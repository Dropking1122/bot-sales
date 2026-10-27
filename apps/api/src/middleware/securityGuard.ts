import { Request, Response, NextFunction } from 'express';
import { logAudit } from '../utils/audit';
import { logger } from '../config/logger';

// Signatures for common cyber attacks and malicious reconnaissance probes
const PROBE_SCANNER_REGEX = /\.(env|git|svn|hg|bzr|ds_store|aws|ssh|dockerignore|sql|bak|old|swp)$|(?:\/|^)(wp-admin|wp-login|xmlrpc|phpmyadmin|pma|actuator|boaform|cgi-bin|solr|telescope|webfig|HNAP1|eval-stdin\.php|setup\.php|dump\.sql|backup\.sql|database\.sql)/i;

const PATH_TRAVERSAL_REGEX = /(?:\.\.[/\\])+|(?:%2e%2e(?:%2f|%5c|\/|\\))+|(?:etc\/passwd|etc\/shadow|boot\.ini|win\.ini|windows\/system32)/i;

const SQL_INJECTION_REGEX = /\b(union(?:\s+all)?\s+select|waitfor\s+delay|sleep\(\s*\d+\s*\)|benchmark\s*\(|into\s+(?:outfile|dumpfile)|load_file\s*\()\b|\b(drop|alter|truncate)\s+table\b|\bexec(?:\s+xp_|\s+sp_)\b/i;

const COMMAND_INJECTION_REGEX = /\$\{jndi:(?:ldap|rmi|dns|nis):|;\s*(?:cat\s+\/|wget\s+https?:\/\/|curl\s+https?:\/\/|nc\s+-[el]|powershell\b|bash\s+-i)/i;

const XSS_REGEX = /<script[\s\S]*?>[\s\S]*?<\/script>|javascript:\s*[a-z0-9_]|<[^>]+(?:onload|onerror|onclick|onmouseover|eval)\s*=/i;

// Fields permitted to contain rich text (exempted from strict injection checks)
const EXEMPT_FIELDS = new Set(['ai_system_prompt', 'bot_greeting', 'bot_dealer_address', 'notes', 'internalNotes']);

function inspectString(val: string, keyName?: string): { isMalicious: boolean; type?: string; sample?: string } {
  if (typeof val !== 'string' || !val.trim()) {
    return { isMalicious: false };
  }

  // Skip exempt fields for SQL/XSS (e.g. system prompts or address)
  const isExempt = keyName && EXEMPT_FIELDS.has(keyName);

  if (PATH_TRAVERSAL_REGEX.test(val)) {
    return { isMalicious: true, type: 'PATH_TRAVERSAL', sample: val.substring(0, 120) };
  }

  if (COMMAND_INJECTION_REGEX.test(val)) {
    return { isMalicious: true, type: 'COMMAND_INJECTION', sample: val.substring(0, 120) };
  }

  if (!isExempt) {
    if (SQL_INJECTION_REGEX.test(val)) {
      return { isMalicious: true, type: 'SQL_INJECTION', sample: val.substring(0, 120) };
    }
    if (XSS_REGEX.test(val)) {
      return { isMalicious: true, type: 'XSS_ATTACK', sample: val.substring(0, 120) };
    }
  }

  return { isMalicious: false };
}

function inspectObject(obj: any, parentKey?: string): { isMalicious: boolean; type?: string; sample?: string } {
  if (!obj || typeof obj !== 'object') return { isMalicious: false };

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const check = inspectString(value, key);
      if (check.isMalicious) return check;
    } else if (typeof value === 'object' && value !== null) {
      const check = inspectObject(value, key);
      if (check.isMalicious) return check;
    }
  }

  return { isMalicious: false };
}

// In-memory rate limiting and auto-jail for repeat malicious IPs
interface IpRecord {
  violations: number;
  lastViolation: number;
  bannedUntil?: number;
}
const ipJailMap = new Map<string, IpRecord>();

// Clean up jail map every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of ipJailMap.entries()) {
    if (rec.bannedUntil && rec.bannedUntil < now) {
      ipJailMap.delete(ip);
    } else if (!rec.bannedUntil && now - rec.lastViolation > 60 * 60 * 1000) {
      ipJailMap.delete(ip);
    }
  }
}, 30 * 60 * 1000);

function registerViolation(ip: string): boolean {
  const now = Date.now();
  let rec = ipJailMap.get(ip);
  if (!rec) {
    rec = { violations: 1, lastViolation: now };
    ipJailMap.set(ip, rec);
    return false;
  }

  // If already banned
  if (rec.bannedUntil && rec.bannedUntil > now) {
    return true;
  }

  // Count violations within 10-minute window
  if (now - rec.lastViolation < 10 * 60 * 1000) {
    rec.violations += 1;
  } else {
    rec.violations = 1;
  }
  rec.lastViolation = now;

  // If >= 4 violations, jail for 24 hours
  if (rec.violations >= 4) {
    rec.bannedUntil = now + 24 * 60 * 60 * 1000;
    logger.warn({ ip, violations: rec.violations }, 'IP has been automatically BANNED for 24h by SecurityGuard Jail');
    return true;
  }

  return false;
}

export function securityGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || '';
    const now = Date.now();

    // Check if IP is currently in jail
    const jailRec = ipJailMap.get(rawIp);
    if (jailRec && jailRec.bannedUntil && jailRec.bannedUntil > now) {
      return res.status(403).json({
        success: false,
        message: 'Akses diblokir permanen sementara: Alamat IP Anda masuk daftar pencekalan keamanan karena aktivitas mencurigakan berulang.'
      });
    }

    const rawUrl = req.originalUrl || req.url || '';
    let decodedUrl = rawUrl;
    try {
      decodedUrl = decodeURIComponent(rawUrl);
    } catch {
      // Decode error could indicate malformed hex payload
    }

    // 1. Check for probe scanner paths
    if (PROBE_SCANNER_REGEX.test(decodedUrl)) {
      const isBanned = registerViolation(rawIp);
      logger.warn({ ip: rawIp, url: rawUrl }, 'Blocked probe scanner path');

      logAudit(req, isBanned ? 'IP_BANNED' : 'ATTACK_BLOCKED', 'SECURITY_ALERT', null, {
        attackType: 'PROBE_SCANNER',
        path: rawUrl,
        method: req.method,
        severity: isBanned ? 'CRITICAL' : 'MEDIUM',
        userAgent: req.headers['user-agent'] || '-'
      }).catch(() => {});

      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Permintaan mencurigakan terdeteksi dan telah diblokir.'
      });
    }

    // 2. Check URL for Path Traversal or Injection
    const urlCheck = inspectString(decodedUrl);
    if (urlCheck.isMalicious) {
      const isBanned = registerViolation(rawIp);
      logger.warn({ ip: rawIp, url: rawUrl, type: urlCheck.type }, 'Blocked malicious URL attack');

      logAudit(req, isBanned ? 'IP_BANNED' : 'ATTACK_BLOCKED', 'SECURITY_ALERT', null, {
        attackType: urlCheck.type,
        path: rawUrl,
        method: req.method,
        severity: isBanned ? 'CRITICAL' : 'HIGH',
        sample: urlCheck.sample,
        userAgent: req.headers['user-agent'] || '-'
      }).catch(() => {});

      return res.status(403).json({
        success: false,
        message: `Akses ditolak: Upaya serangan ${urlCheck.type} terdeteksi dan telah diblokir.`
      });
    }

    // 3. Inspect Query Parameters
    if (req.query && typeof req.query === 'object') {
      const queryCheck = inspectObject(req.query);
      if (queryCheck.isMalicious) {
        const isBanned = registerViolation(rawIp);
        logger.warn({ ip: rawIp, path: rawUrl, type: queryCheck.type }, 'Blocked malicious query parameter');

        logAudit(req, isBanned ? 'IP_BANNED' : 'ATTACK_BLOCKED', 'SECURITY_ALERT', null, {
          attackType: queryCheck.type,
          path: rawUrl,
          method: req.method,
          severity: isBanned ? 'CRITICAL' : 'HIGH',
          sample: queryCheck.sample,
          userAgent: req.headers['user-agent'] || '-'
        }).catch(() => {});

        return res.status(403).json({
          success: false,
          message: `Akses ditolak: Upaya serangan ${queryCheck.type} terdeteksi dan telah diblokir.`
        });
      }
    }

    // 4. Inspect Request Body (if present)
    if (req.body && typeof req.body === 'object') {
      const bodyCheck = inspectObject(req.body);
      if (bodyCheck.isMalicious) {
        const isBanned = registerViolation(rawIp);
        logger.warn({ ip: rawIp, path: rawUrl, type: bodyCheck.type }, 'Blocked malicious payload in body');

        logAudit(req, isBanned ? 'IP_BANNED' : 'ATTACK_BLOCKED', 'SECURITY_ALERT', null, {
          attackType: bodyCheck.type,
          path: rawUrl,
          method: req.method,
          severity: isBanned ? 'CRITICAL' : 'HIGH',
          sample: bodyCheck.sample,
          userAgent: req.headers['user-agent'] || '-'
        }).catch(() => {});

        return res.status(403).json({
          success: false,
          message: `Akses ditolak: Payload berbahaya (${bodyCheck.type}) terdeteksi dan telah diblokir.`
        });
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

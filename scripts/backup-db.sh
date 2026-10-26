#!/bin/bash
set -euo pipefail

BACKUP_DIR="/root/backups/bot-sales"
LOG_FILE="/var/log/bot-sales-backup.log"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/bot_sales_db_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting automated database backup for bot_sales_db..." >> "${LOG_FILE}"

if sudo -u postgres pg_dump bot_sales_db | gzip > "${BACKUP_FILE}"; then
    SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Backup SUCCESS: ${BACKUP_FILE} (Size: ${SIZE})" >> "${LOG_FILE}"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Backup FAILED!" >> "${LOG_FILE}"
    exit 1
fi

# Clean backups older than 7 days
find "${BACKUP_DIR}" -type f -name "bot_sales_db_*.sql.gz" -mtime +7 -exec rm -f {} \;
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaned backups older than 7 days." >> "${LOG_FILE}"

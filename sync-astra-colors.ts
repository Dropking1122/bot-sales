import { prisma } from './apps/api/src/config/db';
import fs from 'fs';
import path from 'path';

const SLUG_MAPPING: Record<string, string> = {
  'HND-BEAT-2026': 'beat',
  'HND-BEAT-STREET-2026': 'beat-street',
  'HND-SCOOPY-2026': 'scoopy',
  'HND-GENIO-2026': 'genio',
  'HND-VARIO-125-2026': 'vario-125',
  'HND-VARIO-160-2026': 'vario-evo-160',
  'HND-STYLO-160-2026': 'stylo-160',
  'HND-PCX-160-2026': 'pcx',
  'HND-ADV-160-2026': 'adv-160',
  'HND-FORZA-2026': 'forza',
  'HND-CB150-VERZA-2026': 'cb-150-verza',
  'HND-SONIC-150-2026': 'sonic-150-r',
  'HND-CB150R-2026': 'cb-150-r',
  'HND-CB150X-2026': 'cb-150-x',
  'HND-CRF150L-2026': 'crf-150-l',
  'HND-CBR150R-2026': 'cbr-150-r',
  'HND-REVO-X-2026': 'revo-x',
  'HND-SUPRA-X-2026': 'supra-x-125-fi',
  'HND-SUPRA-GTR-2026': 'supra-gtr-150',
  'HND-ICON-E-2026': 'icone',
  'HND-EM1-E-2026': 'em1e'
};

async function downloadFile(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destPath, buffer);
    return true;
  } catch (err) {
    console.error(`Failed to download ${url}:`, err);
    return false;
  }
}

function sanitizeColorTitle(raw: string, motorName: string): string {
  // Astra Honda titles often look like: "Deluxe Matte Brown BeAT Deluxe Smart Key" or "Sporty Red Scoopy Sporty"
  let clean = raw.trim();
  // Strip trailing model repetitions if any
  return clean;
}

async function syncAstraHonda() {
  console.log('=== STARTING SYNC FROM OFFICIAL ASTRA HONDA ===');
  const uploadDir = path.resolve('/root/bot-sales/storage/uploads/motorcycles');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const motors = await prisma.motorcycle.findMany({
    where: { isActive: true }
  });

  for (const m of motors) {
    const slug = SLUG_MAPPING[m.sku];
    if (!slug) {
      console.log(`- Skipping ${m.name} (${m.sku}): No slug mapped`);
      continue;
    }

    console.log(`\nFetching ${m.name} (slug: ${slug})...`);
    try {
      const res = await fetch(`https://www.astra-honda.com/api/v1/product/${slug}`);
      if (!res.ok) {
        console.log(`  Failed API fetch: HTTP ${res.status}`);
        continue;
      }

      const data: any = await res.json();
      const astraColors: Array<{ title: string; image: string }> = data.colors || [];
      if (astraColors.length === 0) {
        console.log(`  No colors found for ${slug}`);
        continue;
      }

      console.log(`  Found ${astraColors.length} color variants on Astra Honda!`);

      const colorNames: string[] = [];
      let sortOrder = 0;

      for (const c of astraColors) {
        const colorTitle = sanitizeColorTitle(c.title, m.name);
        colorNames.push(colorTitle);

        if (!c.image) continue;

        // Clean filename
        const safeSlug = slug.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const safeColor = colorTitle
          .toLowerCase()
          .replace(/[^a-z0-9]/gi, '-')
          .replace(/-+/g, '-')
          .slice(0, 30);
        const filename = `${safeSlug}-${safeColor}.png`;
        const localPath = path.join(uploadDir, filename);
        const webUrl = `/storage/uploads/motorcycles/${filename}`;

        // Download if not exists
        if (!fs.existsSync(localPath)) {
          console.log(`    Downloading ${colorTitle} -> ${filename}...`);
          const ok = await downloadFile(c.image, localPath);
          if (!ok) continue;
        } else {
          console.log(`    File exists: ${filename}`);
        }

        // Check if image record exists in DB
        const existingImg = await prisma.motorcycleImage.findFirst({
          where: {
            motorcycleId: m.id,
            OR: [
              { colorName: colorTitle },
              { url: webUrl }
            ]
          }
        });

        if (existingImg) {
          await prisma.motorcycleImage.update({
            where: { id: existingImg.id },
            data: {
              url: webUrl,
              colorName: colorTitle,
              sortOrder
            }
          });
        } else {
          await prisma.motorcycleImage.create({
            data: {
              motorcycleId: m.id,
              url: webUrl,
              colorName: colorTitle,
              isPrimary: sortOrder === 0,
              sortOrder
            }
          });
        }

        sortOrder++;
      }

      // Update motorcycle.colors array in database
      await prisma.motorcycle.update({
        where: { id: m.id },
        data: {
          colors: colorNames
        }
      });

      console.log(`  ✓ Updated ${m.name} with ${colorNames.length} colors and images.`);
    } catch (err: any) {
      console.error(`  Error syncing ${m.name}:`, err.message);
    }
  }

  console.log('\n=== ASTRA HONDA SYNC COMPLETED ===');
}

syncAstraHonda().catch(console.error);
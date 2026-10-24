import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import https from 'https';

const prisma = new PrismaClient();

const UPLOADS_DIR = path.resolve(__dirname, '../../../../storage/uploads/motorcycles');

interface HondaModel {
  sku: string;
  name: string;
  model: string;
  category: string;
  condition: 'BARU' | 'BEKAS';
  priceOtr: number;
  minDp: number;
  colors: string[];
  description: string;
  imageUrl: string;
}

const HONDA_LINEUP: HondaModel[] = [
  {
    sku: 'HND-BEAT-2026',
    name: 'All New Honda BeAT',
    model: 'BeAT',
    category: 'Matic',
    condition: 'BARU',
    priceOtr: 19380000,
    minDp: 1500000,
    colors: ['Hard Rock Black', 'Funk M Red', 'Jazz White', 'Techno Blue Black'],
    description: 'Skutik terlaris dengan mesin eSP 110cc generasi terbaru, rangka eSAF ringan & lincah, lampu depan LED modern, serta fitur Secure Key Shutter & USB Charger.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/new-thumbnail-beat-1-26062026-055630.png'
  },
  {
    sku: 'HND-BEAT-STREET-2026',
    name: 'All New Honda BeAT Street',
    model: 'BeAT Street',
    category: 'Matic',
    condition: 'BARU',
    priceOtr: 20251000,
    minDp: 1600000,
    colors: ['Street Black', 'Street Silver'],
    description: 'Tampil berkarakter dengan naked handlebar street style, speedometer full digital, mesin eSP 110cc hemat bahan bakar dan rangka eSAF bergaransi 5 tahun.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/new-thumbnail-beat-street-1-26062026-055644.png'
  },
  {
    sku: 'HND-GENIO-2026',
    name: 'New Honda Genio',
    model: 'Genio',
    category: 'Matic',
    condition: 'BARU',
    priceOtr: 20600000,
    minDp: 1600000,
    colors: ['Radiant Black', 'Radiant Red', 'Fabulous Matte Green'],
    description: 'Skutik casual berdesain compact dengan ban tubeless 12 inci, panel meter digital dengan eco indicator, dan kompartemen depan luas ber-power charger.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/thumbnail-genio-new-3-29102025-075221.png'
  },
  {
    sku: 'HND-SCOOPY-2026',
    name: 'New Honda Scoopy',
    model: 'Scoopy',
    category: 'Matic',
    condition: 'BARU',
    priceOtr: 23376000,
    minDp: 2000000,
    colors: ['Fashion Blue', 'Fashion Brown', 'Prestige Black', 'Stylish Green'],
    description: 'Ikon skutik retro modern bergaya unik dengan LED projector headlight, Honda Smart Key System, panel meter kombinasi LCD, dan bagasi besar 15.4 liter.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/product-thumbnail-400x300-copy-1-13112025-030828.png'
  },
  {
    sku: 'HND-VARIO-125-2026',
    name: 'New Honda Vario 125',
    model: 'Vario 125',
    category: 'Matic',
    condition: 'BARU',
    priceOtr: 24810000,
    minDp: 2200000,
    colors: ['Advance Matte Black', 'Advance Matte Blue', 'Sporty Red'],
    description: 'Skutik sporty bermesin 125cc liquid cooled dengan eSP, full digital panel meter, Honda Smart Key System, velg agresif, dan USB power charger type A.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/sideview-advance-blue-400x300pxl-copy-1-07042026-080202.png'
  },
  {
    sku: 'HND-VARIO-160-2026',
    name: 'All New Honda Vario 160',
    model: 'Vario 160',
    category: 'Matic',
    condition: 'BARU',
    priceOtr: 28525000,
    minDp: 2500000,
    colors: ['Grande Matte White', 'Grande Matte Black', 'Active Matte Red'],
    description: 'Skutik sport berkapasitas 160cc 4 katup eSP+ dengan pendingin cairan, performa bertenaga, sistem pengereman cakram ganda, dan ban lebar untuk handling mantap.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/product-thumbnail-400x300px-7-24062026-031501.png'
  },
  {
    sku: 'HND-STYLO-160-2026',
    name: 'New Honda Stylo 160',
    model: 'Stylo 160',
    category: 'Matic',
    condition: 'BARU',
    priceOtr: 29695000,
    minDp: 2600000,
    colors: ['Royal Green', 'Royal Matte White', 'Royal Matte Black', 'Glam Red'],
    description: 'New Retro Modern Classic Scooter bermesin 160cc 4-katup eSP+, desain elegan mewah ala Eropa, lampu serba LED, Smart Key, dan tata letak ergonomis premium.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/stylo-royal-violet-400x300pxl-1-23092026-024521.png'
  },
  {
    sku: 'HND-PCX-160-2026',
    name: 'All New Honda PCX 160',
    model: 'PCX 160',
    category: 'Matic Maxi',
    condition: 'BARU',
    priceOtr: 35000000,
    minDp: 3500000,
    colors: ['Magnificent Red', 'Royal Matte Blue', 'Wonderful White', 'Brilliant Black'],
    description: 'Ultimate Luxury Maxi Scooter 160cc eSP+, dilengkapi Honda Selectable Torque Control (HSTC), bagasi ekstra lega 30L, tangki bensin 8.1L, dan Smart Key System.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/product-thumbnail-400x300-4-11022026-041017.png'
  },
  {
    sku: 'HND-ADV-160-2026',
    name: 'New Honda ADV 160',
    model: 'ADV 160',
    category: 'Matic Adventure',
    condition: 'BARU',
    priceOtr: 37890000,
    minDp: 3800000,
    colors: ['Dynamic Red', 'Dynamic Black', 'Tough Matte Brown', 'Tough Matte White'],
    description: 'Penjelajah tangguh berkarakter SUV matic bermesin 160cc eSP+, adjustable windscreen 2 tingkat, suspensi subtank belakang, dan ban tapak dual purpose kokoh.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/product-thumbnail-400x300px-1-08092025-030705.png'
  },
  {
    sku: 'HND-FORZA-2026',
    name: 'Honda Forza 250',
    model: 'Forza 250',
    category: 'Matic Maxi',
    condition: 'BARU',
    priceOtr: 98950000,
    minDp: 12000000,
    colors: ['Candy Syrah Red', 'Matte Gunpowder Black Metallic'],
    description: 'Flagship Premium Skutik 250cc SOHC eSP+ berpendingin cairan, electric adjustable windscreen, HSTC, Emergency Stop Signal (ESS), dan bagasi muat 2 helm full-face.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/product-thumbnail-forza-400x300rev-1-16072025-031300.png'
  },
  {
    sku: 'HND-CB150-VERZA-2026',
    name: 'Honda CB150 Verza',
    model: 'CB150 Verza',
    category: 'Sport',
    condition: 'BARU',
    priceOtr: 24460000,
    minDp: 2200000,
    colors: ['Macho Matte Black', 'Bold Red'],
    description: 'Motor sport komuter tangguh dan irit dengan mesin 150cc SOHC 5-kecepatan berteknologi PGM-FI yang responsif, tangguh untuk penggunaan harian dan niaga.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/verza-product-thumbnail-400x300px-2-24042025-082912.png'
  },
  {
    sku: 'HND-SONIC-150-2026',
    name: 'Honda Sonic 150R',
    model: 'Sonic 150R',
    category: 'Sport',
    condition: 'BARU',
    priceOtr: 28965000,
    minDp: 2600000,
    colors: ['Activo Black', 'Energetic Red', 'Honda Racing Red'],
    description: 'Underbone sport agresif ber DNA balap dengan mesin 150cc DOHC 4-katup 6-kecepatan berkarakter putaran tinggi dan akselerasi responsif.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/sonic-150r-550x413px-r1-22112024-041432.png'
  },
  {
    sku: 'HND-CB150R-2026',
    name: 'All New Honda CB150R Streetfire',
    model: 'CB150R Streetfire',
    category: 'Sport',
    condition: 'BARU',
    priceOtr: 34880000,
    minDp: 3200000,
    colors: ['Machom Matte Black', 'Armored Matte Grey', 'Fury Matte Red'],
    description: 'Naked bike berotot dengan suspensi Inverted Front Fork Showa 37mm, tapered handlebar, tangki bensin berdesain tegas, dan mesin 150cc DOHC 6-percepatan.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/cb1504-550x413px-r1-22112024-041458.png'
  },
  {
    sku: 'HND-CB150X-2026',
    name: 'New Honda CB150X',
    model: 'CB150X',
    category: 'Sport Adventure',
    condition: 'BARU',
    priceOtr: 35220000,
    minDp: 3300000,
    colors: ['Mandala Red', 'Amazon Matte Green', 'Volcano Matte Black'],
    description: 'Pelopor motor sport adventure touring 150cc pertama di Indonesia dengan high windscreen, duck fender khas adventure, ground clearance tinggi 181mm, dan undercowl kokoh.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/fa-ahm-sport-mid-thumbnail-550x413px-21112024-100503.png'
  },
  {
    sku: 'HND-CRF150L-2026',
    name: 'New Honda CRF150L',
    model: 'CRF150L',
    category: 'Sport Adventure',
    condition: 'BARU',
    priceOtr: 38905000,
    minDp: 3800000,
    colors: ['Extreme Red', 'Extreme Black', 'Extreme White', 'Extreme Green'],
    description: 'On/Off Sport motorcycle tangguh di segala medan dengan Inverted Front Suspension Showa terbesar di kelasnya (37mm), ban dual purpose, wavy disc brake, dan velg aluminium.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/revproduct-thumbnail-crf150l-400x300px-28072025-020216.png'
  },
  {
    sku: 'HND-CBR150R-2026',
    name: 'All New Honda CBR150R',
    model: 'CBR150R',
    category: 'Sport',
    condition: 'BARU',
    priceOtr: 39270000,
    minDp: 3900000,
    colors: ['Victory Black Red', 'Dominator Matte Black', 'Honda Tricolor', 'Racing Red'],
    description: 'Full Fairing Supersport sejati dengan Assist/Slipper Clutch mencegah ban belakang selip saat downshift agresif, Inverted Fork Showa SFF-BP, dan desain agresif ala CBR1000RR-R.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/thumbnail-cbr150r-550x413px-tr-new-2-21112024-100742.png'
  },
  {
    sku: 'HND-REVO-X-2026',
    name: 'Honda Revo X',
    model: 'Revo X',
    category: 'Cub',
    condition: 'BARU',
    priceOtr: 18085000,
    minDp: 1500000,
    colors: ['Attractive Red', 'Quantum Black'],
    description: 'Motor bebek tangguh serbaguna terbukti handal, bertenaga mesin 110cc PGM-FI hemat bahan bakar hingga 59.8 km/liter, minim perawatan dan cocok untuk mobilitas tinggi.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/thmbnail-product-2-24012022-110536.png'
  },
  {
    sku: 'HND-SUPRA-X-2026',
    name: 'New Honda Supra X 125 FI',
    model: 'Supra X 125',
    category: 'Cub',
    condition: 'BARU',
    priceOtr: 21500000,
    minDp: 1800000,
    colors: ['Golden Matte Black', 'Energetic Red'],
    description: 'Rajanya motor bebek bermesin 125cc 4 langkah SOHC PGM-FI legendaris yang nyaman, dilengkapi power charger praktis di dalam bagasi dan rem cakram ganda depan-belakang.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/thumbnail-new-supra-x-5-04032022-102907.png'
  },
  {
    sku: 'HND-SUPRA-GTR-2026',
    name: 'New Honda Supra GTR 150',
    model: 'Supra GTR 150',
    category: 'Cub',
    condition: 'BARU',
    priceOtr: 27390000,
    minDp: 2500000,
    colors: ['Spartan Red', 'Gun Black'],
    description: 'Grand Touring Cub bermesin 150cc DOHC 4 katup 6 kecepatan, performa touring bertenaga dengan posisi berkendara tegak yang nyaman untuk perjalanan jauh antar kota.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/supra-gtr-150-4-27052021-092133.png'
  },
  {
    sku: 'HND-ICON-E-2026',
    name: 'Honda ICON e:',
    model: 'ICON e:',
    category: 'Listrik',
    condition: 'BARU',
    priceOtr: 28000000,
    minDp: 2500000,
    colors: ['Iconic Mint', 'Iconic Orange', 'Iconic Red', 'Iconic White'],
    description: 'Sepeda motor listrik kompak modern yang fleksibel untuk mobilitas perkotaan harian, pengisian daya langsung (direct charge), layar digital instrumen, dan ramah lingkungan.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/ahm-light-sideview-blue-4-08102024-032201-09102024-051105.png'
  },
  {
    sku: 'HND-EM1-E-2026',
    name: 'Honda EM1 e:',
    model: 'EM1 e:',
    category: 'Listrik',
    condition: 'BARU',
    priceOtr: 40000000,
    minDp: 3500000,
    colors: ['Innovative White', 'Intelligent Matte Black', 'Smart Red'],
    description: 'Motor listrik premium pertama Honda di Indonesia dengan baterai Honda Mobile Power Pack e: (swappable), teknologi berkualitas tinggi standar global Honda, dan bebas emisi.',
    imageUrl: 'https://imagewebsite.astra-honda.com/uploads/product/thumbnail/em1-silver-samping-400x300-tr-21122023-045018.png'
  }
];

function downloadImage(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        console.warn(`Failed to download ${url}: status ${res.statusCode}`);
        file.close();
        fs.unlink(destPath, () => {});
        return resolve(false);
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    }).on('error', (err) => {
      console.warn(`Error downloading ${url}:`, err.message);
      file.close();
      fs.unlink(destPath, () => {});
      resolve(false);
    });
  });
}

async function main() {
  console.log('🏁 Starting Honda Official Lineup & Image Importer...');
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  // 1. Ensure Honda brand exists
  let hondaBrand = await prisma.brand.findUnique({ where: { name: 'Honda' } });
  if (!hondaBrand) {
    hondaBrand = await prisma.brand.create({
      data: {
        name: 'Honda',
        description: 'PT Astra Honda Motor'
      }
    });
    console.log('✓ Created Honda Brand');
  }

  let importedCount = 0;

  for (const item of HONDA_LINEUP) {
    console.log(`Processing [${item.sku}] ${item.name}...`);

    // Download image locally
    const filename = `${item.sku.toLowerCase()}.png`;
    const localFilePath = path.join(UPLOADS_DIR, filename);
    const downloaded = await downloadImage(item.imageUrl, localFilePath);

    const relativeImageUrl = downloaded
      ? `/storage/uploads/motorcycles/${filename}`
      : item.imageUrl;

    // Upsert Motorcycle
    const motorcycle = await prisma.motorcycle.upsert({
      where: { sku: item.sku },
      update: {
        name: item.name,
        brandId: hondaBrand.id,
        model: item.model,
        year: 2026,
        category: item.category,
        condition: item.condition as any,
        priceOtr: item.priceOtr,
        minDp: item.minDp,
        colors: item.colors,
        description: item.description,
        stockStatus: 'TERSEDIA' as any,
        availableTenors: [11, 17, 23, 29, 35],
        isActive: true
      },
      create: {
        sku: item.sku,
        name: item.name,
        brandId: hondaBrand.id,
        model: item.model,
        year: 2026,
        category: item.category,
        condition: item.condition as any,
        priceOtr: item.priceOtr,
        minDp: item.minDp,
        colors: item.colors,
        description: item.description,
        stockStatus: 'TERSEDIA' as any,
        availableTenors: [11, 17, 23, 29, 35],
        isActive: true
      }
    });

    // Delete existing images for this motorcycle and create fresh primary image
    await prisma.motorcycleImage.deleteMany({
      where: { motorcycleId: motorcycle.id }
    });

    await prisma.motorcycleImage.create({
      data: {
        motorcycleId: motorcycle.id,
        url: relativeImageUrl,
        isPrimary: true,
        sortOrder: 0
      }
    });

    importedCount++;
    console.log(`✓ [${importedCount}/${HONDA_LINEUP.length}] ${item.name} (${item.category} - Rp ${item.priceOtr.toLocaleString('id-ID')}) saved with photo!`);
  }

  console.log(`\n🎉 Successfully imported ${importedCount} official Honda motorcycles with photos!`);
}

main()
  .catch((e) => {
    console.error('Fatal import error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

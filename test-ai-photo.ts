import { prisma } from './apps/api/src/config/db';
import { waManager } from './apps/api/src/modules/whatsapp/whatsapp.service';
import fs from 'fs';

async function main() {
  console.log('--- Testing Motorcycle Photo Resolution ---');

  // Test 1: Resolve motorcycle from user text
  const userQuery = 'Bisa kirim foto beat street dong?';
  const foundMotor = await (waManager as any).findMotorcycleFromText(userQuery);
  console.log('Matched motor:', foundMotor ? foundMotor.name : 'NONE');

  if (foundMotor) {
    const photo = (waManager as any).getMotorcyclePhoto(foundMotor);
    console.log('Photo resolved:', photo);
    console.log('File exists on disk:', photo.mediaPath ? fs.existsSync(photo.mediaPath) : false);
  }

  // Test 2: Resolve bot response when asking for a photo
  const dummyContact = {
    id: 'test-contact-photo',
    name: 'Andi',
    phone: '62899112233',
    phoneNormalized: '62899112233',
    interestedMotorcycle: null
  };

  const response = await (waManager as any).resolveBotResponse('Boleh lihat gambar scoopy kak?', dummyContact);
  console.log('\nResponse structure:', typeof response);
  if (typeof response === 'object') {
    console.log('Has mediaPath:', Boolean(response.mediaPath));
    console.log('mediaPath path:', response.mediaPath);
    console.log('Text preview:\n', response.text.slice(0, 200) + '...');
  } else {
    console.log('Plain text:\n', response);
  }

  console.log('\nPhoto test completed.');
}

main()
  .catch((e) => {
    console.error('Test error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

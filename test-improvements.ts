import { prisma } from './apps/api/src/config/db';
import { askSalesAiAgent } from './apps/api/src/modules/ai/ai.service';
import { waManager } from './apps/api/src/modules/whatsapp/whatsapp.service';

async function test() {
  console.log('=== TEST 1: Greeting & Persona Name ===');
  // Upsert assistant name to Maya
  await prisma.botSetting.upsert({
    where: { key: 'ai_assistant_name' },
    update: { value: 'Maya' },
    create: { key: 'ai_assistant_name', value: 'Maya' }
  });

  const dummyContact = {
    id: 'test-c1',
    name: 'Fajar',
    phone: '62812345678',
    phoneNormalized: '62812345678',
    interestedMotorcycle: 'All New Honda BeAT',
    internalNotes: 'Tanya promo'
  } as any;

  // Test 1A: First message with Islamic Salam
  console.log('\n--- 1A. Salam Test ---');
  const salamReply = await askSalesAiAgent('Assalamualaikum, mau tanya motor Honda', dummyContact, []);
  console.log('User: Assalamualaikum, mau tanya motor Honda');
  console.log('AI Reply:\n', salamReply);

  // Test 1B: Ongoing conversation (follow-up question) - should not repeat "Halo Kak Fajar"
  console.log('\n--- 1B. Ongoing Conversation Follow-up (No Greeting Loop) ---');
  const history = [
    { senderType: 'CUSTOMER', content: 'Assalamualaikum, mau tanya motor Honda' },
    { senderType: 'BOT', content: 'Waalaikumsalam Kak Fajar! Selamat datang di dealer resmi Honda. Ada tipe motor tertentu yang sedang dicari?' }
  ];
  const followUpReply = await askSalesAiAgent('Kalau BeAT OTR-nya berapa ya dan DP minimnya berapa?', dummyContact, history);
  console.log('User: Kalau BeAT OTR-nya berapa ya dan DP minimnya berapa?');
  console.log('AI Reply:\n', followUpReply);

  // Test 2: Color Image Matching
  console.log('\n=== TEST 2: Color Variant Photo Resolution ===');
  const beat = await (waManager as any).findMotorcycleFromText('beat');
  if (beat) {
    // Attach a dummy color image to test color matching
    const dummyColorImg = await prisma.motorcycleImage.create({
      data: {
        motorcycleId: beat.id,
        url: '/storage/uploads/motorcycles/hnd-beat-street-2026.png',
        colorName: 'Hard Rock Black',
        isPrimary: false,
        sortOrder: 2
      }
    });

    const refreshedBeat = await prisma.motorcycle.findUnique({
      where: { id: beat.id },
      include: { images: true }
    });

    const blackPhoto = (waManager as any).getMotorcyclePhoto(refreshedBeat, 'hitam');
    console.log('Requested color: "hitam"');
    console.log('Resolved photo:', blackPhoto);

    // Clean up dummy image
    await prisma.motorcycleImage.delete({ where: { id: dummyColorImg.id } });
  }

  console.log('\nAll tests completed.');
}

test().catch(console.error);
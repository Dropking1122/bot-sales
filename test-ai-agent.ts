import { getAiConfig, testAiAgent, askSalesAiAgent } from './apps/api/src/modules/ai/ai.service';
import { prisma } from './apps/api/src/config/db';

async function main() {
  console.log('--- 1. Testing getAiConfig with FAQ ---');
  const cfg = await getAiConfig();
  console.log('AI Enabled:', cfg.enabled);
  console.log('Model:', cfg.model);
  console.log('FAQ loaded length:', cfg.customFaq.length);

  console.log('\n--- 2. Testing Special FAQ Question (KTP Luar Daerah & Garansi Rangka) ---');
  const sampleContact = {
    id: 'sample-contact-id',
    name: 'Pak Hendro',
    phoneNormalized: '6281399887766',
    interestedMotorcycle: 'PCX 160',
    internalNotes: 'Customer KTP Jawa Tengah, domisili kerja di Cikarang. Cari DP ringan.'
  };

  const history = [
    { senderType: 'CUSTOMER', content: 'Halo mbak, saya mau tanya kalau KTP saya daerah luar kota bisa ambil motor kredit gak ya?' },
    { senderType: 'BOT', content: 'Bisa dibantu Kak Hendro! Kami melayani pembelian KTP luar daerah selama domisili atau kerja di sini.' },
    { senderType: 'CUSTOMER', content: 'Terus kalau rangka motornya itu garansi berapa tahun ya mbak?' }
  ];

  const aiReply = await askSalesAiAgent(
    'Terus kalau rangka motornya itu garansi berapa tahun ya mbak?',
    sampleContact,
    history
  );

  console.log('AI Reply to Special FAQ Question:\n', aiReply);
  console.log('\nTest finished.');
}

main()
  .catch((e) => {
    console.error('Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

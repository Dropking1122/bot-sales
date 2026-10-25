import { getAiConfig, testAiAgent, askSalesAiAgent } from './apps/api/src/modules/ai/ai.service';
import { prisma } from './apps/api/src/config/db';

async function main() {
  console.log('--- 1. Testing getAiConfig ---');
  const cfg = await getAiConfig();
  console.log('AI Enabled:', cfg.enabled);
  console.log('Provider URL:', cfg.providerUrl);
  console.log('Model:', cfg.model);
  console.log('Has API Key:', Boolean(cfg.apiKey));

  console.log('\n--- 2. Testing testAiAgent ---');
  const testRes = await testAiAgent();
  console.log('testAiAgent result:', testRes);

  console.log('\n--- 3. Testing askSalesAiAgent ---');
  const sampleContact = {
    name: 'Rudi Hermawan',
    phoneNormalized: '6281234567890',
    interestedMotorcycle: 'BeAT'
  };
  const history = [
    { senderType: 'CUSTOMER', content: 'Halo kak mau nanya-nanya motor' },
    { senderType: 'BOT', content: 'Halo Kak Rudi! Mau tanya motor apa nih?' }
  ];

  const aiReply = await askSalesAiAgent(
    'Kalau Honda Beat yang warna hitam harganya berapa ya dan bisa kredit DP berapa?',
    sampleContact,
    history
  );
  console.log('Customer: Kalau Honda Beat yang warna hitam harganya berapa ya dan bisa kredit DP berapa?');
  console.log('AI Reply:\n', aiReply);

  console.log('\nAll AI Agent tests completed successfully.');
}

main()
  .catch((e) => {
    console.error('Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

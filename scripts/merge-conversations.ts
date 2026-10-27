import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function mergeAndDeduplicate() {
  console.log('=== Starting Database Merge & Cleanup ===');

  // Step 1: Detect and merge duplicate contacts based on phoneNormalized or LID mapping
  // We know LID 47915192082487 belongs to phone 6288214672165 (revd store)
  const contacts = await prisma.contact.findMany({
    include: {
      conversations: {
        include: { messages: true }
      },
      leads: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${contacts.length} total contact records.`);

  // Find contacts where internalNotes has LID that matches another contact's phone
  for (const c of contacts) {
    if (c.phone === '47915192082487' || c.phoneNormalized === '47915192082487') {
      const realContact = await prisma.contact.findFirst({
        where: { phoneNormalized: '6288214672165' }
      });

      if (realContact && realContact.id !== c.id) {
        console.log(`Merging LID contact ${c.id} into real contact ${realContact.id} (6288214672165)...`);

        // Move conversations
        await prisma.conversation.updateMany({
          where: { contactId: c.id },
          data: { contactId: realContact.id }
        });

        // Move leads
        await prisma.lead.updateMany({
          where: { contactId: c.id },
          data: { contactId: realContact.id, phone: realContact.phoneNormalized }
        });

        // Delete the redundant LID contact
        await prisma.contact.delete({ where: { id: c.id } });
        console.log(`Deleted redundant contact ${c.id}`);
      }
    }
  }

  // Step 2: Merge split conversations for every contact so there is strictly 1 conversation per contact
  const allContacts = await prisma.contact.findMany({
    include: {
      conversations: {
        orderBy: { createdAt: 'asc' },
        include: { messages: true }
      }
    }
  });

  for (const contact of allContacts) {
    if (contact.conversations.length > 1) {
      console.log(`Contact ${contact.name} (${contact.phoneNormalized}) has ${contact.conversations.length} split conversations. Merging...`);

      // Keep the primary conversation (the first or most active one)
      const primaryConv = contact.conversations[0];
      const otherConvs = contact.conversations.slice(1);

      for (const other of otherConvs) {
        console.log(`Moving ${other.messages.length} messages from conv ${other.id} to primary conv ${primaryConv.id}...`);
        await prisma.message.updateMany({
          where: { conversationId: other.id },
          data: { conversationId: primaryConv.id }
        });

        // Delete the duplicate conversation
        await prisma.conversation.delete({
          where: { id: other.id }
        });
      }

      // Update primary conversation lastMessageAt
      const latestMsg = await prisma.message.findFirst({
        where: { conversationId: primaryConv.id },
        orderBy: { createdAt: 'desc' }
      });

      await prisma.conversation.update({
        where: { id: primaryConv.id },
        data: {
          lastMessageAt: latestMsg ? latestMsg.createdAt : primaryConv.lastMessageAt,
          status: 'ACTIVE'
        }
      });
      console.log(`✅ Merged all messages for contact ${contact.name} into conversation ${primaryConv.id}`);
    }
  }

  // Step 3: Deduplicate Leads so there is strictly 1 active/primary Lead per contact
  for (const contact of allContacts) {
    const leads = await prisma.lead.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: 'desc' }
    });

    if (leads.length > 1) {
      console.log(`Contact ${contact.name} has ${leads.length} leads. Consolidating into 1 primary lead...`);
      const primaryLead = leads[0];
      const otherLeads = leads.slice(1);

      // Combine notes
      const extraNotes = otherLeads
        .map((l) => l.notes)
        .filter(Boolean)
        .join(' | ');

      const combinedNotes = primaryLead.notes
        ? (extraNotes ? `${primaryLead.notes} | ${extraNotes}` : primaryLead.notes)
        : extraNotes;

      await prisma.lead.update({
        where: { id: primaryLead.id },
        data: {
          phone: contact.phoneNormalized || primaryLead.phone,
          notes: combinedNotes ? combinedNotes.slice(0, 1000) : null
        }
      });

      // Remove the redundant duplicate leads
      for (const other of otherLeads) {
        await prisma.lead.delete({ where: { id: other.id } });
      }
      console.log(`✅ Kept lead ${primaryLead.id} and removed ${otherLeads.length} redundant leads.`);
    }
  }

  console.log('=== Database Merge & Cleanup Completed Successfully ===');
  await prisma.$disconnect();
}

mergeAndDeduplicate().catch((e) => {
  console.error('Error during migration:', e);
  process.exit(1);
});

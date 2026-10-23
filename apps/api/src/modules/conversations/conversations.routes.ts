import { Router } from 'express';
import {
  listConversations,
  getConversationMessages,
  sendManualReply,
  takeoverBot,
  resumeBot
} from './conversations.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, listConversations);
router.get('/:id/messages', authenticate, getConversationMessages);
router.post('/:id/messages', authenticate, sendManualReply);
router.post('/:id/takeover', authenticate, takeoverBot);
router.post('/:id/resume-bot', authenticate, resumeBot);

export const conversationsRouter = router;

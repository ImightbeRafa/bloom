// ─── Bloom — server/routes/email.js ─────────────────────────────────────────

import { Router } from 'express';
import { sendSinpe } from '../controllers/emailController.js';

const router = Router();

router.post('/send-sinpe', sendSinpe);

export default router;

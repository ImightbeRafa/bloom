// ─── Bloom — server/routes/tilopay.js ───────────────────────────────────────

import { Router } from 'express';
import { createPayment, handleWebhook, confirmPayment, processConfirm } from '../controllers/tilopayController.js';

const router = Router();

router.post('/create-payment', createPayment);
router.post('/webhook',        handleWebhook);
router.get('/confirm',         confirmPayment);
router.post('/confirm',        processConfirm);

export default router;

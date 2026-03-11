// ─── Bloom — api/tilopay/webhook.js ─────────────────────────────────────────
// Vercel serverless function: receives Tilopay payment notifications

import crypto from 'crypto';
import { sendOrderEmail, sendTilopayConfirmationEmail } from '../utils/email.js';
import { sendOrderToBetsyWithRetry } from '../utils/betsy.js';
import { generateEventId, sendMetaEvent } from '../utils/meta.js';

const SUCCESS_STATUSES = ['aprobada', 'approved', 'success', 'paid', 'completed'];
const DECLINE_STATUSES = ['rechazada', 'declined', 'failed', 'canceled', 'cancelled', 'rejected'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  console.log(`[Webhook] Received [${webhookId}]`);

  if (!verifyWebhookSignature(req)) {
    console.error(`[Webhook] Signature verification failed [${webhookId}]`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = req.body;

  const orderId = payload.order || payload.order_id || payload.orderNumber || payload.referencia || payload.reference;
  const transactionId = payload['tilopay-transaction'] || payload.tpt || payload.transaction_id || payload.transaccion_id || payload.id;
  const code   = String(payload.code ?? '');
  const status = String(payload.estado || payload.status || '').toLowerCase();

  console.log(`[Webhook] Order: ${orderId} | Code: ${code} | Status: ${status} | TxID: ${transactionId}`);

  if (!orderId) {
    console.error('[Webhook] No order ID in payload');
    return res.status(400).json({ error: 'Missing order ID' });
  }

  const isApproved = code === '1' || SUCCESS_STATUSES.includes(status);
  const isDeclined = DECLINE_STATUSES.includes(status);

  if (!isApproved) {
    const msg = isDeclined ? 'Payment declined' : `Unknown outcome — code: ${code}, status: ${status}`;
    console.log(`[Webhook] ${msg} for order ${orderId}`);
    return res.status(200).json({ success: false, message: 'Payment not approved' });
  }

  let order = null;

  if (payload.returnData) {
    try {
      order = JSON.parse(Buffer.from(payload.returnData, 'base64').toString('utf-8'));
    } catch (e) {
      console.error('[Webhook] Failed to decode returnData:', e.message);
    }
  }

  if (!order) {
    console.error(`[Webhook] Order ${orderId} — no returnData available`);
    return res.status(200).json({ success: true, message: 'Payment confirmed, but order data unavailable' });
  }

  order.paymentStatus = 'completed';
  order.paymentId     = transactionId;
  order.transactionId = transactionId;
  order.paymentMethod = 'Tilopay';
  order.paidAt        = new Date().toISOString();

  console.log(`[Webhook] Order ${orderId} confirmed — Total: ₡${order.total}`);

  const appUrl = process.env.APP_URL || 'https://bloomcr.shopping';
  const metaEventId = generateEventId('purchase', orderId, transactionId);
  const totalItems = parseInt(order.cantidad) || 1;

  // Do ALL async work BEFORE responding (Vercel terminates after res.json)
  const results = await Promise.allSettled([
    sendOrderEmail(order),
    sendTilopayConfirmationEmail(order),
    sendOrderToBetsyWithRetry({ ...order, transactionId }),
    sendMetaEvent('Purchase', metaEventId, order, req, {
      value: order.total,
      currency: 'CRC',
      content_ids: ['bloom-patch'],
      content_type: 'product',
      num_items: totalItems
    }, `${appUrl}/success.html`)
  ]);

  if (results[0].status === 'rejected') console.error(`[Webhook] Admin email failed for ${orderId}:`, results[0].reason?.message);
  else console.log(`[Webhook] Admin email sent for ${orderId}`);

  if (results[1].status === 'rejected') console.error(`[Webhook] Customer email failed for ${orderId}:`, results[1].reason?.message);
  else console.log(`[Webhook] Customer email sent for ${orderId}`);

  if (results[2].status === 'rejected') console.error(`[Webhook] Betsy sync failed for ${orderId}:`, results[2].reason?.message);
  else console.log(`[Webhook] Betsy synced for ${orderId}`);

  return res.status(200).json({ success: true, orderId, message: 'Payment confirmed' });
}

function verifyWebhookSignature(req) {
  const secret = process.env.TILOPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[Webhook] TILOPAY_WEBHOOK_SECRET not set — skipping verification');
    return true;
  }

  if (req.headers['x-tilopay-secret'] === secret) return true;

  const providedHash = req.headers['hash-tilopay'];
  if (!providedHash) return false;

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const computedHash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(providedHash, 'hex'),
      Buffer.from(computedHash, 'hex')
    );
  } catch {
    return false;
  }
}

// Bloom - api/tilopay/webhook.js
// Receives Tilopay payment notifications and fulfills approved paid orders.

import crypto from 'crypto';
import { sendManualReviewEmail } from '../utils/email.js';
import { processPaidOrder } from '../utils/fulfillment.js';
import { decodeReturnData } from '../utils/order.js';

const SUCCESS_STATUSES = ['aprobada', 'approved', 'success', 'paid', 'completed'];
const DECLINE_STATUSES = ['rechazada', 'declined', 'failed', 'canceled', 'cancelled', 'rejected'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const webhookId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  console.log(`[Webhook] Received [${webhookId}]`);

  if (!verifyWebhookSignature(req)) {
    console.error(`[Webhook] Signature verification failed [${webhookId}]`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = req.body || {};
  const orderId = payload.order || payload.order_id || payload.orderNumber || payload.referencia || payload.reference;
  const transactionId = payload['tilopay-transaction'] || payload.tpt || payload.transaction_id || payload.transaccion_id || payload.id;
  const code = String(payload.code ?? '');
  const status = String(payload.estado || payload.status || '').toLowerCase();

  console.log(`[Webhook] Order: ${orderId || 'missing'} | Code: ${code || 'missing'} | Status: ${status || 'missing'} | TxID: ${transactionId || 'missing'}`);

  if (!orderId) {
    console.error('[Webhook] No order ID in payload');
    return res.status(400).json({ error: 'Missing order ID' });
  }

  const isApproved = code === '1' || SUCCESS_STATUSES.includes(status);
  const isDeclined = DECLINE_STATUSES.includes(status);

  if (!isApproved) {
    const msg = isDeclined ? 'Payment declined' : `Unknown outcome - code: ${code}, status: ${status}`;
    console.log(`[Webhook] ${msg} for order ${orderId}`);
    return res.status(200).json({ success: false, orderId, message: 'Payment not approved' });
  }

  let order;
  try {
    order = decodeReturnData(payload.returnData);
  } catch (err) {
    console.error(`[Webhook] Order ${orderId} requires manual review: ${err.message}`);
    await sendManualReviewEmail({
      orderId,
      transactionId,
      source: 'webhook',
      reason: err.message,
      payload
    }).catch((emailErr) => {
      console.error(`[Webhook] Manual-review email failed for ${orderId}:`, emailErr.message);
    });

    return res.status(200).json({
      success: true,
      orderId,
      status: 'approved_manual_review',
      message: 'Payment confirmed, but order data unavailable or invalid'
    });
  }

  const appUrl = process.env.APP_URL || 'https://bloomcr.shopping';
  const result = await processPaidOrder({
    order,
    transactionId,
    source: 'Webhook',
    req,
    sourceUrl: `${appUrl}/success.html`
  });

  return res.status(200).json({
    success: result.success,
    orderId,
    status: result.success ? 'approved_processed' : 'approved_manual_review',
    channels: result.channels,
    message: result.success ? 'Payment confirmed' : 'Payment confirmed, fulfillment needs review'
  });
}

function verifyWebhookSignature(req) {
  const secret = process.env.TILOPAY_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.ALLOW_UNSIGNED_TILOPAY_WEBHOOKS === 'true') {
      console.warn('[Webhook] Unsigned webhooks allowed by ALLOW_UNSIGNED_TILOPAY_WEBHOOKS=true');
      return true;
    }
    console.error('[Webhook] TILOPAY_WEBHOOK_SECRET is required in production');
    return false;
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

    const provided = Buffer.from(String(providedHash), 'hex');
    const computed = Buffer.from(computedHash, 'hex');
    return provided.length === computed.length && crypto.timingSafeEqual(provided, computed);
  } catch {
    return false;
  }
}

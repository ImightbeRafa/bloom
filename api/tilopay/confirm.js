// ─── Bloom — api/tilopay/confirm.js ─────────────────────────────────────────
// Vercel serverless function: processes order after Tilopay success redirect
// Called by success.html with the returnData echoed from Tilopay's redirect URL

import { sendOrderEmail, sendTilopayConfirmationEmail } from '../utils/email.js';
import { sendOrderToBetsyWithRetry } from '../utils/betsy.js';
import { generateEventId, sendMetaEvent } from '../utils/meta.js';

// In-memory dedup — prevents double sends within the same function instance
const processedOrders = new Set();

export default async function handler(req, res) {
  // GET: legacy polling fallback (kept for backwards compat)
  if (req.method === 'GET') {
    const { orderId } = req.query;
    return res.status(200).json({ status: 'not_found', orderId });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { returnData, transactionId } = req.body;
  if (!returnData) return res.status(400).json({ error: 'Missing returnData' });

  let order;
  try {
    order = JSON.parse(Buffer.from(returnData, 'base64').toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Invalid returnData' });
  }

  const orderId = order.orderId;
  if (!orderId) return res.status(400).json({ error: 'Invalid order data' });

  // Dedup: prevent double sends if success page fires multiple times
  if (processedOrders.has(orderId)) {
    console.log(`[Confirm] Order ${orderId} already processed — skipping`);
    return res.status(200).json({ success: true, orderId, message: 'Already processed' });
  }
  processedOrders.add(orderId);

  order.paymentStatus = 'completed';
  order.paymentId     = transactionId;
  order.transactionId = transactionId;
  order.paymentMethod = 'Tilopay';
  order.paidAt        = new Date().toISOString();

  console.log(`[Confirm] Processing order ${orderId} — Total: ₡${order.total}`);

  const appUrl = process.env.APP_URL || 'https://bloomcr.shopping';
  const metaEventId = generateEventId('purchase', orderId, transactionId);
  const totalItems = parseInt(order.cantidad) || 1;

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

  if (results[0].status === 'rejected') console.error(`[Confirm] Admin email failed for ${orderId}:`, results[0].reason?.message);
  else console.log(`[Confirm] Admin email sent for ${orderId}`);

  if (results[1].status === 'rejected') console.error(`[Confirm] Customer email failed for ${orderId}:`, results[1].reason?.message);
  else console.log(`[Confirm] Customer email sent for ${orderId}`);

  if (results[2].status === 'rejected') console.error(`[Confirm] Betsy failed for ${orderId}:`, results[2].reason?.message);
  else console.log(`[Confirm] Betsy synced for ${orderId}`);

  return res.status(200).json({ success: true, orderId });
}

// Bloom - api/tilopay/confirm.js
// Processes an approved Tilopay success redirect after signed order data is validated.

import { decodeReturnData } from '../utils/order.js';
import { processPaidOrder } from '../utils/fulfillment.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { orderId } = req.query;
    return res.status(200).json({ status: 'not_found', orderId });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { returnData, transactionId, code } = req.body;
  if (!returnData) return res.status(400).json({ error: 'Missing returnData' });

  let order;
  try {
    order = decodeReturnData(returnData);
  } catch (err) {
    console.error('[Confirm] returnData rejected:', err.message);
    return res.status(400).json({ error: err.message });
  }

  const orderId = order.orderId;
  if (!orderId) return res.status(400).json({ error: 'Invalid order data' });

  if (code !== '1') {
    console.warn(`[Confirm] Payment NOT approved for ${orderId} - code: ${code || 'missing'}`);
    return res.status(200).json({ success: false, orderId, message: 'Payment not approved' });
  }

  const appUrl = process.env.APP_URL || 'https://bloomcr.shopping';
  const result = await processPaidOrder({
    order,
    transactionId,
    source: 'Confirm',
    req,
    sourceUrl: `${appUrl}/success.html`
  });

  return res.status(200).json({
    success: result.success,
    orderId,
    metaEventId: result.metaEventId,
    order: {
      orderId,
      cantidad: result.order.cantidad,
      total: result.order.total
    },
    channels: result.channels,
    message: result.success ? 'Payment confirmed' : 'Payment confirmed, fulfillment needs review'
  });
}

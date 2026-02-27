// ─── Bloom — api/tilopay/confirm.js ─────────────────────────────────────────
// Vercel serverless function: polling fallback for payment status

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { orderId } = req.query;
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

  const order = global.pendingOrders?.get(orderId);

  if (!order) {
    // Not in pending = either completed (removed from map) or not found
    return res.status(200).json({ status: 'not_found' });
  }

  return res.status(200).json({
    status: order.paymentStatus || 'pending',
    orderId: order.orderId
  });
}

// ─── Bloom — server/controllers/tilopayController.js ────────────────────────

import crypto from 'crypto';
import { sendOrderEmail, sendTilopayConfirmationEmail } from '../utils/email.js';
import { sendOrderToBetsyWithRetry } from '../utils/betsy.js';
import { generateEventId, sendMetaEvent } from '../utils/meta.js';

const UNIT_PRICE      = 5900;
const TWO_PACK_PRICE  = 11900;
const PROMO_THRESHOLD = 2;
const SHIPPING_COST   = 3000;
const MAX_QTY         = 5;
const PROMO_TOTALS    = {
  2: 11900,
  3: 15900,
  4: 18900,
  5: 21900
};

const PROVINCE_STATE_MAP = {
  'San José': 'CR-SJ', 'Alajuela': 'CR-A', 'Cartago': 'CR-C',
  'Heredia': 'CR-H', 'Guanacaste': 'CR-G', 'Puntarenas': 'CR-P', 'Limón': 'CR-L'
};

function calculateOrder(qty) {
  const quantity = Math.max(1, Math.min(MAX_QTY, parseInt(qty, 10) || 1));
  const promoTotal = PROMO_TOTALS[quantity];
  const shipping = promoTotal ? 0 : SHIPPING_COST;
  const subtotal = promoTotal || UNIT_PRICE * quantity;
  return { subtotal, shipping, total: subtotal + shipping };
}

function generateOrderId() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

async function authenticateTilopay() {
  const res = await fetch(`${process.env.TILOPAY_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiuser: process.env.TILOPAY_USER, password: process.env.TILOPAY_PASSWORD })
  });
  if (!res.ok) throw new Error(`Tilopay auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export async function createPayment(req, res) {
  try {
    const { nombre, apellido, telefono, email, provincia, canton, distrito, direccion, cantidad, comentarios } = req.body;

    const required = { nombre, apellido, telefono, email, provincia, canton, distrito, direccion };
    for (const [field, value] of Object.entries(required)) {
      if (!value?.trim()) return res.status(400).json({ error: `Campo requerido: ${field}` });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Correo electrónico inválido' });
    }

    const qty = parseInt(cantidad) || 1;
    if (qty < 1 || qty > MAX_QTY) {
      return res.status(400).json({ error: `Cantidad debe ser entre 1 y ${MAX_QTY}` });
    }

    const { subtotal, shipping, total } = calculateOrder(qty);
    const orderId  = generateOrderId();
    const appUrl   = process.env.APP_URL || 'http://localhost:5173';

    const order = {
      orderId, nombre: nombre.trim(), apellido: apellido.trim(), telefono: telefono.trim(),
      email: email.trim().toLowerCase(),
      provincia, canton, distrito, direccion: direccion.trim(),
      cantidad: qty, comentarios: (comentarios || '').trim(),
      subtotal, shippingCost: shipping, total,
      paymentMethod: 'Tilopay', paymentStatus: 'pending',
      createdAt: new Date().toISOString()
    };

    // Store in memory for local dev (Express stays alive between requests)
    if (!global.pendingOrders) global.pendingOrders = new Map();
    global.pendingOrders.set(orderId, order);

    const returnData = Buffer.from(JSON.stringify(order)).toString('base64');
    const accessToken = await authenticateTilopay();

    const tilopayPayload = {
      key: process.env.TILOPAY_API_KEY, amount: total, currency: 'CRC',
      description: `Bloom Dermal Micro-Infusion Patch x${qty}`,
      redirect: `${appUrl}/success.html`, errorRedirect: `${appUrl}/error.html`,
      hashVersion: 'V2',
      billToFirstName: nombre.trim(), billToLastName: apellido.trim() || '-',
      billToAddress: direccion, billToAddress2: `${distrito}, ${canton}`,
      billToCity: canton, billToState: PROVINCE_STATE_MAP[provincia] || 'CR-SJ',
      billToZipPostCode: '10101',
      billToCountry: 'CR', billToTelephone: telefono, billToEmail: email,
      orderNumber: orderId, capture: '1', subscription: '0', platform: 'Bloom',
      returnData
    };

    const payRes = await fetch(`${process.env.TILOPAY_BASE_URL}/processPayment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify(tilopayPayload)
    });

    if (!payRes.ok) {
      const errBody = await payRes.text();
      console.error(`[Tilopay] ${payRes.status}: ${errBody}`);
      return res.status(502).json({ error: 'Error al crear pago con Tilopay' });
    }

    const payData = await payRes.json();
    const paymentUrl = payData.urlPaymentForm || payData.url || payData.payment_url;
    if (!paymentUrl) return res.status(502).json({ error: 'Tilopay no devolvió URL de pago' });

    console.log(`[Tilopay] Payment created: ${orderId}`);

    const metaEventId = generateEventId('ic', orderId);
    sendMetaEvent('InitiateCheckout', metaEventId, order, req, {
      value: total, currency: 'CRC',
      content_ids: ['bloom-patch'],
      content_type: 'product',
      num_items: qty
    }, `${appUrl}/#pedido`).catch(() => {});

    return res.json({ success: true, orderId, paymentUrl, transactionId: payData.transaction_id || payData.id, metaEventId });
  } catch (err) {
    console.error('[createPayment]', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}

const SUCCESS_STATUSES = ['aprobada', 'approved', 'success', 'paid', 'completed'];

export async function handleWebhook(req, res) {
  if (!verifyWebhookSignature(req)) return res.status(401).json({ error: 'Unauthorized' });

  const payload = req.body;
  const orderId       = payload.order || payload.order_id || payload.orderNumber || payload.referencia;
  const transactionId = payload['tilopay-transaction'] || payload.tpt || payload.transaction_id;
  const code   = String(payload.code ?? '');
  const status = String(payload.estado || payload.status || '').toLowerCase();

  if (!orderId) return res.status(400).json({ error: 'Missing order ID' });

  const isApproved = code === '1' || SUCCESS_STATUSES.includes(status);
  if (!isApproved) return res.json({ success: false, message: 'Payment not approved' });

  // Try in-memory first (works for Express), then returnData fallback
  let order = global.pendingOrders?.get(orderId);
  if (!order && payload.returnData) {
    try { order = JSON.parse(Buffer.from(payload.returnData, 'base64').toString('utf-8')); } catch {}
  }

  if (!order) {
    console.error(`[Webhook] Order ${orderId} not found`);
    return res.json({ success: true, message: 'Payment confirmed, order data unavailable' });
  }

  order.paymentStatus = 'completed';
  order.paymentId = transactionId;
  order.transactionId = transactionId;
  order.paidAt = new Date().toISOString();

  global.pendingOrders?.delete(orderId);

  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const metaEventId = generateEventId('purchase', orderId, transactionId);
  const totalItems = parseInt(order.cantidad) || 1;

  // Do async work before responding
  const results = await Promise.allSettled([
    sendOrderEmail(order),
    sendTilopayConfirmationEmail(order),
    sendOrderToBetsyWithRetry({ ...order, transactionId }),
    sendMetaEvent('Purchase', metaEventId, order, req, {
      value: order.total, currency: 'CRC',
      content_ids: ['bloom-patch'],
      content_type: 'product',
      num_items: totalItems
    }, `${appUrl}/success.html`)
  ]);

  if (results[0].status === 'rejected') console.error('[Webhook] Admin email:', results[0].reason?.message);
  if (results[1].status === 'rejected') console.error('[Webhook] Customer email:', results[1].reason?.message);
  if (results[2].status === 'rejected') console.error('[Webhook] Betsy:', results[2].reason?.message);

  return res.json({ success: true, orderId, message: 'Payment confirmed' });
}

export function confirmPayment(req, res) {
  const { orderId } = req.query;
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
  const order = global.pendingOrders?.get(orderId);
  res.json({ status: order ? (order.paymentStatus || 'pending') : 'not_found', orderId });
}

export async function processConfirm(req, res) {
  const { returnData, transactionId, code } = req.body;
  if (!returnData) return res.status(400).json({ error: 'Missing returnData' });

  let order;
  try {
    order = JSON.parse(Buffer.from(returnData, 'base64').toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Invalid returnData' });
  }

  const { orderId } = order;
  if (!orderId) return res.status(400).json({ error: 'Invalid order data' });

  // Only process if Tilopay response code is '1' (approved)
  if (code !== '1') {
    console.warn(`[Confirm] Payment NOT approved for ${orderId} — code: ${code || 'missing'}`);
    return res.status(200).json({ success: false, orderId, message: 'Payment not approved' });
  }

  order.paymentStatus = 'completed';
  order.paymentId     = transactionId;
  order.transactionId = transactionId;
  order.paymentMethod = 'Tilopay';
  order.paidAt        = new Date().toISOString();

  global.pendingOrders?.delete(orderId);

  console.log(`[Confirm] Processing order ${orderId}`);

  const appUrlConfirm = process.env.APP_URL || 'http://localhost:5173';
  const metaEventIdConfirm = generateEventId('purchase', orderId, transactionId);
  const totalItemsConfirm = parseInt(order.cantidad) || 1;

  const results = await Promise.allSettled([
    sendOrderEmail(order),
    sendTilopayConfirmationEmail(order),
    sendOrderToBetsyWithRetry({ ...order, transactionId }),
    sendMetaEvent('Purchase', metaEventIdConfirm, order, req, {
      value: order.total, currency: 'CRC',
      content_ids: ['bloom-patch'],
      content_type: 'product',
      num_items: totalItemsConfirm
    }, `${appUrlConfirm}/success.html`)
  ]);

  if (results[0].status === 'rejected') console.error('[Confirm] Admin email:', results[0].reason?.message);
  if (results[1].status === 'rejected') console.error('[Confirm] Customer email:', results[1].reason?.message);
  if (results[2].status === 'rejected') console.error('[Confirm] Betsy:', results[2].reason?.message);

  return res.json({ success: true, orderId });
}

function verifyWebhookSignature(req) {
  const secret = process.env.TILOPAY_WEBHOOK_SECRET;
  if (!secret) return true;
  if (req.headers['x-tilopay-secret'] === secret) return true;

  const providedHash = req.headers['hash-tilopay'];
  if (!providedHash) return false;

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(providedHash, 'hex'), Buffer.from(computed, 'hex'));
  } catch { return false; }
}

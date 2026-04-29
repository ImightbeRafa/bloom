// ─── Bloom — api/tilopay/create-payment.js ──────────────────────────────────
// Vercel serverless function: creates a Tilopay payment link

import { generateEventId, sendMetaEvent } from '../utils/meta.js';

const UNIT_PRICE       = 8900;
const TWO_PACK_PRICE   = 11900;
const PROMO_THRESHOLD  = 2;
const SHIPPING_COST    = 3000;    // flat ₡3,000 shipping

function calculateOrder(qty) {
  const subtotal = qty >= PROMO_THRESHOLD
    ? TWO_PACK_PRICE + Math.max(0, qty - PROMO_THRESHOLD) * UNIT_PRICE
    : UNIT_PRICE * qty;
  const shipping = SHIPPING_COST;
  return { subtotal, shipping, total: subtotal + shipping };
}

function generateOrderId() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

async function authenticateTilopay() {
  const res = await fetch(`${process.env.TILOPAY_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiuser: process.env.TILOPAY_USER,
      password: process.env.TILOPAY_PASSWORD
    })
  });

  if (!res.ok) throw new Error(`Tilopay auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'https://bloomcr.shopping');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      nombre, apellido, telefono, email,
      provincia, canton, distrito, direccion,
      cantidad, comentarios
    } = req.body;

    // Validate required fields
    const required = { nombre, apellido, telefono, email, provincia, canton, distrito, direccion };
    for (const [field, value] of Object.entries(required)) {
      if (!value || !String(value).trim()) {
        return res.status(400).json({ error: `Campo requerido: ${field}` });
      }
    }

    const qty = parseInt(cantidad) || 1;
    const { subtotal, shipping, total } = calculateOrder(qty);
    const orderId = generateOrderId();
    const appUrl  = process.env.APP_URL || 'https://bloomcr.shopping';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Correo electrónico inválido' });
    }

    if (qty < 1 || qty > 10) {
      return res.status(400).json({ error: 'Cantidad debe ser entre 1 y 10' });
    }

    const order = {
      orderId, nombre: nombre.trim(), apellido: apellido.trim(), telefono: telefono.trim(),
      email: email.trim().toLowerCase(),
      provincia, canton, distrito, direccion: direccion.trim(),
      cantidad: qty, comentarios: (comentarios || '').trim(),
      subtotal, shippingCost: shipping, total,
      paymentMethod: 'Tilopay',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString()
    };

    const returnData = Buffer.from(JSON.stringify(order)).toString('base64');

    const accessToken = await authenticateTilopay();

    const firstName = nombre.trim();
    const lastName  = apellido.trim() || '-';

    const provinceStateMap = {
      'San José': 'CR-SJ', 'Alajuela': 'CR-A', 'Cartago': 'CR-C',
      'Heredia': 'CR-H', 'Guanacaste': 'CR-G', 'Puntarenas': 'CR-P', 'Limón': 'CR-L'
    };

    const tilopayPayload = {
      key:              process.env.TILOPAY_API_KEY,
      amount:           total,
      currency:         'CRC',
      description:      `Bloom Dermal Micro-Infusion Patch x${qty}`,
      redirect:         `${appUrl}/success.html`,
      errorRedirect:    `${appUrl}/error.html`,
      hashVersion:      'V2',
      billToFirstName:  firstName,
      billToLastName:   lastName,
      billToAddress:    direccion,
      billToAddress2:   `${distrito}, ${canton}`,
      billToCity:       canton,
      billToState:      provinceStateMap[provincia] || 'CR-SJ',
      billToZipPostCode:'10101',
      billToCountry:    'CR',
      billToTelephone:  telefono,
      billToEmail:      email,
      orderNumber:      orderId,
      capture:          '1',
      subscription:     '0',
      platform:         'Bloom',
      returnData
    };

    const payRes = await fetch(`${process.env.TILOPAY_BASE_URL}/processPayment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(tilopayPayload)
    });

    if (!payRes.ok) {
      const errBody = await payRes.text();
      console.error(`[Tilopay] create-payment failed: ${payRes.status} ${errBody}`);
      return res.status(502).json({ error: 'Error al crear pago con Tilopay' });
    }

    const payData = await payRes.json();
    const paymentUrl   = payData.urlPaymentForm || payData.url || payData.payment_url;
    const transactionId = payData.transaction_id || payData.id;

    if (!paymentUrl) {
      console.error('[Tilopay] No payment URL in response:', payData);
      return res.status(502).json({ error: 'Tilopay no devolvió URL de pago' });
    }

    console.log(`[Tilopay] Payment created — Order: ${orderId}, URL: ${paymentUrl}`);

    const metaEventId = generateEventId('ic', orderId);
    const metaOrder = { ...order };
    if (req.body.fbc) metaOrder.fbc = req.body.fbc;
    if (req.body.fbp) metaOrder.fbp = req.body.fbp;
    sendMetaEvent('InitiateCheckout', metaEventId, metaOrder, req, {
      value: total,
      currency: 'CRC',
      content_ids: ['bloom-patch'],
      content_name: 'Bloom Dermal Micro-Infusion Patch',
      content_type: 'product',
      num_items: qty
    }, req.body.source_url || `${appUrl}/#pedido`).catch(() => {});

    return res.status(200).json({
      success: true,
      orderId,
      paymentUrl,
      transactionId,
      metaEventId
    });

  } catch (err) {
    console.error('[create-payment] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

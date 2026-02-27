// ─── Bloom — api/email/send-sinpe.js ────────────────────────────────────────
// Vercel serverless function: process SINPE Móvil order + send email

import { sendSinpeInstructionsEmail, sendSinpeAdminEmail } from '../utils/email.js';
import { sendOrderToBetsyWithRetry } from '../utils/betsy.js';

const UNIT_PRICE              = 8900;
const SHIPPING_FREE_THRESHOLD = 2;
const SHIPPING_COST           = 2600;

function calculateOrder(qty) {
  const subtotal = UNIT_PRICE * qty;
  const shipping = qty >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_COST;
  return { subtotal, shipping, total: subtotal + shipping };
}

function generateOrderId() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
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
      nombre, telefono, email,
      provincia, canton, distrito, direccion,
      cantidad, comentarios
    } = req.body;

    const required = { nombre, telefono, email, provincia, canton, distrito, direccion };
    for (const [field, value] of Object.entries(required)) {
      if (!value || !String(value).trim()) {
        return res.status(400).json({ error: `Campo requerido: ${field}` });
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Correo electrónico inválido' });
    }

    const qty = parseInt(cantidad) || 1;
    if (qty < 1 || qty > 10) {
      return res.status(400).json({ error: 'Cantidad debe ser entre 1 y 10' });
    }
    const { subtotal, shipping, total } = calculateOrder(qty);
    const orderId = generateOrderId();

    const order = {
      orderId,
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      email: email.trim().toLowerCase(),
      provincia, canton, distrito,
      direccion: direccion.trim(),
      cantidad: qty,
      comentarios: (comentarios || '').trim(),
      subtotal,
      shippingCost: shipping,
      total,
      paymentMethod: 'SINPE',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString()
    };

    console.log(`[SINPE] New order: ${orderId} — Total: ₡${total}`);

    // Fire all three concurrently (non-blocking for the main flow)
    const [emailResult] = await Promise.allSettled([
      sendSinpeInstructionsEmail(order),
      sendSinpeAdminEmail(order),
      sendOrderToBetsyWithRetry(order)
    ]);

    if (emailResult.status === 'rejected') {
      console.error('[SINPE] Customer email failed:', emailResult.reason?.message);
      return res.status(500).json({ error: 'Error al enviar el correo de instrucciones. Intenta de nuevo.' });
    }

    console.log(`[SINPE] Order processed: ${orderId}`);

    return res.status(200).json({
      success: true,
      orderId,
      total,
      sinpePhone: process.env.SINPE_PHONE || '',
      sinpeHolder: process.env.SINPE_HOLDER || ''
    });

  } catch (err) {
    console.error('[send-sinpe] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

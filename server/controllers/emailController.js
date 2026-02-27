// ─── Bloom — server/controllers/emailController.js ──────────────────────────

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

export async function sendSinpe(req, res) {
  try {
    const { nombre, telefono, email, provincia, canton, distrito, direccion, cantidad, comentarios } = req.body;

    const required = { nombre, telefono, email, provincia, canton, distrito, direccion };
    for (const [field, value] of Object.entries(required)) {
      if (!value?.trim()) return res.status(400).json({ error: `Campo requerido: ${field}` });
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
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const order = {
      orderId, nombre: nombre.trim(), telefono: telefono.trim(),
      email: email.trim().toLowerCase(),
      provincia, canton, distrito, direccion: direccion.trim(),
      cantidad: qty, comentarios: (comentarios || '').trim(),
      subtotal, shippingCost: shipping, total,
      paymentMethod: 'SINPE', paymentStatus: 'pending',
      createdAt: new Date().toISOString()
    };

    const [emailResult] = await Promise.allSettled([
      sendSinpeInstructionsEmail(order),
      sendSinpeAdminEmail(order),
      sendOrderToBetsyWithRetry(order)
    ]);

    if (emailResult.status === 'rejected') {
      console.error('[SINPE] Email failed:', emailResult.reason?.message);
      return res.status(500).json({ error: 'Error al enviar correo de instrucciones' });
    }

    console.log(`[SINPE] Order processed: ${orderId}`);
    return res.json({ success: true, orderId, total });
  } catch (err) {
    console.error('[sendSinpe]', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
}

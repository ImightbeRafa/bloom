import { processManualOrder } from '../utils/fulfillment.js';
import { calculateOrder, normalizeTrustedOrder } from '../utils/order.js';

const GAM_PROVINCES = new Set(['san jose', 'san josé', 'san josã©', 'alajuela', 'heredia', 'cartago']);

function generateOrderId() {
  return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function normalizeProvince(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isGamProvince(province) {
  const normalized = normalizeProvince(province);
  return GAM_PROVINCES.has(normalized) || normalized.startsWith('san jos');
}

function requiredError(order) {
  const required = ['nombre', 'apellido', 'telefono', 'email', 'provincia', 'canton', 'distrito', 'direccion'];
  for (const field of required) {
    if (!order[field] || !String(order[field]).trim()) return `Campo requerido: ${field}`;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(order.email)) return 'Correo electronico invalido';

  const qty = parseInt(order.cantidad, 10) || 1;
  if (qty < 1 || qty > 5) return 'Cantidad debe ser entre 1 y 5';

  return null;
}

function buildWhatsappUrl({ order, method }) {
  const whatsappNumber = String(process.env.WHATSAPP_NUMBER || '').trim();
  if (!whatsappNumber) throw new Error('WHATSAPP_NUMBER must be configured');

  const amount = `₡${Number(order.total || 0).toLocaleString('es-CR')}`;
  const message = method === 'cod'
    ? `Hola, quiero confirmar pago contra entrega orden ${order.orderId} por ${amount}`
    : `Hola, comprobante de pago orden ${order.orderId} por ${amount}`;

  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function getSinpeConfig() {
  const sinpeNumber = String(process.env.SINPE_NUMBER || '').trim();
  const sinpeName = String(process.env.SINPE_ACCOUNT_NAME || '').trim();

  if (!sinpeNumber || !sinpeName) {
    throw new Error('SINPE_NUMBER and SINPE_ACCOUNT_NAME must be configured');
  }

  return { sinpeNumber, sinpeName };
}

function isConfigurationError(err) {
  return [
    'SINPE_NUMBER and SINPE_ACCOUNT_NAME must be configured',
    'WHATSAPP_NUMBER must be configured'
  ].includes(err.message);
}

function buildManualOrder(rawOrder, method) {
  const computed = calculateOrder(rawOrder.cantidad);
  const orderId = rawOrder.orderId || generateOrderId();

  return normalizeTrustedOrder({
    ...rawOrder,
    orderId,
    nombre: String(rawOrder.nombre || '').trim(),
    apellido: String(rawOrder.apellido || '').trim() || '-',
    telefono: String(rawOrder.telefono || '').trim(),
    email: String(rawOrder.email || '').trim().toLowerCase(),
    provincia: String(rawOrder.provincia || '').trim(),
    canton: String(rawOrder.canton || '').trim(),
    distrito: String(rawOrder.distrito || '').trim(),
    direccion: String(rawOrder.direccion || '').trim(),
    cantidad: computed.quantity,
    comentarios: String(rawOrder.comentarios || '').trim(),
    subtotal: computed.subtotal,
    shippingCost: computed.shipping,
    total: computed.total,
    paymentMethod: method === 'cod' ? 'Pago contra entrega' : 'SINPE Movil',
    paymentStatus: method === 'cod' ? 'PENDIENTE ENTREGA' : 'PENDIENTE COMPROBANTE',
    createdAt: rawOrder.createdAt || new Date().toISOString()
  });
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
    const method = String(req.body?.method || '').toLowerCase();
    if (!['sinpe', 'cod'].includes(method)) {
      return res.status(400).json({ error: 'Metodo de pago invalido.' });
    }

    const rawOrder = req.body?.order || {};
    const validationError = requiredError(rawOrder);
    if (validationError) return res.status(400).json({ error: validationError });

    if (method === 'cod' && !isGamProvince(rawOrder.provincia)) {
      return res.status(400).json({ error: 'Pago contra entrega solo disponible en la GAM.' });
    }

    const order = buildManualOrder(rawOrder, method);
    const { sinpeNumber, sinpeName } = method === 'sinpe'
      ? getSinpeConfig()
      : { sinpeNumber: '', sinpeName: '' };
    const payment = {
      method,
      status: method === 'cod' ? 'PENDIENTE ENTREGA' : 'PENDIENTE COMPROBANTE',
      transactionId: `${method}-${order.orderId}`,
      sinpeNumber,
      sinpeName
    };

    const appUrl = process.env.APP_URL || 'https://bloomcr.shopping';
    const result = await processManualOrder({
      order,
      method,
      payment,
      eventId: req.body?.eventId || `lead_${order.orderId}_${method}`,
      source: 'ManualOrder',
      req,
      sourceUrl: order.source_url || `${appUrl}/#order`
    });

    const whatsappUrl = buildWhatsappUrl({ order, method });

    return res.status(200).json({
      ok: true,
      success: true,
      orderId: order.orderId,
      whatsappUrl,
      sinpeNumber,
      sinpeName,
      method,
      metaEventId: result.metaEventId,
      channels: result.channels,
      order: {
        orderId: order.orderId,
        cantidad: order.cantidad,
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        total: order.total,
        provincia: order.provincia
      }
    });
  } catch (err) {
    console.error('[manual-order] Error:', err);
    if (isConfigurationError(err)) {
      return res.status(500).json({ error: 'Pago manual no esta configurado. Falta SINPE_NUMBER, SINPE_ACCOUNT_NAME o WHATSAPP_NUMBER.' });
    }
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

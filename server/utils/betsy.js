// ─── Bloom — server/utils/betsy.js ──────────────────────────────────────────
// Same logic as api/utils/betsy.js — kept separate to avoid import path issues

const TIMEOUT_MS = 10000;

function buildBetsyPayload(order) {
  return {
    orderId: order.orderId,
    customer: { name: order.nombre, phone: order.telefono, email: order.email },
    product: {
      name: 'Bloom Dermal Micro-Infusion Patch',
      quantity: order.cantidad,
      unitPrice: `₡${Number(8900).toLocaleString('es-CR')}`
    },
    shipping: {
      cost: order.shippingCost === 0 ? 'GRATIS' : `₡${Number(order.shippingCost).toLocaleString('es-CR')}`,
      courier: 'Correos de Costa Rica',
      address: {
        province: order.provincia,
        canton: order.canton,
        district: order.distrito,
        fullAddress: order.direccion
      }
    },
    total: `₡${Number(order.total).toLocaleString('es-CR')}`,
    payment: {
      method: order.paymentMethod,
      transactionId: order.transactionId || order.paymentId || null,
      status: 'PENDIENTE',
      date: new Date(order.createdAt || Date.now()).toLocaleString('es-CR')
    },
    source: 'Bloom Website',
    salesChannel: 'Website',
    seller: 'Website',
    metadata: {
      campaign: 'organic',
      referrer: 'direct',
      comments: order.paymentMethod === 'Tilopay'
        ? `Pago: Tarjeta (Tilopay) - Estado: PAGADO - ID Transacción: ${order.transactionId || order.paymentId}`
        : 'Pago: SINPE Móvil - Estado: PENDIENTE CONFIRMACIÓN',
      createdAt: order.createdAt || new Date().toISOString()
    }
  };
}

async function sendOrderToBetsy(orderData) {
  if (!process.env.BETSY_API_KEY || !process.env.BETSY_API_URL) {
    console.warn('[Betsy] Not configured — skipping');
    return { success: false, error: 'Not configured' };
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(process.env.BETSY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.BETSY_API_KEY },
      body: JSON.stringify(buildBetsyPayload(orderData)),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { success: false, status: response.status, error: body };
    }

    const data = await response.json();
    console.log(`[Betsy] Synced: ${data.id || 'ok'}`);
    return { success: true, data };
  } catch (err) {
    clearTimeout(timeoutId);
    return { success: false, error: err.name === 'AbortError' ? 'Timeout' : err.message };
  }
}

function isRetryableError(r) {
  if (r.error === 'Not configured') return false;
  if (r.status >= 500) return true;
  if (r.error?.includes('Timeout') || r.error?.includes('ECONNREFUSED')) return true;
  return false;
}

export async function sendOrderToBetsyWithRetry(orderData, maxRetries = 3) {
  for (let i = 1; i <= maxRetries; i++) {
    const result = await sendOrderToBetsy(orderData);
    if (result.success) return result;
    if (i < maxRetries && isRetryableError(result)) {
      await new Promise(r => setTimeout(r, 1000 * i));
      continue;
    }
    return result;
  }
}

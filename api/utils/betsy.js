// Bloom - api/utils/betsy.js
// Betsy CRM integration with retry logic

const TIMEOUT_MS = 10000;

function moneyString(value) {
  return String(Math.round(Number(value || 0)));
}

function paymentStatusLabel(order) {
  if (order.paymentStatus === 'completed') return 'PAGADO';
  return String(order.paymentStatus || 'PENDIENTE').toUpperCase();
}

function buildBetsyPayload(order) {
  const quantity = Number(order.cantidad || 1);
  const subtotal = Number(order.subtotal || (Number(order.total || 0) - Number(order.shippingCost || 0)) || 0);
  const shippingCost = Number(order.shippingCost || 0);
  const total = Number(order.total || subtotal + shippingCost);
  const unitPrice = quantity > 0 ? Math.round(subtotal / quantity) : subtotal;
  const paymentMethod = order.paymentMethod || 'Tilopay';
  const paymentStatus = paymentStatusLabel(order);

  return {
    orderId: order.orderId,
    customer: {
      name: `${order.nombre} ${order.apellido}`.trim(),
      phone: order.telefono,
      email: order.email
    },
    product: {
      name: 'Bloom Dermal Micro-Infusion Patch - paquete de 9 parches',
      quantity,
      unitPrice: moneyString(unitPrice),
      total: moneyString(subtotal),
      packageContents: '9 parches individuales por paquete',
      subtotal: moneyString(subtotal)
    },
    shipping: {
      cost: moneyString(shippingCost),
      courier: 'Correos de Costa Rica',
      address: {
        province: order.provincia,
        canton: order.canton,
        district: order.distrito,
        fullAddress: order.direccion
      }
    },
    subtotal: moneyString(subtotal),
    total: moneyString(total),
    payment: {
      method: paymentMethod,
      transactionId: String(order.transactionId || order.paymentId || 'N/A'),
      status: paymentStatus,
      date: new Date(order.paidAt || order.createdAt || Date.now()).toLocaleString('es-CR')
    },
    source: 'Bloom Website',
    salesChannel: 'Website',
    seller: 'Website',
    metadata: {
      campaign: order.utm_campaign || 'organic',
      referrer: order.utm_source || 'direct',
      comments: `Pago: ${paymentMethod} - Estado: ${paymentStatus} - ID Transaccion: ${order.transactionId || order.paymentId || 'N/A'}`,
      createdAt: order.createdAt || new Date().toISOString()
    }
  };
}

async function sendOrderToBetsy(orderData) {
  if (!process.env.BETSY_API_KEY || !process.env.BETSY_API_URL) {
    console.warn('[Betsy] Not configured - skipping CRM sync');
    return { success: false, error: 'Not configured' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(process.env.BETSY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.BETSY_API_KEY
      },
      body: JSON.stringify(buildBetsyPayload(orderData)),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[Betsy] HTTP ${response.status}: ${body}`);
      return { success: false, status: response.status, error: body };
    }

    const data = await response.json();
    console.log(`[Betsy] Order synced: ${data.id || 'ok'}`);
    return { success: true, data };
  } catch (error) {
    clearTimeout(timeoutId);
    const msg = error.name === 'AbortError' ? 'Request timed out' : error.message;
    console.error(`[Betsy] Error: ${msg}`);
    return { success: false, error: msg };
  }
}

function isRetryableError(result) {
  if (result.error === 'Not configured') return false;
  if (result.status && result.status >= 500) return true;
  if (result.error?.includes('timed out') || result.error?.includes('ECONNREFUSED')) return true;
  return false;
}

export async function sendOrderToBetsyWithRetry(orderData, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[Betsy] Attempt ${attempt}/${maxRetries} for order ${orderData.orderId}`);
    const result = await sendOrderToBetsy(orderData);

    if (result.success) return result;

    if (attempt < maxRetries && isRetryableError(result)) {
      const waitMs = 1000 * attempt;
      console.warn(`[Betsy] Retrying in ${waitMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue;
    }

    console.error(`[Betsy] Failed after ${attempt} attempt(s)`);
    return result;
  }
}

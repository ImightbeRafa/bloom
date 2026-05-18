import crypto from 'crypto';

export const UNIT_PRICE = 8900;
export const TWO_PACK_PRICE = 11900;
export const PROMO_THRESHOLD = 2;
export const SHIPPING_COST = 3000;
export const PATCHES_PER_PACKAGE = 9;

const MAX_QTY = 10;

function getOrderSecret() {
  return process.env.ORDER_DATA_SECRET || process.env.TILOPAY_WEBHOOK_SECRET || '';
}

export function calculateOrder(qty) {
  const quantity = Math.max(1, Math.min(MAX_QTY, parseInt(qty, 10) || 1));
  const subtotal = quantity >= PROMO_THRESHOLD
    ? TWO_PACK_PRICE + Math.max(0, quantity - PROMO_THRESHOLD) * UNIT_PRICE
    : UNIT_PRICE * quantity;
  const shipping = SHIPPING_COST;
  return {
    quantity,
    subtotal,
    shipping,
    total: subtotal + shipping,
    packageCount: quantity,
    patchCount: quantity * PATCHES_PER_PACKAGE
  };
}

export function normalizeTrustedOrder(rawOrder = {}) {
  const computed = calculateOrder(rawOrder.cantidad);
  return {
    ...rawOrder,
    cantidad: computed.quantity,
    subtotal: computed.subtotal,
    shippingCost: computed.shipping,
    total: computed.total,
    packageCount: computed.packageCount,
    patchCount: computed.patchCount,
    packageContents: `${PATCHES_PER_PACKAGE} parches individuales por paquete`
  };
}

function stableOrderPayload(order) {
  const normalized = normalizeTrustedOrder(order);
  return {
    orderId: normalized.orderId,
    nombre: normalized.nombre,
    apellido: normalized.apellido,
    telefono: normalized.telefono,
    email: normalized.email,
    provincia: normalized.provincia,
    canton: normalized.canton,
    distrito: normalized.distrito,
    direccion: normalized.direccion,
    cantidad: normalized.cantidad,
    comentarios: normalized.comentarios || '',
    subtotal: normalized.subtotal,
    shippingCost: normalized.shippingCost,
    total: normalized.total,
    paymentMethod: normalized.paymentMethod,
    paymentStatus: normalized.paymentStatus,
    createdAt: normalized.createdAt,
    fbc: normalized.fbc || '',
    fbp: normalized.fbp || '',
    source_url: normalized.source_url || ''
  };
}

export function signOrder(order) {
  const secret = getOrderSecret();
  if (!secret) {
    throw new Error('ORDER_DATA_SECRET or TILOPAY_WEBHOOK_SECRET is required to sign order data');
  }

  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(stableOrderPayload(order)))
    .digest('hex');
}

export function encodeReturnData(order) {
  const trustedOrder = normalizeTrustedOrder(order);
  const envelope = {
    token_version: 'v2',
    order: trustedOrder,
    signature: signOrder(trustedOrder)
  };
  return Buffer.from(JSON.stringify(envelope)).toString('base64');
}

function timingSafeCompare(a, b) {
  const left = Buffer.from(String(a || ''), 'hex');
  const right = Buffer.from(String(b || ''), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function decodeReturnData(returnData) {
  if (!returnData) throw new Error('Missing returnData');

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(returnData, 'base64').toString('utf-8'));
  } catch {
    throw new Error('Invalid returnData');
  }

  const order = decoded.order || decoded;
  const signature = decoded.signature;
  const trustedOrder = normalizeTrustedOrder(order);

  const requireSignature = process.env.REQUIRE_SIGNED_RETURN_DATA !== 'false';
  if (requireSignature) {
    if (!signature) throw new Error('Unsigned returnData rejected');
    const expected = signOrder(trustedOrder);
    if (!timingSafeCompare(signature, expected)) {
      throw new Error('Invalid returnData signature');
    }
  }

  return trustedOrder;
}

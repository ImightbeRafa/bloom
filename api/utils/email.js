// ─── Bloom — api/utils/email.js ─────────────────────────────────────────────
// Resend email helper + HTML templates

const RESEND_API_URL = 'https://api.resend.com/emails';
const BRAND_NAME     = 'Bloom';
const FROM_EMAIL     = 'orders@bloomcr.shopping';
const customerEmailDedupe = new Map();
const CUSTOMER_EMAIL_DEDUPE_TTL_MS = 1000 * 60 * 60 * 6;

function getFromEmail() {
  return process.env.RESEND_FROM || `${BRAND_NAME} <${FROM_EMAIL}>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCRC(amount) {
  return `&#8353;${Number(amount || 0).toLocaleString('es-CR')}`;
}

function isSinpePayment(payment = {}) {
  return /sinpe/i.test(String(payment.method || payment.paymentMethod || ''));
}

function isCodPayment(payment = {}) {
  return /cod|contra entrega/i.test(String(payment.method || payment.paymentMethod || ''));
}

function pruneCustomerDedupe(now = Date.now()) {
  for (const [key, ts] of customerEmailDedupe.entries()) {
    if (now - ts > CUSTOMER_EMAIL_DEDUPE_TTL_MS) customerEmailDedupe.delete(key);
  }
}

function customerDedupeKey(order, payment) {
  if (isSinpePayment(payment) || isCodPayment(payment)) {
    return `order:${order.orderId || ''}:${order.email || ''}:${order.total || ''}`;
  }
  const tx = payment?.transactionId || order.transactionId || order.paymentId;
  if (tx) return `tx:${tx}`;
  if (order.orderId) return `order:${order.orderId}:${order.email || ''}:${order.total || ''}`;
  return `contact:${order.email || ''}:${order.total || ''}`;
}
async function sendEmail({ from, to, subject, html }) {
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({ from, to, subject, html })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }

  return res.json();
}

// ── Admin Order Notification ──────────────────────────────────────────────────
export async function sendOrderEmail(order) {
  const html = buildAdminEmailHtml(order);
  return sendEmail({
    from: getFromEmail(),
    to: process.env.ORDER_NOTIFICATION_EMAIL,
    subject: `Nueva Orden: ${order.orderId} — ${order.nombre} ${order.apellido}`,
    html
  });
}

// ── Tilopay Order Confirmation to Customer ────────────────────────────────────
export async function sendTilopayConfirmationEmail(order) {
  const html = buildTilopayConfirmationEmailHtml(order);
  return sendEmail({
    from: getFromEmail(),
    to: order.email,
    subject: `Pago confirmado — Bloom #${order.orderId}`,
    html
  });
}

export function customerEmailSubject(order, payment = {}) {
  if (isSinpePayment(payment)) return `Tu pedido #${order.orderId} - Falta el SINPE`;
  if (isCodPayment(payment)) return `Pedido #${order.orderId} - Pago contra entrega`;
  return `Pago confirmado - Bloom #${order.orderId}`;
}

export async function sendManualOrderCustomerEmail(order, payment = {}) {
  const now = Date.now();
  pruneCustomerDedupe(now);

  const key = customerDedupeKey(order, payment);
  if (customerEmailDedupe.has(key)) {
    console.log(`[Email] Customer email deduped for ${key}`);
    return { success: true, deduped: true };
  }

  const html = buildManualCustomerEmailHtml(order, payment);
  const result = await sendEmail({
    from: getFromEmail(),
    to: order.email,
    subject: customerEmailSubject(order, payment),
    html
  });

  customerEmailDedupe.set(key, now);
  return result;
}

export async function sendManualReviewEmail({ orderId, transactionId, source, reason, payload }) {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f8f6ff;font-family:Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;">
    <tr><td style="background:#7f1d1d;color:#fff;padding:22px 28px;">
      <h1 style="margin:0;font-size:22px;">Bloom - pago requiere revision manual</h1>
    </td></tr>
    <tr><td style="padding:24px 28px;">
      <p><strong>Motivo:</strong> ${reason}</p>
      <p><strong>Fuente:</strong> ${source || 'N/A'}</p>
      <p><strong>Orden:</strong> ${orderId || 'N/A'}</p>
      <p><strong>Transaccion Tilopay:</strong> ${transactionId || 'N/A'}</p>
      <p style="margin-top:18px;"><strong>Payload recibido:</strong></p>
      <pre style="white-space:pre-wrap;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:14px;font-size:12px;line-height:1.5;">${JSON.stringify(payload || {}, null, 2)}</pre>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail({
    from: getFromEmail(),
    to: process.env.ORDER_NOTIFICATION_EMAIL,
    subject: `Revision manual Bloom: ${orderId || transactionId || 'pago sin orden'}`,
    html
  });
}

// ── Email Templates ───────────────────────────────────────────────────────────

function buildManualCustomerEmailHtml(order, payment = {}) {
  const sinpe = isSinpePayment(payment);
  const sinpeNumber = escapeHtml(payment.sinpeNumber || process.env.SINPE_NUMBER || '');
  const sinpeName = escapeHtml(payment.sinpeName || process.env.SINPE_ACCOUNT_NAME || '');
  const firstName = escapeHtml(order.nombre || '');

  const sinpeBlock = sinpe ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#160f1f;border:2px dashed #d6a84f;border-radius:10px;margin-bottom:22px;">
      <tr><td style="padding:22px 24px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;color:#f8e7b5;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Envia un SINPE Movil a</p>
        <p style="margin:0;font-family:Consolas,Monaco,monospace;font-size:30px;line-height:1.15;color:#fff8ef;font-weight:900;">${sinpeNumber}</p>
        <p style="margin:8px 0 0;font-size:14px;color:#f8e7b5;">a nombre de <strong>${sinpeName}</strong></p>
        <p style="margin:16px 0 0;font-size:18px;color:#ffffff;font-weight:900;">Monto exacto: ${formatCRC(order.total)}</p>
        <hr style="border:none;border-top:1px solid rgba(214,168,79,0.42);margin:18px 0;">
        <p style="margin:0;font-size:14px;color:#fff8ef;line-height:1.55;"><strong>Importante:</strong> usa tu nombre de pago en el comprobante SINPE. Luego envianos el comprobante por WhatsApp para despachar tu pedido hoy.</p>
      </td></tr>
    </table>` : '';

  const heading = sinpe ? 'Casi listo! Solo falta el SINPE.' : 'Orden confirmada - Pago contra entrega';
  const intro = sinpe
    ? `Hola <strong>${firstName}</strong>, recibimos tu pedido. Solo nos falta tu SINPE Movil para despacharlo hoy.`
    : `Hola <strong>${firstName}</strong>, recibimos tu pedido con pago contra entrega. Te contactaremos por WhatsApp para coordinar la entrega.`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f1f1;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#5e17eb,#b57bee);padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:2px;">BLOOM</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">${sinpe ? 'Pedido pendiente de SINPE' : 'Pedido contra entrega'}</p>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <h2 style="margin:0 0 10px;font-size:22px;color:#1a1a1a;font-weight:800;">${heading}</h2>
    <p style="margin:0 0 22px;font-size:14px;color:#6b5f8a;line-height:1.6;">${intro}</p>
    ${sinpeBlock}
    ${buildCustomerOrderSummary(order)}
    <p style="font-size:13px;color:#9585c4;margin:20px 0 0;text-align:center;">Orden #${escapeHtml(order.orderId)}</p>
  </td></tr>
  <tr><td style="background:#f8f6ff;padding:20px 40px;text-align:center;border-top:1px solid #ede8ff;">
    <p style="margin:0;font-size:12px;color:#9585c4;">Bloom · bloomcr.shopping · Costa Rica</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildCustomerOrderSummary(order) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ff;border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;color:#6b5f8a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Tu pedido</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Producto:</strong> Bloom Dermal Micro-Infusion Patch</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Paquetes:</strong> ${escapeHtml(order.cantidad)} (${Number(order.cantidad || 1) * 9} parches en total)</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Envio:</strong> ${order.shippingCost === 0 ? 'Incluido' : formatCRC(order.shippingCost)}</p>
        <hr style="border:none;border-top:1px solid #e8e0ff;margin:12px 0;">
        <p style="margin:0;font-size:18px;color:#5e17eb;font-weight:700;">Total: ${formatCRC(order.total)}</p>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ff;border-radius:10px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;color:#6b5f8a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Direccion de entrega</p>
        <p style="margin:4px 0;font-size:14px;color:#333;">${escapeHtml(order.provincia)}, ${escapeHtml(order.canton)}, ${escapeHtml(order.distrito)}</p>
        <p style="margin:4px 0;font-size:14px;color:#333;">${escapeHtml(order.direccion)}</p>
      </td></tr>
    </table>`;
}

function buildAdminEmailHtml(order) {
  const isPaid = order.paymentStatus === 'completed';
  const statusBadge = isPaid
    ? '<span style="background:#166534;color:#bbf7d0;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">PAGADO</span>'
    : '<span style="background:#854d0e;color:#fef3c7;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">PENDIENTE</span>';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f1f1;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#5e17eb,#b57bee);padding:32px 40px;">
    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:2px;">BLOOM</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Nueva orden de compra</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 40px;">

    <!-- Status -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
      <h2 style="margin:0;font-size:18px;color:#1a1a1a;">Orden #${order.orderId}</h2>
      ${statusBadge}
    </div>

    <!-- Order Details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ff;border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;color:#6b5f8a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Detalles del pedido</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Fecha:</strong> ${new Date(order.createdAt).toLocaleString('es-CR')}</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Método de pago:</strong> ${order.paymentMethod}</p>
        ${order.paymentId ? `<p style="margin:4px 0;font-size:14px;color:#333;"><strong>ID Transacción:</strong> ${order.paymentId}</p>` : ''}
      </td></tr>
    </table>

    <!-- Customer -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ff;border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;color:#6b5f8a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Cliente</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Nombre:</strong> ${order.nombre} ${order.apellido}</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Teléfono:</strong> ${order.telefono}</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Email:</strong> ${order.email}</p>
      </td></tr>
    </table>

    <!-- Shipping -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ff;border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;color:#6b5f8a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Envío</p>
        <p style="margin:4px 0;font-size:14px;color:#333;">${order.provincia}, ${order.canton}, ${order.distrito}</p>
        <p style="margin:4px 0;font-size:14px;color:#333;">${order.direccion}</p>
      </td></tr>
    </table>

    <!-- Order Summary -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ff;border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;color:#6b5f8a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Resumen</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Producto:</strong> Bloom Dermal Micro-Infusion Patch</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Contenido:</strong> cada paquete trae 9 parches individuales</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Paquetes:</strong> ${order.cantidad} (${Number(order.cantidad || 1) * 9} parches en total)</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Envío:</strong> ${order.shippingCost === 0 ? 'Incluido' : `₡${Number(order.shippingCost).toLocaleString('es-CR')}`}</p>
        <hr style="border:none;border-top:1px solid #e8e0ff;margin:12px 0;">
        <p style="margin:0;font-size:18px;color:#5e17eb;font-weight:700;">Total: ₡${Number(order.total).toLocaleString('es-CR')}</p>
      </td></tr>
    </table>

    ${order.comentarios ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbf0;border:1px solid #fde68a;border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:16px 24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#92400e;font-weight:700;">Notas del cliente</p>
        <p style="margin:0;font-size:14px;color:#333;">${order.comentarios}</p>
      </td></tr>
    </table>` : ''}

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8f6ff;padding:20px 40px;text-align:center;border-top:1px solid #ede8ff;">
    <p style="margin:0;font-size:12px;color:#9585c4;">Bloom · bloomcr.shopping · Costa Rica</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildTilopayConfirmationEmailHtml(order) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f1f1;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#5e17eb,#b57bee);padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:2px;">BLOOM</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Confirmación de pedido</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 40px;">

    <!-- Success badge -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:68px;height:68px;background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.25);border-radius:50%;margin-bottom:16px;">
        <span style="font-size:30px;color:#16a34a;">&#10003;</span>
      </div>
      <h2 style="margin:0 0 8px;font-size:22px;color:#1a1a1a;font-weight:800;">¡Pago confirmado!</h2>
      <p style="margin:0;font-size:14px;color:#6b5f8a;">Hola <strong>${order.nombre}</strong>, tu pedido está siendo preparado.</p>
    </div>

    <!-- Order Summary -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ff;border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;color:#6b5f8a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Tu pedido</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Orden:</strong> #${order.orderId}</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Producto:</strong> Bloom Dermal Micro-Infusion Patch</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Contenido:</strong> cada paquete trae 9 parches individuales</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Paquetes:</strong> ${order.cantidad} (${Number(order.cantidad || 1) * 9} parches en total)</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Envío:</strong> ${order.shippingCost === 0 ? 'Incluido' : `&#8353;${Number(order.shippingCost).toLocaleString('es-CR')}`}</p>
        <hr style="border:none;border-top:1px solid #e8e0ff;margin:12px 0;">
        <p style="margin:0;font-size:18px;color:#5e17eb;font-weight:700;">Total: &#8353;${Number(order.total).toLocaleString('es-CR')}</p>
      </td></tr>
    </table>

    <!-- Shipping Address -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ff;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;color:#6b5f8a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Dirección de entrega</p>
        <p style="margin:4px 0;font-size:14px;color:#333;">${order.provincia}, ${order.canton}, ${order.distrito}</p>
        <p style="margin:4px 0;font-size:14px;color:#333;">${order.direccion}</p>
      </td></tr>
    </table>

    <p style="font-size:14px;color:#6b5f8a;margin:0 0 8px;text-align:center;">Tu pedido será despachado en <strong>1–3 días hábiles</strong>.</p>
    <p style="font-size:13px;color:#9585c4;margin:0;text-align:center;">¿Tienes preguntas? Escríbenos por WhatsApp.</p>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8f6ff;padding:20px 40px;text-align:center;border-top:1px solid #ede8ff;">
    <p style="margin:0;font-size:12px;color:#9585c4;">Bloom · bloomcr.shopping · Costa Rica</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

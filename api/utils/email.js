// ─── Bloom — api/utils/email.js ─────────────────────────────────────────────
// Resend email helper + HTML templates

const RESEND_API_URL = 'https://api.resend.com/emails';
const BRAND_NAME     = 'Bloom';
const FROM_EMAIL     = 'orders@bloomcr.shopping';
const SINPE_PHONE    = process.env.SINPE_PHONE    || '[SINPE_PHONE]';
const SINPE_HOLDER   = process.env.SINPE_HOLDER   || '[SINPE_HOLDER]';

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
    from: `${BRAND_NAME} <${FROM_EMAIL}>`,
    to: process.env.ORDER_NOTIFICATION_EMAIL,
    subject: `Nueva Orden: ${order.orderId} — ${order.nombre}`,
    html
  });
}

// ── SINPE Instructions to Customer ───────────────────────────────────────────
export async function sendSinpeInstructionsEmail(order) {
  const html = buildSinpeEmailHtml(order);
  return sendEmail({
    from: `${BRAND_NAME} <${FROM_EMAIL}>`,
    to: order.email,
    subject: `Tu pedido Bloom #${order.orderId} — Instrucciones SINPE`,
    html
  });
}

// ── Admin notification for SINPE order ───────────────────────────────────────
export async function sendSinpeAdminEmail(order) {
  const html = buildAdminEmailHtml(order);
  return sendEmail({
    from: `${BRAND_NAME} <${FROM_EMAIL}>`,
    to: process.env.ORDER_NOTIFICATION_EMAIL,
    subject: `[SINPE] Nueva Orden: ${order.orderId} — ${order.nombre}`,
    html
  });
}

// ── Email Templates ───────────────────────────────────────────────────────────

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
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Nombre:</strong> ${order.nombre}</p>
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
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Cantidad:</strong> ${order.cantidad}</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Envío:</strong> ${order.shippingCost === 0 ? 'GRATIS' : `₡${Number(order.shippingCost).toLocaleString('es-CR')}`}</p>
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

function buildSinpeEmailHtml(order) {
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
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Instrucciones de pago</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a1a;margin:0 0 20px;">Hola <strong>${order.nombre}</strong>, gracias por tu pedido.</p>

    <!-- SINPE Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#5e17eb,#7c3aff);border-radius:12px;margin-bottom:24px;">
      <tr><td style="padding:28px 32px;">
        <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.7);font-weight:700;text-transform:uppercase;letter-spacing:1px;">Datos para SINPE Móvil</p>
        <p style="margin:16px 0 4px;font-size:13px;color:rgba(255,255,255,0.7);">Número</p>
        <p style="margin:0;font-size:28px;color:#ffffff;font-weight:800;letter-spacing:3px;">${SINPE_PHONE}</p>
        <p style="margin:16px 0 4px;font-size:13px;color:rgba(255,255,255,0.7);">A nombre de</p>
        <p style="margin:0;font-size:16px;color:#ffffff;font-weight:600;">${SINPE_HOLDER}</p>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin:20px 0;">
        <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,0.7);">Monto exacto</p>
        <p style="margin:0;font-size:32px;color:#ffffff;font-weight:800;">₡${Number(order.total).toLocaleString('es-CR')}</p>
        <p style="margin:16px 0 4px;font-size:13px;color:rgba(255,255,255,0.7);">Referencia (descripción)</p>
        <p style="margin:0;font-size:14px;color:#d4a8ff;font-weight:600;">${order.orderId}</p>
      </td></tr>
    </table>

    <!-- Order Summary -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ff;border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;color:#6b5f8a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Tu pedido</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Producto:</strong> Bloom Dermal Micro-Infusion Patch × ${order.cantidad}</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Envío:</strong> ${order.shippingCost === 0 ? 'GRATIS' : `₡${Number(order.shippingCost).toLocaleString('es-CR')}`}</p>
        <p style="margin:4px 0;font-size:14px;color:#333;"><strong>Dirección:</strong> ${order.provincia}, ${order.canton}, ${order.distrito} — ${order.direccion}</p>
      </td></tr>
    </table>

    <p style="font-size:14px;color:#6b5f8a;margin:0 0 8px;">Una vez realizado el SINPE, tu pedido será procesado dentro de <strong>24 horas hábiles</strong>.</p>
    <p style="font-size:14px;color:#6b5f8a;margin:0;">¿Dudas o consultas? Contáctanos por WhatsApp al <strong>${SINPE_PHONE}</strong>.</p>
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

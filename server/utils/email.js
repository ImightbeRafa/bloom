// ─── Bloom — server/utils/email.js ──────────────────────────────────────────
// Same logic as api/utils/email.js — kept separate to avoid import path issues

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_EMAIL     = 'orders@bloomcr.shopping';
const SINPE_PHONE    = process.env.SINPE_PHONE  || '[SINPE_PHONE]';
const SINPE_HOLDER   = process.env.SINPE_HOLDER || '[SINPE_HOLDER]';

async function sendEmail({ from, to, subject, html }) {
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from, to, subject, html })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function sendOrderEmail(order) {
  const isPaid = order.paymentStatus === 'completed';
  const statusLabel = isPaid ? 'PAGADO' : 'PENDIENTE';

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f1f1;margin:0;padding:40px 20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#5e17eb,#b57bee);padding:32px 40px;">
  <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:2px;">BLOOM</h1>
  <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Nueva orden — ${statusLabel}</p>
</div>
<div style="padding:32px 40px;">
  <p><strong>Orden #:</strong> ${order.orderId}</p>
  <p><strong>Fecha:</strong> ${new Date(order.createdAt).toLocaleString('es-CR')}</p>
  <p><strong>Pago:</strong> ${order.paymentMethod}${order.paymentId ? ` — ${order.paymentId}` : ''}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
  <p><strong>Cliente:</strong> ${order.nombre} / ${order.telefono} / ${order.email}</p>
  <p><strong>Dirección:</strong> ${order.provincia}, ${order.canton}, ${order.distrito} — ${order.direccion}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
  <p><strong>Producto:</strong> Bloom Dermal Micro-Infusion Patch × ${order.cantidad}</p>
  <p><strong>Envío:</strong> ${order.shippingCost === 0 ? 'GRATIS' : `₡${Number(order.shippingCost).toLocaleString('es-CR')}`}</p>
  <p style="font-size:18px;color:#5e17eb;font-weight:700;">Total: ₡${Number(order.total).toLocaleString('es-CR')}</p>
  ${order.comentarios ? `<p><strong>Notas:</strong> ${order.comentarios}</p>` : ''}
</div>
</div></body></html>`;

  return sendEmail({
    from: `Bloom <${FROM_EMAIL}>`,
    to: process.env.ORDER_NOTIFICATION_EMAIL,
    subject: `Nueva Orden: ${order.orderId} — ${order.nombre}`,
    html
  });
}

export async function sendSinpeInstructionsEmail(order) {
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f1f1f1;margin:0;padding:40px 20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#5e17eb,#b57bee);padding:32px 40px;">
  <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:2px;">BLOOM</h1>
  <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Instrucciones de pago SINPE</p>
</div>
<div style="padding:32px 40px;">
  <p>Hola <strong>${order.nombre}</strong>, gracias por tu pedido.</p>
  <div style="background:#f0ebff;border-radius:12px;padding:24px;margin:20px 0;">
    <p style="font-size:13px;color:#5e17eb;font-weight:700;margin:0 0 12px;">SINPE Móvil</p>
    <p style="font-size:24px;font-weight:800;letter-spacing:3px;margin:0 0 4px;">${SINPE_PHONE}</p>
    <p style="color:#555;margin:0 0 16px;">A nombre de: <strong>${SINPE_HOLDER}</strong></p>
    <p style="font-size:13px;color:#5e17eb;margin:0 0 4px;">Monto exacto</p>
    <p style="font-size:28px;font-weight:800;color:#5e17eb;margin:0 0 16px;">₡${Number(order.total).toLocaleString('es-CR')}</p>
    <p style="font-size:13px;color:#5e17eb;margin:0 0 4px;">Referencia</p>
    <p style="font-weight:700;color:#333;margin:0;">${order.orderId}</p>
  </div>
  <p style="color:#666;font-size:14px;">Tu pedido será procesado dentro de 24 horas hábiles tras confirmar el pago.</p>
</div>
</div></body></html>`;

  return sendEmail({
    from: `Bloom <${FROM_EMAIL}>`,
    to: order.email,
    subject: `Tu pedido Bloom #${order.orderId} — Instrucciones SINPE`,
    html
  });
}

export async function sendSinpeAdminEmail(order) {
  return sendEmail({
    from: `Bloom <${FROM_EMAIL}>`,
    to: process.env.ORDER_NOTIFICATION_EMAIL,
    subject: `[SINPE] Nueva Orden: ${order.orderId} — ${order.nombre}`,
    html: `<p>Nueva orden SINPE: <strong>${order.orderId}</strong><br>
Cliente: ${order.nombre} / ${order.telefono} / ${order.email}<br>
Dirección: ${order.provincia}, ${order.canton}, ${order.distrito} — ${order.direccion}<br>
Cantidad: ${order.cantidad} | Total: ₡${Number(order.total).toLocaleString('es-CR')}</p>`
  });
}

// ─── Bloom — api/utils/meta.js ───────────────────────────────────────────────
// Meta Conversions API (CAPI) helper — server-side event tracking

import crypto from 'crypto';

const PIXEL_ID          = process.env.META_PIXEL_ID || '';
const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_URL     = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function hashValue(value) {
  if (!value) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function buildUserData(order, req) {
  const firstName = (order.nombre || '').trim();
  const lastName  = (order.apellido || '').trim();

  const userData = {};
  if (order.email)    userData.em = [hashValue(order.email)];
  if (order.telefono) {
    let phone = String(order.telefono).replace(/\D/g, '');
    if (!phone.startsWith('506')) phone = '506' + phone;
    userData.ph = [hashValue(phone)];
  }
  if (firstName) userData.fn = [hashValue(firstName)];
  if (lastName)  userData.ln = [hashValue(lastName)];
  if (order.canton)    userData.ct = [hashValue(order.canton)];
  if (order.provincia) userData.st = [hashValue(order.provincia)];
  userData.country = [hashValue('cr')];
  userData.zp      = [hashValue('10101')];

  // external_id for cross-event user matching
  if (order.email) {
    userData.external_id = [hashValue(order.email)];
  }

  // fbc / fbp cookies for browser-server event deduplication
  if (order.fbc) userData.fbc = order.fbc;
  if (order.fbp) userData.fbp = order.fbp;

  if (req) {
    const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers?.['x-real-ip']
      || req.socket?.remoteAddress || '';
    if (ip) userData.client_ip_address = ip;
    const ua = req.headers?.['user-agent'] || '';
    if (ua) userData.client_user_agent = ua;
  }

  return userData;
}

export function generateEventId(prefix, orderId, extra) {
  return [prefix, orderId, extra].filter(Boolean).join('_');
}

export async function sendMetaEvent(eventName, eventId, order, req, customData, sourceUrl) {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  const pixelId     = PIXEL_ID;

  if (!accessToken || !pixelId) {
    console.warn(`[Meta CAPI] Skipping ${eventName} — not configured`);
    return { success: false, error: 'Not configured' };
  }

  const payload = {
    data: [{
      event_name:       eventName,
      event_time:       Math.floor(Date.now() / 1000),
      event_id:         eventId,
      action_source:    'website',
      event_source_url: sourceUrl || process.env.APP_URL || 'https://bloomcr.shopping',
      user_data:        buildUserData(order || {}, req),
      ...(customData && Object.keys(customData).length > 0 ? { custom_data: customData } : {})
    }],
    access_token: accessToken,
  };

  try {
    const response = await fetch(`${GRAPH_API_URL}/${pixelId}/events`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error(`[Meta CAPI] ${eventName} failed:`, result);
    } else {
      console.log(`[Meta CAPI] ${eventName} sent — eventId: ${eventId}`);
    }
    return result;
  } catch (err) {
    console.error(`[Meta CAPI] ${eventName} error:`, err.message);
    return { success: false, error: err.message };
  }
}

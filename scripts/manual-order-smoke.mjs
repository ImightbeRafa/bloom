process.env.RESEND_API_KEY = 'test';
process.env.ORDER_NOTIFICATION_EMAIL = 'ops@example.com';
process.env.BETSY_API_KEY = 'test';
process.env.BETSY_API_URL = 'https://betsy.test/orders';
process.env.META_PIXEL_ID = '123';
process.env.META_CAPI_ACCESS_TOKEN = 'token';
process.env.SINPE_NUMBER = '8000-0000';
process.env.SINPE_ACCOUNT_NAME = 'Bloom Test Account';
process.env.WHATSAPP_NUMBER = '50680000000';

const { default: handler } = await import('../api/orders/manual.js');

const calls = [];
global.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), body: options.body ? JSON.parse(options.body) : null });
  return {
    ok: true,
    status: 200,
    json: async () => ({ id: 'ok', events_received: 1 }),
    text: async () => 'ok'
  };
};

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { return this; }
  };
}

const baseOrder = {
  orderId: 'ORD-SMOKE-1',
  nombre: 'Maria',
  apellido: 'Lopez',
  telefono: '88887777',
  email: 'maria@example.com',
  provincia: 'San Jose',
  canton: 'Central',
  distrito: 'Carmen',
  direccion: 'Casa azul',
  cantidad: 2,
  fbp: 'fb.1.test',
  source_url: 'https://bloomcr.shopping/#order'
};

let res = mockRes();
await handler({
  method: 'POST',
  body: { order: baseOrder, method: 'sinpe', eventId: 'lead_ORD-SMOKE-1_sinpe' },
  headers: {},
  socket: {}
}, res);

console.log('sinpe', res.statusCode, res.body.ok, res.body.orderId, res.body.whatsappUrl.includes('ORD-SMOKE-1'));
console.log('sinpe capi', calls.find(call => call.url.includes('graph.facebook.com'))?.body?.data?.[0]?.event_id);

calls.length = 0;
res = mockRes();
await handler({
  method: 'POST',
  body: { order: baseOrder, method: 'cod', eventId: 'lead_ORD-SMOKE-1_cod' },
  headers: {},
  socket: {}
}, res);

console.log('cod', res.statusCode, res.body.ok, res.body.method, res.body.whatsappUrl.includes('contra'));

res = mockRes();
await handler({
  method: 'POST',
  body: { order: { ...baseOrder, provincia: 'Limon' }, method: 'cod' },
  headers: {},
  socket: {}
}, res);

console.log('cod invalid', res.statusCode, res.body.error);

const originalSinpeNumber = process.env.SINPE_NUMBER;
delete process.env.SINPE_NUMBER;
res = mockRes();
await handler({
  method: 'POST',
  body: { order: { ...baseOrder, orderId: 'ORD-SMOKE-MISSING-ENV' }, method: 'sinpe' },
  headers: {},
  socket: {}
}, res);
console.log('missing sinpe env', res.statusCode, res.body.error);
process.env.SINPE_NUMBER = originalSinpeNumber;

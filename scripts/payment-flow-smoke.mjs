process.env.TILOPAY_BASE_URL = 'https://tilopay.test/api/v1';
process.env.TILOPAY_API_KEY = 'api-key';
process.env.TILOPAY_USER = 'user';
process.env.TILOPAY_PASSWORD = 'pass';
process.env.TILOPAY_WEBHOOK_SECRET = 'secret';
process.env.ORDER_DATA_SECRET = 'secret';
process.env.RESEND_API_KEY = 'resend';
process.env.ORDER_NOTIFICATION_EMAIL = 'orders@example.com';
process.env.BETSY_API_KEY = 'betsy';
process.env.BETSY_API_URL = 'https://betsy.test/orders';
process.env.META_PIXEL_ID = '123';
process.env.META_CAPI_ACCESS_TOKEN = 'meta';
process.env.APP_URL = 'https://bloomcr.shopping';

const { default: createPayment } = await import('../api/tilopay/create-payment.js');
const { default: confirm } = await import('../api/tilopay/confirm.js');
const { default: webhook } = await import('../api/tilopay/webhook.js');
const { encodeReturnData } = await import('../api/utils/order.js');

const calls = [];

global.fetch = async (url, options = {}) => {
  calls.push({
    url: String(url),
    body: options.body ? JSON.parse(options.body) : null,
    headers: options.headers || {}
  });

  if (String(url).includes('/login')) return Response.json({ access_token: 'token' });
  if (String(url).includes('/processPayment')) {
    return Response.json({ urlPaymentForm: 'https://pay.test/form', transaction_id: 'tx-create' });
  }
  if (String(url).includes('api.resend.com')) return Response.json({ id: 'email-ok' });
  if (String(url).includes('betsy.test')) return Response.json({ id: 'betsy-ok' });
  if (String(url).includes('graph.facebook.com')) return Response.json({ events_received: 1 });
  return Response.json({ ok: true });
};

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const baseOrderBody = {
  nombre: 'Ana',
  apellido: 'Mora',
  telefono: '8888-8888',
  email: 'ana@example.com',
  provincia: 'San Jose',
  canton: 'Central',
  distrito: 'Carmen',
  direccion: 'Casa 123',
  cantidad: 2,
  comentarios: '',
  fbc: 'fb.1.test',
  fbp: 'fbp.test',
  source_url: 'https://bloomcr.shopping/'
};

const createRes = mockRes();
await createPayment({
  method: 'POST',
  body: baseOrderBody,
  headers: {},
  socket: { remoteAddress: '127.0.0.1' }
}, createRes);

const payPayload = calls.find((call) => String(call.url).includes('/processPayment'))?.body;
assert(createRes.statusCode === 200 && createRes.payload.paymentUrl === 'https://pay.test/form', 'create-payment failed');
assert(payPayload.amount === 14900, `expected amount 14900, got ${payPayload.amount}`);
assert(payPayload.token_version === 'v2', 'missing token_version');
assert(payPayload.shipToFirstName && payPayload.shipToEmail, 'missing shipTo fields');
assert(payPayload.returnData, 'missing signed returnData');

const confirmRes = mockRes();
await confirm({
  method: 'POST',
  body: { returnData: payPayload.returnData, transactionId: 'tx-paid', code: '1' },
  headers: {},
  socket: { remoteAddress: '127.0.0.1' }
}, confirmRes);

assert(confirmRes.statusCode === 200 && confirmRes.payload.success, 'confirm failed');
assert(confirmRes.payload.order.total === 14900, 'confirm did not use trusted total');
assert(confirmRes.payload.metaEventId === `${confirmRes.payload.orderId ? `purchase_${confirmRes.payload.orderId}_tx-paid` : ''}`, 'bad purchase event id');

const unsignedReturnData = Buffer
  .from(JSON.stringify({ ...baseOrderBody, orderId: 'ORD-FAKE', total: 1, subtotal: 1 }))
  .toString('base64');
const tamperRes = mockRes();
await confirm({
  method: 'POST',
  body: { returnData: unsignedReturnData, transactionId: 'tx-fake', code: '1' },
  headers: {},
  socket: {}
}, tamperRes);

assert(tamperRes.statusCode === 400, 'unsigned returnData was not rejected');

const webhookRes = mockRes();
await webhook({
  method: 'POST',
  body: { order: 'ORD-MISSING', code: '1', tpt: 'tx-manual' },
  headers: { 'x-tilopay-secret': 'secret' },
  socket: {}
}, webhookRes);

assert(webhookRes.statusCode === 200 && webhookRes.payload.status === 'approved_manual_review', 'missing returnData webhook did not go manual review');

const order = {
  ...baseOrderBody,
  orderId: 'ORD-WEBHOOK',
  cantidad: 2,
  paymentMethod: 'Tilopay',
  paymentStatus: 'pending',
  createdAt: new Date().toISOString()
};
const webhookReturnData = encodeReturnData(order);
const webhookPaidRes = mockRes();
await webhook({
  method: 'POST',
  body: { order: 'ORD-WEBHOOK', code: '1', tpt: 'tx-webhook', returnData: webhookReturnData },
  headers: { 'x-tilopay-secret': 'secret' },
  socket: {}
}, webhookPaidRes);

assert(webhookPaidRes.statusCode === 200 && webhookPaidRes.payload.status === 'approved_processed', 'valid webhook did not process');

console.log(JSON.stringify({
  createPayment: {
    amount: payPayload.amount,
    token_version: payPayload.token_version,
    hasShipTo: Boolean(payPayload.shipToEmail)
  },
  confirm: {
    status: confirmRes.statusCode,
    success: confirmRes.payload.success,
    total: confirmRes.payload.order.total,
    metaEventId: confirmRes.payload.metaEventId
  },
  tamperedConfirm: {
    status: tamperRes.statusCode,
    error: tamperRes.payload.error
  },
  missingReturnDataWebhook: {
    status: webhookRes.payload.status
  },
  validWebhook: {
    status: webhookPaidRes.payload.status
  },
  downstreamCalls: calls.length
}, null, 2));

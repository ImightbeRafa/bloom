import { sendOrderEmail, sendTilopayConfirmationEmail } from './email.js';
import { sendOrderToBetsyWithRetry } from './betsy.js';
import { generateEventId, sendMetaEvent } from './meta.js';
import { normalizeTrustedOrder } from './order.js';

const processedPayments = new Set();

function channelSucceeded(result) {
  return result.status === 'fulfilled' && result.value?.success !== false;
}

function channelStatus(result) {
  if (result.status === 'rejected') {
    return { ok: false, error: result.reason?.message || String(result.reason) };
  }
  if (result.value?.success === false) {
    return { ok: false, error: result.value.error || 'Downstream returned success=false' };
  }
  return { ok: true };
}

export async function processPaidOrder({ order, transactionId, source, req, sourceUrl }) {
  const trustedOrder = normalizeTrustedOrder(order);
  const orderId = trustedOrder.orderId;
  const dedupeKey = `${orderId}:${transactionId || 'no-transaction'}`;

  if (processedPayments.has(dedupeKey)) {
    console.log(`[Fulfillment] ${dedupeKey} already processed - skipping`);
    return { success: true, order: trustedOrder, alreadyProcessed: true };
  }

  trustedOrder.paymentStatus = 'completed';
  trustedOrder.paymentId = transactionId;
  trustedOrder.transactionId = transactionId;
  trustedOrder.paymentMethod = 'Tilopay';
  trustedOrder.paidAt = new Date().toISOString();

  const appUrl = process.env.APP_URL || 'https://bloomcr.shopping';
  const metaEventId = generateEventId('purchase', orderId, transactionId);

  const results = await Promise.allSettled([
    sendOrderEmail(trustedOrder),
    sendTilopayConfirmationEmail(trustedOrder),
    sendOrderToBetsyWithRetry({ ...trustedOrder, transactionId }),
    sendMetaEvent('Purchase', metaEventId, trustedOrder, req, {
      value: trustedOrder.total,
      currency: 'CRC',
      content_ids: ['bloom-patch'],
      content_name: 'Bloom Dermal Micro-Infusion Patch',
      content_type: 'product',
      num_items: trustedOrder.cantidad
    }, sourceUrl || `${appUrl}/success.html`)
  ]);

  const channels = {
    adminEmail: channelStatus(results[0]),
    customerEmail: channelStatus(results[1]),
    betsy: channelStatus(results[2]),
    metaCapi: channelStatus(results[3])
  };

  Object.entries(channels).forEach(([name, status]) => {
    if (!status.ok) console.error(`[${source || 'Fulfillment'}] ${name} failed for ${orderId}: ${status.error}`);
  });

  const hasOperationalRecord = channelSucceeded(results[0]) || channelSucceeded(results[1]) || channelSucceeded(results[2]);
  if (hasOperationalRecord) {
    processedPayments.add(dedupeKey);
  }

  return {
    success: hasOperationalRecord,
    order: trustedOrder,
    metaEventId,
    channels
  };
}

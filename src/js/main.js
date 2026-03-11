// ─── Bloom — main.js ───────────────────────────────────────────────────────

// ── Meta Pixel Helper ────────────────────────────────────────────────────────
function metaTrack(eventName, params, options) {
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      if (params && options) {
        window.fbq('track', eventName, params, options);
      } else if (params) {
        window.fbq('track', eventName, params);
      } else {
        window.fbq('track', eventName);
      }
    }
  } catch { /* no-op */ }
}

// ── Pricing ──────────────────────────────────────────────────────────────────
const UNIT_PRICE = 8900;
const SHIPPING_FREE_THRESHOLD = 2;  // 2+ units → free shipping
const SHIPPING_COST = 2600;

function calculateOrder(qty) {
  const subtotal = UNIT_PRICE * qty;
  const shipping = qty >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_COST;
  const total = subtotal + shipping;
  return { subtotal, shipping, total };
}

// ── Costa Rica Geographic Data ────────────────────────────────────────────────
const CR_DATA = {
  'San José': ['Central', 'Escazú', 'Desamparados', 'Puriscal', 'Tarrazú', 'Aserrí', 'Mora', 'Goicoechea', 'Santa Ana', 'Alajuelita', 'Vásquez de Coronado', 'Acosta', 'Tibás', 'Moravia', 'Montes de Oca', 'Curridabat', 'Pérez Zeledón'],
  'Alajuela': ['Alajuela', 'San Ramón', 'Grecia', 'San Mateo', 'Atenas', 'Naranjo', 'Palmares', 'Poás', 'Orotina', 'San Carlos', 'Zarcero', 'Upala', 'Los Chiles', 'Guatuso'],
  'Cartago': ['Cartago', 'Paraíso', 'La Unión', 'Jiménez', 'Turrialba', 'Alvarado', 'Oreamuno', 'El Guarco'],
  'Heredia': ['Heredia', 'Barva', 'Santo Domingo', 'Santa Bárbara', 'San Rafael', 'San Isidro', 'Belén', 'Flores', 'San Pablo', 'Sarapiquí'],
  'Guanacaste': ['Liberia', 'Nicoya', 'Santa Cruz', 'Bagaces', 'Carrillo', 'Cañas', 'Abangares', 'Tilarán', 'Nandayure', 'La Cruz', 'Hojancha'],
  'Puntarenas': ['Puntarenas', 'Esparza', 'Buenos Aires', 'Montes de Oro', 'Osa', 'Quepos', 'Golfito', 'Coto Brus', 'Parrita', 'Corredores', 'Garabito'],
  'Limón': ['Limón', 'Pococí', 'Siquirres', 'Talamanca', 'Matina', 'Guácimo']
};

// ── DOM References ────────────────────────────────────────────────────────────
const provinciaSelect = document.getElementById('provincia');
const cantonSelect = document.getElementById('canton');
const qtyMinus = document.getElementById('qty-minus');
const qtyPlus = document.getElementById('qty-plus');
const qtyDisplay = document.getElementById('qty-display');
const cantidadInput = document.getElementById('cantidad');
const paymentInputs = document.querySelectorAll('input[name="paymentMethod"]');
const sinpeInfo = document.getElementById('sinpe-info');
const form = document.getElementById('order-form');
const submitBtn = document.getElementById('submit-btn');
const btnText = document.getElementById('btn-text');
const btnLoading = document.getElementById('btn-loading');
const formError = document.getElementById('form-error');

// Summary elements
const summaryQty = document.getElementById('summary-qty');
const summarySubtotal = document.getElementById('summary-subtotal');
const summaryShipping = document.getElementById('summary-shipping');
const summaryTotal = document.getElementById('summary-total');
const shippingNote = document.getElementById('shipping-note');

// ── Province / Canton Dropdowns ───────────────────────────────────────────────
function initProvinces() {
  Object.keys(CR_DATA).forEach(province => {
    const opt = document.createElement('option');
    opt.value = province;
    opt.textContent = province;
    provinciaSelect.appendChild(opt);
  });
}

provinciaSelect.addEventListener('change', () => {
  const province = provinciaSelect.value;
  cantonSelect.innerHTML = '<option value="">Seleccionar...</option>';
  cantonSelect.disabled = !province;

  if (province && CR_DATA[province]) {
    CR_DATA[province].forEach(canton => {
      const opt = document.createElement('option');
      opt.value = canton;
      opt.textContent = canton;
      cantonSelect.appendChild(opt);
    });
  }
});

// ── Quantity Control ──────────────────────────────────────────────────────────
let currentQty = 1;

function updateQty(newQty) {
  if (newQty < 1 || newQty > 10) return;
  currentQty = newQty;
  cantidadInput.value = currentQty;
  qtyDisplay.textContent = currentQty;
  updateSummary();
}

let addToCartFired = false;

qtyMinus.addEventListener('click', () => updateQty(currentQty - 1));
qtyPlus.addEventListener('click', () => {
  const prevQty = currentQty;
  updateQty(currentQty + 1);
  if (!addToCartFired && currentQty > prevQty) {
    addToCartFired = true;
    metaTrack('AddToCart', {
      content_ids: ['bloom-patch'],
      content_name: 'Bloom Dermal Micro-Infusion Patch',
      content_type: 'product',
      value: UNIT_PRICE * currentQty,
      currency: 'CRC'
    });
  }
});

// ── Order Summary ─────────────────────────────────────────────────────────────
function formatCRC(amount) {
  return `₡${Number(amount).toLocaleString('es-CR')}`;
}

function updateSummary() {
  const { subtotal, shipping, total } = calculateOrder(currentQty);

  summaryQty.textContent = `× ${currentQty}`;
  summarySubtotal.textContent = formatCRC(subtotal);
  summaryShipping.textContent = shipping === 0 ? 'GRATIS' : formatCRC(shipping);
  summaryTotal.textContent = formatCRC(total);

  const icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>`;

  if (shipping === 0) {
    shippingNote.innerHTML = `${icon} <strong>Envío gratis</strong> incluido`;
    shippingNote.classList.add('free-shipping');
  } else {
    const unitsNeeded = SHIPPING_FREE_THRESHOLD - currentQty;
    shippingNote.innerHTML = `${icon} Agrega ${unitsNeeded} unidad${unitsNeeded > 1 ? 'es' : ''} más para envío <strong>gratis</strong>`;
    shippingNote.classList.remove('free-shipping');
  }
}

// ── Payment Method Toggle ─────────────────────────────────────────────────────
paymentInputs.forEach(input => {
  input.addEventListener('change', () => {
    const isSinpe = input.value === 'SINPE';
    sinpeInfo.hidden = !isSinpe;
  });
});

// ── Form Utilities ────────────────────────────────────────────────────────────
function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.hidden = loading;
  btnLoading.hidden = !loading;
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
  formError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearError() {
  formError.hidden = true;
  formError.textContent = '';
}

function getFormData() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.cantidad = currentQty;
  return data;
}

function validateForm(data) {
  const required = ['nombre', 'telefono', 'email', 'provincia', 'canton', 'distrito', 'direccion'];
  for (const field of required) {
    if (!data[field] || !data[field].trim()) {
      const label = form.querySelector(`label[for="${field}"]`);
      const fieldName = label ? label.textContent.replace('*', '').trim() : field;
      return `Por favor completa el campo: ${fieldName}`;
    }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    return 'Por favor ingresa un correo electrónico válido.';
  }
  return null;
}

// ── Payment Handlers ──────────────────────────────────────────────────────────
async function handleTilopay(data) {
  const res = await fetch('/api/tilopay/create-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await res.json();

  if (!res.ok || !result.success) {
    throw new Error(result.error || 'Error al crear el pago. Intenta de nuevo.');
  }

  if (result.paymentUrl) {
    metaTrack('InitiateCheckout', {
      content_ids: ['bloom-patch'],
      content_type: 'product',
      num_items: parseInt(data.cantidad) || 1,
      value: calculateOrder(parseInt(data.cantidad) || 1).total,
      currency: 'CRC'
    }, { eventID: result.metaEventId });
    window.location.href = result.paymentUrl;
  } else {
    throw new Error('No se recibió el enlace de pago. Intenta de nuevo.');
  }
}

async function handleSinpe(data) {
  const res = await fetch('/api/email/send-sinpe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await res.json();

  if (!res.ok || !result.success) {
    throw new Error(result.error || 'Error al procesar el pedido. Intenta de nuevo.');
  }

  showSinpeConfirmation(result.orderId, result.total, result.sinpePhone, result.sinpeHolder);

  metaTrack('Lead', {
    content_name: 'SINPE Order',
    value: result.total,
    currency: 'CRC'
  });
}

function showSinpeConfirmation(orderId, total, sinpePhone, sinpeHolder) {
  const formSection = document.getElementById('order');
  formSection.innerHTML = `
    <div class="container" style="max-width:560px;">
      <div class="sinpe-confirm">

        <div class="sinpe-confirm-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#612CE6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>

        <h2 class="sinpe-confirm-title">Pedido recibido</h2>
        <p class="sinpe-confirm-sub">Realizá tu SINPE Móvil con los datos de abajo. También te enviamos las instrucciones por correo.</p>

        <!-- SINPE Payment Box -->
        <div class="sinpe-pay-box">
          <p class="sinpe-pay-heading">SINPE Móvil</p>

          <div class="sinpe-pay-row">
            <span class="sinpe-pay-label">Número</span>
            <span class="sinpe-pay-value sinpe-pay-phone">${sinpePhone}</span>
          </div>
          <div class="sinpe-pay-row">
            <span class="sinpe-pay-label">A nombre de</span>
            <span class="sinpe-pay-value">${sinpeHolder}</span>
          </div>
          <div class="sinpe-pay-divider"></div>
          <div class="sinpe-pay-row">
            <span class="sinpe-pay-label">Monto exacto</span>
            <span class="sinpe-pay-value sinpe-pay-amount">${formatCRC(total)}</span>
          </div>
          <div class="sinpe-pay-row">
            <span class="sinpe-pay-label">Concepto / Referencia</span>
            <span class="sinpe-pay-value sinpe-pay-ref">${orderId}</span>
          </div>
        </div>

        <!-- Steps -->
        <div class="sinpe-steps">
          <div class="sinpe-step">
            <span class="sinpe-step-num">1</span>
            <span>Usá el número de tu orden como concepto del SINPE</span>
          </div>
          <div class="sinpe-step">
            <span class="sinpe-step-num">2</span>
            <span>Guardá el comprobante de pago</span>
          </div>
          <div class="sinpe-step">
            <span class="sinpe-step-num">3</span>
            <span>Enviá el comprobante por WhatsApp al <strong>${sinpePhone}</strong></span>
          </div>
        </div>

        <p class="sinpe-confirm-note">Tu pedido será procesado dentro de 24 horas hábiles tras confirmar el pago.</p>

        <a href="/" class="btn-primary" style="width:100%;text-align:center;margin-top:8px;">Volver a la tienda</a>
      </div>
    </div>
  `;
}

// ── Form Submit ───────────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const data = getFormData();
  const validationError = validateForm(data);

  if (validationError) {
    showError(validationError);
    return;
  }

  setLoading(true);

  try {
    const method = data.paymentMethod;
    if (method === 'SINPE') {
      await handleSinpe(data);
    } else {
      await handleTilopay(data);
    }
  } catch (err) {
    showError(err.message || 'Ocurrió un error inesperado. Por favor intenta de nuevo.');
    setLoading(false);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────
initProvinces();
updateSummary();

// ── Meta Pixel: ViewContent on product section visibility ────────────────────
(function () {
  var orderSection = document.getElementById('order');
  if (!orderSection) return;
  var viewContentFired = false;
  var vcObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !viewContentFired) {
        viewContentFired = true;
        metaTrack('ViewContent', {
          content_ids: ['bloom-patch'],
          content_name: 'Bloom Dermal Micro-Infusion Patch',
          content_type: 'product',
          value: UNIT_PRICE,
          currency: 'CRC'
        });
        vcObserver.disconnect();
      }
    });
  }, { threshold: 0.55 });
  vcObserver.observe(orderSection);
})();

// ── Interactive Background ────────────────────────────────────────────────────
const rootStyle = document.documentElement.style;
let bgTicking = false;

function updateBackground(clientX, clientY) {
  if (!bgTicking) {
    window.requestAnimationFrame(() => {
      const x = (clientX / window.innerWidth) - 0.5;
      const y = (clientY / window.innerHeight) - 0.5;

      rootStyle.setProperty('--mx', `${x * 240}px`);
      rootStyle.setProperty('--my', `${y * 240}px`);

      const distance = Math.sqrt(x * x + y * y);
      const intensity = Math.max(1, 1.25 + (0.8 - distance * 1.8));
      rootStyle.setProperty('--mscale', intensity.toFixed(3));

      const opacity = Math.min(1, 0.9 + (distance * 0.6));
      rootStyle.setProperty('--mopacity', opacity.toFixed(3));

      bgTicking = false;
    });
    bgTicking = true;
  }
}

document.addEventListener('mousemove', (e) => {
  updateBackground(e.clientX, e.clientY);
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    updateBackground(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: true });

// ── Scroll Reveal ────────────────────────────────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal, .reveal-scale, .reveal-stagger').forEach(el => {
  revealObserver.observe(el);
});

// ── Hero Product Tilt ────────────────────────────────────────────────────────
const heroVisual = document.querySelector('.hero-visual-container');
if (heroVisual) {
  document.addEventListener('mousemove', (e) => {
    const rect = heroVisual.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;
    heroVisual.style.transform = `perspective(800px) rotateY(${dx * 6}deg) rotateX(${-dy * 6}deg)`;
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    heroVisual.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg)';
  });
}

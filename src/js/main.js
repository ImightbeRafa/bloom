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

function getMetaCookies() {
  try {
    const cookies = document.cookie.split(';').reduce((acc, c) => {
      const [k, ...v] = c.trim().split('=');
      acc[k] = v.join('=');
      return acc;
    }, {});
    return { fbc: cookies._fbc || '', fbp: cookies._fbp || '' };
  } catch { return { fbc: '', fbp: '' }; }
}

// ── Pricing ──────────────────────────────────────────────────────────────────
const UNIT_PRICE = 8900;
const PROMO_PRICE = 4450;        // 50% off when qty >= 2
const PROMO_THRESHOLD = 2;
const SHIPPING_COST = 3000;      // flat ₡3,000 shipping on all orders

function calculateOrder(qty) {
  const unitPrice = qty >= PROMO_THRESHOLD ? PROMO_PRICE : UNIT_PRICE;
  const subtotal = unitPrice * qty;
  const shipping = SHIPPING_COST;
  const total = subtotal + shipping;
  const saved = qty >= PROMO_THRESHOLD ? (UNIT_PRICE - PROMO_PRICE) * qty : 0;
  return { subtotal, shipping, total, unitPrice, saved };
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
const btnTotalEl = document.getElementById('btn-total');

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
let currentQty = 2;

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
  const { subtotal, shipping, total, unitPrice, saved } = calculateOrder(currentQty);

  summaryQty.textContent = `× ${currentQty}`;
  summarySubtotal.textContent = formatCRC(subtotal);
  summaryShipping.textContent = formatCRC(shipping);
  summaryTotal.textContent = formatCRC(total);
  if (btnTotalEl) btnTotalEl.textContent = formatCRC(total);

  // Update product price display
  const priceEl = document.getElementById('order-price-display');
  if (priceEl) {
    if (currentQty >= PROMO_THRESHOLD) {
      priceEl.innerHTML = `<span class="price-original">₡8,900</span> ₡4,450 <span class="order-product-unit">/ unidad</span>`;
    } else {
      priceEl.innerHTML = `₡8,900 <span class="order-product-unit">/ unidad</span>`;
    }
  }

  const icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>`;

  if (currentQty >= PROMO_THRESHOLD) {
    shippingNote.innerHTML = `${icon} <strong>-50% aplicado</strong> — Ahorrás ${formatCRC(saved)} en esta orden`;
    shippingNote.classList.add('free-shipping');
  } else {
    shippingNote.innerHTML = `${icon} Agrega 1 unidad más y obtené <strong>50% de descuento</strong>`;
    shippingNote.classList.remove('free-shipping');
  }

  // Show/hide savings row
  const savingsRow = document.getElementById('summary-savings-row');
  const savingsAmount = document.getElementById('summary-savings');
  if (savingsRow && savingsAmount) {
    if (saved > 0) {
      savingsRow.hidden = false;
      savingsAmount.textContent = `-${formatCRC(saved)}`;
    } else {
      savingsRow.hidden = true;
    }
  }
}

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
  const { fbc, fbp } = getMetaCookies();
  if (fbc) data.fbc = fbc;
  if (fbp) data.fbp = fbp;
  data.source_url = window.location.href;
  return data;
}

function validateForm(data) {
  const required = ['nombre', 'apellido', 'telefono', 'email', 'provincia', 'canton', 'distrito', 'direccion'];
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
      content_name: 'Bloom Dermal Micro-Infusion Patch',
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

  // Fire AddToCart if not already fired (covers qty=1 users who never changed quantity)
  if (!addToCartFired) {
    addToCartFired = true;
    metaTrack('AddToCart', {
      content_ids: ['bloom-patch'],
      content_name: 'Bloom Dermal Micro-Infusion Patch',
      content_type: 'product',
      value: calculateOrder(currentQty).total,
      currency: 'CRC'
    });
  }

  setLoading(true);

  try {
    await handleTilopay(data);
  } catch (err) {
    showError(err.message || 'Ocurrió un error inesperado. Por favor intenta de nuevo.');
    setLoading(false);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────
initProvinces();
updateQty(2); // default to 2 for promo

// ── Promo Countdown Timer ────────────────────────────────────────────────────
(function () {
  const timerEls = document.querySelectorAll('.promo-timer');
  if (!timerEls.length) return;

  function getNextReset() {
    // Resets every 24h at midnight Costa Rica time (UTC-6)
    const now = new Date();
    const crOffset = -6 * 60;
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const crNow = new Date(utc + crOffset * 60000);
    const tomorrow = new Date(crNow);
    tomorrow.setHours(24, 0, 0, 0);
    const diff = tomorrow.getTime() - crNow.getTime();
    return Date.now() + diff;
  }

  let target = getNextReset();

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    let remaining = target - Date.now();
    if (remaining <= 0) {
      target = getNextReset();
      remaining = target - Date.now();
    }
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    const display = `${pad(h)}:${pad(m)}:${pad(s)}`;
    timerEls.forEach(el => { el.textContent = display; });
    requestAnimationFrame(tick);
  }
  tick();
})();

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
  }, { threshold: 0.25 });
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

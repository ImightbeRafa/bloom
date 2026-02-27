// ─── Bloom — main.js ───────────────────────────────────────────────────────

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

qtyMinus.addEventListener('click', () => updateQty(currentQty - 1));
qtyPlus.addEventListener('click', () => updateQty(currentQty + 1));

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

  // Show SINPE confirmation in place of form
  showSinpeConfirmation(result.orderId, result.total);
}

function showSinpeConfirmation(orderId, total) {
  const formSection = document.getElementById('order');
  formSection.innerHTML = `
    <div class="container">
      <div class="card" style="max-width: 560px; margin: 0 auto; text-align: center; padding: 48px 40px;">
        <div style="width:64px;height:64px;background:rgba(94,23,235,0.07);border:1px solid rgba(94,23,235,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5e17eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.77 9.8a19.79 19.79 0 01-3.07-8.57A2 2 0 012.68 1h3a2 2 0 012 1.72 12.05 12.05 0 00.64 2.57 2 2 0 01-.45 2.11L6.91 8.4a16 16 0 006.69 6.69l1-1a2 2 0 012.11-.45 12.05 12.05 0 002.57.64A2 2 0 0122 16.92z"/>
          </svg>
        </div>
        <h2 style="font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800;margin-bottom:12px;color:#1a1030;">Pedido recibido</h2>
        <p style="color:#6b5b95;margin-bottom:24px;">Revisa tu correo — te enviamos las instrucciones de pago por SINPE Móvil.</p>
        <div style="background:rgba(94,23,235,0.05);border:1px solid rgba(94,23,235,0.12);border-radius:12px;padding:20px;margin-bottom:24px;text-align:left;">
          <p style="font-size:0.85rem;color:#6b5b95;margin-bottom:8px;">Número de orden</p>
          <p style="font-family:'Syne',sans-serif;font-weight:700;color:#1a1030;">${orderId}</p>
          <p style="font-size:0.85rem;color:#6b5b95;margin-top:12px;margin-bottom:8px;">Total a transferir</p>
          <p style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.3rem;background:linear-gradient(135deg,#5e17eb,#b57bee);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${formatCRC(total)}</p>
        </div>
        <p style="font-size:0.85rem;color:#a095c0;">¿Dudas? Escríbenos por WhatsApp.</p>
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

// ── Init ──────────────────────────────────────────────────────────────────────
initProvinces();
updateSummary();

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

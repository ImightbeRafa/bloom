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

// ── UGC Video Carousel ───────────────────────────────────────────────────────
// Reels-style vertical videos: lazy-load, autoplay most-visible, tap-to-unmute,
// fires Meta Pixel engagement events (conversion signals for Meta Ads optimizer).
(function () {
  const carousel = document.getElementById('ugc-carousel');
  if (!carousel) return;

  const cards = Array.from(carousel.querySelectorAll('.ugc-card'));
  if (!cards.length) return;

  const navPrev = document.querySelector('.ugc-nav-prev');
  const navNext = document.querySelector('.ugc-nav-next');

  // Engagement tracking thresholds (fire once per video)
  const engagementFired = new WeakMap();

  function fireVideoEngagement(video, percent) {
    const key = engagementFired.get(video) || {};
    if (key[percent]) return;
    key[percent] = true;
    engagementFired.set(video, key);

    // Meta Pixel custom event — strong conversion signal for the ad algorithm
    const src = video.dataset.src || 'ugc-video';
    try {
      if (typeof window.fbq === 'function') {
        if (percent === 25) {
          window.fbq('trackCustom', 'VideoEngagement_25', {
            video_source: src,
            content_name: 'UGC Testimonial',
            content_category: 'testimonial'
          });
        } else if (percent === 50) {
          // 50% watched → also fire a ViewContent boost for retargeting
          window.fbq('track', 'ViewContent', {
            content_ids: ['bloom-patch'],
            content_name: 'Bloom Dermal Micro-Infusion Patch',
            content_type: 'product',
            content_category: 'ugc_testimonial',
            value: UNIT_PRICE,
            currency: 'CRC'
          });
          window.fbq('trackCustom', 'VideoEngagement_50', {
            video_source: src,
            content_name: 'UGC Testimonial'
          });
        } else if (percent === 75) {
          window.fbq('trackCustom', 'VideoEngagement_75', {
            video_source: src,
            content_name: 'UGC Testimonial'
          });
        } else if (percent === 100) {
          window.fbq('trackCustom', 'VideoEngagement_Complete', {
            video_source: src,
            content_name: 'UGC Testimonial'
          });
        }
      }
    } catch { /* no-op */ }
  }

  function attachTimeTracker(video) {
    if (video._timeTrackerAttached) return;
    video._timeTrackerAttached = true;
    video.addEventListener('timeupdate', () => {
      const d = video.duration;
      if (!d || !isFinite(d) || d <= 0) return;
      const pct = (video.currentTime / d) * 100;
      if (pct >= 25) fireVideoEngagement(video, 25);
      if (pct >= 50) fireVideoEngagement(video, 50);
      if (pct >= 75) fireVideoEngagement(video, 75);
      if (pct >= 95) fireVideoEngagement(video, 100);
    });
  }

  // Lazy-load video src when card is near viewport (±400px).
  // Uses preload=metadata so the first FRAME shows (not just the poster) —
  // makes the creator's face visible before playback starts.
  function loadVideoSrc(video) {
    if (video._srcLoaded) return;
    const src = video.dataset.src;
    if (!src) return;
    video._srcLoaded = true;
    video.preload = 'metadata';
    video.src = src;
    video.load();
    attachTimeTracker(video);
  }

  const lazyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting) {
        loadVideoSrc(video);
      }
    });
  }, { rootMargin: '400px 0px', threshold: 0.01 });

  cards.forEach(card => {
    const video = card.querySelector('.ugc-video');
    if (video) lazyObserver.observe(video);
  });

  // Eagerly preload the first 2 cards so playback feels instant on scroll-in
  const firstVideos = cards.slice(0, 2)
    .map(c => c.querySelector('.ugc-video'))
    .filter(Boolean);
  firstVideos.forEach(loadVideoSrc);

  // Autoplay most-visible card, pause others
  let activeCard = null;

  function setActiveCard(card) {
    if (activeCard === card) return;

    // Pause previous
    if (activeCard) {
      const prevVideo = activeCard.querySelector('.ugc-video');
      if (prevVideo) {
        prevVideo.pause();
        // Reset mute on inactive card so next one starts muted
        prevVideo.muted = true;
        updateMuteIcon(activeCard, true);
      }
      activeCard.classList.remove('is-playing');
    }

    activeCard = card;

    if (card) {
      const video = card.querySelector('.ugc-video');
      if (video) {
        loadVideoSrc(video);
        video.muted = true; // autoplay requires muted
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => { /* autoplay blocked — user can tap play */ });
        }
        card.classList.add('is-playing');
        updateMuteIcon(card, true);
      }
    }
  }

  const visibilityObserver = new IntersectionObserver((entries) => {
    // Find the entry with highest intersection ratio
    let best = null;
    entries.forEach(entry => {
      if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
        best = entry;
      }
    });

    // Check all currently observed cards to find most-visible overall
    const visibleCards = cards.filter(card => {
      const rect = card.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return rect.bottom > 0 && rect.top < vh;
    });

    if (!visibleCards.length) {
      setActiveCard(null);
      return;
    }

    // Pick the card closest to center of viewport
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const viewportCenterY = vh / 2;
    const viewportCenterX = vw / 2;

    let closest = null;
    let closestDist = Infinity;
    visibleCards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(cx - viewportCenterX, cy - viewportCenterY);
      if (dist < closestDist) {
        closestDist = dist;
        closest = card;
      }
    });

    setActiveCard(closest);
  }, { threshold: [0.3, 0.6, 0.9] });

  cards.forEach(card => visibilityObserver.observe(card));

  // Also update active card on horizontal scroll (carousel swipe)
  let scrollRaf = null;
  carousel.addEventListener('scroll', () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = null;
      const rect = carousel.getBoundingClientRect();
      const carouselCenterX = rect.left + rect.width / 2;
      let closest = null;
      let closestDist = Infinity;
      cards.forEach(card => {
        const cRect = card.getBoundingClientRect();
        const cx = cRect.left + cRect.width / 2;
        const dist = Math.abs(cx - carouselCenterX);
        if (dist < closestDist) {
          closestDist = dist;
          closest = card;
        }
      });
      if (closest) setActiveCard(closest);
    });
  }, { passive: true });

  // ── Click handlers per card ─────────────────────────────────────────────
  function updateMuteIcon(card, muted) {
    const iconMuted = card.querySelector('.ugc-icon-muted');
    const iconSound = card.querySelector('.ugc-icon-sound');
    if (iconMuted && iconSound) {
      iconMuted.hidden = !muted;
      iconSound.hidden = muted;
    }
  }

  function updatePlayIcon(card, playing) {
    const iconPlay = card.querySelector('.ugc-icon-play');
    const iconPause = card.querySelector('.ugc-icon-pause');
    if (iconPlay && iconPause) {
      iconPlay.hidden = playing;
      iconPause.hidden = !playing;
    }
  }

  cards.forEach(card => {
    const video = card.querySelector('.ugc-video');
    const playBtn = card.querySelector('.ugc-play-btn');
    const muteBtn = card.querySelector('.ugc-mute-btn');
    const media = card.querySelector('.ugc-card-media');
    if (!video || !media) return;

    // Play/pause toggle (and unmute on user interaction)
    const togglePlay = (e) => {
      if (e) e.stopPropagation();
      loadVideoSrc(video);
      if (video.paused) {
        // User gesture: can unmute
        video.muted = false;
        updateMuteIcon(card, false);
        video.play().catch(() => {});
        setActiveCard(card);
      } else {
        video.pause();
      }
    };

    if (playBtn) playBtn.addEventListener('click', togglePlay);
    media.addEventListener('click', (e) => {
      if (e.target.closest('.ugc-mute-btn')) return;
      togglePlay(e);
    });

    // Mute toggle (independent of play)
    if (muteBtn) {
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        loadVideoSrc(video);
        video.muted = !video.muted;
        updateMuteIcon(card, video.muted);
        if (video.paused) {
          video.play().catch(() => {});
        }
      });
    }

    video.addEventListener('play', () => {
      card.classList.add('is-playing');
      updatePlayIcon(card, true);
    });
    video.addEventListener('pause', () => {
      card.classList.remove('is-playing');
      updatePlayIcon(card, false);
    });
  });

  // ── Desktop arrow navigation ────────────────────────────────────────────
  function scrollByCard(direction) {
    if (!cards.length) return;
    const card = cards[0];
    const gap = 18;
    const amount = (card.offsetWidth + gap) * direction;
    carousel.scrollBy({ left: amount, behavior: 'smooth' });
  }

  if (navPrev) navPrev.addEventListener('click', () => scrollByCard(-1));
  if (navNext) navNext.addEventListener('click', () => scrollByCard(1));
})();

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

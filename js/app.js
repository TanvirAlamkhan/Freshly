/* app.js — main application */

const SLIDES = [
  { tag: 'Farm Fresh', title: "Nature's Best,\nDelivered Fast", sub: 'Handpicked organic produce from local farms.', cta: 'Shop Fresh', emoji: '🥬', bg: 'linear-gradient(135deg,#15803d,#166534,#0f4c1e)', href: '#featured' },
  { tag: 'Weekend Deal', title: '20% Off All\nOrganic Fruits', sub: 'Use code FRESH20 at checkout.', cta: 'Grab the Deal', emoji: '🍓', bg: 'linear-gradient(135deg,#be185d,#9d174d,#701a47)', href: '#deals' },
  { tag: 'New Arrivals', title: 'Exotic Produce\nJust Landed', sub: 'Rare fruits and vegetables from around the world.', cta: 'Explore Now', emoji: '🥭', bg: 'linear-gradient(135deg,#b45309,#92400e,#6b2e08)', href: '#featured' },
];

let allProducts = [], allCategories = [], activeFilter = 'all', visibleCount = 8;
let heroIndex = 0, heroTimer = null, qvProduct = null, qvQty = 1;

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const fmt = p => '$' + Number(p).toFixed(2);

const dom = {
  navbar: $('#navbar'), heroSlider: $('#hero-slider'), heroDots: $('#hero-dots'),
  heroPrev: $('#hero-prev'), heroNext: $('#hero-next'),
  categoriesGrid: $('#categories-grid'), filterBar: $('#filter-bar'),
  productsGrid: $('#products-grid'), loadMoreBtn: $('#load-more-btn'),
  searchInput: $('#search-input'), searchDropdown: $('#search-dropdown'),
  cartBtn: $('#cart-btn'), cartBadge: $('#cart-badge'),
  cartOverlay: $('#cart-overlay'), cartSidebar: $('#cart-sidebar'),
  cartClose: $('#cart-close'), cartBody: $('#cart-body'),
  cartFooter: $('#cart-footer'), cartTotalDisplay: $('#cart-total-display'),
  checkoutBtn: $('#checkout-btn'),
  authBtn: $('#auth-btn'), authLabel: $('#auth-label'),
  hamburger: $('#hamburger'), mobileNav: $('#mobile-nav'),
  toastContainer: $('#toast-container'), year: $('#year'),
  authOverlay: $('#auth-modal-overlay'), modalClose: $('#modal-close'),
  tabLogin: $('#tab-login'), tabRegister: $('#tab-register'),
  panelLogin: $('#panel-login'), panelRegister: $('#panel-register'),
  loginForm: $('#login-form'), loginEmail: $('#login-email'),
  loginPassword: $('#login-password'), loginError: $('#login-error'),
  loginSubmit: $('#login-submit'), registerForm: $('#register-form'),
  regName: $('#reg-name'), regEmail: $('#reg-email'),
  regPassword: $('#reg-password'), registerError: $('#register-error'),
  registerSubmit: $('#register-submit'),
  checkoutOverlay: $('#checkout-modal-overlay'), checkoutModalClose: $('#checkout-modal-close'),
  checkoutForm: $('#checkout-form'), checkoutItems: $('#checkout-items'),
  coSubtotal: $('#co-subtotal'), coTotal: $('#co-total'),
  checkoutError: $('#checkout-error'), placeOrderBtn: $('#place-order-btn'),
  successOverlay: $('#success-modal-overlay'), successMsg: $('#success-msg'),
  successClose: $('#success-close'),
  qvOverlay: $('#quickview-overlay'), qvClose: $('#qv-close'),
  qvEmoji: $('#qv-emoji'), qvBadge: $('#qv-badge'), qvTitle: $('#qv-title'),
  qvDesc: $('#qv-desc'), qvPrice: $('#qv-price'), qvUnit: $('#qv-unit'),
  qvMinus: $('#qv-minus'), qvPlus: $('#qv-plus'), qvQtyEl: $('#qv-qty'),
  qvAddBtn: $('#qv-add-btn'),
};

/* ---- TOAST ---- */
function toast(msg, type = 'success', ms = 3200) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  dom.toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, ms);
}

/* ---- MODAL ---- */
function openModal(el)  { el.classList.add('open'); el.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden'; }
function closeModal(el) { el.classList.remove('open'); el.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; }

/* ---- HERO ---- */
function buildHero() {
  dom.heroSlider.innerHTML = SLIDES.map(s => `
    <div class="hero-slide" style="background:${s.bg}">
      <div class="hero-slide-content">
        <span class="hero-tag">${s.tag}</span>
        <h1 class="hero-title">${s.title.replace('\n','<br>')}</h1>
        <p class="hero-sub">${s.sub}</p>
        <a href="${s.href}" class="hero-cta">${s.cta} →</a>
      </div>
      <span class="hero-emoji" aria-hidden="true">${s.emoji}</span>
    </div>`).join('');

  dom.heroDots.innerHTML = SLIDES.map((_,i) =>
    `<button class="hero-dot${i===0?' active':''}" data-idx="${i}" aria-label="Slide ${i+1}"></button>`
  ).join('');

  dom.heroDots.addEventListener('click', e => { const b = e.target.closest('.hero-dot'); if (b) goSlide(+b.dataset.idx); });
  dom.heroPrev.addEventListener('click', () => goSlide((heroIndex - 1 + SLIDES.length) % SLIDES.length));
  dom.heroNext.addEventListener('click', () => goSlide((heroIndex + 1) % SLIDES.length));
  heroTimer = setInterval(() => goSlide((heroIndex + 1) % SLIDES.length), 5000);
}

function goSlide(i) {
  heroIndex = i;
  dom.heroSlider.style.transform = `translateX(-${i * 100}%)`;
  $$('.hero-dot').forEach((d, j) => d.classList.toggle('active', j === i));
  clearInterval(heroTimer);
  heroTimer = setInterval(() => goSlide((heroIndex + 1) % SLIDES.length), 5000);
}

/* ---- CATEGORIES ---- */
function renderCategories(cats) {
  dom.categoriesGrid.innerHTML = cats.map(c => `
    <div class="category-card" data-cat-id="${c.id}" role="button" tabindex="0" aria-label="${c.name}">
      <span class="cat-emoji">${c.icon || c.emoji || '🥗'}</span>
      <span class="cat-name">${c.name}</span>
    </div>`).join('');

  dom.categoriesGrid.addEventListener('click', e => {
    const card = e.target.closest('.category-card');
    if (!card) return;
    const id = card.dataset.catId;
    setFilter(id);
    $$('.category-card').forEach(c => c.classList.toggle('active', c.dataset.catId === id));
    $('#featured').scrollIntoView({ behavior: 'smooth' });
  });
}

/* ---- FILTER ---- */
function buildFilterBar(cats) {
  $$('.filter-btn:not([data-filter="all"])', dom.filterBar).forEach(b => b.remove());
  cats.forEach(c => {
    const b = document.createElement('button');
    b.className = 'filter-btn';
    b.dataset.filter = c.id;
    b.textContent = `${c.icon || c.emoji || ''} ${c.name}`.trim();
    dom.filterBar.appendChild(b);
  });
  dom.filterBar.addEventListener('click', e => {
    const b = e.target.closest('.filter-btn');
    if (!b) return;
    $$('.filter-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    setFilter(b.dataset.filter);
  });
}

function setFilter(f) { activeFilter = f; visibleCount = 8; renderProducts(); }

/* ---- PRODUCTS ---- */
const BADGE_CLASS = { ORGANIC: 'badge-organic', SALE: 'badge-sale', NEW: 'badge-new', POPULAR: 'badge-popular', HOT: 'badge-hot' };

function productImage(p) {
  const src = p.imageUrl || p.emoji || '';
  if (!src) return '<span class="prod-emoji">🛒</span>';
  if (src.startsWith('/') || src.startsWith('http')) {
    return `<img src="${src}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="prod-emoji" style="display:none">🛒</span>`;
  }
  return `<span class="prod-emoji">${src}</span>`;
}

function filtered() {
  let list = allProducts;
  if (activeFilter !== 'all') list = list.filter(p => String(p.categoryId) === String(activeFilter));
  const q = dom.searchInput.value.trim().toLowerCase();
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q));
  return list;
}

function renderProducts() {
  const list = filtered();
  const visible = list.slice(0, visibleCount);

  if (!visible.length) {
    dom.productsGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--gray-400)"><div style="font-size:48px;margin-bottom:12px">🔍</div><p style="font-size:16px;font-weight:500">No products found</p></div>`;
    dom.loadMoreBtn.style.display = 'none';
    return;
  }

  dom.productsGrid.innerHTML = visible.map(p => {
    const stock = p.inventory?.stockQuantity ?? 99;
    const low = stock > 0 && stock <= 5;
    const out = stock === 0;
    return `
      <article class="product-card" data-id="${p.id}">
        <div class="product-img-wrap" data-action="quickview">
          ${p.badge ? `<span class="product-badge ${BADGE_CLASS[p.badge]||'badge-organic'}">${p.badge}</span>` : ''}
          ${productImage(p)}
        </div>
        <div class="product-info">
          <h3 class="product-name">${p.name}</h3>
          <p class="product-desc">${p.description||''}</p>
          <div class="product-footer">
            <div class="product-price-block">
              <span class="product-price">${fmt(p.price)}</span>
              <span class="product-unit">${p.unit||'each'}</span>
              ${low ? `<span class="product-stock-low">Only ${stock} left!</span>` : ''}
            </div>
            ${out
              ? `<span style="font-size:12px;color:var(--gray-400);font-weight:600">Out of stock</span>`
              : `<button class="add-btn" data-action="add" aria-label="Add ${p.name} to cart">+</button>`}
          </div>
        </div>
      </article>`;
  }).join('');

  dom.loadMoreBtn.style.display = list.length > visibleCount ? 'inline-flex' : 'none';
}

/* ---- QUICK VIEW ---- */
function openQuickView(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  qvProduct = p; qvQty = 1;
  const src = p.imageUrl || p.emoji || '🛒';
  if (src.startsWith('/') || src.startsWith('http')) {
    dom.qvEmoji.innerHTML = `<img src="${src}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
  } else {
    dom.qvEmoji.textContent = src;
  }
  dom.qvTitle.textContent = p.name;
  dom.qvDesc.textContent  = p.description || '';
  dom.qvPrice.textContent = fmt(p.price);
  dom.qvUnit.textContent  = `/ ${p.unit || 'each'}`;
  dom.qvQtyEl.textContent = 1;
  if (p.badge) { dom.qvBadge.textContent = p.badge; dom.qvBadge.className = `qv-badge ${BADGE_CLASS[p.badge]||'badge-organic'}`; dom.qvBadge.style.display = ''; }
  else dom.qvBadge.style.display = 'none';
  openModal(dom.qvOverlay);
}

dom.qvMinus?.addEventListener('click', () => { if (qvQty > 1) dom.qvQtyEl.textContent = --qvQty; });
dom.qvPlus?.addEventListener('click',  () => { dom.qvQtyEl.textContent = ++qvQty; });
dom.qvAddBtn?.addEventListener('click', () => {
  if (!qvProduct) return;
  Cart.add(qvProduct, qvQty);
  toast(`${qvProduct.imageUrl||'🛒'} ${qvProduct.name} ×${qvQty} added`);
  bumpBadge(); closeModal(dom.qvOverlay);
});
dom.qvClose?.addEventListener('click', () => closeModal(dom.qvOverlay));
dom.qvOverlay?.addEventListener('click', e => { if (e.target === dom.qvOverlay) closeModal(dom.qvOverlay); });

/* ---- CART UI ---- */
function bumpBadge() {
  dom.cartBadge.classList.remove('bump');
  void dom.cartBadge.offsetWidth;
  dom.cartBadge.classList.add('bump');
}

function renderCart({ items, count, total }) {
  dom.cartBadge.textContent = count;
  dom.cartTotalDisplay.textContent = fmt(total);

  if (!items.length) {
    dom.cartBody.innerHTML = `<div class="cart-empty"><span class="cart-empty-icon">🛒</span><span class="cart-empty-text">Your cart is empty</span><p style="font-size:13px;color:var(--gray-400)">Add some fresh items!</p></div>`;
    dom.cartFooter?.classList.add('hidden');
    return;
  }
  dom.cartFooter?.classList.remove('hidden');
  dom.cartBody.innerHTML = items.map(i => `
    <div class="cart-item" data-cart-id="${i.id}">
      <div class="cart-item-emoji">${i.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${i.name}</div>
        <div class="cart-item-price">${fmt(Number(i.price) * i.quantity)}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-action="dec">−</button>
          <span class="qty-display">${i.quantity}</span>
          <button class="qty-btn" data-action="inc">+</button>
        </div>
      </div>
      <button class="cart-item-remove" data-action="remove" aria-label="Remove ${i.name}">✕</button>
    </div>`).join('');

  dom.cartBody.addEventListener('click', e => {
    const item = e.target.closest('.cart-item');
    const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
    if (!item || !action) return;
    const id = +item.dataset.cartId;
    const cur = Cart.items().find(x => x.id === id);
    if (action === 'inc')    Cart.setQty(id, (cur?.quantity||1) + 1);
    if (action === 'dec')    Cart.setQty(id, (cur?.quantity||1) - 1);
    if (action === 'remove') Cart.remove(id);
  });
}

function openCart()  { dom.cartSidebar.classList.add('open'); dom.cartOverlay.classList.add('open'); dom.cartSidebar.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden'; }
function closeCart() { dom.cartSidebar.classList.remove('open'); dom.cartOverlay.classList.remove('open'); dom.cartSidebar.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; }

dom.cartBtn?.addEventListener('click', openCart);
dom.cartClose?.addEventListener('click', closeCart);
dom.cartOverlay?.addEventListener('click', closeCart);

/* ---- AUTH ---- */
dom.authBtn?.addEventListener('click', () => {
  if (API.isLoggedIn()) { API.logout(); updateAuthUI(); toast('Signed out', 'info'); }
  else openModal(dom.authOverlay);
});
dom.modalClose?.addEventListener('click', () => closeModal(dom.authOverlay));
dom.authOverlay?.addEventListener('click', e => { if (e.target === dom.authOverlay) closeModal(dom.authOverlay); });
dom.tabLogin?.addEventListener('click', () => { dom.tabLogin.classList.add('active'); dom.tabRegister.classList.remove('active'); dom.panelLogin.classList.remove('hidden'); dom.panelRegister.classList.add('hidden'); });
dom.tabRegister?.addEventListener('click', () => { dom.tabRegister.classList.add('active'); dom.tabLogin.classList.remove('active'); dom.panelRegister.classList.remove('hidden'); dom.panelLogin.classList.add('hidden'); });

dom.loginForm?.addEventListener('submit', async e => {
  e.preventDefault(); dom.loginError.textContent = '';
  setLoading(dom.loginSubmit, true);
  try { await API.login(dom.loginEmail.value.trim(), dom.loginPassword.value); closeModal(dom.authOverlay); updateAuthUI(); toast('Welcome back! 👋'); }
  catch (err) { dom.loginError.textContent = err.message; }
  finally { setLoading(dom.loginSubmit, false); }
});

dom.registerForm?.addEventListener('submit', async e => {
  e.preventDefault(); dom.registerError.textContent = '';
  if (dom.regPassword.value.length < 8) { dom.registerError.textContent = 'Password must be at least 8 characters'; return; }
  setLoading(dom.registerSubmit, true);
  try { await API.register(dom.regName.value.trim(), dom.regEmail.value.trim(), dom.regPassword.value); closeModal(dom.authOverlay); updateAuthUI(); toast('Welcome to Freshly 🥬'); }
  catch (err) { dom.registerError.textContent = err.message; }
  finally { setLoading(dom.registerSubmit, false); }
});

function updateAuthUI() {
  const u = API.currentUser();
  dom.authLabel.textContent = u ? (u.name?.split(' ')[0] || 'Account') : 'Sign In';
  const ordersBtn = document.getElementById('orders-btn');
  if (ordersBtn) ordersBtn.style.display = u ? 'flex' : 'none';
}

/* ---- MY ORDERS ---- */
const STATUS_COLOR = { PENDING:'#f59e0b', PAID:'#3b82f6', SHIPPED:'#8b5cf6', DELIVERED:'#22c55e', CANCELLED:'#ef4444' };
const STATUS_BG    = { PENDING:'#fef3c7', PAID:'#dbeafe', SHIPPED:'#ede9fe', DELIVERED:'#dcfce7', CANCELLED:'#fee2e2' };

async function openOrders() {
  const overlay = document.getElementById('orders-modal-overlay');
  const list    = document.getElementById('orders-list');
  openModal(overlay);
  list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">Loading orders…</div>';
  try {
    const res = await API.getMyOrders();
    const orders = res.data || [];
    if (!orders.length) {
      list.innerHTML = '<div style="text-align:center;padding:48px;color:var(--gray-400)"><div style="font-size:48px;margin-bottom:12px">📦</div><p style="font-size:16px;font-weight:500">No orders yet</p><p style="font-size:13px;margin-top:4px">Start shopping to see orders here!</p></div>';
      return;
    }
    list.innerHTML = orders.map(o => `
      <div style="border:1.5px solid var(--gray-100);border-radius:16px;margin-bottom:12px;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:var(--gray-50)">
          <div>
            <div style="font-weight:700;color:var(--gray-800);font-size:15px">Order #${o.id}</div>
            <div style="font-size:12px;color:var(--gray-400);margin-top:2px">${new Date(o.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:18px;font-weight:800;color:var(--green-600)">$${Number(o.totalAmount).toFixed(2)}</span>
            <span style="font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;background:${STATUS_BG[o.status]||'#f3f4f6'};color:${STATUS_COLOR[o.status]||'#6b7280'}">${o.status}</span>
          </div>
        </div>
        <div style="padding:12px 20px;display:flex;flex-wrap:wrap;gap:10px">
          ${o.items.map(item => `
            <div style="display:flex;align-items:center;gap:8px;background:var(--white);border:1px solid var(--gray-100);border-radius:10px;padding:8px 12px">
              <span style="font-size:22px">${item.product.imageUrl || '📦'}</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--gray-700)">${item.product.name}</div>
                <div style="font-size:12px;color:var(--gray-400)">×${item.quantity} · $${Number(item.priceAtPurchase).toFixed(2)} each</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('');
  } catch (e) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--red-500)">${e.message}</div>`;
  }
}

document.getElementById('orders-btn')?.addEventListener('click', openOrders);
document.getElementById('orders-modal-close')?.addEventListener('click', () => closeModal(document.getElementById('orders-modal-overlay')));
document.getElementById('orders-modal-overlay')?.addEventListener('click', e => { if (e.target.id === 'orders-modal-overlay') closeModal(e.target); });

/* ---- CHECKOUT ---- */
dom.checkoutBtn?.addEventListener('click', () => {
  if (!API.isLoggedIn()) { closeCart(); openModal(dom.authOverlay); toast('Please sign in to checkout', 'info'); return; }
  const { items, total } = Cart.summary();
  if (!items.length) { toast('Cart is empty', 'info'); return; }
  dom.checkoutItems.innerHTML = items.map(i => `
    <div class="co-item"><span class="co-item-emoji">${i.emoji}</span><span class="co-item-name">${i.name} ×${i.quantity}</span><span class="co-item-price">${fmt(Number(i.price)*i.quantity)}</span></div>`).join('');
  dom.coSubtotal.textContent = fmt(total);
  dom.coTotal.textContent    = fmt(total);
  closeCart(); openModal(dom.checkoutOverlay);
});

dom.checkoutModalClose?.addEventListener('click', () => closeModal(dom.checkoutOverlay));
dom.checkoutOverlay?.addEventListener('click', e => { if (e.target === dom.checkoutOverlay) closeModal(dom.checkoutOverlay); });

dom.checkoutForm?.addEventListener('submit', async e => {
  e.preventDefault(); dom.checkoutError.textContent = '';
  if (!$('#co-fname').value.trim() || !$('#co-address').value.trim()) { dom.checkoutError.textContent = 'Please fill in all required fields.'; return; }
  setLoading(dom.placeOrderBtn, true);
  try {
    await API.createOrder(Cart.items());
    Cart.clear(); closeModal(dom.checkoutOverlay);
    dom.successMsg.textContent = "Your order has been placed! We'll have it delivered fresh to your door.";
    openModal(dom.successOverlay);
  } catch (err) {
    dom.checkoutError.textContent = err.message;
  } finally { setLoading(dom.placeOrderBtn, false); }
});

dom.successClose?.addEventListener('click', () => closeModal(dom.successOverlay));

/* ---- SEARCH ---- */
let searchDebounce;
dom.searchInput?.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const q = dom.searchInput.value.trim().toLowerCase();
    if (!q) { dom.searchDropdown.classList.remove('open'); renderProducts(); return; }
    const results = allProducts.filter(p => p.name.toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q)).slice(0, 5);
    dom.searchDropdown.innerHTML = results.length
      ? results.map(p => `<div class="search-result-item" data-id="${p.id}"><span class="sri-emoji">${p.imageUrl||'🛒'}</span><div><div class="sri-name">${p.name}</div><div class="sri-price">${fmt(p.price)}</div></div></div>`).join('')
      : `<div class="search-no-result">No results for "${q}"</div>`;
    dom.searchDropdown.classList.add('open');
    renderProducts();
  }, 250);
});

dom.searchDropdown?.addEventListener('click', e => {
  const item = e.target.closest('.search-result-item');
  if (!item) return;
  openQuickView(+item.dataset.id);
  dom.searchDropdown.classList.remove('open');
  dom.searchInput.value = '';
  renderProducts();
});

document.addEventListener('click', e => {
  if (!dom.searchInput?.contains(e.target) && !dom.searchDropdown?.contains(e.target))
    dom.searchDropdown?.classList.remove('open');
});

/* ---- MISC ---- */
dom.hamburger?.addEventListener('click', () => {
  const open = dom.mobileNav.classList.toggle('open');
  dom.hamburger.classList.toggle('open', open);
  dom.hamburger.setAttribute('aria-expanded', open);
});

window.addEventListener('scroll', () => dom.navbar.classList.toggle('scrolled', scrollY > 20), { passive: true });

dom.loadMoreBtn?.addEventListener('click', () => { visibleCount += 8; renderProducts(); });

function setLoading(btn, on) {
  if (on) { btn._t = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true; }
  else { btn.innerHTML = btn._t || btn.innerHTML; btn.disabled = false; }
}

/* ---- INIT ---- */
async function init() {
  dom.year.textContent = new Date().getFullYear();
  buildHero();
  updateAuthUI();
  Cart.onChange(renderCart);

  // Single delegated listener — never re-added on renderProducts calls
  dom.productsGrid.addEventListener('click', e => {
    const card = e.target.closest('.product-card');
    if (!card) return;
    const id = +card.dataset.id;
    const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
    if (action === 'quickview') openQuickView(id);
    if (action === 'add') {
      const p = allProducts.find(x => x.id === id);
      if (p) {
        Cart.add(p);
        const label = (p.imageUrl && !p.imageUrl.startsWith('/') && !p.imageUrl.startsWith('http')) ? p.imageUrl : '🛒';
        toast(`${label} ${p.name} added`);
        bumpBadge();
      }
    }
  });

  try {
    const [catRes, prodRes] = await Promise.all([API.getCategories(), API.getProducts()]);
    allCategories = catRes.data || [];
    allProducts   = prodRes.data?.products || prodRes.data || [];
    renderCategories(allCategories);
    buildFilterBar(allCategories);
    renderProducts();
  } catch (err) {
    console.error(err);
    dom.categoriesGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-400)">
        <p>Could not connect to backend.</p>
        <p style="font-size:13px;margin-top:8px">Make sure Next.js is running: <strong>npm run dev</strong> in the grocery-store directory.</p>
      </div>`;
    dom.productsGrid.innerHTML = '';
  }

  // Refresh products when tab regains focus (picks up admin changes)
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      try {
        const res = await API.getProducts();
        allProducts = res.data?.products || res.data || [];
        renderProducts();
      } catch { /* silent */ }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

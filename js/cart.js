/* ============================================================================
   Freshly Grocery E-Commerce — Shopping Cart Manager (js/cart.js)
   ============================================================================ */

const CART_STORAGE_KEY = 'freshly_cart_items_v2';
let listeners = [];

export function getCartItems() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('[Cart Storage Error]', err);
    return [];
  }
}

function saveCartItems(items) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    notifyListeners();
  } catch (err) {
    console.error('[Cart Save Error]', err);
  }
}

export function subscribeCart(callback) {
  if (typeof callback === 'function') {
    listeners.push(callback);
  }
}

function notifyListeners() {
  const summary = getCartSummary();
  listeners.forEach(fn => fn(summary));
}

export function addToCart(product, quantity = 1) {
  const items = getCartItems();
  const existing = items.find(i => i.id === product.id);
  const currentQty = existing ? existing.quantity : 0;
  const newQty = currentQty + quantity;

  const maxStock = product.stock_quantity !== undefined ? product.stock_quantity : 99;
  if (newQty > maxStock) {
    throw new Error(`Cannot add more than ${maxStock} units of "${product.title}" (Stock limit reached).`);
  }

  if (existing) {
    existing.quantity = newQty;
  } else {
    items.push({
      id: product.id,
      title: product.title,
      price: parseFloat(product.price),
      image_url: product.image_url,
      quantity: quantity,
      stock_quantity: maxStock
    });
  }

  saveCartItems(items);
  return items;
}

export function updateCartQty(productId, newQty) {
  let items = getCartItems();
  const target = items.find(i => i.id === productId);
  if (!target) return;

  if (newQty <= 0) {
    items = items.filter(i => i.id !== productId);
  } else {
    const maxStock = target.stock_quantity !== undefined ? target.stock_quantity : 99;
    if (newQty > maxStock) {
      throw new Error(`Only ${maxStock} units available in stock.`);
    }
    target.quantity = newQty;
  }

  saveCartItems(items);
}

export function removeFromCart(productId) {
  const items = getCartItems().filter(i => i.id !== productId);
  saveCartItems(items);
}

export function clearCart() {
  saveCartItems([]);
}

export function getCartSummary() {
  const items = getCartItems();
  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = subtotal > 0 && subtotal < 50 ? 4.99 : 0.00;
  const grandTotal = subtotal + deliveryFee;

  return {
    items,
    totalItemsCount,
    subtotal: subtotal.toFixed(2),
    deliveryFee: deliveryFee.toFixed(2),
    grandTotal: grandTotal.toFixed(2)
  };
}

/**
 * Global UI Cart Drawer Renderer Helper
 */
export function renderCartDrawer() {
  const drawerBody = document.getElementById('cart-drawer-body');
  const drawerFooter = document.getElementById('cart-drawer-footer');
  const badgeCounts = document.querySelectorAll('.cart-badge');

  const summary = getCartSummary();

  badgeCounts.forEach(b => {
    b.textContent = summary.totalItemsCount;
    b.style.display = summary.totalItemsCount > 0 ? 'flex' : 'none';
  });

  if (!drawerBody) return;

  if (summary.items.length === 0) {
    drawerBody.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <i class="fas fa-shopping-basket" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
        <h3>Your Cart is Empty</h3>
        <p style="font-size: 0.9rem; margin-top: 0.5rem;">Add some fresh items to get started!</p>
      </div>
    `;
    if (drawerFooter) drawerFooter.style.display = 'none';
    return;
  }

  if (drawerFooter) drawerFooter.style.display = 'block';

  drawerBody.innerHTML = summary.items.map(item => `
    <div class="cart-item">
      <img src="${item.image_url || 'https://via.placeholder.com/64'}" alt="${item.title}" class="cart-item-img" onerror="this.onerror=null;this.src='https://via.placeholder.com/64?text=Freshly'">
      <div class="cart-item-details">
        <div class="cart-item-title">${item.title}</div>
        <div class="cart-item-price">$${item.price.toFixed(2)} each</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn btn-minus" data-id="${item.id}">-</button>
        <span style="font-weight: 600; font-size: 0.9rem; width: 20px; text-align: center;">${item.quantity}</span>
        <button class="qty-btn btn-plus" data-id="${item.id}">+</button>
      </div>
      <button class="btn-remove-item" data-id="${item.id}" style="color: #ef4444; margin-left: 0.5rem;" title="Remove">
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>
  `).join('');

  if (drawerFooter) {
    drawerFooter.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem;">
        <span>Subtotal:</span>
        <strong>$${summary.subtotal}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 0.95rem;">
        <span>Delivery Fee:</span>
        <strong>${parseFloat(summary.deliveryFee) === 0 ? '<span style="color: var(--primary);">FREE</span>' : '$' + summary.deliveryFee}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem; font-size: 1.15rem; font-weight: 700;">
        <span>Total:</span>
        <span style="color: var(--primary-dark);">$${summary.grandTotal}</span>
      </div>
      <button id="btn-proceed-checkout" class="btn btn-primary" style="width: 100%;">
        Proceed to Checkout <i class="fas fa-arrow-right"></i>
      </button>
    `;
  }

  drawerBody.querySelectorAll('.btn-minus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const item = summary.items.find(i => i.id === id);
      if (item) updateCartQty(id, item.quantity - 1);
    });
  });

  drawerBody.querySelectorAll('.btn-plus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const item = summary.items.find(i => i.id === id);
      if (item) {
        try {
          updateCartQty(id, item.quantity + 1);
        } catch (err) {
          alert(err.message);
        }
      }
    });
  });

  drawerBody.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      removeFromCart(id);
    });
  });
}

subscribeCart(() => renderCartDrawer());

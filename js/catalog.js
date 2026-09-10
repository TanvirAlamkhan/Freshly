/* ============================================================================
   Freshly Grocery E-Commerce — Storefront Catalog Engine (js/catalog.js)
   Dynamic Category Filter Bar & Live Product Display with Fallback Handling
   ============================================================================ */

import { fetchCategories, fetchProducts, parseApiError } from './api.js';
import { addToCart } from './cart.js';
import { showToast } from './customer.js';

let fetchedProducts = [];
let currentSelectedCategory = 'All';

export function getFetchedProducts() {
  return fetchedProducts;
}

export async function initCatalog({ pillsContainerId, gridContainerId, searchInputId }) {
  await renderCategoryBar(pillsContainerId, gridContainerId);
  await loadProducts(gridContainerId);

  // Search input listener with debounce
  const searchInput = document.getElementById(searchInputId);
  if (searchInput) {
    let searchDebounce;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      const query = e.target.value;
      searchDebounce = setTimeout(() => {
        loadProducts(gridContainerId, currentSelectedCategory, query);
      }, 300);
    });
  }
}

export async function renderCategoryBar(pillsContainerId, gridContainerId) {
  const container = document.getElementById(pillsContainerId);
  if (!container) return;

  try {
    const categories = await fetchCategories();
    if (categories && categories.length > 0) {
      container.innerHTML = `
        <button class="pill-btn ${currentSelectedCategory === 'All' ? 'active' : ''}" data-category="All">All Items</button>
        ${categories.map(c => `
          <button class="pill-btn ${currentSelectedCategory === c.name || currentSelectedCategory === String(c.id) ? 'active' : ''}" data-category="${c.name}" data-id="${c.id}">${c.name}</button>
        `).join('')}
      `;
    } else {
      container.innerHTML = `
        <button class="pill-btn active" data-category="All">All Items</button>
        <button class="pill-btn" data-category="Fresh Produce">Fresh Produce</button>
        <button class="pill-btn" data-category="Dairy & Eggs">Dairy & Eggs</button>
        <button class="pill-btn" data-category="Bakery">Bakery</button>
        <button class="pill-btn" data-category="Beverages">Beverages</button>
        <button class="pill-btn" data-category="Snacks">Snacks</button>
      `;
    }

    container.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentSelectedCategory = e.currentTarget.dataset.category;
        const searchInput = document.getElementById('input-search');
        const query = searchInput ? searchInput.value : '';
        loadProducts(gridContainerId, currentSelectedCategory, query);
      });
    });
  } catch (err) {
    console.warn('[Catalog Category Error]', err);
  }
}

export async function loadProducts(gridContainerId, category = 'All', searchQuery = '') {
  const grid = document.getElementById(gridContainerId);
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
      <i class="fas fa-circle-notch fa-spin" style="font-size: 2.5rem; color: var(--primary);"></i>
      <p style="margin-top: 1rem; color: var(--text-muted);">Loading fresh catalog...</p>
    </div>
  `;

  try {
    fetchedProducts = await fetchProducts(category, searchQuery);
    renderProductsGrid(gridContainerId, fetchedProducts);
  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: white; border-radius: var(--radius-md);">
        <i class="fas fa-exclamation-triangle" style="font-size: 2.5rem; color: #ef4444; margin-bottom: 0.75rem;"></i>
        <h3>Could Not Load Product Catalog</h3>
        <p style="color: var(--text-muted); margin-top: 0.35rem;">${parseApiError(err)}</p>
        <button id="btn-retry-catalog" class="btn btn-secondary btn-sm" style="margin-top: 1rem;">Retry Loading</button>
      </div>
    `;
    document.getElementById('btn-retry-catalog')?.addEventListener('click', () => loadProducts(gridContainerId, category, searchQuery));
  }
}

export function renderProductsGrid(gridContainerId, products) {
  const grid = document.getElementById(gridContainerId);
  if (!grid) return;

  if (!products || products.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: white; border-radius: var(--radius-md);">
        <i class="fas fa-search" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 0.75rem;"></i>
        <h3>No products found</h3>
        <p style="color: var(--text-muted);">Try selecting a different category or search term.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(p => {
    const inStock = p.is_available && p.stock_quantity > 0;
    const fallbackImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80';
    const imgUrl = p.image_url || fallbackImg;

    const categoryName = p.categories?.name || p.category || 'GROCERY ITEM';

    return `
      <div class="product-card">
        <div class="product-image-container">
          <img src="${imgUrl}" alt="${p.title}" class="product-image" onerror="this.onerror=null;this.src='${fallbackImg}';">
          <span class="stock-tag ${inStock ? 'stock-in' : 'stock-out'}">
            ${inStock ? `${p.stock_quantity} left` : 'Out of Stock'}
          </span>
        </div>
        <div class="product-info">
          <div class="product-category" style="text-transform: uppercase; font-size: 0.75rem; color: var(--primary); font-weight: 700;">${categoryName}</div>
          <h3 class="product-title">${p.title}</h3>
          <div class="product-bottom">
            <span class="product-price">$${parseFloat(p.price).toFixed(2)}</span>
            <button class="btn ${inStock ? 'btn-primary' : 'btn-secondary'} btn-sm btn-add-cart" data-id="${p.id}" ${!inStock ? 'disabled' : ''}>
              ${inStock ? '<i class="fas fa-plus"></i> Add' : 'Out of Stock'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.btn-add-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.currentTarget.dataset.id;
      const product = fetchedProducts.find(p => String(p.id) === String(productId));
      if (product) {
        try {
          addToCart(product, 1);
          showToast(`Added "${product.title}" to cart!`, 'success');
        } catch (err) {
          showToast(err.message, 'warning');
        }
      }
    });
  });
}

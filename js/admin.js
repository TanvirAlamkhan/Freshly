/* ============================================================================
   Freshly Grocery E-Commerce — Admin Portal Operations Controller (js/admin.js)
   Kanban Drag & Drop, Thermal Slip Printing, Analytics Charts & Stock Thresholds
   ============================================================================ */

import { 
  IS_MOCK_MODE, 
  setMockMode,
  getAdminSession,
  logoutAdmin,
  loginAdmin,
  fetchAdminOrders, 
  updateOrderStatus, 
  assignOrderFulfillment,
  fetchAdminInventory, 
  toggleProductAvailability,
  saveProductItem,
  fetchAnalyticsMetrics,
  fetchCustomerRoster,
  fetchCoupons,
  saveCoupon,
  toggleCouponStatus,
  deleteCoupon
} from './admin-api.js';

import { showToast } from './customer.js';

let currentOrdersList = [];
let currentInventoryList = [];
let audioChimeEnabled = true;
let activeTimeframe = 'All Time';
let draggedOrderId = null;

export async function initAdminOperations() {
  updateModeBadge();
  bindGlobalEvents();

  // Session check
  const session = getAdminSession();
  if (!session && IS_MOCK_MODE) {
    // Auto-authenticate mock admin for seamless offline testing
    await loginAdmin('admin@grocery.com', 'admin123');
  }

  await loadActiveModuleData();
}

function updateModeBadge() {
  const badgeLabel = document.getElementById('mode-badge-label');
  const btnToggle = document.getElementById('btn-toggle-mode');
  if (badgeLabel) {
    badgeLabel.textContent = IS_MOCK_MODE ? 'MOCK MODE (OFFLINE)' : 'SUPABASE MODE (LIVE)';
  }
  if (btnToggle) {
    btnToggle.style.color = IS_MOCK_MODE ? '#38bdf8' : '#10b981';
  }
}

async function loadActiveModuleData() {
  await renderKanbanBoard();
  await renderOrdersTable();
  await renderInventoryTable();
  await renderAnalyticsDashboard();
  await renderCustomerRoster();
  await renderCouponsModule();
}

/* ============================================================================
   MODULE 1: KANBAN BOARD & DRAG-AND-DROP PIPELINE
   ============================================================================ */

async function renderKanbanBoard() {
  const container = document.getElementById('view-kanban-board');
  if (!container) return;

  const filterStatus = document.getElementById('admin-status-filter')?.value || 'All';
  currentOrdersList = await fetchAdminOrders(filterStatus);

  const statuses = ['Pending', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled'];

  container.innerHTML = statuses.map(status => {
    const colOrders = currentOrdersList.filter(o => o.status === status);
    const badgeClass = `badge-${status.toLowerCase().replace(/\s+/g, '-')}`;

    return `
      <div class="kanban-col" data-status="${status}">
        <div class="kanban-col-header">
          <span>${status}</span>
          <span class="badge ${badgeClass}">${colOrders.length}</span>
        </div>
        <div class="kanban-col-body" style="display: flex; flex-direction: column; gap: 0.75rem; flex-grow: 1;">
          ${colOrders.map(order => `
            <div class="kanban-card" draggable="true" data-id="${order.id}">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.35rem;">
                <span>#${String(order.id).substring(0, 8).toUpperCase()}</span>
                <span style="color: var(--text-muted); font-weight: 500;">$${parseFloat(order.total_amount).toFixed(2)}</span>
              </div>
              <div style="font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">${order.customer_name || 'Customer'}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${order.delivery_address || 'Standard Address'}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 0.5rem; margin-top: 0.5rem;">
                <button class="btn btn-secondary btn-sm btn-open-fulfillment" data-id="${order.id}" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">
                  <i class="fas fa-truck"></i> Fulfill
                </button>
                <button class="btn btn-secondary btn-sm btn-print-slip" data-id="${order.id}" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">
                  <i class="fas fa-print"></i> Slip
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Attach HTML5 Drag-and-Drop Handlers
  container.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedOrderId = e.currentTarget.dataset.id;
      e.currentTarget.classList.add('dragging');
      e.dataTransfer.setData('text/plain', draggedOrderId);
    });

    card.addEventListener('dragend', (e) => {
      e.currentTarget.classList.remove('dragging');
      draggedOrderId = null;
    });
  });

  container.querySelectorAll('.kanban-col').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', () => {
      col.classList.remove('drag-over');
    });

    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const targetStatus = col.dataset.status;
      if (draggedOrderId && targetStatus) {
        try {
          await updateOrderStatus(draggedOrderId, targetStatus);
          showToast(`Order #${String(draggedOrderId).substring(0, 8).toUpperCase()} moved to ${targetStatus}`, 'success');
          await renderKanbanBoard();
          await renderOrdersTable();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });

  // Bind Buttons inside Kanban Cards
  container.querySelectorAll('.btn-open-fulfillment').forEach(btn => {
    btn.addEventListener('click', (e) => openFulfillmentModal(e.currentTarget.dataset.id));
  });

  container.querySelectorAll('.btn-print-slip').forEach(btn => {
    btn.addEventListener('click', (e) => openPackingSlipModal(e.currentTarget.dataset.id));
  });
}

async function renderOrdersTable() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  const filterStatus = document.getElementById('admin-status-filter')?.value || 'All';
  currentOrdersList = await fetchAdminOrders(filterStatus);

  if (currentOrdersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No orders found matching filter.</td></tr>`;
    return;
  }

  const statuses = ['Pending', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled'];

  tbody.innerHTML = currentOrdersList.map(o => `
    <tr>
      <td><strong>#${String(o.id).substring(0, 8).toUpperCase()}</strong></td>
      <td>
        <div style="font-weight: 600;">${o.customer_name || 'Customer'}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${o.delivery_address || 'Standard Address'}</div>
      </td>
      <td style="font-size: 0.85rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${(Array.isArray(o.items) ? o.items : []).map(i => `${i.title} (${i.quantity}x)`).join(', ')}
      </td>
      <td><strong>$${parseFloat(o.total_amount).toFixed(2)}</strong></td>
      <td>
        <select class="form-select form-select-sm select-table-status" data-id="${o.id}">
          ${statuses.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>
        <div style="font-size: 0.85rem;"><strong>Driver:</strong> ${o.delivery_person || 'Unassigned'}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${o.fulfillment_notes || 'No notes'}</div>
      </td>
      <td>
        <div style="display: flex; gap: 0.35rem;">
          <button class="btn btn-secondary btn-sm btn-open-fulfillment" data-id="${o.id}"><i class="fas fa-truck"></i></button>
          <button class="btn btn-secondary btn-sm btn-print-slip" data-id="${o.id}"><i class="fas fa-print"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.select-table-status').forEach(select => {
    select.addEventListener('change', async (e) => {
      const orderId = e.currentTarget.dataset.id;
      const status = e.currentTarget.value;
      try {
        await updateOrderStatus(orderId, status);
        showToast(`Order #${String(orderId).substring(0, 8).toUpperCase()} status updated to ${status}`, 'success');
        await renderKanbanBoard();
        await renderOrdersTable();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  tbody.querySelectorAll('.btn-open-fulfillment').forEach(btn => {
    btn.addEventListener('click', (e) => openFulfillmentModal(e.currentTarget.dataset.id));
  });

  tbody.querySelectorAll('.btn-print-slip').forEach(btn => {
    btn.addEventListener('click', (e) => openPackingSlipModal(e.currentTarget.dataset.id));
  });
}

/* ============================================================================
   MODULE 2: INVENTORY & STOCK ALERT THRESHOLDS
   ============================================================================ */

async function renderInventoryTable() {
  const tbody = document.getElementById('admin-inventory-tbody');
  if (!tbody) return;

  currentInventoryList = await fetchAdminInventory();

  if (currentInventoryList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No products found in inventory.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentInventoryList.map(p => {
    const isLowStock = p.stock_quantity <= (p.low_stock_threshold || 5);
    const rowClass = isLowStock ? 'table-row-low-stock' : '';

    return `
      <tr class="${rowClass}">
        <td>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <img src="${p.image_url || 'https://via.placeholder.com/40'}" alt="${p.title}" style="width: 40px; height: 40px; border-radius: var(--radius-sm); object-fit: cover;" onerror="this.onerror=null;this.src='https://via.placeholder.com/40?text=Grocery';">
            <div>
              <div style="font-weight: 600;">${p.title}</div>
              ${isLowStock ? '<span class="badge badge-cancelled" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;"><i class="fas fa-exclamation-triangle"></i> LOW STOCK ALERT</span>' : ''}
            </div>
          </div>
        </td>
        <td>${p.category || 'General'}</td>
        <td><strong>$${parseFloat(p.price).toFixed(2)}</strong></td>
        <td><strong style="color: ${isLowStock ? '#dc2626' : 'var(--text-main)'}">${p.stock_quantity} units</strong></td>
        <td>${p.low_stock_threshold || 5} units</td>
        <td>
          <button class="btn btn-sm ${p.is_available ? 'btn-primary' : 'btn-danger'} btn-toggle-availability" data-id="${p.id}" data-available="${p.is_available}">
            ${p.is_available ? '<i class="fas fa-check"></i> In Stock' : '<i class="fas fa-ban"></i> Out of Stock'}
          </button>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm btn-edit-product" data-id="${p.id}">
            <i class="fas fa-edit"></i> Edit
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-toggle-availability').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const currentVal = e.currentTarget.dataset.available === 'true';
      try {
        await toggleProductAvailability(id, !currentVal);
        showToast(`Item availability updated.`, 'success');
        await renderInventoryTable();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  tbody.querySelectorAll('.btn-edit-product').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const prod = currentInventoryList.find(p => String(p.id) === String(id));
      if (prod) openProductEditModal(prod);
    });
  });
}

/* ============================================================================
   MODULE 3: SALES & REVENUE ANALYTICS DASHBOARD
   ============================================================================ */

async function renderAnalyticsDashboard() {
  const metrics = await fetchAnalyticsMetrics(activeTimeframe);

  document.getElementById('analytics-revenue').textContent = `$${metrics.grossRevenue}`;
  document.getElementById('analytics-orders-count').textContent = metrics.totalOrdersCount;
  document.getElementById('analytics-aov').textContent = `$${metrics.aov}`;
  document.getElementById('analytics-pending').textContent = metrics.pendingCount;

  // Render CSS Horizontal Bar Chart for Peak Shopping Hours
  const chartContainer = document.getElementById('analytics-hourly-chart');
  if (chartContainer) {
    const maxVal = Math.max(...metrics.hourlyBuckets, 1);
    const labels = ['00:00 - 02:00', '02:00 - 04:00', '04:00 - 06:00', '06:00 - 08:00', '08:00 - 10:00', '10:00 - 12:00', '12:00 - 14:00', '14:00 - 16:00', '16:00 - 18:00', '18:00 - 20:00', '20:00 - 22:00', '22:00 - 00:00'];

    chartContainer.innerHTML = metrics.hourlyBuckets.map((count, idx) => {
      const percent = Math.round((count / maxVal) * 100);
      return `
        <div class="chart-row">
          <div class="chart-label">${labels[idx]}</div>
          <div class="chart-bar-bg">
            <div class="chart-bar-fill" style="width: ${percent}%;"></div>
          </div>
          <div class="chart-val">${count}</div>
        </div>
      `;
    }).join('');
  }

  // Render Top Sellers Leaderboard
  const leaderboardContainer = document.getElementById('analytics-top-sellers');
  if (leaderboardContainer) {
    if (metrics.topSellers.length === 0) {
      leaderboardContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No sales data available for leaderboard.</p>`;
    } else {
      leaderboardContainer.innerHTML = metrics.topSellers.map((item, rank) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0; border-bottom: 1px solid var(--border);">
          <div>
            <strong style="color: var(--primary); font-size: 0.9rem;">#${rank + 1}</strong>
            <span style="font-weight: 600; font-size: 0.9rem; margin-left: 0.5rem;">${item.title}</span>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; font-size: 0.9rem;">$${item.revenue.toFixed(2)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${item.unitsSold} units sold</div>
          </div>
        </div>
      `).join('');
    }
  }
}

/* ============================================================================
   MODULE 4: CUSTOMER MANAGEMENT ROSTER
   ============================================================================ */

async function renderCustomerRoster() {
  const tbody = document.getElementById('admin-customers-tbody');
  if (!tbody) return;

  const searchQuery = document.getElementById('input-search-customers')?.value || '';
  const roster = await fetchCustomerRoster(searchQuery);

  if (roster.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No registered customers found.</td></tr>`;
    return;
  }

  tbody.innerHTML = roster.map(c => `
    <tr>
      <td><strong style="font-size: 0.9rem;">${c.name}</strong></td>
      <td>${c.email}</td>
      <td>${c.phone}</td>
      <td><span class="badge badge-customer">${c.totalOrders} orders</span></td>
      <td><strong style="color: var(--primary-dark);">$${c.lifetimeSpend.toFixed(2)}</strong></td>
      <td>
        <button class="btn btn-secondary btn-sm btn-view-customer" data-email="${c.email}">
          <i class="fas fa-eye"></i> Detail Drawer
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-view-customer').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const email = e.currentTarget.dataset.email;
      const target = roster.find(c => c.email === email);
      if (target) openCustomerDetailDrawer(target);
    });
  });
}

function openCustomerDetailDrawer(customer) {
  const modal = document.getElementById('modal-customer-detail');
  const title = document.getElementById('customer-detail-name');
  const body = document.getElementById('customer-detail-body');

  if (!modal || !body) return;

  title.textContent = `${customer.name}'s Order History`;
  body.innerHTML = `
    <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
      <div><strong>Email:</strong> ${customer.email}</div>
      <div><strong>Phone:</strong> ${customer.phone}</div>
      <div><strong>Total Lifetime Spend:</strong> $${customer.lifetimeSpend.toFixed(2)}</div>
    </div>
    <h4>Orders Breakdown (${customer.orders.length})</h4>
    <div style="max-height: 350px; overflow-y: auto; margin-top: 0.75rem;">
      ${customer.orders.map(o => `
        <div style="background: white; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 0.5rem;">
          <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 0.85rem;">
            <span>Order #${String(o.id).substring(0, 8).toUpperCase()}</span>
            <span class="badge badge-${o.status.toLowerCase().replace(/\s+/g, '-')}">${o.status}</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin: 0.35rem 0;">${o.delivery_address || ''}</div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700;">
            <span>Total: $${parseFloat(o.total_amount).toFixed(2)}</span>
            <span>${new Date(o.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  modal.classList.add('open');
}

/* ============================================================================
   MODULE 5: DISCOUNT & COUPON ENGINE
   ============================================================================ */

async function renderCouponsModule() {
  const container = document.getElementById('admin-coupons-list');
  if (!container) return;

  const coupons = await fetchCoupons();

  if (coupons.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No discount coupons created yet.</p>`;
    return;
  }

  container.innerHTML = coupons.map(c => `
    <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
      <div>
        <span style="font-family: monospace; font-size: 1.1rem; font-weight: 800; color: var(--primary);">${c.code}</span>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
          ${c.discount_type === 'percentage' ? c.value + '% OFF' : '$' + parseFloat(c.value).toFixed(2) + ' OFF'} (Min Spend: $${parseFloat(c.min_spend).toFixed(2)})
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <button class="btn btn-sm ${c.is_active ? 'btn-primary' : 'btn-secondary'} btn-toggle-coupon" data-id="${c.id}" data-active="${c.is_active}">
          ${c.is_active ? 'Active' : 'Disabled'}
        </button>
        <button class="btn btn-danger btn-sm btn-delete-coupon" data-id="${c.id}" title="Delete Code">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-toggle-coupon').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const active = e.currentTarget.dataset.active === 'true';
      try {
        await toggleCouponStatus(id, !active);
        showToast('Coupon status updated.', 'success');
        await renderCouponsModule();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  container.querySelectorAll('.btn-delete-coupon').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if (confirm('Delete this promotional coupon code?')) {
        try {
          await deleteCoupon(id);
          showToast('Coupon deleted.', 'success');
          await renderCouponsModule();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

/* ============================================================================
   THERMAL PACKING SLIP PRINT GENERATOR
   ============================================================================ */

function openPackingSlipModal(orderId) {
  const modal = document.getElementById('printable-slip-modal');
  const container = document.getElementById('slip-print-content');
  if (!modal || !container) return;

  const order = currentOrdersList.find(o => String(o.id) === String(orderId));
  if (!order) return;

  const items = Array.isArray(order.items) ? order.items : [];

  container.innerHTML = `
    <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
      <h2 style="font-size: 1.25rem; font-weight: 800;">FRESHLY GROCERY</h2>
      <p style="font-size: 0.75rem;">PACKING SLIP & ORDER RECEIPT</p>
      <p style="font-size: 0.75rem; margin-top: 0.25rem;">Date: ${new Date(order.created_at).toLocaleString()}</p>
    </div>

    <div style="font-size: 0.8rem; margin-bottom: 0.75rem;">
      <div><strong>ORDER NO:</strong> #${String(order.id).substring(0, 8).toUpperCase()}</div>
      <div><strong>CUSTOMER:</strong> ${order.customer_name || 'Customer'}</div>
      <div><strong>ADDRESS:</strong> ${order.delivery_address || 'Standard Address'}</div>
      <div><strong>SLOT:</strong> ${order.delivery_slot || 'Express'}</div>
      <div><strong>SUBSTITUTE PREF:</strong> ${order.substitution_pref || 'Refund item'}</div>
      <div><strong>ASSIGNED DRIVER:</strong> ${order.delivery_person || 'Unassigned'}</div>
      ${order.fulfillment_notes ? `<div><strong>NOTES:</strong> ${order.fulfillment_notes}</div>` : ''}
    </div>

    <table style="width: 100%; text-align: left; font-size: 0.8rem; border-collapse: collapse; border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin-bottom: 0.75rem;">
      <thead>
        <tr>
          <th style="padding: 0.35rem 0;">QTY</th>
          <th style="padding: 0.35rem 0;">ITEM</th>
          <th style="padding: 0.35rem 0; text-align: right;">PRICE</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td style="padding: 0.25rem 0;">${i.quantity}x</td>
            <td style="padding: 0.25rem 0;">${i.title}</td>
            <td style="padding: 0.25rem 0; text-align: right;">$${(i.price * i.quantity).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 0.95rem; margin-bottom: 1rem;">
      <span>TOTAL PAYABLE:</span>
      <span>$${parseFloat(order.total_amount).toFixed(2)}</span>
    </div>

    <div style="text-align: center; font-size: 0.7rem; border-top: 1px dashed #000; padding-top: 0.5rem;">
      Thank you for shopping organic with Freshly Grocery!
    </div>
  `;

  modal.classList.add('open');
}

function openFulfillmentModal(orderId) {
  const modal = document.getElementById('modal-fulfillment');
  const order = currentOrdersList.find(o => String(o.id) === String(orderId));
  if (!modal || !order) return;

  document.getElementById('fulfillment-order-id').value = order.id;
  document.getElementById('fulfillment-driver').value = order.delivery_person || '';
  document.getElementById('fulfillment-notes').value = order.fulfillment_notes || '';

  modal.classList.add('open');
}

function openProductEditModal(product = null) {
  const modal = document.getElementById('modal-product-edit');
  if (!modal) return;

  document.getElementById('product-modal-title').textContent = product ? 'Edit Grocery Product' : 'Add New Product';
  document.getElementById('edit-prod-id').value = product ? product.id : '';
  document.getElementById('edit-prod-title').value = product ? product.title : '';
  document.getElementById('edit-prod-price').value = product ? product.price : '';
  document.getElementById('edit-prod-stock').value = product ? product.stock_quantity : '';
  document.getElementById('edit-prod-threshold').value = product ? (product.low_stock_threshold || 5) : 5;
  document.getElementById('edit-prod-image').value = product ? product.image_url : '';

  modal.classList.add('open');
}

/* ============================================================================
   GLOBAL EVENT BINDINGS
   ============================================================================ */

function bindGlobalEvents() {
  // Dual-Mode Toggle Button
  document.getElementById('btn-toggle-mode')?.addEventListener('click', async () => {
    setMockMode(!IS_MOCK_MODE);
    updateModeBadge();
    showToast(`Switched mode to ${IS_MOCK_MODE ? 'MOCK MODE (OFFLINE)' : 'SUPABASE MODE (LIVE)'}`, 'info');
    await loadActiveModuleData();
  });

  // Module Tabs Switching
  const tabs = [
    { btn: 'tab-admin-pipeline', module: 'module-admin-pipeline' },
    { btn: 'tab-admin-inventory', module: 'module-admin-inventory' },
    { btn: 'tab-admin-analytics', module: 'module-admin-analytics' },
    { btn: 'tab-admin-customers', module: 'module-admin-customers' },
    { btn: 'tab-admin-coupons', module: 'module-admin-coupons' }
  ];

  tabs.forEach(t => {
    const btnEl = document.getElementById(t.btn);
    if (btnEl) {
      btnEl.addEventListener('click', () => {
        tabs.forEach(x => {
          document.getElementById(x.btn)?.classList.remove('active');
          document.getElementById(x.module).style.display = 'none';
        });
        btnEl.classList.add('active');
        document.getElementById(t.module).style.display = 'block';
      });
    }
  });

  // Kanban vs Table View Toggle
  const btnKanban = document.getElementById('btn-view-kanban');
  const btnTable = document.getElementById('btn-view-table');
  const viewKanban = document.getElementById('view-kanban-board');
  const viewTable = document.getElementById('view-orders-table');

  btnKanban?.addEventListener('click', () => {
    btnKanban.classList.add('active');
    btnTable.classList.remove('active');
    viewKanban.style.display = 'grid';
    viewTable.style.display = 'none';
  });

  btnTable?.addEventListener('click', () => {
    btnTable.classList.add('active');
    btnKanban.classList.remove('active');
    viewTable.style.display = 'block';
    viewKanban.style.display = 'none';
  });

  // Status Filter Listener
  document.getElementById('admin-status-filter')?.addEventListener('change', async () => {
    await renderKanbanBoard();
    await renderOrdersTable();
  });

  // Fulfillment Form Submit
  document.getElementById('form-fulfillment')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const orderId = document.getElementById('fulfillment-order-id').value;
    const driver = document.getElementById('fulfillment-driver').value.trim();
    const notes = document.getElementById('fulfillment-notes').value.trim();

    try {
      await assignOrderFulfillment(orderId, driver, notes);
      showToast('Fulfillment details updated.', 'success');
      document.getElementById('modal-fulfillment')?.classList.remove('open');
      await renderKanbanBoard();
      await renderOrdersTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Print Slip Triggers
  document.getElementById('btn-print-slip-modal')?.addEventListener('click', () => {
    const orderId = document.getElementById('fulfillment-order-id').value;
    document.getElementById('modal-fulfillment')?.classList.remove('open');
    openPackingSlipModal(orderId);
  });

  document.getElementById('btn-trigger-print')?.addEventListener('click', () => {
    window.print();
  });

  // Modal Closers
  document.getElementById('btn-close-fulfillment')?.addEventListener('click', () => document.getElementById('modal-fulfillment')?.classList.remove('open'));
  document.getElementById('btn-close-product-edit')?.addEventListener('click', () => document.getElementById('modal-product-edit')?.classList.remove('open'));
  document.getElementById('btn-close-customer-detail')?.addEventListener('click', () => document.getElementById('modal-customer-detail')?.classList.remove('open'));
  document.getElementById('btn-close-slip')?.addEventListener('click', () => document.getElementById('printable-slip-modal')?.classList.remove('open'));

  // Product Edit Form Submit
  document.getElementById('form-product-edit')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-save-product-submit');
    const statusContainer = document.getElementById('product-upload-status');
    const statusText = document.getElementById('product-upload-status-text');

    const id = document.getElementById('edit-prod-id').value;
    const title = document.getElementById('edit-prod-title').value.trim();
    const category_id = document.getElementById('product-category')?.value || null;
    const price = parseFloat(document.getElementById('edit-prod-price').value);
    const stock_quantity = parseInt(document.getElementById('edit-prod-stock').value, 10);
    const low_stock_threshold = parseInt(document.getElementById('edit-prod-threshold').value, 10);
    let image_url = document.getElementById('edit-prod-image').value.trim();

    const fileInput = document.getElementById('product-image');
    const file = fileInput?.files[0];

    let uploadedFilePath = null;

    try {
      if (submitBtn) submitBtn.disabled = true;
      
      if (file) {
        if (statusContainer && statusText) {
          statusContainer.style.display = 'block';
          statusText.textContent = 'Uploading image to Supabase Storage...';
        }
        const { uploadProductImage } = await import('./api.js');
        const uploadResult = await uploadProductImage(file);
        image_url = uploadResult.publicUrl;
        uploadedFilePath = uploadResult.filePath;
      }

      if (!image_url) {
        throw new Error('Please select an image file or provide an image URL.');
      }

      if (statusContainer && statusText) {
        statusContainer.style.display = 'block';
        statusText.textContent = 'Saving product...';
      }

      const payload = {
        title,
        price,
        stock_quantity,
        low_stock_threshold,
        image_url,
        is_available: stock_quantity > 0
      };
      if (category_id) payload.category_id = category_id;
      if (id) payload.id = id;

      await saveProductItem(payload);
      showToast('Product item saved successfully!', 'success');
      
      document.getElementById('form-product-edit').reset();
      const previewContainer = document.getElementById('image-preview-container');
      if (previewContainer) previewContainer.style.display = 'none';
      
      document.getElementById('modal-product-edit')?.classList.remove('open');
      await renderInventoryTable();
    } catch (err) {
      if (uploadedFilePath) {
        try {
          const { deleteProductImage } = await import('./api.js');
          await deleteProductImage(uploadedFilePath);
        } catch (rollbackErr) {
          console.warn('[Rollback Error]', rollbackErr);
        }
      }
      showToast(err.message, 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (statusContainer) statusContainer.style.display = 'none';
    }
  });

  document.getElementById('btn-open-add-product')?.addEventListener('click', () => openProductEditModal(null));

  // Analytics Timeframe Pills
  document.querySelectorAll('#analytics-timeframe-pills .pill-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      document.querySelectorAll('#analytics-timeframe-pills .pill-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      activeTimeframe = e.currentTarget.dataset.timeframe;
      await renderAnalyticsDashboard();
    });
  });

  // Customer Search Input
  let customerSearchDebounce;
  document.getElementById('input-search-customers')?.addEventListener('input', () => {
    clearTimeout(customerSearchDebounce);
    customerSearchDebounce = setTimeout(() => renderCustomerRoster(), 300);
  });

  // Coupon Creation Form Submit
  document.getElementById('form-create-coupon')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('coupon-code').value.trim();
    const discount_type = document.getElementById('coupon-type').value;
    const value = parseFloat(document.getElementById('coupon-value').value);
    const min_spend = parseFloat(document.getElementById('coupon-min-spend').value);
    const expiry_date = document.getElementById('coupon-expiry').value;

    try {
      await saveCoupon({ code, discount_type, value, min_spend, expiry_date });
      showToast(`Coupon code ${code.toUpperCase()} created!`, 'success');
      document.getElementById('form-create-coupon').reset();
      await renderCouponsModule();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // CSV Export Button
  document.getElementById('btn-export-csv')?.addEventListener('click', async () => {
    try {
      const orders = await fetchAdminOrders('All');
      if (orders.length === 0) {
        showToast('No order data available for CSV export.', 'warning');
        return;
      }

      const headers = ['Order ID', 'Customer', 'Email', 'Address', 'Status', 'Total ($)', 'Date', 'Driver', 'Items'];
      const rows = orders.map(o => [
        `#${String(o.id).substring(0, 8).toUpperCase()}`,
        `"${o.customer_name || 'Customer'}"`,
        o.customer_email || '',
        `"${(o.delivery_address || '').replace(/"/g, '""')}"`,
        o.status,
        parseFloat(o.total_amount || 0).toFixed(2),
        new Date(o.created_at).toLocaleDateString(),
        o.delivery_person || 'Unassigned',
        `"${(Array.isArray(o.items) ? o.items.map(i => `${i.title} x${i.quantity}`).join('; ') : '').replace(/"/g, '""')}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `freshly_orders_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Exported ${orders.length} orders to CSV file.`, 'success');
    } catch (err) {
      showToast(`CSV Export failed: ${err.message}`, 'error');
    }
  });

  // Audio Chime Toggle
  document.getElementById('toggle-audio-chime')?.addEventListener('change', (e) => {
    audioChimeEnabled = e.target.checked;
    showToast(`Order chime sound ${audioChimeEnabled ? 'enabled' : 'muted'}.`, 'info');
  });
}

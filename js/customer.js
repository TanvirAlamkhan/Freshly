/* ============================================================================
   Freshly Grocery E-Commerce — Customer Portal Module (js/customer.js)
   Live Order Tracker (Realtime WebSockets), Order Cancellation & Reorder
   ============================================================================ */

import { 
  fetchCustomerOrders, 
  cancelOrderCustomer, 
  createOrder, 
  subscribeToOrders, 
  getUserProfile,
  updateUserProfile,
  parseApiError 
} from './api.js';

import { requireAuth } from './auth.js';
import { getCartSummary, clearCart, addToCart } from './cart.js';

let currentUser = null;
let currentProfile = null;
let customerOrders = [];
let realtimeChannel = null;

export async function initCustomerDashboard() {
  const authData = await requireAuth('customer');
  if (!authData) return;

  currentUser = authData.user;
  currentProfile = authData.profile;

  renderProfileCard();
  await refreshOrders();
  setupRealtimeTracker();
  bindCustomerFormEvents();
}

/**
 * Global Toast Notification Helper
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const iconMap = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };

  toast.innerHTML = `
    <i class="fas ${iconMap[type] || iconMap.info}" style="font-size: 1.25rem; margin-top: 0.1rem;"></i>
    <div style="flex-grow: 1;">
      <div style="font-weight: 600; font-size: 0.9rem;">${type.toUpperCase()}</div>
      <div style="font-size: 0.85rem; margin-top: 0.15rem;">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ============================================================================
   PROFILE & ADDRESS DETAILS
   ============================================================================ */

function renderProfileCard() {
  const container = document.getElementById('customer-profile-details');
  if (!container || !currentProfile) return;

  container.innerHTML = `
    <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border); padding: 1.25rem;">
      <h3 style="margin-bottom: 0.75rem;"><i class="fas fa-user-circle" style="color: var(--primary);"></i> Account Details</h3>
      <div style="font-size: 0.9rem; line-height: 1.8;">
        <div><strong>Name:</strong> ${currentProfile.full_name || 'Customer'}</div>
        <div><strong>Email:</strong> ${currentProfile.email}</div>
        <div><strong>Phone:</strong> ${currentProfile.phone || 'Not provided'}</div>
        <div><strong>Default Address:</strong> ${currentProfile.default_address || 'Not saved'}</div>
      </div>
    </div>
  `;
}

/* ============================================================================
   ORDER TRACKER & HISTORY
   ============================================================================ */

async function refreshOrders() {
  if (!currentUser) return;
  try {
    customerOrders = await fetchCustomerOrders(currentUser.id);
    renderActiveOrderTracker();
    renderOrderHistory();
  } catch (err) {
    showToast(parseApiError(err), 'error');
  }
}

function renderActiveOrderTracker() {
  const container = document.getElementById('active-order-tracker-container');
  if (!container) return;

  const activeOrder = customerOrders.find(o => o.status !== 'Delivered' && o.status !== 'Cancelled');

  if (!activeOrder) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--border);">
        <i class="fas fa-box-open" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 0.75rem;"></i>
        <h3>No Active Deliveries</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.35rem;">You don't have any ongoing orders at the moment.</p>
        <a href="index.html" class="btn btn-primary btn-sm" style="margin-top: 1rem;">Browse Grocery Store</a>
      </div>
    `;
    return;
  }

  const steps = [
    { key: 'Pending', label: 'Order Placed', icon: 'fa-receipt' },
    { key: 'Processing', label: 'Packing Items', icon: 'fa-box' },
    { key: 'Out for Delivery', label: 'Out for Delivery', icon: 'fa-truck-fast' },
    { key: 'Delivered', label: 'Delivered', icon: 'fa-house-circle-check' }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === activeOrder.status);
  const progressPercent = currentStepIndex >= 0 ? (currentStepIndex / (steps.length - 1)) * 100 : 0;

  container.innerHTML = `
    <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border); padding: 1.75rem; box-shadow: var(--shadow-sm);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
        <div>
          <span style="font-size: 0.85rem; color: var(--text-muted);">ORDER #${String(activeOrder.id).substring(0, 8).toUpperCase()}</span>
          <h3 style="margin-top: 0.2rem;">Live Delivery Status</h3>
        </div>
        <span class="badge badge-${activeOrder.status.toLowerCase().replace(/\s+/g, '-')}">
          ${activeOrder.status}
        </span>
      </div>

      <!-- VISUAL STEP TRACKER -->
      <div class="step-tracker">
        <div class="step-progress-line" style="width: ${progressPercent}%;"></div>
        ${steps.map((step, idx) => {
          let stepClass = '';
          if (idx < currentStepIndex) stepClass = 'completed';
          else if (idx === currentStepIndex) stepClass = 'active';

          return `
            <div class="step-item ${stepClass}">
              <div class="step-circle">
                <i class="fas ${step.icon}"></i>
              </div>
              <div class="step-label">${step.label}</div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="background: #f8fafc; padding: 1.25rem; border-radius: var(--radius-md); margin-top: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div>
          <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Delivery Address</span>
          <p style="font-weight: 600; font-size: 0.9rem; margin-top: 0.2rem;">${activeOrder.delivery_address || 'Standard Address'}</p>
        </div>
        <div>
          <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Estimated Slot</span>
          <p style="font-weight: 600; font-size: 0.9rem; margin-top: 0.2rem;">${activeOrder.delivery_slot || 'Standard Delivery'}</p>
        </div>
        <div>
          <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Total Amount</span>
          <p style="font-weight: 700; font-size: 1.1rem; color: var(--primary-dark); margin-top: 0.2rem;">$${parseFloat(activeOrder.total_amount).toFixed(2)}</p>
        </div>
      </div>

      <div style="margin-top: 1.25rem; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fas fa-sync fa-spin"></i> Live updates enabled via Supabase Realtime</span>
        ${activeOrder.status === 'Pending' ? `
          <button class="btn btn-danger btn-sm btn-cancel-order" data-id="${activeOrder.id}">
            <i class="fas fa-times-circle"></i> Cancel Order
          </button>
        ` : ''}
      </div>
    </div>
  `;

  const cancelBtn = container.querySelector('.btn-cancel-order');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if (confirm('Are you sure you want to cancel this pending order?')) {
        try {
          await cancelOrderCustomer(id);
          showToast('Order cancelled successfully.', 'success');
          await refreshOrders();
        } catch (err) {
          showToast(parseApiError(err), 'error');
          await refreshOrders();
        }
      }
    });
  }
}

function renderOrderHistory() {
  const container = document.getElementById('order-history-container');
  if (!container) return;

  if (customerOrders.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        No order history found.
      </div>
    `;
    return;
  }

  container.innerHTML = customerOrders.map(order => {
    const items = Array.isArray(order.items) ? order.items : [];
    const statusClass = `badge-${order.status.toLowerCase().replace(/\s+/g, '-')}`;

    return `
      <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border); padding: 1.25rem; margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <span style="font-weight: 700; font-size: 0.95rem;">Order #${String(order.id).substring(0, 8).toUpperCase()}</span>
            <span style="font-size: 0.85rem; color: var(--text-muted); margin-left: 0.75rem;">${new Date(order.created_at).toLocaleDateString()}</span>
          </div>
          <span class="badge ${statusClass}">${order.status}</span>
        </div>

        <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.75rem;">
          Items: ${items.map(i => `${i.title} (${i.quantity}x)`).join(', ')}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 0.75rem;">
          <div style="font-weight: 700; font-size: 1.05rem; color: var(--primary-dark);">
            Total: $${parseFloat(order.total_amount).toFixed(2)}
          </div>
          <div style="display: flex; gap: 0.5rem;">
            ${order.status === 'Pending' ? `
              <button class="btn btn-danger btn-sm btn-cancel-order" data-id="${order.id}">
                Cancel
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm btn-reorder" data-order-id="${order.id}">
              <i class="fas fa-redo"></i> 1-Click Reorder
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-reorder').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const orderId = e.currentTarget.dataset.orderId;
      const targetOrder = customerOrders.find(o => String(o.id) === String(orderId));
      if (!targetOrder || !Array.isArray(targetOrder.items)) return;

      let reorderCount = 0;
      targetOrder.items.forEach(item => {
        try {
          addToCart(item, item.quantity);
          reorderCount++;
        } catch (err) {
          console.warn(`[Reorder Skip] ${err.message}`);
        }
      });

      showToast(`${reorderCount} item(s) restored to your shopping cart!`, 'success');
      setTimeout(() => {
        window.location.href = 'index.html?drawer=open';
      }, 800);
    });
  });

  container.querySelectorAll('.btn-cancel-order').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if (confirm('Cancel this pending order?')) {
        try {
          await cancelOrderCustomer(id);
          showToast('Order cancelled.', 'success');
          await refreshOrders();
        } catch (err) {
          showToast(parseApiError(err), 'error');
          await refreshOrders();
        }
      }
    });
  });
}

function setupRealtimeTracker() {
  if (realtimeChannel) return;

  realtimeChannel = subscribeToOrders(
    (newOrder) => {
      if (currentUser && newOrder.user_id === currentUser.id) {
        showToast(`New order placed successfully!`, 'info');
        refreshOrders();
      }
    },
    (updatedOrder) => {
      if (currentUser && updatedOrder.user_id === currentUser.id) {
        showToast(`Order status updated to: ${updatedOrder.status}`, 'info');
        refreshOrders();
      }
    }
  );
}

function bindCustomerFormEvents() {
  const profileForm = document.getElementById('form-update-profile');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('profile-phone').value;
      const default_address = document.getElementById('profile-address').value;

      try {
        await updateUserProfile(currentUser.id, { phone, default_address });
        showToast('Profile details updated.', 'success');
        currentProfile.phone = phone;
        currentProfile.default_address = default_address;
        renderProfileCard();
      } catch (err) {
        showToast(parseApiError(err), 'error');
      }
    });
  }
}

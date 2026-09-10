/* ============================================================================
   Freshly Grocery E-Commerce — Dual-Mode Admin API Abstraction Layer (js/admin-api.js)
   Supports MOCK_MODE = true (Rich Offline Testing) & MOCK_MODE = false (Supabase)
   ============================================================================ */

import { getSupabase, parseApiError } from './api.js';

// DUAL-MODE ARCHITECTURE TOGGLE
export let IS_MOCK_MODE = true;

export function setMockMode(enabled) {
  IS_MOCK_MODE = Boolean(enabled);
  localStorage.setItem('freshly_use_mock_mode', IS_MOCK_MODE ? 'true' : 'false');
}

// Read stored mode setting if present
if (localStorage.getItem('freshly_use_mock_mode') !== null) {
  IS_MOCK_MODE = localStorage.getItem('freshly_use_mock_mode') === 'true';
}

/* ============================================================================
   MOCK SEED DATASETS (INITIALIZED IN LOCALSTORAGE)
   ============================================================================ */

function initMockSeedData() {
  if (!localStorage.getItem('freshly_mock_orders')) {
    const seedOrders = [
      {
        id: '1001',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        customer_name: 'Sarah Jenkins',
        customer_email: 'sarah.j@example.com',
        customer_phone: '+1 (555) 234-5678',
        delivery_address: '742 Evergreen Terrace, Apt 3B',
        delivery_slot: 'Morning (8:00 AM - 11:00 AM)',
        substitution_pref: 'Allow similar brand',
        status: 'Pending',
        total_amount: 42.85,
        delivery_person: '',
        fulfillment_notes: '',
        items: [
          { id: 1, title: 'Organic Honeycrisp Apples (1kg)', price: 4.99, quantity: 2 },
          { id: 3, title: 'Whole Milk Organic (1 Gal)', price: 4.29, quantity: 1 },
          { id: 5, title: 'Artisanal Sourdough Bread', price: 5.49, quantity: 1 }
        ]
      },
      {
        id: '1002',
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        customer_name: 'David Miller',
        customer_email: 'david.m@example.com',
        customer_phone: '+1 (555) 876-5432',
        delivery_address: '100 Wall Street, Suite 400',
        delivery_slot: 'Afternoon (1:00 PM - 4:00 PM)',
        substitution_pref: 'Refund item',
        status: 'Processing',
        total_amount: 28.40,
        delivery_person: 'John (Courier #4)',
        fulfillment_notes: 'Egg carton inspected for cracks.',
        items: [
          { id: 2, title: 'Fresh Hass Avocados (Pack of 3)', price: 3.49, quantity: 2 },
          { id: 4, title: 'Free-Range Large Eggs (12pk)', price: 3.99, quantity: 1 }
        ]
      },
      {
        id: '1003',
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        customer_name: 'Emily Watson',
        customer_email: 'emily.w@example.com',
        customer_phone: '+1 (555) 345-6789',
        delivery_address: '456 Oak Lane, House 12',
        delivery_slot: 'Evening (6:00 PM - 9:00 PM)',
        substitution_pref: 'Contact me',
        status: 'Out for Delivery',
        total_amount: 65.20,
        delivery_person: 'Alex (Driver #2)',
        fulfillment_notes: 'Substituted fresh spinach per customer call.',
        items: [
          { id: 1, title: 'Organic Honeycrisp Apples (1kg)', price: 4.99, quantity: 3 },
          { id: 6, title: 'Cold Pressed Orange Juice (1L)', price: 4.79, quantity: 2 }
        ]
      },
      {
        id: '1004',
        created_at: new Date(Date.now() - 3600000 * 26).toISOString(),
        customer_name: 'Michael Chang',
        customer_email: 'michael.c@example.com',
        customer_phone: '+1 (555) 987-6543',
        delivery_address: '88 Tech Boulevard',
        delivery_slot: 'Morning (8:00 AM - 11:00 AM)',
        substitution_pref: 'Refund item',
        status: 'Delivered',
        total_amount: 89.90,
        delivery_person: 'Driver Sam',
        fulfillment_notes: 'Left at front desk receptionist.',
        items: [
          { id: 3, title: 'Whole Milk Organic (1 Gal)', price: 4.29, quantity: 4 },
          { id: 5, title: 'Artisanal Sourdough Bread', price: 5.49, quantity: 2 }
        ]
      }
    ];
    localStorage.setItem('freshly_mock_orders', JSON.stringify(seedOrders));
  }

  if (!localStorage.getItem('freshly_mock_products')) {
    const seedProducts = [
      { id: 1, title: 'Organic Honeycrisp Apples (1kg)', price: 4.99, stock_quantity: 45, low_stock_threshold: 5, category: 'Fresh Produce', category_id: 1, image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop&q=80', is_available: true },
      { id: 2, title: 'Fresh Hass Avocados (Pack of 3)', price: 3.49, stock_quantity: 3, low_stock_threshold: 5, category: 'Fresh Produce', category_id: 1, image_url: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=500&auto=format&fit=crop&q=80', is_available: true },
      { id: 3, title: 'Whole Milk Organic (1 Gal)', price: 4.29, stock_quantity: 20, low_stock_threshold: 5, category: 'Dairy & Eggs', category_id: 2, image_url: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=500&auto=format&fit=crop&q=80', is_available: true },
      { id: 4, title: 'Free-Range Large Eggs (12pk)', price: 3.99, stock_quantity: 50, low_stock_threshold: 10, category: 'Dairy & Eggs', category_id: 2, image_url: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=500&auto=format&fit=crop&q=80', is_available: true },
      { id: 5, title: 'Artisanal Sourdough Bread', price: 5.49, stock_quantity: 2, low_stock_threshold: 5, category: 'Bakery', category_id: 3, image_url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=500&auto=format&fit=crop&q=80', is_available: true },
      { id: 6, title: 'Cold Pressed Orange Juice (1L)', price: 4.79, stock_quantity: 25, low_stock_threshold: 5, category: 'Beverages', category_id: 4, image_url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop&q=80', is_available: true }
    ];
    localStorage.setItem('freshly_mock_products', JSON.stringify(seedProducts));
  }

  if (!localStorage.getItem('freshly_mock_coupons')) {
    const seedCoupons = [
      { id: 1, code: 'FRESH20', discount_type: 'percentage', value: 20, min_spend: 35, expiry_date: '2026-12-31', is_active: true },
      { id: 2, code: 'WELCOME10', discount_type: 'flat', value: 10, min_spend: 25, expiry_date: '2026-12-31', is_active: true },
      { id: 3, code: 'ORGANIC5', discount_type: 'flat', value: 5, min_spend: 15, expiry_date: '2026-12-31', is_active: true }
    ];
    localStorage.setItem('freshly_mock_coupons', JSON.stringify(seedCoupons));
  }
}

initMockSeedData();

/* ============================================================================
   AUTHENTICATION METHODS
   ============================================================================ */

export async function loginAdmin(email, password) {
  if (!email || !password) {
    throw new Error('Please enter both email and password.');
  }

  if (IS_MOCK_MODE) {
    const e = email.toLowerCase();
    if ((e === 'admin@grocery.com' && password === 'admin123') || (e === 'admin@fresh.com' && password === 'Admin123')) {
      const session = {
        user: { id: 'mock-admin-id', email: e },
        profile: { full_name: 'Store Admin', role: 'admin' }
      };
      sessionStorage.setItem('freshly_admin_session', JSON.stringify(session));
      return session;
    } else {
      throw new Error('Invalid credentials. Use admin@fresh.com / Admin123 (or admin@grocery.com / admin123)');
    }
  } else {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client not initialized');
    
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(parseApiError(error));

    // Verify role === 'admin'
    const { data: profile } = await client.from('profiles').select('*').eq('id', data.user.id).single();
    if (profile?.role !== 'admin') {
      await client.auth.signOut();
      throw new Error('Access Denied: Non-admin accounts cannot log into the Admin Operations Portal.');
    }

    return { user: data.user, profile };
  }
}

export function getAdminSession() {
  if (IS_MOCK_MODE) {
    try {
      const raw = sessionStorage.getItem('freshly_admin_session');
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }
  return null; // Will check via Supabase in auth.js
}

export function logoutAdmin() {
  sessionStorage.removeItem('freshly_admin_session');
}

/* ============================================================================
   ORDERS & KANBAN MANAGEMENT
   ============================================================================ */

export async function fetchAdminOrders(statusFilter = 'All') {
  if (IS_MOCK_MODE) {
    let orders = JSON.parse(localStorage.getItem('freshly_mock_orders') || '[]');
    if (statusFilter && statusFilter !== 'All') {
      orders = orders.filter(o => o.status === statusFilter);
    }
    return orders;
  } else {
    const client = getSupabase();
    if (!client) return [];
    let query = client.from('orders').select('*').order('created_at', { ascending: false });
    if (statusFilter && statusFilter !== 'All') {
      query = query.eq('status', statusFilter);
    }
    const { data, error } = await query;
    if (error) throw new Error(parseApiError(error));
    return data || [];
  }
}

export async function updateOrderStatus(orderId, newStatus) {
  if (IS_MOCK_MODE) {
    const orders = JSON.parse(localStorage.getItem('freshly_mock_orders') || '[]');
    const target = orders.find(o => String(o.id) === String(orderId));
    if (target) {
      target.status = newStatus;
      localStorage.setItem('freshly_mock_orders', JSON.stringify(orders));
      return target;
    }
    throw new Error('Order not found in mock store.');
  } else {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client uninitialized');
    const { data, error } = await client
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)
      .select();
    if (error) throw new Error(parseApiError(error));
    return data[0];
  }
}

export async function assignOrderFulfillment(orderId, driverName, notes) {
  if (IS_MOCK_MODE) {
    const orders = JSON.parse(localStorage.getItem('freshly_mock_orders') || '[]');
    const target = orders.find(o => String(o.id) === String(orderId));
    if (target) {
      target.delivery_person = driverName;
      target.fulfillment_notes = notes;
      localStorage.setItem('freshly_mock_orders', JSON.stringify(orders));
      return target;
    }
    throw new Error('Order not found.');
  } else {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client uninitialized');
    const { data, error } = await client
      .from('orders')
      .update({ delivery_person: driverName, fulfillment_notes: notes })
      .eq('id', orderId)
      .select();
    if (error) throw new Error(parseApiError(error));
    return data[0];
  }
}

/* ============================================================================
   INVENTORY & STOCK CONTROL
   ============================================================================ */

export async function fetchAdminInventory() {
  if (IS_MOCK_MODE) {
    return JSON.parse(localStorage.getItem('freshly_mock_products') || '[]');
  } else {
    const client = getSupabase();
    if (!client) return [];
    const { data, error } = await client.from('products').select('*').order('id', { ascending: false });
    if (error) throw new Error(parseApiError(error));
    return data || [];
  }
}

export async function toggleProductAvailability(productId, isAvailable) {
  if (IS_MOCK_MODE) {
    const products = JSON.parse(localStorage.getItem('freshly_mock_products') || '[]');
    const target = products.find(p => String(p.id) === String(productId));
    if (target) {
      target.is_available = isAvailable;
      localStorage.setItem('freshly_mock_products', JSON.stringify(products));
      return target;
    }
  } else {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client uninitialized');
    const { data, error } = await client
      .from('products')
      .update({ is_available: Boolean(isAvailable) })
      .eq('id', productId)
      .select();
    if (error) throw new Error(parseApiError(error));
    return data[0];
  }
}

export async function createAdminCategory(categoryName) {
  if (IS_MOCK_MODE) {
    const products = JSON.parse(localStorage.getItem('freshly_mock_products') || '[]');
    const newCat = categoryName.trim();
    return { id: Date.now(), name: newCat, slug: newCat.toLowerCase().replace(/[^a-z0-9]+/g, '-') };
  } else {
    const { createCategory } = await import('./api.js');
    return await createCategory(categoryName);
  }
}

export async function saveProductItem(productData) {
  if (IS_MOCK_MODE) {
    const products = JSON.parse(localStorage.getItem('freshly_mock_products') || '[]');
    if (productData.id) {
      // Edit existing
      const idx = products.findIndex(p => String(p.id) === String(productData.id));
      if (idx !== -1) {
        products[idx] = { ...products[idx], ...productData };
      }
    } else {
      // Add new
      productData.id = Date.now();
      products.unshift(productData);
    }
    localStorage.setItem('freshly_mock_products', JSON.stringify(products));
    return productData;
  } else {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client uninitialized');
    let query;
    if (productData.id) {
      query = client.from('products').update(productData).eq('id', productData.id).select();
    } else {
      query = client.from('products').insert([productData]).select();
    }
    const { data, error } = await query;
    if (error) throw new Error(parseApiError(error));
    return data[0];
  }
}

/* ============================================================================
   SALES ANALYTICS CALCULATIONS
   ============================================================================ */

export async function fetchAnalyticsMetrics(timeframe = 'All Time') {
  const orders = await fetchAdminOrders('All');
  const validOrders = orders.filter(o => o.status !== 'Cancelled');

  const grossRevenue = validOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
  const totalOrdersCount = orders.length;
  const aov = validOrders.length > 0 ? (grossRevenue / validOrders.length) : 0;
  const pendingCount = orders.filter(o => o.status === 'Pending').length;

  // Hourly frequency distribution (00:00 to 23:00)
  const hourlyBuckets = Array(12).fill(0); // 2-hour buckets
  orders.forEach(o => {
    const hour = new Date(o.created_at).getHours();
    const bucketIndex = Math.floor(hour / 2);
    hourlyBuckets[bucketIndex]++;
  });

  // Top Sellers Leaderboard
  const productSalesMap = {};
  orders.forEach(o => {
    if (Array.isArray(o.items)) {
      o.items.forEach(item => {
        if (!productSalesMap[item.title]) {
          productSalesMap[item.title] = { title: item.title, unitsSold: 0, revenue: 0 };
        }
        productSalesMap[item.title].unitsSold += item.quantity;
        productSalesMap[item.title].revenue += (item.price * item.quantity);
      });
    }
  });

  const topSellers = Object.values(productSalesMap).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);

  return {
    grossRevenue: grossRevenue.toFixed(2),
    totalOrdersCount,
    aov: aov.toFixed(2),
    pendingCount,
    hourlyBuckets,
    topSellers
  };
}

/* ============================================================================
   CUSTOMER ROSTER & HISTORICAL DRAWER
   ============================================================================ */

export async function fetchCustomerRoster(searchQuery = '') {
  const orders = await fetchAdminOrders('All');
  const customerMap = {};

  orders.forEach(o => {
    const key = o.customer_email || 'customer@example.com';
    if (!customerMap[key]) {
      customerMap[key] = {
        email: key,
        name: o.customer_name || 'Customer',
        phone: o.customer_phone || '+1 (555) 000-0000',
        registered_at: o.created_at,
        totalOrders: 0,
        lifetimeSpend: 0,
        orders: []
      };
    }

    customerMap[key].totalOrders++;
    if (o.status !== 'Cancelled') {
      customerMap[key].lifetimeSpend += parseFloat(o.total_amount || 0);
    }
    customerMap[key].orders.push(o);
  });

  let roster = Object.values(customerMap);
  if (searchQuery && searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    roster = roster.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.email.toLowerCase().includes(q) || 
      c.phone.includes(q)
    );
  }

  return roster;
}

/* ============================================================================
   DISCOUNTS & COUPONS ENGINE
   ============================================================================ */

export async function fetchCoupons() {
  if (IS_MOCK_MODE) {
    return JSON.parse(localStorage.getItem('freshly_mock_coupons') || '[]');
  } else {
    const client = getSupabase();
    if (!client) return [];
    const { data, error } = await client.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(parseApiError(error));
    return data || [];
  }
}

export async function saveCoupon(couponData) {
  // Input validations
  if (couponData.discount_type === 'percentage' && (couponData.value <= 0 || couponData.value > 100)) {
    throw new Error('Percentage discount must be between 1% and 100%.');
  }
  if (couponData.value <= 0) {
    throw new Error('Discount value must be greater than zero.');
  }

  if (IS_MOCK_MODE) {
    const coupons = JSON.parse(localStorage.getItem('freshly_mock_coupons') || '[]');
    const existing = coupons.find(c => c.code.toUpperCase() === couponData.code.toUpperCase());
    if (existing && !couponData.id) {
      throw new Error('This category or coupon code already exists.');
    }

    couponData.id = Date.now();
    couponData.code = couponData.code.toUpperCase();
    couponData.is_active = true;
    coupons.unshift(couponData);
    localStorage.setItem('freshly_mock_coupons', JSON.stringify(coupons));
    return couponData;
  } else {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client uninitialized');
    const { data, error } = await client.from('coupons').insert([{
      ...couponData,
      code: couponData.code.toUpperCase()
    }]).select();
    if (error) throw new Error(parseApiError(error));
    return data[0];
  }
}

export async function toggleCouponStatus(couponId, isActive) {
  if (IS_MOCK_MODE) {
    const coupons = JSON.parse(localStorage.getItem('freshly_mock_coupons') || '[]');
    const target = coupons.find(c => String(c.id) === String(couponId));
    if (target) {
      target.is_active = isActive;
      localStorage.setItem('freshly_mock_coupons', JSON.stringify(coupons));
      return target;
    }
  } else {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client uninitialized');
    const { data, error } = await client.from('coupons').update({ is_active: Boolean(isActive) }).eq('id', couponId).select();
    if (error) throw new Error(parseApiError(error));
    return data[0];
  }
}

export async function deleteCoupon(couponId) {
  if (IS_MOCK_MODE) {
    let coupons = JSON.parse(localStorage.getItem('freshly_mock_coupons') || '[]');
    coupons = coupons.filter(c => String(c.id) !== String(couponId));
    localStorage.setItem('freshly_mock_coupons', JSON.stringify(coupons));
  } else {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client uninitialized');
    const { error } = await client.from('coupons').delete().eq('id', couponId);
    if (error) throw new Error(parseApiError(error));
  }
}

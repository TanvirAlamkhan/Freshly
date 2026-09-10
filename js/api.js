/* ============================================================================
   Freshly Grocery E-Commerce — Supabase API & Data Layer (v3 Production)
   ============================================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// DEFAULT OR STORED CONFIGURATION
const STORAGE_KEY_URL = 'freshly_supabase_url';
const STORAGE_KEY_ANON = 'freshly_supabase_anon_key';

let supabaseClient = null;

// DEFAULT HARDCODED / ENVIRONMENT CREDENTIALS FALLBACK
const DEFAULT_SUPABASE_URL = 'https://your-supabase-project.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'your-anon-key-here';

export function getSupabaseConfig() {
  return {
    url: localStorage.getItem(STORAGE_KEY_URL) || window.ENV_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    anonKey: localStorage.getItem(STORAGE_KEY_ANON) || window.ENV_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  };
}

export function setSupabaseConfig(url, anonKey) {
  if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
  if (anonKey) localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
  supabaseClient = null; // Reset instance
}

export function getSupabase() {
  if (supabaseClient) return supabaseClient;
  
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    console.warn('[Supabase API] Supabase URL or Anon Key missing. Operating in credentials setup mode.');
    return null;
  }

  try {
    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return supabaseClient;
  } catch (err) {
    console.error('[Supabase Init Error]', err);
    return null;
  }
}

/**
 * Friendly Error Parser Wrapper
 */
export function parseApiError(error) {
  if (!error) return 'An unknown error occurred.';
  if (typeof error === 'string') return error;

  const msg = error.message || error.error_description || '';
  const code = error.code || error.status || '';

  if (code === '23505' || msg.includes('categories_name_key') || msg.includes('unique constraint')) {
    return 'This category already exists.';
  }
  if (code === 'user_already_exists' || msg.includes('User already registered') || msg.includes('profiles_email_key')) {
    return 'An account with this email already exists. Please sign in.';
  }
  if (msg.includes('Invalid login credentials') || code === 'invalid_credentials') {
    return 'Incorrect email or password. Please try again.';
  }
  if (msg.includes('User not found') || code === 'user_not_found') {
    return 'Account does not exist with this email.';
  }
  if (msg.includes('Email rate limit exceeded') || code === 429) {
    return 'Too many failed attempts. Please wait 60 seconds.';
  }
  if (msg.includes('row-level security') || code === '42501' || code === 403) {
    return 'Access Denied: You do not have permission for this action.';
  }
  if (msg.includes('Email not confirmed') || code === 'email_not_confirmed') {
    return 'Email not confirmed yet. Please check your inbox or disable "Confirm Email" in Supabase Auth settings.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Supabase project unreachable or paused. Verify your Supabase URL in settings or switch to MOCK MODE.';
  }

  return msg || error.error || 'Database operation failed.';
}

/* ============================================================================
   AUTHENTICATION METHODS
   ============================================================================ */

export async function loginUser(email, password) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase credentials not configured.');
  
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(parseApiError(error));
  return data;
}

export async function registerUser({ email, password, fullName, phone, defaultAddress, role = 'customer' }) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase credentials not configured.');

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        default_address: defaultAddress,
        role
      }
    }
  });

  if (error) throw new Error(parseApiError(error));
  return data;
}

export async function logoutUser() {
  const client = getSupabase();
  if (client) {
    await client.auth.signOut();
  }
}

export async function getCurrentSession() {
  const client = getSupabase();
  if (!client) return null;
  const { data: { session } } = await client.auth.getSession();
  return session;
}

export async function getUserProfile(userId) {
  const client = getSupabase();
  if (!client || !userId) return null;

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.warn('[API] Could not fetch profile:', error.message);
    return null;
  }
  return data;
}

export async function updateUserProfile(userId, profileUpdates) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase client uninitialized');

  const { data, error } = await client
    .from('profiles')
    .update(profileUpdates)
    .eq('id', userId)
    .select();

  if (error) throw new Error(parseApiError(error));
  return data[0];
}

/* ============================================================================
   CATEGORIES METHODS
   ============================================================================ */

export async function fetchCategories() {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('[API Categories Warning]', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    return [];
  }
}

export async function getCategories() {
  return await fetchCategories();
}

export async function createCategory(name) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase client uninitialized');

  const trimmedName = name.trim();
  const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const { data, error } = await client
    .from('categories')
    .insert([{ name: trimmedName, slug }])
    .select();

  if (error) {
    if (error.code === '23505' || error.message.includes('unique constraint')) {
      throw new Error('Category already exists.');
    }
    throw new Error(parseApiError(error));
  }
  return data[0];
}

/* ============================================================================
   PRODUCT CATALOG & SUPABASE STORAGE METHODS
   ============================================================================ */

export async function fetchProducts(category = null, searchQuery = null) {
  const client = getSupabase();
  if (!client) return [];

  let query = client.from('products').select('*, categories(name, slug)').order('id', { ascending: false });

  if (category && category !== 'All') {
    if (!isNaN(parseInt(category))) {
      query = query.eq('category_id', parseInt(category));
    } else {
      // Find category by name
      const { data: catData } = await client.from('categories').select('id').eq('name', category).single();
      if (catData) {
        query = query.eq('category_id', catData.id);
      }
    }
  }

  if (searchQuery && searchQuery.trim() !== '') {
    query = query.ilike('title', `%${searchQuery.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(parseApiError(error));
  return data || [];
}

export async function getProducts(categoryId = null) {
  const client = getSupabase();
  if (!client) return [];

  let query = client.from('products').select('*, categories(name, slug)').order('id', { ascending: false });

  if (categoryId && categoryId !== 'All') {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;
  if (error) throw new Error(parseApiError(error));
  return data || [];
}

export async function uploadProductImage(file) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase client uninitialized');

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file format. Please upload a JPEG, PNG, or WebP image.');
  }

  const MAX_SIZE = 2 * 1024 * 1024; // 2MB
  if (file.size > MAX_SIZE) {
    throw new Error('File size exceeds 2MB limit. Please choose a smaller image.');
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `products/${Date.now()}_${sanitizedName}`;

  const { data, error } = await client.storage
    .from('product-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    if (error.status === 403 || error.message.includes('row-level security')) {
      throw new Error('Storage Access Denied: Admin authorization required.');
    }
    throw new Error(`Image Upload Failed: ${parseApiError(error)}`);
  }

  const { data: publicUrlData } = client.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return {
    publicUrl: publicUrlData.publicUrl,
    filePath
  };
}

export async function deleteProductImage(filePath) {
  const client = getSupabase();
  if (!client || !filePath) return;

  try {
    await client.storage.from('product-images').remove([filePath]);
    console.log(`[Storage Cleanup] Removed file: ${filePath}`);
  } catch (err) {
    console.warn('[Storage Cleanup Error]', err);
  }
}

export async function createProduct(productData, filePath = null) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase client uninitialized');

  const { data, error } = await client
    .from('products')
    .insert([productData])
    .select();

  if (error) {
    if (filePath) {
      await deleteProductImage(filePath);
    }
    throw new Error(`Product Creation Failed: ${parseApiError(error)}`);
  }

  return data[0];
}

export async function updateProductStock(productId, stockQty, isAvailable = true) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase client uninitialized');

  const { data, error } = await client
    .from('products')
    .update({ 
      stock_quantity: parseInt(stockQty, 10),
      is_available: Boolean(isAvailable)
    })
    .eq('id', productId)
    .select();

  if (error) throw new Error(parseApiError(error));
  return data;
}

export async function toggleProductAvailability(productId, isAvailable) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase client uninitialized');

  const { data, error } = await client
    .from('products')
    .update({ is_available: Boolean(isAvailable) })
    .eq('id', productId)
    .select();

  if (error) throw new Error(parseApiError(error));
  return data;
}

/* ============================================================================
   ORDER & STOCK METHODS
   ============================================================================ */

export async function validateCartStock(cartItems) {
  const client = getSupabase();
  if (!client || !cartItems || cartItems.length === 0) return { valid: true };

  const productIds = cartItems.map(i => i.id);
  const { data: dbProducts, error } = await client
    .from('products')
    .select('id, title, stock_quantity, is_available')
    .in('id', productIds);

  if (error) throw new Error(parseApiError(error));

  const issues = [];
  for (const item of cartItems) {
    const product = dbProducts.find(p => p.id === item.id);
    if (!product) {
      issues.push(`"${item.title}" is no longer available in store catalog.`);
    } else if (!product.is_available) {
      issues.push(`"${product.title}" is currently Out of Stock.`);
    } else if (product.stock_quantity < item.quantity) {
      issues.push(`Only ${product.stock_quantity} units of "${product.title}" left in stock (Requested: ${item.quantity}).`);
    }
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }
  return { valid: true };
}

/* ============================================================================
   COUPON VALIDATION METHOD
   ============================================================================ */

export async function validateCoupon(code, subtotal = 0) {
  if (!code || !code.trim()) {
    throw new Error('Please enter a valid coupon code.');
  }

  const cleanCode = code.trim().toUpperCase();
  const isMock = localStorage.getItem('freshly_use_mock_mode') === 'true' || localStorage.getItem('freshly_use_mock_mode') === null;

  let coupon = null;

  if (isMock) {
    const coupons = JSON.parse(localStorage.getItem('freshly_mock_coupons') || '[]');
    coupon = coupons.find(c => String(c.code).toUpperCase() === cleanCode);
  } else {
    const client = getSupabase();
    if (!client) {
      const coupons = JSON.parse(localStorage.getItem('freshly_mock_coupons') || '[]');
      coupon = coupons.find(c => String(c.code).toUpperCase() === cleanCode);
    } else {
      const { data, error } = await client
        .from('coupons')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

      if (error) throw new Error(parseApiError(error));
      coupon = data;
    }
  }

  if (!coupon) {
    throw new Error(`Coupon code "${cleanCode}" is invalid.`);
  }

  if (!coupon.is_active) {
    throw new Error(`Coupon code "${cleanCode}" is currently inactive.`);
  }

  if (coupon.expiry_date) {
    const today = new Date().toISOString().split('T')[0];
    if (coupon.expiry_date < today) {
      throw new Error(`Coupon code "${cleanCode}" has expired.`);
    }
  }

  const minSpend = parseFloat(coupon.min_spend || 0);
  if (subtotal < minSpend) {
    throw new Error(`Minimum spend of ৳${minSpend.toFixed(2)} required for coupon "${cleanCode}".`);
  }

  let discountAmount = 0;
  const val = parseFloat(coupon.value);
  if (coupon.discount_type === 'percentage') {
    discountAmount = (subtotal * val) / 100;
  } else {
    discountAmount = val;
  }

  discountAmount = Math.min(subtotal, Math.max(0, discountAmount));

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      value: val,
      min_spend: minSpend
    },
    discountAmount: parseFloat(discountAmount.toFixed(2))
  };
}

export async function createOrder(orderPayload) {
  const isMock = localStorage.getItem('freshly_use_mock_mode') === 'true' || localStorage.getItem('freshly_use_mock_mode') === null;

  if (isMock) {
    const orders = JSON.parse(localStorage.getItem('freshly_mock_orders') || '[]');
    const newOrder = {
      id: String(Date.now()),
      created_at: new Date().toISOString(),
      customer_name: orderPayload.customer_name || 'Customer',
      customer_email: orderPayload.customer_email || 'customer@example.com',
      customer_phone: orderPayload.customer_phone || '+1 (555) 000-0000',
      delivery_address: orderPayload.delivery_address,
      delivery_slot: orderPayload.delivery_slot,
      substitution_pref: orderPayload.substitution_pref,
      status: 'Pending',
      total_amount: orderPayload.total_amount,
      coupon_code: orderPayload.coupon_code || '',
      discount_amount: orderPayload.discount_amount || 0,
      delivery_person: '',
      fulfillment_notes: '',
      user_id: orderPayload.user_id,
      items: orderPayload.items
    };
    orders.unshift(newOrder);
    localStorage.setItem('freshly_mock_orders', JSON.stringify(orders));

    // Deduct stock in mock inventory
    const products = JSON.parse(localStorage.getItem('freshly_mock_products') || '[]');
    for (const item of orderPayload.items) {
      const p = products.find(prod => String(prod.id) === String(item.id));
      if (p) {
        p.stock_quantity = Math.max(0, p.stock_quantity - item.quantity);
        if (p.stock_quantity === 0) p.is_available = false;
      }
    }
    localStorage.setItem('freshly_mock_products', JSON.stringify(products));

    return newOrder;
  } else {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client uninitialized');

    const stockCheck = await validateCartStock(orderPayload.items);
    if (!stockCheck.valid) {
      throw new Error(`Stock Error:\n${stockCheck.issues.join('\n')}`);
    }

    const { data, error } = await client
      .from('orders')
      .insert([orderPayload])
      .select();

    if (error) throw new Error(parseApiError(error));
    const newOrder = data[0];

    for (const item of orderPayload.items) {
      const { data: p } = await client.from('products').select('stock_quantity').eq('id', item.id).single();
      if (p) {
        const newStock = Math.max(0, p.stock_quantity - item.quantity);
        await client.from('products').update({ stock_quantity: newStock }).eq('id', item.id);
      }
    }

    return newOrder;
  }
}

export async function fetchCustomerOrders(userId) {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(parseApiError(error));
  return data || [];
}

export async function fetchAllOrders(statusFilter = null) {
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

export async function updateOrderStatus(orderId, status, deliveryPerson = null) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase client uninitialized');

  const updateData = { status };
  if (deliveryPerson) updateData.delivery_person = deliveryPerson;

  const { data, error } = await client
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select();

  if (error) throw new Error(parseApiError(error));
  return data[0];
}

export async function cancelOrderCustomer(orderId) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase client uninitialized');

  const { data, error } = await client
    .from('orders')
    .update({ status: 'Cancelled' })
    .eq('id', orderId)
    .eq('status', 'Pending')
    .select();

  if (error) throw new Error(parseApiError(error));
  if (!data || data.length === 0) {
    throw new Error('This order is already being processed and can no longer be cancelled.');
  }

  return data[0];
}

/* ============================================================================
   SUPABASE REALTIME WEBSOCKET SUBSCRIPTION
   ============================================================================ */

export function subscribeToOrders(onInsertCallback, onUpdateCallback) {
  const client = getSupabase();
  if (!client) return null;

  const channel = client
    .channel('orders_realtime_channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => {
        if (onInsertCallback) onInsertCallback(payload.new);
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders' },
      (payload) => {
        if (onUpdateCallback) onUpdateCallback(payload.new);
      }
    )
    .subscribe();

  return channel;
}

# Freshly — Premium Grocery Store

A fully-featured grocery store frontend built with **vanilla HTML, CSS, and JavaScript** — no frameworks, no build tools. Connects to a REST API backend for products, auth, and orders.

---

## Live Demo

Open directly in browser (with a backend running):

```
index.html
```

Or serve statically:

```bash
npx serve .
# → http://localhost:3000
```

---

## Features

### Shopping
- **Hero slider** — 3 auto-rotating promotional banners (5s interval, dot navigation)
- **Category grid** — dynamic categories fetched from API
- **Product grid** — filter by category, load more (8 at a time)
- **Live search** — dropdown suggestions as you type
- **Quick view** — modal with quantity selector before adding to cart
- **Toast notifications** — success/error feedback on every action

### Cart
- **Slide-out cart sidebar** — shows all items, quantities, total
- Quantity adjust + remove per item
- Persisted in **localStorage** — survives page refresh
- Real-time badge count on cart button

### Auth
- **Sign In / Register** modal with tab switching
- JWT token stored in `localStorage`
- Authenticated state shown in navbar (name + My Orders button)
- Auto-logout on token removal

### Checkout
- Multi-step checkout modal
- Order summary with items + subtotal + total
- Places order via API → success confirmation modal

### UX Details
- Responsive navbar with hamburger menu (mobile)
- Scroll-aware navbar (shadow on scroll)
- Accessible — `aria-label`, `aria-hidden`, `role` attributes throughout
- All modals trap focus + restore scroll on close

---

## File Structure

```
grocery-frontend/
├── index.html        ← Full app shell + all modal HTML
├── css/
│   └── styles.css    ← All styles (layout, components, animations)
└── js/
    ├── app.js        ← Main app logic (hero, categories, products, UI)
    ├── api.js        ← Fetch layer (all API calls, auth token management)
    └── cart.js       ← localStorage cart (add, remove, qty, total)
```

---

## How It Works

### API Layer — `api.js`
All requests go through a single `API._req()` method that:
1. Attaches `Authorization: Bearer <token>` if logged in
2. Parses JSON response
3. Throws typed errors on non-2xx status

```js
API.getProducts({ page: 1, limit: 8, search: 'apple' })
API.login(email, password)       // stores token in localStorage
API.createOrder(cartItems)
```

### Cart — `cart.js`
Pure localStorage-backed cart using the module pattern:

```js
Cart.add(product, qty)   // add or increment
Cart.setQty(id, qty)     // update or remove if qty < 1
Cart.remove(id)
Cart.summary()           // { items, count, total }
Cart.onChange(fn)        // subscribe to cart changes
```

### App — `app.js`
Orchestrates everything:
- Fetches products + categories on load
- Builds hero slider with auto-rotation
- Wires up all DOM events (search, filter, cart, auth, checkout)
- Listens to `Cart.onChange()` to keep badge + sidebar in sync

---

## API Endpoints Expected

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (page, limit, search) |
| GET | `/api/categories` | List categories |
| POST | `/api/auth/login` | Login → returns `{ data: { token, user } }` |
| POST | `/api/auth/register` | Register → returns `{ data: { token, user } }` |
| POST | `/api/orders` | Place order → `{ items: [{ productId, quantity }] }` |

---

## Tech Stack

| | |
|---|---|
| **HTML** | Semantic, accessible markup |
| **CSS** | Custom properties, flexbox, grid, animations |
| **JavaScript** | Vanilla ES6+ (modules pattern, async/await) |
| **Fonts** | Inter (Google Fonts) |
| **Storage** | localStorage (cart + auth token) |
| **Backend** | REST API (any — connects via `/api` prefix) |

---

## Pair With

This frontend connects to `grocery-store` — a Next.js backend with the matching API routes and database.

---

*Built with zero dependencies · SR MAEIN*

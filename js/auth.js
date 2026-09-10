/* ============================================================================
   Freshly Grocery E-Commerce — Authentication & Role Router Engine (js/auth.js)
   ============================================================================ */

import { getSupabase, getCurrentSession, getUserProfile, logoutUser } from './api.js';

let currentUserProfile = null;

export function getCurrentUserProfile() {
  return currentUserProfile;
}

export async function initAuth() {
  const client = getSupabase();
  if (!client) {
    updateNavUI(null, null);
    return null;
  }

  try {
    const session = await getCurrentSession();
    if (session?.user) {
      currentUserProfile = await getUserProfile(session.user.id);
      updateNavUI(session.user, currentUserProfile);
    } else {
      currentUserProfile = null;
      updateNavUI(null, null);
    }

    client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        currentUserProfile = await getUserProfile(session.user.id);
        updateNavUI(session.user, currentUserProfile);
      } else if (event === 'SIGNED_OUT') {
        currentUserProfile = null;
        updateNavUI(null, null);
      }
    });

    return currentUserProfile;
  } catch (err) {
    console.error('[Auth Init Error]', err);
    updateNavUI(null, null);
    return null;
  }
}

/**
 * Route Guard: Ensures user is authenticated & matches required role
 */
export async function requireAuth(requiredRole = null) {
  const session = await getCurrentSession();
  if (!session?.user) {
    window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}&banner=auth_required`;
    return null;
  }

  const profile = await getUserProfile(session.user.id);
  if (!profile) {
    window.location.href = `login.html?banner=profile_missing`;
    return null;
  }

  if (requiredRole && profile.role !== requiredRole) {
    if (requiredRole === 'admin') {
      window.location.href = `index.html?banner=unauthorized_admin`;
    } else {
      window.location.href = `index.html`;
    }
    return null;
  }

  return { user: session.user, profile };
}

/**
 * Intelligent Post-Login Role Router
 */
export async function redirectIfLoggedIn() {
  const session = await getCurrentSession();
  if (session?.user) {
    const profile = await getUserProfile(session.user.id);
    if (profile?.role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'customer.html';
    }
  }
}

/**
 * Update Top Navigation Bar UI
 */
function updateNavUI(user, profile) {
  const navActionsContainer = document.getElementById('nav-user-actions');
  if (!navActionsContainer) return;

  if (user && profile) {
    const roleBadgeClass = profile.role === 'admin' ? 'badge-admin' : 'badge-customer';
    const dashboardLink = profile.role === 'admin' 
      ? '<a href="admin.html" class="btn btn-secondary btn-sm"><i class="fas fa-chart-line"></i> Admin Portal</a>'
      : '<a href="customer.html" class="btn btn-secondary btn-sm"><i class="fas fa-user-circle"></i> My Dashboard</a>';

    navActionsContainer.innerHTML = `
      ${dashboardLink}
      <span class="badge ${roleBadgeClass}">${profile.role}</span>
      <button id="btn-logout" class="btn btn-secondary btn-sm" title="Log Out">
        <i class="fas fa-sign-out-alt"></i> Logout
      </button>
    `;

    document.getElementById('btn-logout')?.addEventListener('click', async () => {
      await logoutUser();
      window.location.href = 'index.html';
    });
  } else {
    navActionsContainer.innerHTML = `
      <a href="login.html" class="btn btn-primary btn-sm">
        <i class="fas fa-user"></i> Sign In / Register
      </a>
    `;
  }
}

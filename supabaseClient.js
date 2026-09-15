(function () {
  "use strict";

  // ============================================================
  // Auth now goes through server.js's authenticated REST API,
  // not directly against Supabase from the browser. Password
  // hashing and checking both happen server-side (bcrypt, in
  // server.js), so the browser never touches password_hash and
  // never needs bcryptjs. This is the fix for the exposure where
  // the old client-side flow let anyone with the public anon key
  // read every row (including password_hash) straight out of the
  // users table via the Supabase JS client.
  //
  // Keep this in sync with API_BASE_URL in app.js if the server.js
  // deployment URL ever changes.
  // ============================================================
  const API_BASE_URL = "https://mavis-personal-tracker.onrender.com";

  // Session helpers — the logged-in user + JWT are stored in
  // localStorage under this key. app.js reads the token back out
  // via authAPI.getSession().token to authenticate its own API calls.
  const SESSION_KEY = 'mavis_session';

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  async function postJSON(path, body) {
    let response;
    try {
      response = await fetch(API_BASE_URL + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (err) {
      // Network failure, server unreachable, CORS block, etc.
      throw new Error('Could not reach the server. Please check your connection and try again.');
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      // Non-JSON response body — fall through, message below covers it
    }

    if (!response.ok) {
      throw new Error((data && data.error) || 'Something went wrong. Please try again.');
    }

    return data;
  }

  async function getJSON(path) {
    const response = await fetch(API_BASE_URL + path);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        response.status === 404
          ? 'The authentication API is not updated on the server yet. Please redeploy the backend.'
          : 'The authentication server returned an unexpected response.'
      );
    }
    const data = await response.json();
    if (!response.ok) throw new Error((data && data.error) || 'Could not load configuration.');
    return data;
  }

  async function authenticatedPostJSON(path, body, method) {
    const session = getSession();
    const response = await fetch(API_BASE_URL + path, {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': session && session.token ? 'Bearer ' + session.token : ''
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error((data && data.error) || 'Something went wrong. Please try again.');
    return data;
  }

  async function authenticatedGetJSON(path) {
    const session = getSession();
    const response = await fetch(API_BASE_URL + path, {
      headers: { 'Authorization': session && session.token ? 'Bearer ' + session.token : '' }
    });
    const data = await response.json();
    if (!response.ok) throw new Error((data && data.error) || 'Something went wrong. Please try again.');
    return data;
  }

  // ============================================================
  // Auth API
  // ============================================================
  window.authAPI = {

    register: async (username, password) => {
      if (!username || !password) throw new Error('Username and password are required.');
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');

      // server.js's /api/register hashes the password with bcrypt
      // server-side and checks for an existing username itself —
      // both of those checks used to happen here, in the browser.
      const data = await postJSON('/api/register', {
        username: username.toLowerCase().trim(),
        password: password
      });

      return data.user;
    },

    login: async (username, password) => {
      // server.js's /api/login verifies the password against the
      // stored bcrypt hash server-side and returns a signed JWT —
      // the browser never sees password_hash at any point.
      const data = await postJSON('/api/login', {
        username: username.toLowerCase().trim(),
        password: password
      });

      const session = Object.assign({}, data.user, { token: data.token });
      setSession(session);
      return session;
    },

    googleLogin: async (credential) => {
      const data = await postJSON('/api/auth/google', { credential });
      const session = Object.assign({}, data.user, { token: data.token });
      setSession(session);
      return session;
    },

    googleCodeLogin: async (code) => {
      const data = await postJSON('/api/auth/google/code', { code });
      const session = Object.assign({}, data.user, { token: data.token });
      setSession(session);
      return session;
    },

    linkGoogle: async (credential) => {
      const data = await authenticatedPostJSON('/api/auth/google/link', { credential });
      const session = getSession();
      if (session) setSession(Object.assign({}, session, data.user));
      return data.user;
    },

    updateAccount: async (body) => {
      const data = await authenticatedPostJSON('/api/account', body, 'PATCH');
      const session = getSession();
      if (session) setSession(Object.assign({}, session, data.user, { token: data.token }));
      return data.user;
    },

    unlinkGoogle: async () => {
      const data = await authenticatedPostJSON('/api/auth/google/unlink', {});
      const session = getSession();
      if (session) setSession(Object.assign({}, session, data.user));
      return data.user;
    },

    refreshUser: async () => {
      const data = await authenticatedGetJSON('/api/me');
      const session = getSession();
      if (session) setSession(Object.assign({}, session, data.user));
      return data.user;
    },

    initializeGoogleButton: async (elementId, callback, text) => {
      const deadline = Date.now() + 5000;
      while ((!window.google || !window.google.accounts || !window.google.accounts.id) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        throw new Error('Google Sign-In is unavailable. Please reload and try again.');
      }
      const config = await getJSON('/api/config');
      if (!config.googleClientId) throw new Error('Google Sign-In is not configured.');
      window.google.accounts.id.initialize({ client_id: config.googleClientId, callback });
      const element = document.getElementById(elementId);
      if (element) {
        window.google.accounts.id.renderButton(element, {
          theme: 'outline',
          size: 'large',
          text: text || 'signin_with',
          width: Math.min(360, element.parentElement ? element.parentElement.clientWidth : 360)
        });
      }
    },

    initializeGoogleOAuthButton: async (callback) => {
      const deadline = Date.now() + 5000;
      while ((!window.google || !window.google.accounts || !window.google.accounts.oauth2) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
        throw new Error('Google Sign-In is unavailable. Please reload and try again.');
      }
      const config = await getJSON('/api/config');
      if (!config.googleClientId) throw new Error('Google Sign-In is not configured.');
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: config.googleClientId,
        scope: 'openid email profile',
        ux_mode: 'popup',
        access_type: 'offline',
        prompt: 'select_account',
        callback
      });
      client.requestCode();
    },

    initializeGooglePrompt: async (callback) => {
      const deadline = Date.now() + 5000;
      while ((!window.google || !window.google.accounts || !window.google.accounts.id) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        throw new Error('Google Sign-In is unavailable. Please reload and try again.');
      }
      const config = await getJSON('/api/config');
      if (!config.googleClientId) throw new Error('Google Sign-In is not configured.');
      window.google.accounts.id.initialize({ client_id: config.googleClientId, callback });
      return function () {
        window.google.accounts.id.prompt();
      };
    },

    logout: () => {
      clearSession();
      window.location.reload();
    },

    isLoggedIn: () => !!getSession(),

    getSession: () => getSession(),

    getUserId: () => {
      const s = getSession();
      return s ? s.id : null;
    }
  };
})();

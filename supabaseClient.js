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

      const session = { id: data.user.id, username: data.user.username, token: data.token };
      setSession(session);
      return session;
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

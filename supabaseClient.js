(function () {
  "use strict";

  // bcryptjs browser build exposes itself as dcodeIO.bcrypt, not window.bcrypt
  const bcrypt = (window.dcodeIO && window.dcodeIO.bcrypt) || window.bcrypt;

  // Initialize the Supabase JS client (used only for DB queries, NOT for auth)
  const { url, anonKey } = window.MAVIS_SUPABASE_CONFIG;
  const supabase = window.supabase.createClient(url, anonKey);

  // Expose raw client so app.js can query tables
  window.MAVIS_SUPABASE = supabase;

  // Session helpers — we store the logged-in user in localStorage ourselves
  const SESSION_KEY = 'mavis_session';

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  // ============================================================
  // Auth API
  // ============================================================
  window.authAPI = {

    register: async (username, password) => {
      if (!username || !password) throw new Error('Username and password are required.');
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');

      // Check if username already taken
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', username.toLowerCase().trim())
        .maybeSingle();

      if (existing) throw new Error('Username is already taken.');

      // Hash the password using bcryptjs (loaded via CDN)
      const hash = await bcrypt.hash(password, 10);

      const { data, error } = await supabase
        .from('users')
        .insert({ username: username.toLowerCase().trim(), password_hash: hash })
        .select('id, username')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },

    login: async (username, password) => {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, password_hash')
        .eq('username', username.toLowerCase().trim())
        .maybeSingle();

      if (error || !user) throw new Error('Invalid username or password.');

      // Compare entered password with stored hash
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) throw new Error('Invalid username or password.');

      // Save session (without password_hash!)
      const session = { id: user.id, username: user.username };
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

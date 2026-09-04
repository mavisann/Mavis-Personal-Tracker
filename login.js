document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');
  const tabSwitch = document.querySelector('.tab-switch');
  const errorBox = document.getElementById('error-box');

  const API_BASE_URL = 'https://mavis-personal-tracker.onrender.com';
  const REDIRECT_TARGET = 'index.html';
  const SESSION_KEY = 'mavis_session';

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    errorBox.classList.add('hidden');
  }

  function getEyeIcon(isOpen) {
    if (isOpen) {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      `;
    }

    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 3l18 18"/>
        <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42"/>
        <path d="M9.88 5.08A10.42 10.42 0 0 1 12 5c6.5 0 10 7 10 7a15.86 15.86 0 0 1-4 5.04"/>
        <path d="M6.61 6.61A15.7 15.7 0 0 0 2 12s3.5 7 10 7a10.44 10.44 0 0 0 5.39-1.61"/>
      </svg>
    `;
  }

  function setupPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(function (button) {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;

      const syncIcon = function () {
        const shouldShow = input.type === 'text';
        button.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
        button.innerHTML = getEyeIcon(shouldShow);
      };

      button.addEventListener('click', function () {
        const nextType = input.type === 'password' ? 'text' : 'password';
        input.type = nextType;
        syncIcon();
        input.focus();
      });

      syncIcon();
    });
  }

  function switchTab(tab) {
    const isLogin = tab === 'login';
    loginTab.classList.toggle('active', isLogin);
    signupTab.classList.toggle('active', !isLogin);
    tabSwitch.classList.toggle('login-active', isLogin);
    tabSwitch.classList.toggle('signup-active', !isLogin);

    [loginForm, signupForm].forEach(function (form) {
      const shouldActivate = isLogin ? form === loginForm : form === signupForm;
      form.classList.toggle('active', shouldActivate);
      form.classList.toggle('inactive', !shouldActivate);
    });

    hideError();
  }

  loginTab.addEventListener('click', function () {
    switchTab('login');
  });

  signupTab.addEventListener('click', function () {
    switchTab('signup');
  });

  async function postJSON(path, body) {
    let response;
    try {
      response = await fetch(API_BASE_URL + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (error) {
      throw new Error('Could not reach the server. Please check your connection and try again.');
    }

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      throw new Error((data && data.error) || 'Something went wrong. Please try again.');
    }

    return data;
  }

  async function handleSubmit(event, action) {
    event.preventDefault();
    hideError();

    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Please wait...';

    const prefix = action === 'login' ? 'login' : 'signup';
    const username = document.getElementById(prefix + '-username').value.trim();
    const password = document.getElementById(prefix + '-password').value;

    try {
      if (action === 'register') {
        await postJSON('/api/register', { username: username.toLowerCase(), password });
      }

      const loginData = await postJSON('/api/login', { username: username.toLowerCase(), password });
      const session = {
        id: loginData.user.id,
        username: loginData.user.username,
        token: loginData.token
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      window.location.href = REDIRECT_TARGET;
    } catch (error) {
      showError(error.message || 'An error occurred. Please try again.');
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  loginForm.addEventListener('submit', function (event) {
    handleSubmit(event, 'login');
  });

  signupForm.addEventListener('submit', function (event) {
    handleSubmit(event, 'register');
  });

  setupPasswordToggles();

  const sessionCheck = (() => {
    let session = null;
    try {
      session = JSON.parse(localStorage.getItem('mavis_session'));
    } catch (error) {
      session = null;
    }

    if (session && session.token) {
      window.location.href = 'index.html';
    }
  })();

  return sessionCheck;
});

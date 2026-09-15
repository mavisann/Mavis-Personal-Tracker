document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');
  const tabSwitch = document.querySelector('.tab-switch');
  const errorBox = document.getElementById('error-box');
  const termsModal = document.getElementById('terms-modal');
  const termsAgreement = document.getElementById('terms-agreement');
  const termsContinue = document.getElementById('terms-continue');
  const termsError = document.getElementById('terms-error');

  const API_BASE_URL = 'https://mavis-personal-tracker.onrender.com';
  const REDIRECT_TARGET = 'index.html';
  const SESSION_KEY = 'mavis_session';
  const TERMS_ACCEPTED_KEY = 'mavis_terms_accepted_at';

  fetch(API_BASE_URL + '/api/health', { method: 'GET', mode: 'cors', keepalive: true }).catch(function () {});

  function hasAcceptedTerms() {
    return Boolean(localStorage.getItem(TERMS_ACCEPTED_KEY));
  }

  function requireTermsAgreement() {
    if (hasAcceptedTerms()) return true;
    termsModal.classList.add('is-open');
    termsAgreement.focus();
    termsError.textContent = 'Please agree to the Terms & Conditions to continue.';
    return false;
  }

  termsAgreement.checked = hasAcceptedTerms();
  termsContinue.disabled = !termsAgreement.checked;
  termsAgreement.addEventListener('change', function () {
    termsContinue.disabled = !termsAgreement.checked;
    termsError.textContent = '';
  });
  termsContinue.addEventListener('click', function () {
    if (!termsAgreement.checked) {
      termsError.textContent = 'Please check the agreement box first.';
      return;
    }
    localStorage.setItem(TERMS_ACCEPTED_KEY, new Date().toISOString());
    termsModal.classList.remove('is-open');
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  }

  function setFieldError(input, message) {
    const error = document.getElementById(input.id + '-error');
    input.setCustomValidity(message || '');
    input.classList.toggle('has-error', Boolean(message));
    if (error) error.textContent = message || '';
  }

  function validateForm(form) {
    let valid = true;
    form.querySelectorAll('input').forEach(function (input) {
      const message = input.validity.valid ? '' : (input.validity.valueMissing ? 'This field is required.' : input.validationMessage);
      setFieldError(input, message);
      if (message) valid = false;
    });
    return valid;
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

    if (!requireTermsAgreement()) return;
    const form = event.target;
    if (!validateForm(form)) {
      form.reportValidity();
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Please wait...';
    form.setAttribute('aria-busy', 'true');

    const prefix = action === 'login' ? 'login' : 'signup';
    const username = document.getElementById(prefix + '-username').value.trim();
    const password = document.getElementById(prefix + '-password').value;
    const emailInput = document.getElementById('signup-email');
    const email = emailInput ? emailInput.value.trim() : '';

    try {
      if (action === 'register') {
        await postJSON('/api/register', {
          username: username.toLowerCase(),
          password,
          email: email || undefined
        });
      }

      const loginData = await postJSON('/api/login', { username: username.toLowerCase(), password });
      const session = {
        id: loginData.user.id,
        username: loginData.user.username,
        token: loginData.token
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      button.textContent = action === 'register' ? 'Account created — welcome!' : "You're signed in!";
      button.classList.add('success-state');
      form.removeAttribute('aria-busy');
      window.setTimeout(function () {
        window.location.href = REDIRECT_TARGET;
      }, 450);
    } catch (error) {
      showError(error.message || 'An error occurred. Please try again.');
      button.disabled = false;
      button.textContent = originalText;
      form.removeAttribute('aria-busy');
    }
  }

  loginForm.addEventListener('submit', function (event) {
    handleSubmit(event, 'login');
  });

  signupForm.addEventListener('submit', function (event) {
    handleSubmit(event, 'register');
  });

  function handleGoogleCredential(response) {
    if (!requireTermsAgreement()) return;
    hideError();
    window.authAPI.googleLogin(response.credential)
      .then(function () {
      showError('Signed in successfully. Loading your dashboard…');
      errorBox.classList.remove('bg-red-50', 'border-red-200', 'text-red-700');
      errorBox.classList.add('success-message');
      window.location.href = REDIRECT_TARGET;
      })
      .catch(function (error) {
        showError(error.message || 'Google sign-in failed. Please try again.');
      });
  }

  function setupGoogleSignIn() {
      if (!window.authAPI || !window.authAPI.initializeGoogleOAuthButton) return;
      ['google-login-button', 'google-signup-button'].forEach(function (buttonId) {
        var button = document.getElementById(buttonId);
        if (button) {
          button.addEventListener('click', function () {
            if (!requireTermsAgreement()) return;
            hideError();
            window.authAPI.initializeGoogleOAuthButton(function (response) {
              if (!response || !response.code) {
                showError('Google authorization was cancelled.');
                return;
              }
              window.authAPI.googleCodeLogin(response.code)
                .then(function () {
                  showError('Signed in successfully. Loading your dashboard…');
                  errorBox.classList.remove('bg-red-50', 'border-red-200', 'text-red-700');
                  errorBox.classList.add('success-message');
                  window.location.href = REDIRECT_TARGET;
                })
                .catch(function (error) {
                  showError(error.message || 'Google sign-in failed. Please try again.');
                });
            }).catch(function (error) {
              showError(error.message || 'Google sign-in is unavailable.');
            });
          });
        }
      });
  }

  setupPasswordToggles();
  setupGoogleSignIn();
  [loginForm, signupForm].forEach(function (form) {
    form.querySelectorAll('input').forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.validity.valid) setFieldError(input, '');
      });
    });
  });

  if (!localStorage.getItem('mavis_consent')) {
    const banner = document.createElement('div');
    banner.className = 'consent-banner';
    banner.innerHTML = '<p>We use localStorage for your session and preferences. <a href="privacy.html">Read our privacy policy</a>.</p><button class="btn btn-primary" type="button">Got it</button>';
    banner.querySelector('button').addEventListener('click', function () {
      localStorage.setItem('mavis_consent', 'accepted');
      banner.remove();
    });
    document.body.appendChild(banner);
  }

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

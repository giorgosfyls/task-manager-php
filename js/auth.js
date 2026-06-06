/* ============================================================
   TaskFlow — Auth logic
   js/auth.js

   Handles the login/register page (index.html):
     - Tab switching between Sign In and Sign Up
     - Show/hide password toggle
     - Client-side form validation
     - Fetch POST to the PHP auth endpoints
     - Field-level error display and server message display

   Depends on: nothing (standalone, loaded only on index.html)
   ============================================================ */


/* ════════════════════════════════════════════════════════════
   TAB SWITCHING
════════════════════════════════════════════════════════════ */

const tabs   = document.querySelectorAll('.auth-tab');
const panels = document.querySelectorAll('.form-panel');

/**
 * Activates the requested tab and its corresponding panel.
 * @param {'login'|'register'} targetId
 */
function activateTab(targetId) {
  tabs.forEach(tab => {
    const isActive = tab.dataset.target === targetId;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  panels.forEach(panel => {
    const isActive = panel.id === `panel-${targetId}`;
    panel.classList.toggle('active', isActive);
    panel.setAttribute('aria-hidden', String(!isActive));
  });
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => activateTab(tab.dataset.target));
});

// Cross-link anchors ("Sign up now" / "Sign in here")
document.getElementById('link-to-register')
  .addEventListener('click', e => { e.preventDefault(); activateTab('register'); });

document.getElementById('link-to-login')
  .addEventListener('click', e => { e.preventDefault(); activateTab('login'); });


/* ════════════════════════════════════════════════════════════
   SHOW / HIDE PASSWORD
════════════════════════════════════════════════════════════ */

document.querySelectorAll('.btn-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input    = document.getElementById(btn.dataset.target);
    const isHidden = input.type === 'password';

    input.type = isHidden ? 'text' : 'password';

    // Swap the SVG icon between eye and eye-off
    const svg = btn.querySelector('.icon-eye');
    if (isHidden) {
      svg.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
                 a18.45 18.45 0 0 1 5.06-5.94
                 M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8
                 a18.5 18.5 0 0 1-2.16 3.19
                 m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>`;
    } else {
      svg.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>`;
    }

    btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  });
});


/* ════════════════════════════════════════════════════════════
   HELPERS — field errors, messages, loading state
════════════════════════════════════════════════════════════ */

/**
 * Marks a field as invalid and shows an error message below it.
 * @param {HTMLInputElement} inputEl
 * @param {HTMLElement}      errorEl
 * @param {string}           msg
 */
function showFieldError(inputEl, errorEl, msg) {
  inputEl.classList.add('error');
  inputEl.setAttribute('aria-invalid', 'true');
  errorEl.textContent = msg;
  errorEl.classList.add('visible');
}

/**
 * Clears the error state from a field.
 * @param {HTMLInputElement} inputEl
 * @param {HTMLElement}      errorEl
 */
function clearFieldError(inputEl, errorEl) {
  inputEl.classList.remove('error');
  inputEl.removeAttribute('aria-invalid');
  errorEl.textContent = '';
  errorEl.classList.remove('visible');
}

/**
 * Shows a success or error message banner below the form.
 * @param {HTMLElement}       el
 * @param {'success'|'error'} type
 * @param {string}            msg
 */
function setMessage(el, type, msg) {
  el.className   = `auth-message ${type}`;
  el.textContent = msg;
}

/**
 * Toggles the loading/disabled state of a submit button.
 * @param {HTMLButtonElement} btn
 * @param {boolean}           loading
 */
function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}


/* ════════════════════════════════════════════════════════════
   LOGIN FORM
════════════════════════════════════════════════════════════ */

document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();

  const emailEl  = document.getElementById('login-email');
  const passEl   = document.getElementById('login-password');
  const emailErr = document.getElementById('login-email-error');
  const passErr  = document.getElementById('login-password-error');
  const msgEl    = document.getElementById('login-message');
  const btn      = document.getElementById('btn-login');

  // Clear previous state
  clearFieldError(emailEl, emailErr);
  clearFieldError(passEl,  passErr);
  msgEl.className = 'auth-message';

  // Client-side validation
  let valid = true;

  if (!emailEl.value.trim()) {
    showFieldError(emailEl, emailErr, 'Email is required.');
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
    showFieldError(emailEl, emailErr, 'Invalid email format.');
    valid = false;
  }

  if (!passEl.value) {
    showFieldError(passEl, passErr, 'Password is required.');
    valid = false;
  }

  if (!valid) return;

  setLoading(btn, true);

  try {
    const res = await fetch('api/auth/login.php', {
      method:      'POST',
      credentials: 'same-origin',
      headers:     { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:    emailEl.value.trim().toLowerCase(),
        password: passEl.value,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setMessage(msgEl, 'success', '✓ Signed in! Redirecting…');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
    } else {
      setMessage(msgEl, 'error', data.error || 'Sign in failed. Please try again.');
    }
  } catch {
    setMessage(msgEl, 'error', 'Network error. Check your connection.');
  } finally {
    setLoading(btn, false);
  }
});


/* ════════════════════════════════════════════════════════════
   REGISTER FORM
════════════════════════════════════════════════════════════ */

document.getElementById('form-register').addEventListener('submit', async e => {
  e.preventDefault();

  const usernameEl  = document.getElementById('reg-username');
  const emailEl     = document.getElementById('reg-email');
  const passEl      = document.getElementById('reg-password');
  const confirmEl   = document.getElementById('reg-confirm');
  const usernameErr = document.getElementById('reg-username-error');
  const emailErr    = document.getElementById('reg-email-error');
  const passErr     = document.getElementById('reg-password-error');
  const confirmErr  = document.getElementById('reg-confirm-error');
  const msgEl       = document.getElementById('register-message');
  const btn         = document.getElementById('btn-register');

  // Clear previous state
  [
    [usernameEl, usernameErr],
    [emailEl,    emailErr],
    [passEl,     passErr],
    [confirmEl,  confirmErr],
  ].forEach(([input, error]) => clearFieldError(input, error));
  msgEl.className = 'auth-message';

  // Client-side validation
  let valid = true;

  if (usernameEl.value.trim().length < 3) {
    showFieldError(usernameEl, usernameErr, 'Username must be at least 3 characters.');
    valid = false;
  }

  if (!emailEl.value.trim()) {
    showFieldError(emailEl, emailErr, 'Email is required.');
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
    showFieldError(emailEl, emailErr, 'Invalid email format.');
    valid = false;
  }

  if (passEl.value.length < 6) {
    showFieldError(passEl, passErr, 'Password must be at least 6 characters.');
    valid = false;
  }

  if (confirmEl.value !== passEl.value) {
    showFieldError(confirmEl, confirmErr, 'Passwords do not match.');
    valid = false;
  }

  if (!valid) return;

  setLoading(btn, true);

  try {
    const res = await fetch('api/auth/register.php', {
      method:      'POST',
      credentials: 'same-origin',
      headers:     { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameEl.value.trim(),
        email:    emailEl.value.trim().toLowerCase(),
        password: passEl.value,
      }),
    });

    const data = await res.json();

    if (res.status === 201) {
      setMessage(msgEl, 'success', '✓ Account created! You can now sign in.');
      e.target.reset();
      // Switch to login tab after a short delay
      setTimeout(() => activateTab('login'), 1800);
    } else {
      setMessage(msgEl, 'error', data.error || 'Registration failed. Please try again.');
    }
  } catch {
    setMessage(msgEl, 'error', 'Network error. Check your connection.');
  } finally {
    setLoading(btn, false);
  }
});


/* ════════════════════════════════════════════════════════════
   UX EXTRAS
════════════════════════════════════════════════════════════ */

// Show password hint when the password field is focused
document.getElementById('reg-password').addEventListener('focus', () => {
  document.getElementById('reg-password-hint').style.display = 'block';
});

// Clear field errors as the user types (real-time feedback)
document.querySelectorAll('.auth-form input').forEach(input => {
  input.addEventListener('input', () => {
    const errorId = input.getAttribute('aria-describedby')?.split(' ')[0];
    if (!errorId) return;
    const errEl = document.getElementById(errorId);
    if (errEl) clearFieldError(input, errEl);
  });
});
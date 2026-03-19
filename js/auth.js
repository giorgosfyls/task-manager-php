/* ============================================================
   TaskFlow — Auth logic
   js/auth.js
   ============================================================ */

/* ── Tab switching ─────────────────────────────────────────── */
const tabs   = document.querySelectorAll('.auth-tab');
const panels = document.querySelectorAll('.form-panel');

function activateTab(targetId) {
  tabs.forEach(t => {
    const isActive = t.dataset.target === targetId;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive);
  });
  panels.forEach(p => {
    const isActive = p.id === `panel-${targetId}`;
    p.classList.toggle('active', isActive);
    p.setAttribute('aria-hidden', !isActive);
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


/* ── Show/hide password ────────────────────────────────────── */
document.querySelectorAll('.btn-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input    = document.getElementById(btn.dataset.target);
    const isHidden = input.type === 'password';
    input.type     = isHidden ? 'text' : 'password';

    // Swap between eye and eye-off icon
    const svg = btn.querySelector('.icon-eye');
    if (isHidden) {
      svg.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      `;
    } else {
      svg.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      `;
    }
    btn.setAttribute('aria-label',
      isHidden ? 'Hide password' : 'Toggle password visibility');
  });
});


/* ── Helpers ───────────────────────────────────────────────── */
function showFieldError(inputEl, errorEl, msg) {
  inputEl.classList.add('error');
  inputEl.setAttribute('aria-invalid', 'true');
  errorEl.textContent = msg;
  errorEl.classList.add('visible');
}

function clearFieldError(inputEl, errorEl) {
  inputEl.classList.remove('error');
  inputEl.removeAttribute('aria-invalid');
  errorEl.textContent = '';
  errorEl.classList.remove('visible');
}

function setMessage(el, type, msg) {
  el.className   = `auth-message ${type}`;
  el.textContent = msg;
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}


/* ── Login form ────────────────────────────────────────────── */
document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();

  const emailEl  = document.getElementById('login-email');
  const passEl   = document.getElementById('login-password');
  const emailErr = document.getElementById('login-email-error');
  const passErr  = document.getElementById('login-password-error');
  const msgEl    = document.getElementById('login-message');
  const btn      = document.getElementById('btn-login');
  let valid = true;

  // Clear previous state
  clearFieldError(emailEl, emailErr);
  clearFieldError(passEl,  passErr);
  msgEl.className = 'auth-message';

  // Validate
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
    const res  = await fetch('api/auth/login.php', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        email:    emailEl.value.trim().toLowerCase(),
        password: passEl.value
      })
    });
    const data = await res.json();

    if (res.ok) {
      setMessage(msgEl, 'success', '✓ Signed in successfully! Redirecting to dashboard…');
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


/* ── Register form ─────────────────────────────────────────── */
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
  let valid = true;

  // Clear previous state
  [usernameEl, emailEl, passEl, confirmEl].forEach((el, i) => {
    clearFieldError(el, [usernameErr, emailErr, passErr, confirmErr][i]);
  });
  msgEl.className = 'auth-message';

  // Validate
  if (!usernameEl.value.trim() || usernameEl.value.trim().length < 3) {
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
    const res  = await fetch('api/auth/register.php', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        username: usernameEl.value.trim(),
        email:    emailEl.value.trim().toLowerCase(),
        password: passEl.value
      })
    });
    const data = await res.json();

    if (res.status === 201) {
      setMessage(msgEl, 'success', '✓ Account created! You can now sign in.');
      e.target.reset();
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


/* ── Show password hint on focus ───────────────────────────── */
document.getElementById('reg-password').addEventListener('focus', () => {
  document.getElementById('reg-password-hint').style.display = 'block';
});


/* ── Clear field errors while typing ──────────────────────── */
document.querySelectorAll('.auth-form input').forEach(input => {
  input.addEventListener('input', () => {
    const errorId = input.getAttribute('aria-describedby')?.split(' ')[0];
    if (errorId) {
      const errEl = document.getElementById(errorId);
      if (errEl) clearFieldError(input, errEl);
    }
  });
});
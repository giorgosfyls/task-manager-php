/* ============================================================
   TaskFlow — API Fetch Wrapper
   js/api.js

   Provides three helper functions used by all pages:
     apiGet(url)          — GET  request
     apiPost(url, body)   — POST request with JSON body
     apiDelete(url, body) — DELETE request with JSON body

   All functions:
     - Send the session cookie automatically (credentials: 'same-origin')
     - Parse the JSON response
     - Throw a consistent error object on failure:
         { status: 404, message: "Task not found" }
     - Redirect to index.html on 401 (not authenticated / session expired)

   Usage:
     const data  = await apiGet('api/tasks/list.php?project_id=3');
     const data  = await apiPost('api/tasks/create.php', { title: 'Fix bug' });
     await apiDelete('api/tasks/delete.php', { id: 7 });
   ============================================================ */


/* ── Core fetch wrapper ────────────────────────────────────── */

/**
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<object>}
 * @throws {{ status: number, message: string }}
 */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'same-origin',    // Always send session cookie
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Session expired or not logged in — redirect to login page
  if (res.status === 401) {
    window.location.replace('index.html');
    throw { status: 401, message: 'Session expired. Redirecting to login.' };
  }

  // Parse JSON — all endpoints return JSON
  let data;
  try {
    data = await res.json();
  } catch {
    throw { status: res.status, message: 'Invalid server response.' };
  }

  // Non-2xx status — surface the server error message
  if (!res.ok) {
    throw { status: res.status, message: data.error || 'An unexpected error occurred.' };
  }

  return data;
}


/* ── Public helpers ────────────────────────────────────────── */

/** GET request — no body */
async function apiGet(url) {
  return apiFetch(url, { method: 'GET' });
}

/** POST request — JSON body */
async function apiPost(url, body = {}) {
  return apiFetch(url, {
    method: 'POST',
    body:   JSON.stringify(body),
  });
}

/** DELETE request — JSON body (for the resource id) */
async function apiDelete(url, body = {}) {
  return apiFetch(url, {
    method: 'DELETE',
    body:   JSON.stringify(body),
  });
}
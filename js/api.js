/* ============================================================
   TaskFlow — API Fetch Wrapper
   js/api.js

   Provides three helper functions for all API calls:
     apiGet(url)          — GET request
     apiPost(url, body)   — POST request with JSON body
     apiDelete(url, body) — DELETE request with JSON body

   All functions:
     - Always send session cookie (credentials: 'same-origin')
     - Parse JSON response automatically
     - Throw a consistent error object on failure:
       { status: 401, message: "Not authenticated" }
     - Redirect to index.html on 401 (session expired or not logged in)
   ============================================================ */


/* ── Core fetch wrapper ────────────────────────────────────── */

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // 401 = session expired or not logged in — redirect to login
  if (res.status === 401) {
    window.location.replace('index.html');
    // Throw so any awaiting code stops immediately
    throw { status: 401, message: 'Session expired. Redirecting to login.' };
  }

  // Parse JSON (all our endpoints return JSON)
  let data;
  try {
    data = await res.json();
  } catch {
    // Response body is not valid JSON
    throw { status: res.status, message: 'Invalid server response.' };
  }

  // Non-2xx status — throw the error from the server
  if (!res.ok) {
    throw { status: res.status, message: data.error || 'An unexpected error occurred.' };
  }

  return data;
}


/* ── Public API ────────────────────────────────────────────── */

/**
 * GET request — no body
 * @param  {string} url  e.g. 'api/projects/list.php'
 * @returns {Promise<object>}
 *
 * Usage:
 *   const data = await apiGet('api/projects/list.php');
 *   console.log(data.projects);
 */
async function apiGet(url) {
  return apiFetch(url, { method: 'GET' });
}

/**
 * POST request — JSON body
 * @param  {string} url   e.g. 'api/projects/create.php'
 * @param  {object} body  e.g. { title: 'My Project' }
 * @returns {Promise<object>}
 *
 * Usage:
 *   const data = await apiPost('api/projects/create.php', { title: 'TaskFlow' });
 *   console.log(data.project);
 */
async function apiPost(url, body = {}) {
  return apiFetch(url, {
    method: 'POST',
    body:   JSON.stringify(body),
  });
}

/**
 * DELETE request — JSON body (for the resource id)
 * @param  {string} url   e.g. 'api/projects/delete.php'
 * @param  {object} body  e.g. { id: 5 }
 * @returns {Promise<object>}
 *
 * Usage:
 *   await apiDelete('api/projects/delete.php', { id: 5 });
 */
async function apiDelete(url, body = {}) {
  return apiFetch(url, {
    method: 'DELETE',
    body:   JSON.stringify(body),
  });
}
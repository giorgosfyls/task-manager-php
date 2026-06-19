<?php
/**
 * session_check.php — Session authentication guard / middleware
 *
 * Included at the top of every protected API endpoint (after the
 * Content-Type header is set by the caller).
 *
 * Responsibilities:
 * 1. Configure session cookie (HttpOnly, SameSite=Strict)
 * 2. Set up session path for persistence
 * 3. Start the session
 * 4. Reject unauthenticated requests with 401
 * 5. Enforce a 30-minute inactivity timeout
 * 6. Refresh the activity timestamp on every valid request
 *
 * NOTE: This file must NOT echo anything itself — the caller sets
 * Content-Type and handles output. The file only exits on failure.
 *
 * ────────────────────────────────────────────────────────────
 * FIX: The previous version was executing
 * echo json_encode(['authenticated' => true]);
 * without an exit. This violated the rule defined in the comment above:
 * every endpoint that includes this file (create.php, list.php, update.php, ...)
 * continued its execution AND printed its own JSON, resulting in two JSON objects
 * joined together in the response, e.g.:
 * {"authenticated":true}{"message":"...","project":{...}}
 * This makes the response an invalid JSON format, causing the frontend
 * (res.json() in js/api.js) to crash with "Invalid server response."
 * — EVEN WHEN the backend succeeded (201) and properly saved data to the DB.
 *
 * Solution: Removed the echo entirely on success scenarios. The file now remains
 * silent on success (as the comment dictates) and only responds on failure, with an exit.
 * ════════════════════════════════════════════════════════════
 */

// ── Session path configuration (must match login.php and logout.php) ─
// Create or use existing sessions directory instead of /tmp (Windows/XAMPP compatible)
header('Content-Type: application/json');

$sessionPath = __DIR__ . '/../../sessions';
if (!is_dir($sessionPath)) {
    mkdir($sessionPath, 0755, true);
}
session_save_path($sessionPath);
session_name('TASKFLOW_SESSION');

// ── Session cookie configuration ────────────────────────────────
// Must match login.php and logout.php exactly for consistency
// - lifetime: 0 = session cookie expires when browser closes
// - path: '/' = cookie available to entire website
// - secure: false = allowed over HTTP (set to true in production for HTTPS only)
// - httponly: true = JavaScript cannot read the cookie (mitigates XSS attacks)
// - samesite: 'Strict' = cookie not sent on cross-origin requests (prevents CSRF attacks)
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => false,       // Set to true in production (HTTPS only)
    'httponly' => true,        // Prevents JavaScript access — mitigates XSS
    'samesite' => 'Strict',    // Prevents CSRF via cross-site requests
]);

// Start the session after configuration is set
session_start();

// ── Constants ──────────────────────────────────────────────────────
// Define session inactivity timeout (30 minutes)
if (!defined('SESSION_TIMEOUT')) {
    define('SESSION_TIMEOUT', 1800);
}

// ── Check 1: Authentication verification ──────────────────────────
// Reject the request if no user_id is stored in the session
// This means the user is not logged in
if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated. Please log in.']);
    exit;
}

// ── Check 2: Session inactivity timeout ────────────────────────
// If session exists but user hasn't been active for 30+ minutes, expire the session
// This is a security measure to prevent session hijacking
if (
    isset($_SESSION['last_activity']) &&
    (time() - $_SESSION['last_activity']) > SESSION_TIMEOUT
) {
    // Clear and destroy the session
    session_unset();
    session_destroy();

    http_response_code(401);
    echo json_encode(['error' => 'Session expired. Please log in again.']);
    exit;
}

// ── Step 3: Refresh activity timestamp ─────────────────────────
// Update the last activity timestamp to the current time
// This keeps the session alive as long as the user is making requests
$_SESSION['last_activity'] = time();

// ── Success output — ONLY when called directly as an endpoint ──
// dashboard.js / kanban.js call this file directly
// (apiGet('api/config/session_check.php')) to check if the
// user is logged in, and they expect a JSON response.
//
// However, when this file is included / required by ANOTHER
// endpoint (create.php, list.php, update.php, ...), it MUST NOT
// print anything — otherwise it breaks the caller's JSON output
// (two JSON objects joined together).
//
// get_included_files()[0] tells us which file is executed FIRST
// (the entry point). If this very file (session_check.php)
// is the entry point, then it was called directly as an endpoint.
if (get_included_files()[0] === __FILE__) {
    echo json_encode(['authenticated' => true]);
}
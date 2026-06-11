<?php
/**
 * session_check.php — Session authentication guard / middleware
 *
 * Included at the top of every protected API endpoint (after the
 * Content-Type header is set by the caller).
 *
 * Responsibilities:
 *   1. Configure session cookie (HttpOnly, SameSite=Lax)
 *   2. Set up session path for persistence
 *   3. Start the session
 *   4. Reject unauthenticated requests with 401
 *   5. Enforce a 30-minute inactivity timeout
 *   6. Refresh the activity timestamp on every valid request
 *
 * NOTE: This file must NOT echo anything itself — the caller sets
 * Content-Type and handles output. The file only exits on failure.
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
// - samesite: 'Lax' = cookie sent on top-level navigations (allows login redirect to work)
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => false,       // Set to true in production (HTTPS only)
    'httponly' => true,        // Prevents JavaScript access — mitigates XSS
    'samesite' => 'Lax',       // Allows cookie to persist on navigation (login redirect)
]);

// Start the session after configuration is set
session_start();

// ── Constants ──────────────────────────────────────────────────────
// Define session inactivity timeout (30 minutes)
define('SESSION_TIMEOUT', 1800);

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
echo json_encode(['authenticated' => true]);

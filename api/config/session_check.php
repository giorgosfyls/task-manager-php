<?php
/**
 * session_check.php — Session authentication guard
 *
 * Included at the top of every protected API endpoint (after the
 * Content-Type header is set by the caller).
 *
 * Responsibilities:
 *   1. Configure session cookie (HttpOnly, SameSite=Strict)
 *   2. Start the session
 *   3. Reject unauthenticated requests with 401
 *   4. Enforce a 30-minute inactivity timeout
 *   5. Refresh the activity timestamp on every valid request
 *
 * NOTE: This file must NOT echo anything itself — the caller sets
 * Content-Type and handles output. The file only exits on failure.
 */

// ── Cookie settings (must match login.php exactly) ────────────
session_set_cookie_params([
    'lifetime' => 0,           // Session cookie — expires on browser close
    'path'     => '/',
    'secure'   => false,       // Set to true in production (HTTPS only)
    'httponly' => true,        // Prevents JS access — mitigates XSS
    'samesite' => 'Strict',    // Prevents CSRF via cross-site requests
]);

session_start();

// ── Constants ──────────────────────────────────────────────────
define('SESSION_TIMEOUT', 1800); // 30 minutes of inactivity

// ── 1. Authentication check ────────────────────────────────────
if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated. Please log in.']);
    exit;
}

// ── 2. Inactivity timeout ──────────────────────────────────────
if (
    isset($_SESSION['last_activity']) &&
    (time() - $_SESSION['last_activity']) > SESSION_TIMEOUT
) {
    session_unset();
    session_destroy();
    http_response_code(401);
    echo json_encode(['error' => 'Session expired. Please log in again.']);
    exit;
}

// ── 3. Refresh activity timestamp ─────────────────────────────
$_SESSION['last_activity'] = time();
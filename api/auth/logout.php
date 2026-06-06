<?php
/**
 * logout.php — Destroy the current user session
 *
 * Method : POST
 * Body   : (empty)
 * Returns: 200 { message }
 *
 * Steps:
 *   1. Clear all session variables
 *   2. Expire the session cookie in the browser
 *   3. Destroy the server-side session
 */

header('Content-Type: application/json');

// ── Method guard ───────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Session cookie params must match login.php and session_check.php
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => false,
    'httponly' => true,
    'samesite' => 'Strict',
]);

session_start();

// ── 1. Clear all session variables ────────────────────────────
session_unset();

// ── 2. Expire the session cookie in the browser ───────────────
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 3600,         // Set expiry in the past
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

// ── 3. Destroy the server-side session ────────────────────────
session_destroy();

echo json_encode(['message' => 'Logged out successfully']);
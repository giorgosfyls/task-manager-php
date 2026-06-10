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

// ── Session path configuration (must match login.php) ──────────────
$sessionPath = __DIR__ . '/../../sessions';
if (!is_dir($sessionPath)) {
    mkdir($sessionPath, 0755, true);
}
session_save_path($sessionPath);

header('Content-Type: application/json');

// ── Request method validation ────────────────────────────────────
// Only POST requests allowed (logout is a destructive operation)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Session cookie configuration (must match login.php and session_check.php) ─
// Keep same configuration so we can properly invalidate the cookie
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => false,
    'httponly' => true,
    'samesite' => 'Strict',
]);

// Start the session (or resume existing one) to access $_SESSION
session_start();

// ── Step 1: Clear all session variables ──────────────────────────
// Remove all data stored in the current session
session_unset();

// ── Step 2: Expire the session cookie in the browser ──────────────
// Instruct the browser to delete the session cookie by setting expiry to the past
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),           // Use default session name (PHPSESSID)
        '',                        // Empty value
        time() - 3600,             // Expiry in the past (deletes the cookie)
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

// ── Step 3: Destroy the server-side session ────────────────────
// Remove the session file from the server (delete the sessions directory entry)
session_destroy();

// ── Return success response ───────────────────────────────────────
echo json_encode(['message' => 'Logged out successfully']);
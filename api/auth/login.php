<?php
/**
 * login.php — Authenticate a user and create a session
 *
 * Method : POST
 * Body   : { "email": string, "password": string }
 * Returns: 200 { message, user: { id, username, email } }
 *          400 { error } — missing / invalid fields
 *          401 { error } — wrong credentials
 *
 * Security:
 *   - password_verify() against bcrypt hash (no plain-text comparison)
 *   - session_regenerate_id(true) prevents session fixation
 *   - Generic error message for wrong credentials (no user enumeration)
 */

// ── Session path configuration (Windows/XAMPP compatible) ────────
// Create or use existing sessions directory instead of /tmp
$sessionPath = __DIR__ . '/../../sessions';
if (!is_dir($sessionPath)) {
    mkdir($sessionPath, 0755, true);
}
session_save_path($sessionPath);

header('Content-Type: application/json');

// ── Session cookie configuration (must be set before session_start) ─
// Configure how the session cookie behaves in the browser
// - lifetime: 0 = expires when browser closes
// - httponly: true = JavaScript cannot access the cookie (mitigates XSS)
// - samesite: Lax = cookie sent on top-level navigations (allows login redirect)
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => false,    // Change to true in production (HTTPS only)
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_name('TASKFLOW_SESSION');

// Start the session after configuration is set
session_start();

require '../config/db.php';

// Support alternate PDO connection variable names in db.php
if (!isset($pdo)) {
    if (isset($db)) {
        $pdo = $db;
    } elseif (isset($conn)) {
        $pdo = $conn;
    }
}

if (!isset($pdo)) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection not available']);
    exit;
}

// ── Request method validation ────────────────────────────────────
// Only POST requests allowed (GET, DELETE, etc. are rejected)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Parse and validate JSON body ──────────────────────────────────
// Read the raw JSON from request body
$data = json_decode(file_get_contents('php://input'), true);

// Check that both email and password fields are present
if (!isset($data['email'], $data['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

// ── Input sanitization ────────────────────────────────────────────
// Normalize email (lowercase) and remove whitespace
$email    = strtolower(trim($data['email']));
$password = $data['password'];

// Verify neither field is empty after trimming
if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['error' => 'All fields are required']);
    exit;
}

// Validate email format using PHP's built-in filter
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email format']);
    exit;
}

// ── Database lookup ──────────────────────────────────────────────
// Query for user by email using prepared statement (prevents SQL injection)
$stmt = $pdo->prepare(
    'SELECT id, username, email, password_hash FROM users WHERE email = ?'
);
$stmt->execute([$email]);
$user = $stmt->fetch(); // PDO::FETCH_ASSOC set in db.php

// ── Password verification ────────────────────────────────────────
// Use password_verify() for constant-time comparison against bcrypt hash
// Same error message for "user not found" and "wrong password" to prevent user enumeration
if (!$user || !password_verify($password, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid email or password']);
    exit;
}

// ── Prevent session fixation attack ───────────────────────────────
// Regenerate the session ID and delete the old one after successful authentication
session_regenerate_id(true);

// ── Store authenticated user data in session ─────────────────────
// Store essential user info in $_SESSION so it persists across requests
$_SESSION['user_id']       = (int) $user['id'];
$_SESSION['username']      = $user['username'];
$_SESSION['email']         = $user['email'];
$_SESSION['last_activity'] = time();  // For inactivity timeout tracking

// ── Return success response ───────────────────────────────────────
echo json_encode([
    'message' => 'Login successful',
    'user'    => [
        'id'       => (int) $user['id'],
        'username' => $user['username'],
        'email'    => $user['email'],
    ],
]);

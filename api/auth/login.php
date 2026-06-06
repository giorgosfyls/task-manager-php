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

header('Content-Type: application/json');

// Session cookie must be configured before session_start()
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => false,    // Change to true in production (HTTPS)
    'httponly' => true,
    'samesite' => 'Strict',
]);

session_start();

require '../config/db.php';

// ── Method guard ───────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Parse JSON body ────────────────────────────────────────────
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['email'], $data['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

// ── Sanitise inputs ────────────────────────────────────────────
$email    = strtolower(trim($data['email']));
$password = $data['password'];

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['error' => 'All fields are required']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email format']);
    exit;
}

// ── Look up user ───────────────────────────────────────────────
$stmt = $pdo->prepare(
    'SELECT id, username, email, password_hash FROM users WHERE email = ?'
);
$stmt->execute([$email]);
$user = $stmt->fetch(); // PDO::FETCH_ASSOC set in db.php

// ── Verify password (constant-time comparison via password_verify) ─
if (!$user || !password_verify($password, $user['password_hash'])) {
    // Same message for "user not found" and "wrong password"
    // — prevents user enumeration attacks
    http_response_code(401);
    echo json_encode(['error' => 'Invalid email or password']);
    exit;
}

// ── Prevent session fixation ───────────────────────────────────
session_regenerate_id(true);

// ── Store authenticated user in session ────────────────────────
$_SESSION['user_id']       = (int) $user['id'];
$_SESSION['username']      = $user['username'];
$_SESSION['email']         = $user['email'];
$_SESSION['last_activity'] = time();

echo json_encode([
    'message' => 'Login successful',
    'user'    => [
        'id'       => (int) $user['id'],
        'username' => $user['username'],
        'email'    => $user['email'],
    ],
]);
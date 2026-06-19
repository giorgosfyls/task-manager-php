<?php
/**
 * register.php — Create a new user account
 *
 * Method : POST
 * Body   : { "username": string, "email": string, "password": string }
 * Returns: 201 { message }
 *          400 { error } — validation failure
 *          409 { error } — duplicate email or username
 *          500 { error } — database error
 *
 * Security:
 *   - Password hashed with PASSWORD_DEFAULT (bcrypt, cost 12 in PHP 8+)
 *   - PDO prepared statements prevent SQL injection
 *   - No raw password stored or logged anywhere
 */

header('Content-Type: application/json');

require '../config/db.php';
/** @var PDO $pdo */

// ── Method guard ───────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Parse JSON body ────────────────────────────────────────────
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['username'], $data['email'], $data['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

// ── Sanitise inputs ────────────────────────────────────────────
$username = trim($data['username']);
$email    = strtolower(trim($data['email']));
$password = $data['password'];

// ── Validate inputs ────────────────────────────────────────────
if (strlen($username) < 3) {
    http_response_code(400);
    echo json_encode(['error' => 'Username must be at least 3 characters']);
    exit;
}

if (strlen($username) > 50) {
    http_response_code(400);
    echo json_encode(['error' => 'Username must be 50 characters or less']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email format']);
    exit;
}

if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['error' => 'Password must be at least 6 characters']);
    exit;
}

// ── Check for duplicate email or username ──────────────────────
$check = $pdo->prepare(
    'SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1'
);
$check->execute([$email, $username]);

if ($check->fetch()) {
    http_response_code(409);
    echo json_encode(['error' => 'Email or username already exists']);
    exit;
}

// ── Hash password and insert new user ─────────────────────────
$passwordHash = password_hash($password, PASSWORD_DEFAULT);

try {
    $stmt = $pdo->prepare(
        'INSERT INTO users (username, email, password_hash)
         VALUES (:username, :email, :password_hash)'
    );
    $stmt->execute([
        ':username'      => $username,
        ':email'         => $email,
        ':password_hash' => $passwordHash,
    ]);

    http_response_code(201);
    echo json_encode(['message' => 'Account created successfully']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Registration failed. Please try again.']);
}
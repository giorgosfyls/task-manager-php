<?php
/**
 * db.php — PDO database connection
 *
 * Included by every API endpoint.
 * Exposes a single $pdo object configured with:
 *   - Exception error mode  (PDO::ERRMODE_EXCEPTION)
 *   - Emulated prepares off (prevents type-juggling edge cases)
 *   - utf8mb4 charset       (full Unicode + emoji support)
 *
 * Security: connection errors return a generic 500 JSON response
 * so no internal details (host, dbname, credentials) are leaked.
 */

// ── Configuration ─────────────────────────────────────────────
define('DB_HOST',    'localhost');
define('DB_NAME',    'task_manager');
define('DB_USER',    'root');
define('DB_PASS',    '');          // Empty by default on XAMPP
define('DB_CHARSET', 'utf8mb4');

// ── Connection ─────────────────────────────────────────────────
try {
    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        DB_HOST,
        DB_NAME,
        DB_CHARSET
    );

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,   // real prepared statements
    ]);

} catch (PDOException $e) {
    // Never expose the real error message in production
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed. Please try again later.']);
    exit;
}
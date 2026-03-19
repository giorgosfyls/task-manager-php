<?php

header("Content-Type: application/json");

require "../config/session_check.php";

// 1. Clear all session variables
$_SESSION = [];

// 2. Destroy the session cookie
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

// 3. Destroy the session
session_destroy();

echo json_encode(["message" => "Logged out successfully"]);
<?php

session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => false,    // change to true in production (HTTPS)
    'httponly' => true,
    'samesite' => 'Strict'
]);

session_start();

$timeout = 1800; // 30 minutes

// 1. Check if user is authenticated
if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["error" => "Not authenticated"]);
    exit;
}

// 2. Check session timeout
if (isset($_SESSION["last_activity"]) && (time() - $_SESSION["last_activity"]) > $timeout) {
    session_destroy();
    http_response_code(401);
    echo json_encode(["error" => "Session expired"]);
    exit;
}

// 3. Refresh activity timer
$_SESSION["last_activity"] = time();
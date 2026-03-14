<?php

header("Content-Type: application/json");

session_start();

require "../config/db.php";

$data = json_decode(file_get_contents("php://input"), true);

// 1. Check required fields exist
if (!isset($data["email"]) || !isset($data["password"])) {
    http_response_code(400);
    echo json_encode(["error" => "Missing required fields"]);
    exit;
}

$email    = strtolower(trim($data["email"]));
$password = $data["password"];

// 2. Validate fields
if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(["error" => "All fields are required"]);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid email format"]);
    exit;
}

// 3. Find user by email
$stmt = $pdo->prepare("SELECT id, username, email, password_hash FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

// 4. Verify password
if (!$user || !password_verify($password, $user["password_hash"])) {
    http_response_code(401);
    echo json_encode(["error" => "Invalid email or password"]);
    exit;
}

// 5. Regenerate session ID to prevent session fixation
session_regenerate_id(true);

// 6. Store user in session
$_SESSION["user_id"]       = $user["id"];
$_SESSION["username"]      = $user["username"];
$_SESSION["email"]         = $user["email"];
$_SESSION["last_activity"] = time(); // track session timeout

echo json_encode([
    "message"  => "Login successful",
    "user" => [
        "id"       => $user["id"],
        "username" => $user["username"],
        "email"    => $user["email"],
    ]
]);
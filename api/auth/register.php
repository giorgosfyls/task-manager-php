<?php

header("Content-Type: application/json");

require "../config/db.php";

$data = json_decode(file_get_contents("php://input"), true);

// 1. Check required fields exist
if (!isset($data["username"]) || !isset($data["email"]) || !isset($data["password"])) {
    http_response_code(400);
    echo json_encode(["error" => "Missing required fields"]);
    exit;
}

$username = trim($data["username"]);
$email    = strtolower(trim($data["email"]));
$password = $data["password"];

// 2. Validate fields
if (empty($username) || empty($email) || strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(["error" => "All fields are required and password must be at least 6 characters"]);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid email format"]);
    exit;
}

// 3. Check for duplicate email or username
$check = $pdo->prepare("SELECT id FROM users WHERE email = ? OR username = ?");
$check->execute([$email, $username]);
if ($check->fetch()) {
    http_response_code(409);
    echo json_encode(["error" => "Email or username already exists"]);
    exit;
}

// 4. Hash password and insert
$passwordHash = password_hash($password, PASSWORD_DEFAULT);

$sql  = "INSERT INTO users (username, email, password_hash) VALUES (:username, :email, :password_hash)";
$stmt = $pdo->prepare($sql);

try {
    $stmt->execute([
        ":username"      => $username,
        ":email"         => $email,
        ":password_hash" => $passwordHash,
    ]);
    http_response_code(201);
    echo json_encode(["message" => "User registered successfully"]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Registration failed. Please try again."]);
}
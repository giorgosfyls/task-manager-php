<?php
/**
 * projects/create.php — Create a new project
 *
 * Method : POST
 * Body   : { title: string, [description]: string }
 * Returns: 201 { message, project }
 *          400 { error } — validation failure
 *          405 { error } — wrong HTTP method
 *          500 { error } — database error
 *
 * The DB trigger `after_project_insert` automatically adds the
 * owner to project_members with role = 'owner', so no manual
 * INSERT into project_members is needed here.
 *
 * The full project object is returned so the frontend can render
 * the new card immediately without a second fetch.
 */

header('Content-Type: application/json');

require '../config/session_check.php';
require '../config/db.php';

// ── Method guard ───────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Parse body ─────────────────────────────────────────────────
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['title']) || trim($data['title']) === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Title is required']);
    exit;
}

$title       = trim($data['title']);
$description = trim($data['description'] ?? '');
$ownerId     = (int) $_SESSION['user_id'];

// ── Validate ───────────────────────────────────────────────────
if (strlen($title) > 100) {
    http_response_code(400);
    echo json_encode(['error' => 'Title must be 100 characters or less']);
    exit;
}

if (strlen($description) > 500) {
    http_response_code(400);
    echo json_encode(['error' => 'Description must be 500 characters or less']);
    exit;
}

try {
    // ── Insert project ─────────────────────────────────────────
    // The after_project_insert trigger handles adding the owner
    // to project_members automatically.
    $stmt = $pdo->prepare('
        INSERT INTO projects (title, description, owner_id)
        VALUES (:title, :description, :owner_id)
    ');
    $stmt->execute([
        ':title'       => $title,
        ':description' => $description,
        ':owner_id'    => $ownerId,
    ]);

    $newId = (int) $pdo->lastInsertId();

    // ── Fetch the saved project to return it ───────────────────
    $fetch = $pdo->prepare('
        SELECT id, title, description, owner_id, created_at
        FROM   projects
        WHERE  id = :id
    ');
    $fetch->execute([':id' => $newId]);
    $project = $fetch->fetch();

    // Add dashboard fields so the card renders without a refetch
    $project['id']         = (int) $project['id'];
    $project['owner_id']   = (int) $project['owner_id'];
    $project['task_count'] = 0;
    $project['done_count'] = 0;
    $project['members']    = [[
        'id'       => $ownerId,
        'username' => $_SESSION['username'],
    ]];

    http_response_code(201);
    echo json_encode([
        'message' => 'Project created successfully',
        'project' => $project,
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to create project']);
}

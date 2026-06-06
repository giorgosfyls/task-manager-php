<?php
/**
 * projects/delete.php — Delete a project
 *
 * Method : DELETE
 * Body   : { id: int }
 * Returns: 200 { message }
 *          400 { error } — missing id
 *          403 { error } — user is not the owner
 *          404 { error } — project not found
 *          405 { error } — wrong HTTP method
 *          500 { error } — database error
 *
 * Authorization: only the project owner can delete.
 * Cascade: schema ON DELETE CASCADE removes project_members,
 *          tasks, and comments automatically.
 */

header('Content-Type: application/json');

require '../config/session_check.php';
require '../config/db.php';

// ── Method guard ───────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Parse body ─────────────────────────────────────────────────
$data      = json_decode(file_get_contents('php://input'), true);
$projectId = isset($data['id']) && is_numeric($data['id']) ? (int) $data['id'] : null;
$userId    = (int) $_SESSION['user_id'];

if (!$projectId) {
    http_response_code(400);
    echo json_encode(['error' => 'Project ID is required']);
    exit;
}

try {
    // ── Verify project exists ──────────────────────────────────
    $check = $pdo->prepare('
        SELECT id, owner_id FROM projects WHERE id = :id
    ');
    $check->execute([':id' => $projectId]);
    $project = $check->fetch();

    if (!$project) {
        http_response_code(404);
        echo json_encode(['error' => 'Project not found']);
        exit;
    }

    // ── Verify ownership ───────────────────────────────────────
    if ((int) $project['owner_id'] !== $userId) {
        http_response_code(403);
        echo json_encode(['error' => 'Only the project owner can delete this project']);
        exit;
    }

    // ── Delete — CASCADE handles members, tasks, comments ─────
    $stmt = $pdo->prepare('DELETE FROM projects WHERE id = :id');
    $stmt->execute([':id' => $projectId]);

    echo json_encode(['message' => 'Project deleted successfully']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to delete project']);
}
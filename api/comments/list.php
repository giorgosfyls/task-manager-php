<?php
/**
 * comments/list.php — Fetch all comments for a task
 *
 * Method : GET
 * Params : task_id (query string, required)
 * Returns: 200 { comments: Comment[] }
 *          400 { error } — missing task_id
 *          403 { error } — user is not a project member
 *          500 { error } — database error
 *
 * Comments are ordered oldest-first so the thread reads top-to-bottom.
 * Each Comment: { id, task_id, content, created_at, user_id, user_username }
 */

header('Content-Type: application/json');

require '../../config/session_check.php';
require '../../config/db.php';

// ── Validate query parameter ───────────────────────────────────
if (empty($_GET['task_id']) || !is_numeric($_GET['task_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'task_id is required']);
    exit;
}

$taskId = (int) $_GET['task_id'];
$userId = (int) $_SESSION['user_id'];

try {
    // ── Verify membership via the task's project ───────────────
    $access = $pdo->prepare('
        SELECT 1
        FROM   tasks t
        JOIN   project_members pm
               ON  pm.project_id = t.project_id
               AND pm.user_id    = :user_id
        WHERE  t.id = :task_id
    ');
    $access->execute([':task_id' => $taskId, ':user_id' => $userId]);

    if (!$access->fetch()) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied']);
        exit;
    }

    // ── Fetch comments with author username, oldest first ──────
    $stmt = $pdo->prepare('
        SELECT
            c.id,
            c.task_id,
            c.content,
            c.created_at,
            u.id       AS user_id,
            u.username AS user_username
        FROM   comments c
        JOIN   users    u ON u.id = c.user_id
        WHERE  c.task_id = :task_id
        ORDER  BY c.created_at ASC
    ');
    $stmt->execute([':task_id' => $taskId]);
    $rows = $stmt->fetchAll();

    // ── Cast numeric fields ────────────────────────────────────
    $comments = array_map(static function (array $row): array {
        $row['id']      = (int) $row['id'];
        $row['task_id'] = (int) $row['task_id'];
        $row['user_id'] = (int) $row['user_id'];
        return $row;
    }, $rows);

    echo json_encode(['comments' => $comments]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch comments']);
}
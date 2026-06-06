<?php
/**
 * comments/add.php — Add a comment to a task
 *
 * Method : POST
 * Body   : { task_id: int, content: string }
 * Returns: 201 { message, comment: Comment }
 *          400 { error } — validation failure
 *          403 { error } — user is not a project member
 *          500 { error } — database error
 *
 * The full comment object (with username) is returned so the
 * frontend can append it to the DOM immediately without re-fetching.
 *
 * Security:
 *   - Project membership verified before INSERT
 *   - Content length capped at 2000 characters
 *   - XSS prevention is handled on the frontend (escapeHtml)
 *     and in PHP output contexts (htmlspecialchars)
 */

header('Content-Type: application/json');

require '../../config/session_check.php';
require '../../config/db.php';

// ── Method guard ───────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Parse body ─────────────────────────────────────────────────
$data    = json_decode(file_get_contents('php://input'), true);
$taskId  = isset($data['task_id']) && is_numeric($data['task_id'])
    ? (int) $data['task_id']
    : null;
$content = isset($data['content']) ? trim($data['content']) : '';
$userId  = (int) $_SESSION['user_id'];

// ── Validate ───────────────────────────────────────────────────
if (!$taskId) {
    http_response_code(400);
    echo json_encode(['error' => 'task_id is required']);
    exit;
}

if ($content === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Comment content is required']);
    exit;
}

if (strlen($content) > 2000) {
    http_response_code(400);
    echo json_encode(['error' => 'Comment must be 2000 characters or less']);
    exit;
}

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

    // ── Insert comment ─────────────────────────────────────────
    $stmt = $pdo->prepare('
        INSERT INTO comments (task_id, user_id, content)
        VALUES (:task_id, :user_id, :content)
    ');
    $stmt->execute([
        ':task_id' => $taskId,
        ':user_id' => $userId,
        ':content' => $content,
    ]);

    $newId = (int) $pdo->lastInsertId();

    // ── Return the new comment with username ───────────────────
    $fetch = $pdo->prepare('
        SELECT c.id, c.task_id, c.content, c.created_at,
               u.id       AS user_id,
               u.username AS user_username
        FROM   comments c
        JOIN   users    u ON u.id = c.user_id
        WHERE  c.id = :id
    ');
    $fetch->execute([':id' => $newId]);
    $comment = $fetch->fetch();

    // Cast numeric fields
    $comment['id']      = (int) $comment['id'];
    $comment['task_id'] = (int) $comment['task_id'];
    $comment['user_id'] = (int) $comment['user_id'];

    http_response_code(201);
    echo json_encode([
        'message' => 'Comment added successfully',
        'comment' => $comment,
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to add comment']);
}
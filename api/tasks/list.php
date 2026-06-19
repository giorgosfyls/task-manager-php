<?php
/**
 * tasks/list.php — Fetch tasks
 *
 * Method : GET
 * Params : project_id (query string, OPTIONAL)
 *
 * - With project_id    → Returns tasks ONLY for this project
 * (requires the user to be a member)
 * - Without project_id → Returns ALL tasks from ALL projects
 * where the user is a member
 * (used by the dashboard)
 *
 * Returns: 200 { tasks: Task[] }
 * 403 { error } — user is not a project member (only when project_id is provided)
 * 500 { error } — database error
 *
 * Each Task object:
 * id, title, status, priority, due_date, assigned_to,
 * assigned_username, created_at, updated_at
 *
 * Ordered by: status (todo → in_progress → done),
 * then priority (high → medium → low),
 * then creation date ascending.
 */

header('Content-Type: application/json');

require '../config/session_check.php';
require '../config/db.php';
/** @var PDO $pdo */

$userId = (int) $_SESSION['user_id'];

// ── project_id is now optional ─────────────────────────
$hasProjectId = !empty($_GET['project_id']);

if ($hasProjectId && !is_numeric($_GET['project_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'project_id must be numeric']);
    exit;
}

$projectId = $hasProjectId ? (int) $_GET['project_id'] : null;

try {

    if ($projectId !== null) {
        // ── Mode 1: Tasks of a specific project ──────
        // Verify membership
        $access = $pdo->prepare('
            SELECT 1 FROM project_members
            WHERE  project_id = :project_id
            AND    user_id    = :user_id
        ');
        $access->execute([':project_id' => $projectId, ':user_id' => $userId]);

        if (!$access->fetch()) {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied']);
            exit;
        }

        $stmt = $pdo->prepare('
            SELECT
                t.id, t.title, t.status, t.priority, t.due_date,
                t.assigned_to, t.created_at, t.updated_at,
                u.username AS assigned_username
            FROM       tasks t
            LEFT JOIN  users u ON u.id = t.assigned_to
            WHERE      t.project_id = :project_id
            ORDER BY
                FIELD(t.status,   \'todo\', \'in_progress\', \'done\'),
                FIELD(t.priority, \'high\', \'medium\', \'low\'),
                t.created_at ASC
        ');
        $stmt->execute([':project_id' => $projectId]);

    } else {
        // ── Mode 2: ALL tasks of the user (dashboard) ──
        $stmt = $pdo->prepare('
            SELECT
                t.id, t.title, t.status, t.priority, t.due_date,
                t.assigned_to, t.created_at, t.updated_at,
                u.username AS assigned_username
            FROM       tasks t
            JOIN       project_members pm
                       ON  pm.project_id = t.project_id
                       AND pm.user_id    = :user_id
            LEFT JOIN  users u ON u.id = t.assigned_to
            ORDER BY
                FIELD(t.status,   \'todo\', \'in_progress\', \'done\'),
                FIELD(t.priority, \'high\', \'medium\', \'low\'),
                t.created_at ASC
        ');
        $stmt->execute([':user_id' => $userId]);
    }

    $rows = $stmt->fetchAll();

    // ── Cast numeric fields ────────────────────────────────────
    $tasks = array_map(static function (array $row): array {
        $row['id']          = (int) $row['id'];
        $row['assigned_to'] = $row['assigned_to'] !== null
            ? (int) $row['assigned_to']
            : null;
        return $row;
    }, $rows);

    echo json_encode(['tasks' => $tasks]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch tasks']);
}
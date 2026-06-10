<?php
/**
 * tasks/update.php — Update one or more fields of a task
 *
 * Method : POST
 * Body   : { id: int, [title], [status], [priority], [due_date], [assigned_to] }
 * Returns: 200 { message }
 *          400 { error } — missing id or invalid field values
 *          403 { error } — user is not a project member
 *          404 { error } — task not found
 *          500 { error } — database error
 *
 * Design: Only fields present in the request body are updated
 * (partial update / PATCH semantics over POST).
 *
 * Security:
 *   - Project membership verified before any write
 *   - All values validated against whitelists (status, priority)
 *   - Dynamic query built with parameterised values only — no raw input
 *     concatenated into SQL
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../../config/session_check.php';
require_once __DIR__ . '/../../config/db.php';

// Ensure $pdo is available from included db.php
if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection not initialized']);
    exit;
}

// ── Method guard ───────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Parse body ─────────────────────────────────────────────────
$data = json_decode(file_get_contents('php://input'), true);

if (empty($data['id']) || !is_numeric($data['id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Task ID is required']);
    exit;
}

$taskId = (int) $data['id'];
$userId = (int) $_SESSION['user_id'];

// ── Allowed value sets ─────────────────────────────────────────
const VALID_STATUSES    = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES  = ['low', 'medium', 'high'];

try {
    // ── Verify access: user must be a project member ───────────
    $check = $pdo->prepare('
        SELECT t.id, t.project_id
        FROM   tasks t
        JOIN   project_members pm
               ON  pm.project_id = t.project_id
               AND pm.user_id    = :user_id
        WHERE  t.id = :task_id
    ');
    $check->execute([':task_id' => $taskId, ':user_id' => $userId]);

    if (!$check->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Task not found or access denied']);
        exit;
    }

    // ── Build dynamic SET clause ───────────────────────────────
    $fields = [];
    $params = [':task_id' => $taskId];

    // Title
    if (isset($data['title'])) {
        $title = trim($data['title']);
        if ($title === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Title cannot be empty']);
            exit;
        }
        if (strlen($title) > 150) {
            http_response_code(400);
            echo json_encode(['error' => 'Title must be 150 characters or less']);
            exit;
        }
        $fields[]          = 'title = :title';
        $params[':title']  = $title;
    }

    // Status
    if (isset($data['status'])) {
        if (!in_array($data['status'], VALID_STATUSES, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid status value']);
            exit;
        }
        $fields[]           = 'status = :status';
        $params[':status']  = $data['status'];
    }

    // Priority
    if (isset($data['priority'])) {
        if (!in_array($data['priority'], VALID_PRIORITIES, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid priority value']);
            exit;
        }
        $fields[]             = 'priority = :priority';
        $params[':priority']  = $data['priority'];
    }

    // Due date (null = clear the date)
    if (array_key_exists('due_date', $data)) {
        $dueDate = $data['due_date'];
        if ($dueDate !== null && !strtotime((string) $dueDate)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid due_date format']);
            exit;
        }
        $fields[]             = 'due_date = :due_date';
        $params[':due_date']  = $dueDate;
    }

    // Assigned to (null = unassign)
    if (array_key_exists('assigned_to', $data)) {
        $fields[]                = 'assigned_to = :assigned_to';
        $params[':assigned_to']  = $data['assigned_to'] ? (int) $data['assigned_to'] : null;
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['error' => 'No fields to update']);
        exit;
    }

    // ── Execute update ─────────────────────────────────────────
    $sql  = 'UPDATE tasks SET ' . implode(', ', $fields) . ' WHERE id = :task_id';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    echo json_encode(['message' => 'Task updated successfully']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to update task']);
}

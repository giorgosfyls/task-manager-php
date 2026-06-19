<?php
/**
 * projects/list.php — Fetch all projects for the logged-in user
 *
 * Method : GET
 * Returns: 200 { projects: Project[] }
 * 500 { error }
 *
 * Each Project includes:
 * id, title, description, owner_id, created_at,
 * task_count, done_count, members (up to 5)
 *
 * Only projects where the user is a member (or owner) are returned.
 *
 * ────────────────────────────────────────────────────────────
 * FIX: The previous version used JSON_ARRAYAGG /
 * JSON_OBJECT to fetch members within the same SQL query.
 * These functions do not exist in MariaDB < 10.5,
 * resulting in "FUNCTION task_manager.JSON_ARRAYAGG does not exist".
 *
 * Solution: We fetch projects + task stats using a single query (without JSON
 * functions), and members using A SECOND separate query (all members
 * of all these projects combined via IN (...)), and then we group them in PHP.
 * This results in 2 queries total, regardless of the number of projects
 * — much more compatible and equally efficient.
 * ════════════════════════════════════════════════════════════
 */

header('Content-Type: application/json');

require '../config/session_check.php';
require '../config/db.php';
/** @var PDO $pdo */

$userId = (int) $_SESSION['user_id'];

try {
    // ── 1) Projects + task stats (without members) ────────────────
    $sql = "
        SELECT
            p.id,
            p.title,
            p.description,
            p.owner_id,
            p.created_at,
            COUNT(DISTINCT t.id)                                       AS task_count,
            COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) AS done_count
        FROM       projects        p
        JOIN       project_members pm ON pm.project_id = p.id
                                     AND pm.user_id    = :user_id
        LEFT JOIN  tasks           t  ON t.project_id  = p.id
        GROUP BY   p.id
        ORDER BY   p.created_at DESC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':user_id' => $userId]);
    $rows = $stmt->fetchAll();

    if (empty($rows)) {
        echo json_encode(['projects' => []]);
        exit;
    }

    // ── 2) Members of all these projects, in one query ──────────
    $projectIds = array_column($rows, 'id');
    $placeholders = implode(',', array_fill(0, count($projectIds), '?'));

    $memberStmt = $pdo->prepare("
        SELECT pm.project_id, u.id, u.username, pm.role
        FROM   project_members pm
        JOIN   users u ON u.id = pm.user_id
        WHERE  pm.project_id IN ($placeholders)
        ORDER  BY pm.project_id, pm.role DESC, u.id ASC
    ");
    $memberStmt->execute($projectIds);
    $memberRows = $memberStmt->fetchAll();

    // Group members by project_id, capped at 5 per project
    $membersByProject = [];
    foreach ($memberRows as $m) {
        $pid = (int) $m['project_id'];
        if (!isset($membersByProject[$pid])) {
            $membersByProject[$pid] = [];
        }
        if (count($membersByProject[$pid]) < 5) {
            $membersByProject[$pid][] = [
                'id'       => (int) $m['id'],
                'username' => $m['username'],
            ];
        }
    }

    // ── 3) Merge projects + members, cast numerics ──────────────
    $projects = array_map(static function (array $row) use ($membersByProject): array {
        $id = (int) $row['id'];
        $row['id']         = $id;
        $row['owner_id']   = (int) $row['owner_id'];
        $row['task_count'] = (int) $row['task_count'];
        $row['done_count'] = (int) $row['done_count'];
        $row['members']    = $membersByProject[$id] ?? [];
        return $row;
    }, $rows);

    echo json_encode(['projects' => $projects]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch projects']);
}
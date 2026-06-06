<?php
/**
 * projects/members.php — List or add members to a project
 *
 * GET  ?project_id=X  → 200 { members: Member[] }
 *   Returns all members of the project.
 *   Used by kanban.js to populate the assigned_to dropdown.
 *
 * POST { project_id, username } → 201 { message, member }
 *   Adds a user (by username) to the project.
 *   Only the project owner can add members.
 *
 * Authorization:
 *   GET  — any project member can list members
 *   POST — only the project owner can add members
 */

header('Content-Type: application/json');

require '../config/session_check.php';
require '../config/db.php';

$userId = (int) $_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

/* ════════════════════════════════════════════════════════════
   GET — list all members of a project
════════════════════════════════════════════════════════════ */
if ($method === 'GET') {

    if (empty($_GET['project_id']) || !is_numeric($_GET['project_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'project_id is required']);
        exit;
    }

    $projectId = (int) $_GET['project_id'];

    try {
        // Verify the requester is a member of this project
        $access = $pdo->prepare('
            SELECT 1 FROM project_members
            WHERE  project_id = :project_id AND user_id = :user_id
        ');
        $access->execute([':project_id' => $projectId, ':user_id' => $userId]);

        if (!$access->fetch()) {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied']);
            exit;
        }

        // Fetch all members with their role
        $stmt = $pdo->prepare('
            SELECT u.id, u.username, pm.role
            FROM   project_members pm
            JOIN   users           u  ON u.id = pm.user_id
            WHERE  pm.project_id = :project_id
            ORDER  BY pm.role DESC, u.username ASC
        ');
        $stmt->execute([':project_id' => $projectId]);
        $members = $stmt->fetchAll();

        // Cast id to int
        $members = array_map(static function (array $m): array {
            $m['id'] = (int) $m['id'];
            return $m;
        }, $members);

        echo json_encode(['members' => $members]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch members']);
    }

    exit;
}

/* ════════════════════════════════════════════════════════════
   POST — add a new member by username
════════════════════════════════════════════════════════════ */
if ($method === 'POST') {

    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['project_id']) || !is_numeric($data['project_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'project_id is required']);
        exit;
    }

    if (!isset($data['username']) || trim($data['username']) === '') {
        http_response_code(400);
        echo json_encode(['error' => 'username is required']);
        exit;
    }

    $projectId = (int) $data['project_id'];
    $username  = trim($data['username']);

    try {
        // ── Verify project exists ──────────────────────────────
        $checkProject = $pdo->prepare('
            SELECT id, owner_id FROM projects WHERE id = :id
        ');
        $checkProject->execute([':id' => $projectId]);
        $project = $checkProject->fetch();

        if (!$project) {
            http_response_code(404);
            echo json_encode(['error' => 'Project not found']);
            exit;
        }

        // ── Only the owner can add members ─────────────────────
        if ((int) $project['owner_id'] !== $userId) {
            http_response_code(403);
            echo json_encode(['error' => 'Only the project owner can add members']);
            exit;
        }

        // ── Find user by username ──────────────────────────────
        $findUser = $pdo->prepare('
            SELECT id, username FROM users WHERE username = :username
        ');
        $findUser->execute([':username' => $username]);
        $newMember = $findUser->fetch();

        if (!$newMember) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            exit;
        }

        // ── Check not already a member ─────────────────────────
        $checkMember = $pdo->prepare('
            SELECT 1 FROM project_members
            WHERE  project_id = :project_id AND user_id = :user_id
        ');
        $checkMember->execute([
            ':project_id' => $projectId,
            ':user_id'    => $newMember['id'],
        ]);

        if ($checkMember->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'User is already a member of this project']);
            exit;
        }

        // ── Insert into project_members ────────────────────────
        $insert = $pdo->prepare('
            INSERT INTO project_members (project_id, user_id, role)
            VALUES (:project_id, :user_id, \'member\')
        ');
        $insert->execute([
            ':project_id' => $projectId,
            ':user_id'    => $newMember['id'],
        ]);

        http_response_code(201);
        echo json_encode([
            'message' => 'Member added successfully',
            'member'  => [
                'id'       => (int) $newMember['id'],
                'username' => $newMember['username'],
                'role'     => 'member',
            ],
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to add member']);
    }

    exit;
}

// ── Any other method ───────────────────────────────────────────
http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
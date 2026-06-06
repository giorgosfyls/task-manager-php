-- ============================================================
-- TaskFlow — Database Schema
-- MySQL 8.0+ · InnoDB · utf8mb4_unicode_ci
--
-- Run once to set up the database:
--   1. Open phpMyAdmin (http://localhost/phpmyadmin)
--   2. Create a database named: task_manager
--   3. Import this file via the Import tab
--
-- Tables:      users, projects, project_members, tasks, comments
-- Trigger:     after_project_insert (auto-adds owner to members)
-- Cascades:    project → members, tasks, comments (all CASCADE)
-- ============================================================

CREATE DATABASE IF NOT EXISTS task_manager
  CHARACTER SET utf8mb4
  COLLATE       utf8mb4_unicode_ci;

USE task_manager;


-- ============================================================
-- USERS
-- Stores registered user accounts.
-- Passwords are stored as bcrypt hashes (never plain text).
-- ============================================================
CREATE TABLE users (
    id            INT          AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- PROJECTS
-- Each project belongs to one owner (users.id).
-- Deleting a user cascades to their projects.
-- The after_project_insert trigger (below) automatically adds
-- the owner to project_members with role = 'owner'.
-- ============================================================
CREATE TABLE projects (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(100) NOT NULL,
    description TEXT,
    owner_id    INT          NOT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_projects_owner
        FOREIGN KEY (owner_id) REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_projects_owner (owner_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- PROJECT_MEMBERS
-- Junction table: which users belong to which projects.
-- role = 'owner'  → full control (can delete project / tasks)
-- role = 'member' → can view, create and edit tasks / comments
-- ============================================================
CREATE TABLE project_members (
    project_id INT                     NOT NULL,
    user_id    INT                     NOT NULL,
    role       ENUM('owner', 'member') NOT NULL DEFAULT 'member',

    PRIMARY KEY (project_id, user_id),

    CONSTRAINT fk_members_project
        FOREIGN KEY (project_id) REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_members_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_members_user (user_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TASKS
-- Each task belongs to a project and optionally has an assignee.
-- status   : todo | in_progress | done
-- priority : low  | medium      | high
-- When the assignee (assigned_to) is deleted, the field is set
-- to NULL (task remains, just unassigned).
-- ============================================================
CREATE TABLE tasks (
    id          INT           AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(150)  NOT NULL,
    status      ENUM('todo', 'in_progress', 'done') NOT NULL DEFAULT 'todo',
    priority    ENUM('low', 'medium', 'high')        NOT NULL DEFAULT 'medium',
    project_id  INT           NOT NULL,
    assigned_to INT           NULL,
    due_date    DATE          NULL,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_tasks_project
        FOREIGN KEY (project_id) REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_tasks_assignee
        FOREIGN KEY (assigned_to) REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_tasks_project  (project_id),
    INDEX idx_tasks_assignee (assigned_to),
    INDEX idx_tasks_status   (status)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- COMMENTS
-- Each comment belongs to a task and was written by a user.
-- Deleting a task cascades to its comments.
-- Deleting a user cascades to their comments.
-- ============================================================
CREATE TABLE comments (
    id         INT       AUTO_INCREMENT PRIMARY KEY,
    task_id    INT       NOT NULL,
    user_id    INT       NOT NULL,
    content    TEXT      NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_comments_task
        FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_comments_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_comments_task (task_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TRIGGER: after_project_insert
-- Automatically inserts the project owner into project_members
-- with role = 'owner' every time a new project is created.
-- This means api/projects/create.php never needs to do a
-- manual INSERT into project_members.
-- ============================================================
DELIMITER //

CREATE TRIGGER after_project_insert
AFTER INSERT ON projects
FOR EACH ROW
BEGIN
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner');
END//

DELIMITER ;
-- ============================================================
-- Task Manager — Database Schema
-- MySQL 8.0+ | InnoDB | utf8mb4
-- ============================================================

CREATE DATABASE IF NOT EXISTS task_manager
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE task_manager;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id            INT          AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE projects (
    id          INT           AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(100)  NOT NULL,
    description TEXT,
    owner_id    INT           NOT NULL,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (owner_id) REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_projects_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PROJECT MEMBERS
-- ============================================================
CREATE TABLE project_members (
    project_id INT,
    user_id    INT,
    role       ENUM('owner', 'member') DEFAULT 'member',

    PRIMARY KEY (project_id, user_id),

    FOREIGN KEY (project_id) REFERENCES projects(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_members_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
    id          INT           AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(150)  NOT NULL,
    status      ENUM('todo', 'in_progress', 'done') DEFAULT 'todo',
    priority    ENUM('low', 'medium', 'high')        DEFAULT 'medium',
    project_id  INT           NOT NULL,
    assigned_to INT           NULL,
    due_date    DATE          NULL,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES projects(id)
        ON DELETE CASCADE,

    FOREIGN KEY (assigned_to) REFERENCES users(id)
        ON DELETE SET NULL,

    INDEX idx_tasks_project  (project_id),
    INDEX idx_tasks_assigned (assigned_to),
    INDEX idx_tasks_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE comments (
    id         INT       AUTO_INCREMENT PRIMARY KEY,
    task_id    INT       NOT NULL,
    user_id    INT       NOT NULL,
    content    TEXT      NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_comments_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TRIGGER: Auto-add owner to project_members on project create
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
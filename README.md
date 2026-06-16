# TaskFlow — PHP & MySQL Task Manager

![HTML5](https://img.shields.io/badge/HTML5-orange?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-blue?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-yellow?logo=javascript&logoColor=black)
![PHP](https://img.shields.io/badge/PHP-8.0+-purple?logo=php&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0+-blue?logo=mysql&logoColor=white)
![Git](https://img.shields.io/badge/Git-orange?logo=git&logoColor=white)
![Last commit](https://img.shields.io/github/last-commit/giorgosfyls/task-manager-php)
![Repo size](https://img.shields.io/github/repo-size/giorgosfyls/task-manager-php)
![Top language](https://img.shields.io/github/languages/top/giorgosfyls/task-manager-php)

A full-stack web application for project and task management built with PHP, MySQL and Vanilla JavaScript — developed as a capstone project at SAEK (Vocational Training Institute).

---

## Screenshots

> Add screenshots to the `screenshots/` folder and uncomment the lines below.

<!-- ![Login page](screenshots/login.png) -->
<!-- ![Dashboard](screenshots/dashboard.png) -->
<!-- ![Kanban board](screenshots/kanban.png) -->
<!-- ![Task detail modal](screenshots/task-detail.png) -->

---

## Features

- **Authentication** — Register, login, logout with PHP sessions and bcrypt password hashing
- **Projects** — Create, view and delete projects; team member management
- **Kanban Board** — Drag & Drop between To Do / In Progress / Done columns
- **Tasks** — Create, edit (title, priority, due date, assignee), delete
- **Comments** — Per-task comment threads, posted without page reload
- **Responsive** — Works on mobile and desktop
- **Security** — XSS prevention, SQL injection prevention, session fixation prevention

---

## Tech Stack

| Layer            | Technology                          |
|------------------|-------------------------------------|
| **Frontend**     | HTML5, CSS3 (Flexbox / Grid), Vanilla JavaScript (ES2020) |
| **Backend**      | PHP 8.0+                            |
| **Database**     | MySQL 8.0+                          |
| **Auth**         | PHP Sessions + bcrypt               |
| **Server**       | Apache (via XAMPP)                  |
| **Version control** | Git + GitHub                     |

---

## Requirements

- [XAMPP](https://www.apachefriends.org/) 8.x (Apache + MySQL + PHP 8.0+)
- Git

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/giorgosfyls/task-manager-php.git
```

### 2. Move the folder to htdocs

| OS | Path |
|----|------|
| Windows | `C:\xampp\htdocs\task-manager-php\` |
| macOS | `/Applications/XAMPP/htdocs/task-manager-php/` |
| Linux | `/opt/lampp/htdocs/task-manager-php/` |

### 3. Start XAMPP

Open the XAMPP Control Panel and start **Apache** and **MySQL**.

### 4. Create the database

1. Open your browser and go to: `http://localhost/phpmyadmin`
2. Click **New** in the left sidebar
3. Name the database: `task_manager` — click **Create**
4. Select the `task_manager` database, click **Import**
5. Upload the file: `database/schema.sql` — click **Go**

### 5. Check the database config

Open `api/config/db.php` — the defaults match a standard XAMPP installation:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'task_manager');
define('DB_USER', 'root');
define('DB_PASS', '');           // Empty by default on XAMPP
```

If you have set a MySQL root password, update `DB_PASS` accordingly.

### 6. Open the application

```
http://localhost/task-manager-php/
```

Register a new account and you are ready to go.

---

## Project Structure

```
task-manager-php/
│
├── index.html              # Login / Register page
├── dashboard.html          # Projects overview + recent tasks
├── project.html            # Kanban board for a single project
│
├── css/
│   ├── base.css            # CSS variables, reset, typography, layouts
│   ├── auth.css            # Login / Register page styles
│   ├── dashboard.css       # Dashboard + sidebar + topbar styles
│   ├── modals.css          # CSS for modals
│   └── kanban.css          # Kanban board, task cards, modal, comments
│
├── js/
│   ├── api.js              # Fetch wrapper (apiGet, apiPost, apiDelete)
│   ├── auth.js             # Login and registration logic
│   ├── dashboard.js        # Projects CRUD, stat cards, search
│   └── kanban.js           # Drag & Drop, task detail modal, comments
│
├── api/
│   ├── config/
│   │   ├── db.php          # PDO connection (single $pdo instance)
│   │   └── session_check.php  # Auth guard included by all protected endpoints
│   │
│   ├── auth/
│   │   ├── login.php       # POST — authenticate user, create session
│   │   ├── logout.php      # POST — destroy session
│   │   └── register.php    # POST — create account
│   │
│   ├── projects/
│   │   ├── list.php        # GET  — all projects for the logged-in user
│   │   ├── create.php      # POST — create project
│   │   ├── delete.php      # DELETE — delete project (owner only)
│   │   └── members.php     # GET list / POST add member
│   │
│   ├── tasks/
│   │   ├── list.php        # GET  — tasks for a project (?project_id=X)
│   │   ├── create.php      # POST — create task
│   │   ├── update.php      # POST — partial update (status, priority, …)
│   │   └── delete.php      # DELETE — delete task (owner only)
│   │
│   └── comments/
│       ├── list.php        # GET  — comments for a task (?task_id=X)
│       └── add.php         # POST — add a comment
│
├── database/
│   └── schema.sql          # Table definitions, indexes, trigger
│
├── screenshots/            # Add your screenshots here
├── .gitignore
└── README.md
```

---

## Database Schema

```
USERS
  id | username | email | password_hash | created_at

PROJECTS
  id | title | description | owner_id (→ USERS) | created_at

PROJECT_MEMBERS
  project_id (→ PROJECTS) | user_id (→ USERS) | role (owner | member)

TASKS
  id | title | status | priority | project_id (→ PROJECTS) |
  assigned_to (→ USERS) | due_date | created_at | updated_at

COMMENTS
  id | task_id (→ TASKS) | user_id (→ USERS) | content | created_at
```

**Trigger:** `after_project_insert` — automatically adds the project creator to `project_members` with `role = 'owner'` on every new project insert.

**Cascades:** Deleting a project removes its members, tasks and comments. Deleting a task removes its comments.

---

## Security

| Threat | Protection |
|--------|-----------|
| **SQL Injection** | PDO prepared statements with bound parameters on every query. No raw user input concatenated into SQL. |
| **XSS** | All user-generated content escaped with `escapeHtml()` (JS) before `innerHTML`. PHP output uses `json_encode()` which escapes by default. |
| **Session Fixation** | `session_regenerate_id(true)` called immediately after successful login. |
| **Session Hijacking** | Cookies set with `HttpOnly`, `SameSite=Strict`. 30-minute inactivity timeout enforced server-side. |
| **Unauthorised Access** | Every protected endpoint requires `session_check.php`. Membership verified before every read or write operation. |
| **Privilege Escalation** | Delete operations check that the user is the project owner, not just a member. |
| **User Enumeration** | Login returns the same error message for "user not found" and "wrong password". |

---

## Live Demo (XAMPP)

Since this is a server-side PHP application it cannot run on GitHub Pages (static hosting only). To show a live demo:

**Option A — Share XAMPP via local network**
1. Find your local IP: run `ipconfig` (Windows) or `ifconfig` (macOS/Linux)
2. In XAMPP → Apache → Config → `httpd.conf`, change `Listen 80` to `Listen 0.0.0.0:80`
3. Others on the same network can access: `http://YOUR_LOCAL_IP/task-manager-php/`

**Option B — Record a demo video**
Use OBS Studio or Loom to record a 2–3 minute walkthrough and link it here.

**Option C — Deploy to a free PHP host**
[InfinityFree](https://infinityfree.net/) or [000webhost](https://www.000webhost.com/) support PHP + MySQL for free. Upload via FTP and import `schema.sql` via phpMyAdmin.

---

## Author

**Student:** Giorgos Fyls  
**Institution:** SAEK  
**Year:** 2026  
**Project type:** Full-Stack Web Development Capstone

---

## License

Developed for educational purposes as part of the SAEK capstone project.

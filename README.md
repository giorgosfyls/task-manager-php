# Task Manager / Project Management Tool — Web App

A full-stack web application for project and task management, featuring a Kanban board interface. Developed as a capstone project at SAEK (Vocational Training Institute).

---

## Screenshots

> ```
>
>
> ```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3 (Flexbox / Grid), Vanilla JavaScript |
| **Backend** | PHP 8 |
| **Database** | MySQL |
| **Authentication** | PHP Sessions + bcrypt |
| **Server** | Apache (via XAMPP) |
| **Version Control** | Git + GitHub |

---

## Features

- User registration and login with PHP Sessions and bcrypt password hashing
- Full CRUD operations for Projects
- Task management with priority levels and due dates
- Kanban Board with Drag and Drop (To Do / In Progress / Done)
- Comments per task
- Team member assignment to projects
- Responsive design for mobile and desktop

---

## Requirements

- [XAMPP](https://www.apachefriends.org/) (Apache + MySQL + PHP 8)
- Git

---

## Installation

**1. Clone the repository**

```bash
git clone https://github.com/giorg1s/project_management_web_application.git
```

**2. Move the project to the htdocs directory**

Copy the project folder to:
- Windows: `C:\xampp\htdocs\task-manager-php\`
- macOS / Linux: `/opt/lampp/htdocs/task-manager-php/`

**3. Start XAMPP**

Open the XAMPP Control Panel and start both **Apache** and **MySQL**.

**4. Create the database**

- Open your browser and navigate to: `http://localhost/phpmyadmin`
- Create a new database named: `task_manager`
- Select **Import** and upload the file: `database/schema.sql`

**5. Configure the database connection**

Open `api/config/db.php` and update the credentials if necessary:

```php
<?php
$host     = 'localhost';
$dbname   = 'task_manager';
$username = 'root';   // default XAMPP username
$password = '';       // default XAMPP password (empty)
```

**6. Run the application**

Open your browser and navigate to:

```
http://localhost/task-manager-php/
```

---

## Project Structure

```
task-manager-php/
│
├── index.html              # Landing page (Login / Register)
├── dashboard.html          # Projects overview
├── project.html            # Kanban board view
│
├── css/
│   ├── style.css           # Global stylesheet
│   └── kanban.css          # Kanban board styles
│
├── js/
│   ├── api.js              # Fetch API wrapper (apiGet, apiPost, apiDelete)
│   ├── auth.js             # Login and registration logic
│   ├── dashboard.js        # Projects CRUD
│   └── kanban.js           # Drag and Drop, task management
│
├── api/
│   ├── config/
│   │   └── db.php          # PDO database connection
│   ├── auth/
│   │   ├── register.php
│   │   ├── login.php
│   │   └── logout.php
│   ├── projects/
│   │   ├── list.php
│   │   ├── create.php
│   │   └── delete.php
│   ├── tasks/
│   │   ├── list.php
│   │   ├── create.php
│   │   ├── update.php
│   │   └── delete.php
│   └── comments/
│       ├── add.php
│       └── list.php
│
├── database/
│   └── schema.sql          # Table definitions and seed data
│
├──.gitignore
└── README.md
```

---

## Database Schema (ERD)

```
USERS
  id | username | email | password_hash | created_at

PROJECTS
  id | title | description | owner_id (FK -> USERS) | created_at

PROJECT_MEMBERS
  project_id (FK) | user_id (FK) | role

TASKS
  id | title | status | priority | project_id (FK) | assigned_to (FK) | due_date

COMMENTS
  id | task_id (FK) | user_id (FK) | content | created_at
```

---

## Security

- Passwords hashed with **bcrypt** via `password_hash()`
- **SQL Injection** prevention using PDO Prepared Statements
- **XSS** prevention using `htmlspecialchars()`
- Session regeneration after login via `session_regenerate_id()`
- Cookies configured as `HttpOnly`

---

## Author

**Student:** Giorgos Fyls
**Institution:** SAEK
**Year:** 2025
**Project Type:** Full-Stack Web Development Capstone
**Contact me:** giorgosinbond@gmail.com

---

## License

This project was developed for educational purposes as part of the SAEK capstone project requirements.

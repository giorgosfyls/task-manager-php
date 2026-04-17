# Task Manager — PHP & MySQL

![HTML5](https://img.shields.io/badge/HTML5-orange?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-blue?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-yellow?logo=javascript&logoColor=black)
![PHP](https://img.shields.io/badge/PHP-purple?logo=php&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-blue?logo=mysql&logoColor=white)
![Git](https://img.shields.io/badge/Git-orange?logo=git&logoColor=white)
![Last commit](https://img.shields.io/github/last-commit/giorg1s/task-manager-php)
![GitHub stars](https://img.shields.io/github/stars/giorg1s/blackjack?style=social)
![GitHub forks](https://img.shields.io/github/forks/giorg1s/blackjack?style=social)
![GitHub repo size](https://img.shields.io/github/repo-size/giorg1s/task-manager-php)
![Top language](https://img.shields.io/github/languages/top/giorg1s/task-manager-php)

A full-stack web application for project and task management, featuring a Kanban board interface. Developed as a capstone project at SAEK (Vocational Training Institute).

---

## Screenshots

```
![Dashboard](screenshots/dashboard.png)
![Kanban Board](screenshots/kanban.png)
```

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
git clone https://github.com/giorg1s/task-manager-php.git
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
│   ├── auth.css
│   ├── base.css            # Base for every .html file
│   ├── dashboard.css
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
│   │   ├── session_check.php
│   │   └── db.php          # PDO database connection
│   ├── auth/
│   │   ├── register.php
│   │   ├── login.php
│   │   └── logout.php
│   ├── projects/
│   │   ├── list.php
│   │   ├── create.php
│   │   ├── delete.php
│   │   └── members.php
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
├── LICANSE
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

## Development Timeline

| Week | Period | Goal |
|---|---|---|
| 1 | March, Week 1 | XAMPP setup, GitHub repository, database schema |
| 2 | March, Week 2 | PHP authentication API |
| 3 | March, Week 3 | HTML/CSS — Login and Dashboard pages |
| 4 | March, Week 4 | PHP Projects API |
| 5 | April, Week 1 | JavaScript Dashboard |
| 6 | April, Week 2 | PHP Tasks API |
| 7 | April, Week 3 | Kanban Board with Drag and Drop |
| 8 | April, Week 4 | Task detail view and Comments |
| 9 | May, Week 1 | Polish, security review, documentation |
| 10 | May, Week 2 | Presentation and submission |

---

## Author

**Student:** Giorgos Fyls
**Institution:** SAEK
**Year:** 2026
**Project Type:** Full-Stack Web Development Capstone

---

## License

This project was developed for educational purposes as part of the SAEK capstone project requirements.

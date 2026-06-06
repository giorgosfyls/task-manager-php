# TaskFlow — Security Audit Report
**Date:** May 2026 | **Version:** v1.0 | **Reviewer:** Code Cleanup Pass

---

## 1. SQL Injection — PDO Prepared Statements

**Status: ✅ PASS**

Every database query in the project uses PDO prepared statements with bound parameters. No raw user input is ever concatenated into SQL strings.

### Verified files

| File | Method | Example |
|------|--------|---------|
| `api/auth/login.php` | `prepare()` + `execute([$email])` | `WHERE email = ?` |
| `api/auth/register.php` | Named params | `:username, :email, :password_hash` |
| `api/tasks/update.php` | Dynamic SET with params | Fields built programmatically, values always bound |
| `api/projects/members.php` | Named params | `:project_id, :user_id` |
| All other endpoints | Named or positional params | Consistent throughout |

### Dynamic query (tasks/update.php)

The update endpoint builds a dynamic SET clause but only ever concatenates **field names** (which are hardcoded strings from an internal whitelist), never user input:

```php
// Safe — field names are hardcoded, values always bound
$fields[] = 'status = :status';
$params[':status'] = $data['status'];

$sql = 'UPDATE tasks SET ' . implode(', ', $fields) . ' WHERE id = :task_id';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
```

---

## 2. XSS — Cross-Site Scripting

**Status: ✅ PASS**

### Frontend (JavaScript)

All user-generated content is passed through `escapeHtml()` before being assigned to `innerHTML`:

```js
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

Applied in: `buildTaskCard()` (title), `buildCommentEl()` (username, content), `projectCardHTML()` (title, description), `taskItemHTML()` (title), `populateMemberSelect()` (username).

### Backend (PHP)

PHP endpoints return data via `json_encode()` which escapes special characters by default. No endpoint renders HTML directly — all output is JSON consumed by the JS layer.

### Recommendation (future)

If PHP ever renders HTML directly (e.g. email templates), wrap all output in `htmlspecialchars($value, ENT_QUOTES, 'UTF-8')`.

---

## 3. Session Security

**Status: ✅ PASS**

### Session fixation prevention

`session_regenerate_id(true)` is called immediately after a successful login, before any session data is written:

```php
// login.php
if (!$user || !password_verify($password, $user['password_hash'])) { ... }

session_regenerate_id(true);  // New session ID — old one invalidated
$_SESSION['user_id'] = (int) $user['id'];
```

### Cookie configuration

Applied consistently in `login.php` and `session_check.php`:

```php
session_set_cookie_params([
    'lifetime' => 0,        // Expires on browser close
    'path'     => '/',
    'secure'   => false,    // ⚠ Set to true in production (HTTPS)
    'httponly' => true,     // JS cannot read the cookie — mitigates XSS
    'samesite' => 'Strict', // Cookie not sent on cross-site requests — mitigates CSRF
]);
```

### Inactivity timeout

`session_check.php` enforces a 30-minute server-side timeout:

```php
define('SESSION_TIMEOUT', 1800);

if ((time() - $_SESSION['last_activity']) > SESSION_TIMEOUT) {
    session_unset();
    session_destroy();
    http_response_code(401);
    ...
}
$_SESSION['last_activity'] = time();
```

---

## 4. CSRF — Cross-Site Request Forgery

**Status: ⚠ PARTIAL**

### Current mitigation

The session cookie is set with `SameSite=Strict`, which prevents the browser from sending the cookie on any cross-origin request. This blocks the vast majority of CSRF attacks in modern browsers.

### Remaining risk

Older browsers (IE11, some Safari versions before 2020) do not support `SameSite`. For these browsers, a state-changing request from a different origin would include the session cookie.

### Recommendation for production

Add a CSRF token to all state-changing POST/DELETE requests:

**PHP — generate and store token:**
```php
// In session_check.php, after session_start()
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
```

**PHP — verify on each state-changing request:**
```php
$token = $data['csrf_token'] ?? '';
if (!hash_equals($_SESSION['csrf_token'], $token)) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid CSRF token']);
    exit;
}
```

**JavaScript — send token with every request:**
```js
// In api.js — retrieve token from a <meta> tag or a session endpoint
async function apiFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken(),
            ...options.headers,
        },
    });
}
```

---

## 5. Authorization — Ownership Checks

**Status: ✅ PASS**

Every protected endpoint verifies that the logged-in user has the right to perform the action:

| Endpoint | Check |
|----------|-------|
| `tasks/list.php` | User must be a `project_members` row for this project |
| `tasks/create.php` | User must be a `project_members` row for this project |
| `tasks/update.php` | User must be a `project_members` row for this task's project |
| `tasks/delete.php` | User must be the **project owner** |
| `projects/delete.php` | User must be the **project owner** |
| `projects/members.php` POST | User must be the **project owner** |
| `comments/add.php` | User must be a `project_members` row (via the task's project) |
| `comments/list.php` | User must be a `project_members` row (via the task's project) |

---

## 6. Password Security

**Status: ✅ PASS**

- Passwords hashed with `password_hash($password, PASSWORD_DEFAULT)` — uses bcrypt in PHP 8
- Verified with `password_verify()` — constant-time comparison, immune to timing attacks
- Minimum length: 6 characters (enforced on both client and server)
- Plain-text password never stored, logged, or returned in any response

---

## 7. Error Handling — Information Disclosure

**Status: ✅ PASS**

- `db.php` catches `PDOException` and returns a generic 500 message — no host, dbname or credentials leaked
- Login returns the same error for "user not found" and "wrong password" — prevents user enumeration
- All `catch (PDOException $e)` blocks return generic messages; `$e->getMessage()` is never exposed

---

## 8. Input Validation

**Status: ✅ PASS**

| Input | Validation |
|-------|-----------|
| Email | `filter_var($email, FILTER_VALIDATE_EMAIL)` + `strtolower(trim())` |
| Password | Minimum 6 characters, server-side check |
| Username | Minimum 3, maximum 50 characters |
| Task title | Maximum 150 characters, non-empty |
| Comment content | Maximum 2000 characters, non-empty |
| Project title | Maximum 100 characters, non-empty |
| Status | Whitelist: `['todo', 'in_progress', 'done']` |
| Priority | Whitelist: `['low', 'medium', 'high']` |
| Numeric IDs | `is_numeric()` check + `(int)` cast |
| Due date | `strtotime()` validation |

---

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| SQL Injection | ✅ Pass | All queries use PDO prepared statements |
| XSS | ✅ Pass | escapeHtml() on all user content in JS |
| Session fixation | ✅ Pass | session_regenerate_id(true) on login |
| Session timeout | ✅ Pass | 30 min server-side inactivity check |
| HttpOnly cookies | ✅ Pass | JS cannot access session cookie |
| SameSite=Strict | ✅ Pass | Blocks most CSRF attacks |
| CSRF token | ⚠ Partial | SameSite covers modern browsers; add token for full coverage in production |
| Ownership checks | ✅ Pass | Every endpoint verifies membership/ownership |
| Password hashing | ✅ Pass | bcrypt via password_hash() |
| Information disclosure | ✅ Pass | No internal errors exposed to client |
| Input validation | ✅ Pass | Length, type and whitelist checks on all inputs |
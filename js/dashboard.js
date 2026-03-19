/* ============================================================
   TaskFlow — Dashboard logic
   js/dashboard.js

   Responsibilities:
    1. Session check — redirect to login if not authenticated
    2. Load & render stat cards  (api/projects/list.php + api/tasks/list.php)
    3. Load & render project cards
    4. Load & render recent tasks
    5. Sidebar toggle (collapse / expand)
    6. Search filter (client-side, on loaded tasks)
   ============================================================ */


/* ── 1. SESSION CHECK ──────────────────────────────────────── */
// The very first thing we do is verify the user is logged in.
// api/config/session_check.php returns 401 if not authenticated.

(async () => {
  try {
    const res = await fetch('api/auth/session_check.php', {
      credentials: 'same-origin',
    });

    if (!res.ok) {
      // Not authenticated — redirect to login page
      window.location.replace('index.html');
      return;
    }

    // Authenticated — boot the rest of the dashboard
    await bootDashboard();

  } catch {
    // Network error — still redirect rather than showing broken UI
    window.location.replace('index.html');
  }
})();


/* ── 2. BOOT ───────────────────────────────────────────────── */
// Called only after the session check passes.

async function bootDashboard() {
  setupSidebarToggle();
  setupSearch();

  // Fetch projects and tasks in parallel for speed
  const [projects, tasks] = await Promise.all([
    fetchProjects(),
    fetchTasks(),
  ]);

  renderStats(projects, tasks);
  renderProjects(projects);
  renderTasks(tasks);
}


/* ── 3. FETCH HELPERS ──────────────────────────────────────── */

async function fetchProjects() {
  try {
    const res  = await fetch('api/projects/list.php', { credentials: 'same-origin' });
    const data = await res.json();
    // api returns: { projects: [...] } or { error: "..." }
    return res.ok ? data.projects : [];
  } catch {
    return [];
  }
}

async function fetchTasks() {
  try {
    const res  = await fetch('api/tasks/list.php', { credentials: 'same-origin' });
    const data = await res.json();
    // api returns: { tasks: [...] } or { error: "..." }
    return res.ok ? data.tasks : [];
  } catch {
    return [];
  }
}


/* ── 4. STAT CARDS ─────────────────────────────────────────── */
// Calculates totals from the fetched data and updates the DOM.

function renderStats(projects, tasks) {
  const totalProjects = projects.length;
  const openTasks     = tasks.filter(t => t.status !== 'done').length;
  const doneTasks     = tasks.filter(t => t.status === 'done').length;

  // Unique member count across all projects
  const memberIds = new Set(
    projects.flatMap(p => (p.members || []).map(m => m.id))
  );
  const totalMembers = memberIds.size;

  setText('stat-projects', totalProjects);
  setText('stat-tasks',    openTasks);
  setText('stat-done',     doneTasks);
  setText('stat-members',  totalMembers || '—');
}

// Helper: safely set textContent by id
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}


/* ── 5. PROJECT CARDS ──────────────────────────────────────── */

function renderProjects(projects) {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  // Mark as loaded (removes aria-busy spinner behaviour)
  grid.setAttribute('aria-busy', 'false');

  if (projects.length === 0) {
    grid.innerHTML = `
      <p class="text-muted" style="grid-column:1/-1; padding:2rem 0;">
        No projects yet. <a href="#" id="link-new-project">Create your first one.</a>
      </p>`;
    document.getElementById('link-new-project')
      ?.addEventListener('click', e => { e.preventDefault(); openNewProjectModal(); });
    return;
  }

  // Show max 6 cards on the dashboard
  grid.innerHTML = projects.slice(0, 6).map(p => projectCardHTML(p)).join('');
}

function projectCardHTML(p) {
  const total    = p.task_count  ?? 0;
  const done     = p.done_count  ?? 0;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
  const members  = (p.members || []).slice(0, 4);
  const overflow = (p.members?.length ?? 0) - members.length;
  const colour   = p.colour || '#e8490f';

  return `
    <article class="project-card" data-project-id="${p.id}" tabindex="0"
             role="button" aria-label="Open project ${escHtml(p.title)}">
      <div class="project-card__header">
        <div>
          <p class="project-card__title">${escHtml(p.title)}</p>
          <p class="project-card__desc">${escHtml(p.description || 'No description')}</p>
        </div>
        <span class="project-dot" style="background:${colour}" aria-hidden="true"></span>
      </div>

      <div class="project-progress">
        <div class="project-progress__label">
          <span>${done} / ${total} tasks</span>
          <span>${pct}%</span>
        </div>
        <div class="project-progress__bar"
             role="progressbar"
             aria-valuenow="${pct}"
             aria-valuemin="0"
             aria-valuemax="100"
             aria-label="${pct}% complete">
          <div class="project-progress__fill" style="width:${pct}%"></div>
        </div>
      </div>

      <div class="project-members" aria-label="${members.length} member${members.length !== 1 ? 's' : ''}">
        ${members.map(m => `
          <div class="project-members__avatar" title="${escHtml(m.username)}" aria-hidden="true">
            ${initials(m.username)}
          </div>`).join('')}
        ${overflow > 0
          ? `<div class="project-members__more" aria-label="${overflow} more members">+${overflow}</div>`
          : ''}
      </div>
    </article>`;
}

// Navigate to project page when card is clicked or Enter is pressed
document.addEventListener('click', e => {
  const card = e.target.closest('.project-card[data-project-id]');
  if (card) window.location.href = `project.html?id=${card.dataset.projectId}`;
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const card = e.target.closest('.project-card[data-project-id]');
  if (card) window.location.href = `project.html?id=${card.dataset.projectId}`;
});


/* ── 6. TASK LIST ──────────────────────────────────────────── */

// Keep a reference so the search filter can re-render
let allTasks = [];

function renderTasks(tasks) {
  allTasks = tasks;
  const list = document.getElementById('task-list');
  if (!list) return;

  list.setAttribute('aria-busy', 'false');
  paintTaskList(tasks.slice(0, 10));
}

function paintTaskList(tasks) {
  const list = document.getElementById('task-list');
  if (!list) return;

  if (tasks.length === 0) {
    list.innerHTML = `<li class="task-item" style="cursor:default;">
      <span class="task-item__title text-muted">No tasks found.</span>
    </li>`;
    return;
  }

  list.innerHTML = tasks.map(t => taskItemHTML(t)).join('');
}

function taskItemHTML(t) {
  const isDone    = t.status === 'done';
  const dueLabel  = formatDue(t.due_date);
  const overdue   = isOverdue(t.due_date) && !isDone;
  const dueClass  = overdue ? 'task-item__due task-item__due--overdue' : 'task-item__due';

  return `
    <li class="task-item${isDone ? ' done' : ''}"
        data-task-id="${t.id}"
        role="listitem">
      <div class="task-item__check"
           role="checkbox"
           aria-checked="${isDone}"
           tabindex="0"
           aria-label="Mark task ${escHtml(t.title)} as ${isDone ? 'incomplete' : 'complete'}">
      </div>
      <span class="task-item__title">${escHtml(t.title)}</span>
      ${t.due_date
        ? `<span class="${dueClass}" aria-label="Due ${dueLabel}">${dueLabel}</span>`
        : ''}
    </li>`;
}

// Toggle task done/undone on checkbox click or Enter
document.addEventListener('click', e => {
  const checkbox = e.target.closest('.task-item__check');
  if (checkbox) toggleTask(checkbox);
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const checkbox = e.target.closest('.task-item__check');
  if (checkbox) { e.preventDefault(); toggleTask(checkbox); }
});

async function toggleTask(checkboxEl) {
  const li     = checkboxEl.closest('.task-item');
  const taskId = li?.dataset.taskId;
  if (!taskId) return;

  const isDone    = li.classList.contains('done');
  const newStatus = isDone ? 'todo' : 'done';

  // Optimistic UI — update immediately, revert on error
  li.classList.toggle('done', !isDone);
  checkboxEl.setAttribute('aria-checked', String(!isDone));

  try {
    const res = await fetch('api/tasks/update.php', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id: taskId, status: newStatus }),
    });

    if (!res.ok) throw new Error('Update failed');

    // Sync local cache
    const task = allTasks.find(t => String(t.id) === String(taskId));
    if (task) task.status = newStatus;

  } catch {
    // Revert on failure
    li.classList.toggle('done', isDone);
    checkboxEl.setAttribute('aria-checked', String(isDone));
  }
}


/* ── 7. SIDEBAR TOGGLE ─────────────────────────────────────── */
//
// Δύο modes ανάλογα με το viewport:
//
//  Desktop/Tablet (≥ 768px):
//    Toggle body.sidebar-collapsed → CSS Grid αλλάζει πλάτος.
//    Preference αποθηκεύεται στο localStorage.
//
//  Mobile (< 768px):
//    Sidebar είναι fixed + position:left:-100% (εκτός οθόνης).
//    Toggle sidebar.open → slide-in από αριστερά.
//    Backdrop εμφανίζεται — κλικ πάνω του κλείνει το sidebar.

function setupSidebarToggle() {
  const btn      = document.getElementById('btn-sidebar-toggle');
  const sidebar  = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const body     = document.body;

  if (!btn || !sidebar) return;

  // ── Restore desktop preference ──────────────────────────────
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    body.classList.add('sidebar-collapsed');
    btn.setAttribute('aria-expanded', 'false');
  }

  // ── Helper: is mobile breakpoint? ───────────────────────────
  const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

  // ── Open / close overlay (mobile) ───────────────────────────
  function openMobileSidebar() {
    sidebar.classList.add('open');
    backdrop?.classList.add('visible');
    btn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden'; // prevent scroll behind
  }

  function closeMobileSidebar() {
    sidebar.classList.remove('open');
    backdrop?.classList.remove('visible');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  // ── Toggle button ────────────────────────────────────────────
  btn.addEventListener('click', () => {
    if (isMobile()) {
      // Mobile: overlay mode
      sidebar.classList.contains('open')
        ? closeMobileSidebar()
        : openMobileSidebar();
    } else {
      // Desktop/Tablet: collapse mode
      const isCollapsed = body.classList.toggle('sidebar-collapsed');
      btn.setAttribute('aria-expanded', String(!isCollapsed));
      localStorage.setItem('sidebar-collapsed', isCollapsed);
    }
  });

  // ── Backdrop click closes sidebar ────────────────────────────
  backdrop?.addEventListener('click', closeMobileSidebar);

  // ── Escape key closes sidebar ────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      closeMobileSidebar();
      btn.focus(); // return focus to toggle button
    }
  });

  // ── Close mobile sidebar on resize to desktop ────────────────
  window.addEventListener('resize', () => {
    if (!isMobile() && sidebar.classList.contains('open')) {
      closeMobileSidebar();
    }
  });
}


/* ── 8. SEARCH FILTER ──────────────────────────────────────── */
// Client-side filter — ακούει ΚΑΙ το desktop search (#topbar-search)
// ΚΑΙ το mobile search strip (#mobile-search-input).

function setupSearch() {
  const desktopInput = document.getElementById('topbar-search');
  const mobileInput  = document.getElementById('mobile-search-input');

  function handleSearch(q) {
    const query = q.trim().toLowerCase();
    if (!query) {
      paintTaskList(allTasks.slice(0, 10));
      return;
    }
    const filtered = allTasks.filter(t =>
      t.title.toLowerCase().includes(query)
    );
    paintTaskList(filtered);
  }

  // Sync the two inputs so they show the same value
  function syncInputs(value) {
    if (desktopInput) desktopInput.value = value;
    if (mobileInput)  mobileInput.value  = value;
  }

  if (desktopInput) {
    desktopInput.addEventListener('input', () => {
      syncInputs(desktopInput.value);
      handleSearch(desktopInput.value);
    });
  }

  if (mobileInput) {
    mobileInput.addEventListener('input', () => {
      syncInputs(mobileInput.value);
      handleSearch(mobileInput.value);
    });
  }
}


/* ── 9. NEW PROJECT BUTTON ─────────────────────────────────── */
// Placeholder — will open a modal in a future week.

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-new-project')
    ?.addEventListener('click', openNewProjectModal);
});

function openNewProjectModal() {
  // TODO (Week 4): replace with actual modal
  alert('New project modal — coming soon!');
}


/* ── 10. UTILITIES ─────────────────────────────────────────── */

// Escape HTML to prevent XSS when injecting user data into innerHTML
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Get up to 2 initials from a username
function initials(username) {
  if (!username) return '?';
  const parts = username.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : username.slice(0, 2).toUpperCase();
}

// Format a date string for display
function formatDue(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Check if a due date is in the past
function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}
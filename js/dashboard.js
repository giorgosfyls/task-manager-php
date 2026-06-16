/* ============================================================
   TaskFlow — Dashboard logic
   js/dashboard.js

   Depends on: js/api.js (must be loaded first)

   ────────────────────────────────────────────────────────────
   FIX (this version):
   "New Project" always showed an error message even though the
   project was actually created successfully on the server.

   Root cause: renderStats(projects, tasks) called tasks.filter(...)
   without checking that `tasks` was really an array. When called
   from handleCreateProject() as renderStats(allProjects, allTasks),
   a TypeError was thrown if allTasks was not in the expected shape
   at that moment, which was caught by the surrounding try/catch and
   reported back as a failure — even though api/projects/create.php
   had already returned 201 and the row existed in the database.

   renderStats / renderProjects / renderTasks now defensively
   normalise their inputs to arrays before using array methods.
   ════════════════════════════════════════════════════════════ */


/* ════════════════════════════════════════════════════════════
   1. SESSION CHECK + BOOT
════════════════════════════════════════════════════════════ */

(async () => {
  try {
    await apiGet('api/config/session_check.php');
    await bootDashboard();
  } catch {
    window.location.replace('index.html');
  }
})();


/* ════════════════════════════════════════════════════════════
   2. BOOT — wire up UI then fetch data
════════════════════════════════════════════════════════════ */

async function bootDashboard() {
  setupSidebarToggle();
  setupSearch();
  setupNewProjectBtn();

  const [projects, tasks] = await Promise.all([
    fetchProjects(),
    fetchAllTasks(),
  ]);

  renderStats(projects, tasks);
  renderProjects(projects);
  renderTasks(tasks);
}


/* ════════════════════════════════════════════════════════════
   3. FETCH HELPERS
════════════════════════════════════════════════════════════ */

async function fetchProjects() {
  try {
    const data = await apiGet('api/projects/list.php');
    return data.projects ?? [];
  } catch {
    return [];
  }
}

async function fetchAllTasks() {
  try {
    const data = await apiGet('api/tasks/list.php');
    return data.tasks ?? [];
  } catch {
    return [];
  }
}


/* ════════════════════════════════════════════════════════════
   4. STAT CARDS
════════════════════════════════════════════════════════════ */

/**
 * Both arguments are normalised to arrays defensively — see FIX
 * note at the top of this file. This prevents a TypeError when
 * renderStats is called before allTasks has been populated.
 */
function renderStats(projects, tasks) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeTasks     = Array.isArray(tasks) ? tasks : [];

  const openTasks  = safeTasks.filter(t => t.status !== 'done').length;
  const doneTasks  = safeTasks.filter(t => t.status === 'done').length;

  const memberIds = new Set(
    safeProjects.flatMap(p => (p.members ?? []).map(m => m.id))
  );

  setText('stat-projects', safeProjects.length);
  setText('stat-tasks',    openTasks);
  setText('stat-done',     doneTasks);
  setText('stat-members',  memberIds.size || '—');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}


/* ════════════════════════════════════════════════════════════
   5. PROJECT CARDS
════════════════════════════════════════════════════════════ */

let allProjects = [];

function renderProjects(projects) {
  allProjects = Array.isArray(projects) ? projects : [];

  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  grid.setAttribute('aria-busy', 'false');

  if (allProjects.length === 0) {
    grid.innerHTML = `
      <p class="text-muted" style="grid-column:1/-1; padding:2rem 0;">
        No projects yet.
        <a href="#" id="link-new-project">Create your first one.</a>
      </p>`;
    document.getElementById('link-new-project')
      ?.addEventListener('click', e => { e.preventDefault(); openNewProjectModal(); });
    return;
  }

  grid.innerHTML = allProjects.slice(0, 6).map(p => projectCardHTML(p)).join('');
}

function projectCardHTML(p) {
  const total    = p.task_count ?? 0;
  const done     = p.done_count ?? 0;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
  const members  = (p.members ?? []).slice(0, 4);
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

      <div class="project-card__footer">
        <div class="project-members"
             aria-label="${members.length} member${members.length !== 1 ? 's' : ''}">
          ${members.map(m => `
            <div class="project-members__avatar"
                 title="${escHtml(m.username)}" aria-hidden="true">
              ${initials(m.username)}
            </div>`).join('')}
          ${overflow > 0
            ? `<div class="project-members__more"
                    aria-label="${overflow} more members">+${overflow}</div>`
            : ''}
        </div>

        <button class="btn-delete-project"
                data-project-id="${p.id}"
                aria-label="Delete project ${escHtml(p.title)}"
                title="Delete project">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>

    </article>`;
}

document.addEventListener('click', async e => {
  const deleteBtn = e.target.closest('.btn-delete-project');
  if (deleteBtn) {
    e.stopPropagation();
    await handleDeleteProject(deleteBtn.dataset.projectId);
    return;
  }

  const card = e.target.closest('.project-card[data-project-id]');
  if (card) {
    const name = allProjects.find(p => String(p.id) === card.dataset.projectId)?.title || '';
    sessionStorage.setItem(`project_name_${card.dataset.projectId}`, name);
    window.location.href = `project.html?project_id=${card.dataset.projectId}`;
  }
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const card = e.target.closest('.project-card[data-project-id]');
  if (card) {
    window.location.href = `project.html?project_id=${card.dataset.projectId}`;
  }
});

/**
 * POSTs a new project, prepends it to the cached list, and re-renders.
 * @returns {{ ok: boolean, message?: string }}
 */
async function handleCreateProject(title, description) {
  try {
    const data = await apiPost('api/projects/create.php', { title, description });

    allProjects = [data.project, ...allProjects];
    renderProjects(allProjects);
    renderStats(allProjects, allTasks);

    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

async function handleDeleteProject(projectId) {
  if (!confirm('Delete this project? This action cannot be undone.')) return;

  try {
    await apiDelete('api/projects/delete.php', { id: Number(projectId) });

    allProjects = allProjects.filter(p => String(p.id) !== String(projectId));
    renderProjects(allProjects);
    renderStats(allProjects, allTasks);

  } catch (err) {
    alert(err.message);
  }
}


/* ════════════════════════════════════════════════════════════
   6. RECENT TASK LIST
════════════════════════════════════════════════════════════ */

let allTasks = [];

function renderTasks(tasks) {
  allTasks = Array.isArray(tasks) ? tasks : [];
  const list = document.getElementById('task-list');
  if (!list) return;
  list.setAttribute('aria-busy', 'false');
  paintTaskList(allTasks.slice(0, 10));
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
  const isDone   = t.status === 'done';
  const dueLabel = formatDue(t.due_date);
  const overdue  = isOverdue(t.due_date) && !isDone;
  const dueClass = overdue ? 'task-item__due task-item__due--overdue' : 'task-item__due';

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

  li.classList.toggle('done', !isDone);
  checkboxEl.setAttribute('aria-checked', String(!isDone));

  try {
    await apiPost('api/tasks/update.php', { id: Number(taskId), status: newStatus });

    const task = allTasks.find(t => String(t.id) === String(taskId));
    if (task) task.status = newStatus;

  } catch {
    li.classList.toggle('done', isDone);
    checkboxEl.setAttribute('aria-checked', String(isDone));
  }
}


/* ════════════════════════════════════════════════════════════
   7. NEW PROJECT MODAL
════════════════════════════════════════════════════════════ */

function setupNewProjectBtn() {
  document.getElementById('btn-new-project')
    ?.addEventListener('click', openNewProjectModal);
}

function openNewProjectModal() {
  document.getElementById('modal-new-project')?.remove();

  const overlay = document.createElement('div');
  overlay.id        = 'modal-new-project';
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role',            'dialog');
  overlay.setAttribute('aria-modal',      'true');
  overlay.setAttribute('aria-labelledby', 'modal-new-title');

  overlay.innerHTML = `
    <div class="modal">

      <div class="modal__header">
        <h2 class="modal__title" id="modal-new-title">New Project</h2>
        <button class="modal__close" id="btn-modal-close" aria-label="Close modal">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6"  x2="6"  y2="18"/>
            <line x1="6"  y1="6"  x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal__body">
        <div class="field">
          <label for="modal-project-title">
            Title <span aria-hidden="true" style="color:var(--red)">*</span>
          </label>
          <div class="field-wrap">
            <input type="text"
                   id="modal-project-title"
                   placeholder="e.g. TaskFlow App"
                   maxlength="100"
                   autocomplete="off"
                   aria-required="true"
                   aria-describedby="modal-title-error" />
          </div>
          <span class="field-error" id="modal-title-error" role="alert"></span>
        </div>

        <div class="field">
          <label for="modal-project-desc">Description</label>
          <textarea id="modal-project-desc"
                    placeholder="What is this project about?"
                    rows="3"
                    maxlength="500"></textarea>
        </div>
      </div>

      <div class="modal__footer">
        <button class="btn-sm btn-sm--ghost" id="btn-modal-cancel">Cancel</button>
        <button class="btn-sm" id="btn-modal-submit">
          <span class="btn-label">Create Project</span>
          <span class="spinner" aria-hidden="true"></span>
        </button>
      </div>

    </div>`;

  document.body.appendChild(overlay);

  const titleInput = overlay.querySelector('#modal-project-title');
  const descInput  = overlay.querySelector('#modal-project-desc');
  const submitBtn  = overlay.querySelector('#btn-modal-submit');
  const errorEl    = overlay.querySelector('#modal-title-error');

  titleInput.focus();

  const closeModal = () => overlay.remove();

  overlay.querySelector('#btn-modal-close').addEventListener('click', closeModal);
  overlay.querySelector('#btn-modal-cancel').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  submitBtn.addEventListener('click', async () => {
    const title       = titleInput.value.trim();
    const description = descInput.value.trim();

    errorEl.textContent = '';
    titleInput.classList.remove('error');

    if (!title) {
      errorEl.textContent = 'Title is required.';
      titleInput.classList.add('error');
      titleInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('loading');

    const result = await handleCreateProject(title, description);

    if (result.ok) {
      closeModal();
    } else {
      errorEl.textContent = result.message;
      submitBtn.disabled  = false;
      submitBtn.classList.remove('loading');
      titleInput.focus();
    }
  });
}


/* ════════════════════════════════════════════════════════════
   8. SIDEBAR TOGGLE
════════════════════════════════════════════════════════════ */

function setupSidebarToggle() {
  const btn      = document.getElementById('btn-sidebar-toggle');
  const sidebar  = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (!btn || !sidebar) return;

  const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

  if (!isMobile() && localStorage.getItem('sidebar-collapsed') === 'true') {
    document.body.classList.add('sidebar-collapsed');
    btn.setAttribute('aria-expanded', 'false');
  }

  const openMobile = () => {
    sidebar.classList.add('open');
    backdrop?.classList.add('visible');
    btn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const closeMobile = () => {
    sidebar.classList.remove('open');
    backdrop?.classList.remove('visible');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  btn.addEventListener('click', () => {
    if (isMobile()) {
      sidebar.classList.contains('open') ? closeMobile() : openMobile();
    } else {
      const collapsed = document.body.classList.toggle('sidebar-collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
      localStorage.setItem('sidebar-collapsed', collapsed);
    }
  });

  backdrop?.addEventListener('click', closeMobile);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      closeMobile();
      btn.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (!isMobile() && sidebar.classList.contains('open')) closeMobile();
  });
}


/* ════════════════════════════════════════════════════════════
   9. SEARCH FILTER (client-side)
════════════════════════════════════════════════════════════ */

function setupSearch() {
  const desktopInput = document.getElementById('topbar-search');
  const mobileInput  = document.getElementById('mobile-search-input');

  function handleSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) { paintTaskList(allTasks.slice(0, 10)); return; }
    paintTaskList(allTasks.filter(t => t.title.toLowerCase().includes(q)));
  }

  function syncInputs(value) {
    if (desktopInput) desktopInput.value = value;
    if (mobileInput)  mobileInput.value  = value;
  }

  desktopInput?.addEventListener('input', () => {
    syncInputs(desktopInput.value);
    handleSearch(desktopInput.value);
  });

  mobileInput?.addEventListener('input', () => {
    syncInputs(mobileInput.value);
    handleSearch(mobileInput.value);
  });
}


/* ════════════════════════════════════════════════════════════
   10. UTILITIES
════════════════════════════════════════════════════════════ */

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initials(username) {
  if (!username) return '?';
  const parts = username.trim().split(/\s+/);
  return (parts.length >= 2
    ? parts[0][0] + parts[1][0]
    : username.slice(0, 2)
  ).toUpperCase();
}

function formatDue(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}
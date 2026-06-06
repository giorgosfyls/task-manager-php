/**
 * kanban.js — Kanban Board logic
 *
 * Responsibilities:
 *   - Load tasks and project members on page init (parallel fetch)
 *   - Render task cards into the three Kanban columns
 *   - HTML5 Drag & Drop: dragstart / dragover / drop → status change
 *   - Fetch POST to api/tasks/update.php after every drop
 *   - Quick-create modal (title, priority, due_date, column)
 *   - Task Detail modal (all fields + assigned_to)
 *   - Comments: load, post, DOM update
 *   - Loading spinners, empty states, error messages
 *
 * Depends on: js/api.js (must be loaded first)
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */

/** Returns project_id from the URL query string (?project_id=X). */
function getProjectId() {
  return new URLSearchParams(window.location.search).get('project_id') || null;
}

/**
 * Shows a brief toast notification.
 * @param {string}  msg
 * @param {'success'|'error'|'info'|''} type
 * @param {number}  duration  Milliseconds before auto-hide
 */
function showToast(msg, type = '', duration = 2800) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = 'toast' + (type ? ` toast--${type}` : '');
  toast.hidden      = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.hidden = true; }, duration);
}

/**
 * Formats a MySQL date string (YYYY-MM-DD) to DD/MM/YYYY
 * and determines whether the deadline has passed.
 * @param {string} dateStr
 * @returns {{ display: string, overdue: boolean } | null}
 */
function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const due = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = String(due.getDate()).padStart(2, '0');
  const m = String(due.getMonth() + 1).padStart(2, '0');
  return { display: `${d}/${m}/${due.getFullYear()}`, overdue: due < now };
}

/**
 * Returns up to two-character initials from a name or username.
 * e.g. "John Doe" → "JD",  "alice" → "AL"
 * @param {string} name
 * @returns {string}
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

/**
 * Escapes HTML special characters to prevent XSS.
 * Used on all user-generated content before setting innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Formats a MySQL datetime string for display in the comments section.
 * e.g. "2026-05-21 14:30:00" → "21/05/2026 at 14:30"
 * @param {string} str
 * @returns {string}
 */
function formatDateTime(str) {
  if (!str) return '';
  const dt = new Date(str.replace(' ', 'T'));
  const d  = String(dt.getDate()).padStart(2, '0');
  const m  = String(dt.getMonth() + 1).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${dt.getFullYear()} at ${hh}:${mm}`;
}


/* ════════════════════════════════════════════════════════════
   UI STATE HELPERS (spinner / empty state / error)
════════════════════════════════════════════════════════════ */

/**
 * Replaces an element's content with a loading spinner.
 * @param {HTMLElement} el
 * @param {'sm'|'md'|'lg'} size
 */
function showSpinner(el, size = 'md') {
  el.innerHTML = `
    <div class="spinner-wrap spinner-wrap--${size}" role="status" aria-label="Loading">
      <span class="spinner"></span>
    </div>`;
}

/**
 * Replaces an element's content with an empty-state message.
 * @param {HTMLElement} el
 * @param {string} title     Primary message
 * @param {string} subtitle  Secondary hint (optional)
 * @param {string} icon      SVG path data for the icon (optional)
 */
function showEmptyState(el, title, subtitle = '', icon = '') {
  const iconSvg = icon
    ? `<svg class="empty-state__icon" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
          stroke-linejoin="round" aria-hidden="true">${icon}</svg>`
    : '';
  el.innerHTML = `
    <div class="empty-state">
      ${iconSvg}
      <p class="empty-state__title">${escapeHtml(title)}</p>
      ${subtitle ? `<p class="empty-state__sub">${escapeHtml(subtitle)}</p>` : ''}
    </div>`;
}

/**
 * Replaces an element's content with an inline error message.
 * @param {HTMLElement} el
 * @param {string} message
 */
function showError(el, message) {
  el.innerHTML = `
    <div class="inline-error" role="alert">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8"  x2="12"    y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>${escapeHtml(message)}</span>
    </div>`;
}


/* ════════════════════════════════════════════════════════════
   API CALLS
   All use apiGet / apiPost from js/api.js for consistent
   error handling and automatic 401 → redirect behaviour.
════════════════════════════════════════════════════════════ */

/** Loads all tasks for the current project. */
async function fetchTasks(projectId) {
  const data = await apiGet(`api/tasks/list.php?project_id=${projectId}`);
  return data.tasks;
}

/**
 * Updates task status after a drag & drop.
 * Only sends the fields that changed — partial update.
 */
async function updateTaskStatus(taskId, newStatus) {
  return apiPost('api/tasks/update.php', { id: taskId, status: newStatus });
}

/** Creates a new task and returns the saved task object. */
async function createTask(payload) {
  const data = await apiPost('api/tasks/create.php', payload);
  return data.task;
}

/** Updates an existing task with all provided fields. */
async function updateTask(payload) {
  return apiPost('api/tasks/update.php', payload);
}

/** Deletes a task by id. */
async function deleteTask(taskId) {
  return apiDelete('api/tasks/delete.php', { id: taskId });
}

/** Loads all project members for the assigned_to dropdown. */
async function fetchProjectMembers(projectId) {
  const data = await apiGet(`api/projects/members.php?project_id=${projectId}`);
  return data.members; // [{ id, username }]
}

/** Loads all comments for a task. */
async function fetchComments(taskId) {
  const data = await apiGet(`api/comments/list.php?task_id=${taskId}`);
  return data.comments; // [{ id, content, created_at, user_username }]
}

/** Posts a new comment and returns the saved comment object. */
async function postComment(taskId, content) {
  const data = await apiPost('api/comments/add.php', { task_id: taskId, content });
  return data.comment; // { id, content, created_at, user_username }
}


/* ════════════════════════════════════════════════════════════
   DOM RENDERING — TASK CARDS
════════════════════════════════════════════════════════════ */

/**
 * Builds a draggable task card element.
 *
 * Structure:
 *   article.task-card         [draggable]
 *     .task-card__top         title + priority badge
 *     .task-card__meta        due date + assignee avatar
 *     .task-card__actions     edit / delete buttons (visible on hover)
 *
 * @param {object} task
 * @returns {HTMLElement}
 */
function buildTaskCard(task) {
  const card = document.createElement('article');
  card.className      = 'task-card';
  card.draggable      = true;
  card.dataset.id     = task.id;
  card.dataset.status = task.status;
  card.setAttribute('role',       'listitem');
  card.setAttribute('aria-label', task.title);

  const priorityLabel = { high: 'High', medium: 'Medium', low: 'Low' }[task.priority] || 'Medium';
  const priorityCls   = `priority-badge priority-badge--${task.priority || 'medium'}`;

  // Due date HTML (with overdue styling)
  let dueHTML = '';
  if (task.due_date) {
    const due = formatDueDate(task.due_date);
    const cls = due.overdue ? 'task-card__due task-card__due--overdue' : 'task-card__due';
    dueHTML = `
      <span class="${cls}" title="${due.overdue ? 'Overdue!' : 'Due date'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8"  y1="2" x2="8"  y2="6"/>
          <line x1="3"  y1="10" x2="21" y2="10"/>
        </svg>
        ${due.display}
      </span>`;
  }

  // Assignee avatar (initials)
  const assigneeName = task.assigned_username || '';
  const avatarHTML   = assigneeName
    ? `<span class="task-card__avatar" title="${escapeHtml(assigneeName)}">${getInitials(assigneeName)}</span>`
    : '';

  card.innerHTML = `
    <div class="task-card__top">
      <h4 class="task-card__title">${escapeHtml(task.title)}</h4>
      <span class="${priorityCls}" aria-label="Priority: ${priorityLabel}">${priorityLabel}</span>
    </div>
    <div class="task-card__meta">
      ${dueHTML}
      ${avatarHTML}
    </div>
    <div class="task-card__actions" aria-label="Task actions">
      <button class="task-card__btn task-card__btn--edit"
              aria-label="Edit task" data-id="${task.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="task-card__btn task-card__btn--delete"
              aria-label="Delete task" data-id="${task.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>`;

  // Drag events
  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragend',   onDragEnd);

  // Click anywhere on card → detail modal (except action buttons)
  card.addEventListener('click', (e) => {
    if (e.target.closest('.task-card__btn')) return;
    openDetailModal(task);
  });

  card.querySelector('.task-card__btn--edit').addEventListener('click', (e) => {
    e.stopPropagation();
    openDetailModal(task);
  });

  card.querySelector('.task-card__btn--delete').addEventListener('click', (e) => {
    e.stopPropagation();
    handleDeleteTask(task.id, card);
  });

  return card;
}

/** Renders all task cards for one column, handling the empty state. */
function renderColumn(tasks, status) {
  const body  = document.getElementById(`tasks-${status}`);
  const count = document.getElementById(`count-${status}`);

  // Remove skeleton placeholders
  body.querySelectorAll('.task-card--skeleton').forEach(el => el.remove());

  const filtered = tasks.filter(t => t.status === status);

  if (filtered.length === 0) {
    showEmptyState(
      body,
      'No tasks here',
      'Drag a card here or click + Add Task',
      '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'
    );
  } else {
    filtered.forEach(task => body.appendChild(buildTaskCard(task)));
  }

  count.textContent = filtered.length;
}

/** Renders all three columns from a flat tasks array. */
function renderBoard(tasks) {
  renderColumn(tasks, 'todo');
  renderColumn(tasks, 'in_progress');
  renderColumn(tasks, 'done');
}

/** Recounts real task cards in a column and updates the badge. */
function updateColumnCount(status) {
  const body  = document.getElementById(`tasks-${status}`);
  const count = document.getElementById(`count-${status}`);
  if (!body || !count) return;
  count.textContent = body.querySelectorAll('.task-card:not(.task-card--skeleton)').length;
}


/* ════════════════════════════════════════════════════════════
   DRAG & DROP  (HTML5 Drag and Drop API)
════════════════════════════════════════════════════════════ */

/** Reference to the card currently being dragged. */
let draggedCard = null;

/** dragstart — fired on the card when the user starts dragging. */
function onDragStart(e) {
  draggedCard = this;
  this.classList.add('dragging');
  e.dataTransfer.setData('text/plain', this.dataset.id);
  e.dataTransfer.effectAllowed = 'move';
}

/** dragend — clean up classes regardless of whether drop succeeded. */
function onDragEnd() {
  if (draggedCard) draggedCard.classList.remove('dragging');
  document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
  draggedCard = null;
}

/**
 * dragover — MUST call preventDefault() to allow the drop.
 * Adds a visual highlight to the target column.
 */
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drag-over');
}

/** dragleave — remove highlight when card leaves the column area. */
function onDragLeave() {
  this.classList.remove('drag-over');
}

/**
 * drop — move the card and persist the new status via API.
 *
 * Uses an optimistic update: the DOM is updated immediately and
 * rolled back if the API call fails, so the UI feels instant.
 */
async function onDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');

  const taskId    = e.dataTransfer.getData('text/plain');
  const newStatus = this.closest('.kanban-column').dataset.status;
  const card      = document.querySelector(`.task-card[data-id="${taskId}"]`);
  if (!card) return;

  const oldStatus = card.dataset.status;
  if (oldStatus === newStatus) return; // Dropped into the same column — nothing to do

  const targetBody = document.getElementById(`tasks-${newStatus}`);
  const oldBody    = document.getElementById(`tasks-${oldStatus}`);

  // ── Optimistic DOM update ──────────────────────────────────
  targetBody.querySelector('.empty-state')?.remove();
  targetBody.querySelectorAll('.empty-state').forEach(el => el.remove());

  targetBody.appendChild(card);
  card.dataset.status = newStatus;
  updateColumnCount(oldStatus);
  updateColumnCount(newStatus);

  // Show empty state in the source column if it's now empty
  if (!oldBody.querySelector('.task-card')) {
    showEmptyState(
      oldBody,
      'No tasks here',
      'Drag a card here or click + Add Task',
      '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'
    );
  }

  // ── API call ───────────────────────────────────────────────
  try {
    await updateTaskStatus(Number(taskId), newStatus);
    showToast('Task moved', 'success');
  } catch (err) {
    console.error('updateTaskStatus failed:', err);

    // ── Rollback: restore card to original column ──────────
    oldBody.querySelector('.empty-state')?.remove();
    oldBody.appendChild(card);
    card.dataset.status = oldStatus;
    updateColumnCount(oldStatus);
    updateColumnCount(newStatus);
    showToast('Failed to move task. Please try again.', 'error');
  }
}


/* ════════════════════════════════════════════════════════════
   TASK DETAIL MODAL
   Fields: title, priority, due_date, status, assigned_to
   Right column: Comments section
════════════════════════════════════════════════════════════ */

/** Project members cached on page load — used to populate the dropdown. */
let _members = [];

/**
 * Fills the assigned_to <select> with project members.
 * @param {HTMLSelectElement} selectEl
 * @param {number|string}     selectedId  Currently assigned user id (or empty)
 */
function populateMemberSelect(selectEl, selectedId) {
  selectEl.innerHTML = '<option value="">Unassigned</option>';
  _members.forEach(m => {
    const opt       = document.createElement('option');
    opt.value       = m.id;
    opt.textContent = m.username;
    if (String(m.id) === String(selectedId)) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

/**
 * Opens the Task Detail Modal pre-filled with the task's current values
 * and loads its comment thread in the right column.
 * @param {object} task
 */
async function openDetailModal(task) {
  const modal = document.getElementById('modal-detail');
  modal.hidden = false;

  // Fill editable fields
  document.getElementById('detail-task-id').value  = task.id;
  document.getElementById('detail-title').value    = task.title;
  document.getElementById('detail-priority').value = task.priority || 'medium';
  document.getElementById('detail-due').value      = task.due_date ? task.due_date.split(' ')[0] : '';
  document.getElementById('detail-status').value   = task.status;

  populateMemberSelect(
    document.getElementById('detail-assigned'),
    task.assigned_to || ''
  );

  document.getElementById('detail-title').focus();

  // Load comments in parallel with the modal opening
  await loadComments(task.id);
}

/** Closes the detail modal and clears the comment textarea. */
function closeDetailModal() {
  document.getElementById('modal-detail').hidden     = true;
  document.getElementById('comment-input').value     = '';
}


/* ════════════════════════════════════════════════════════════
   COMMENTS
════════════════════════════════════════════════════════════ */

/**
 * Fetches and renders comments for a task.
 * Shows a spinner while loading and an empty state when there are none.
 */
async function loadComments(taskId) {
  const list = document.getElementById('comment-list');
  showSpinner(list, 'sm');

  try {
    const comments = await fetchComments(taskId);

    if (comments.length === 0) {
      showEmptyState(
        list,
        'No comments yet',
        'Be the first to add one!',
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
      );
      return;
    }

    list.innerHTML = '';
    comments.forEach(c => list.appendChild(buildCommentEl(c)));
    list.scrollTop = list.scrollHeight; // Scroll to latest comment

  } catch (err) {
    console.error('loadComments error:', err);
    showError(list, 'Could not load comments. Please try again.');
  }
}

/**
 * Builds a single comment element.
 * @param {{ id, content, created_at, user_username }} comment
 * @returns {HTMLElement}
 */
function buildCommentEl(comment) {
  const el      = document.createElement('div');
  el.className  = 'comment';
  el.dataset.id = comment.id;

  el.innerHTML = `
    <div class="comment__avatar">${getInitials(comment.user_username)}</div>
    <div class="comment__body">
      <div class="comment__meta">
        <strong class="comment__author">${escapeHtml(comment.user_username)}</strong>
        <time class="comment__time" datetime="${escapeHtml(comment.created_at)}">
          ${formatDateTime(comment.created_at)}
        </time>
      </div>
      <p class="comment__text">${escapeHtml(comment.content)}</p>
    </div>`;

  return el;
}

/**
 * Handles the Post Comment button (and Ctrl+Enter shortcut).
 * POSTs the comment, then appends it to the list with a slide-in animation.
 */
async function handlePostComment() {
  const taskId  = Number(document.getElementById('detail-task-id').value);
  const input   = document.getElementById('comment-input');
  const content = input.value.trim();
  const btn     = document.getElementById('btn-post-comment');
  const list    = document.getElementById('comment-list');

  if (!content) {
    input.focus();
    showToast('Please write a comment first.', 'error');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Posting…';

  try {
    const comment = await postComment(taskId, content);

    // Remove empty-state if it was showing
    list.querySelector('.empty-state')?.remove();

    // Append new comment with slide-in animation
    const el = buildCommentEl(comment);
    el.classList.add('comment--new');
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;

    input.value = '';
    showToast('Comment posted', 'success');

  } catch (err) {
    console.error('postComment error:', err);
    showToast('Failed to post comment. Please try again.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Post';
  }
}


/* ════════════════════════════════════════════════════════════
   DETAIL MODAL — SAVE CHANGES
════════════════════════════════════════════════════════════ */

/** Reads the detail modal fields, calls the API, and updates the card in-place. */
async function handleSaveDetail() {
  const taskId = Number(document.getElementById('detail-task-id').value);
  const title  = document.getElementById('detail-title').value.trim();
  const btn    = document.getElementById('btn-save-detail');

  if (!title) {
    document.getElementById('detail-title').focus();
    showToast('Title cannot be empty.', 'error');
    return;
  }

  const payload = {
    id:          taskId,
    title,
    priority:    document.getElementById('detail-priority').value,
    due_date:    document.getElementById('detail-due').value     || null,
    status:      document.getElementById('detail-status').value,
    assigned_to: document.getElementById('detail-assigned').value || null,
    project_id:  getProjectId(),
  };

  btn.disabled    = true;
  btn.textContent = 'Saving…';

  try {
    await updateTask(payload);

    // Rebuild the card DOM element with updated data
    const oldCard   = document.querySelector(`.task-card[data-id="${taskId}"]`);
    const oldStatus = oldCard?.dataset.status;

    if (oldCard) {
      const member   = _members.find(m => String(m.id) === String(payload.assigned_to));
      const enriched = { ...payload, assigned_username: member?.username || '' };
      const newCard  = buildTaskCard(enriched);
      oldCard.replaceWith(newCard);

      // Move to correct column if status changed
      if (oldStatus && oldStatus !== payload.status) {
        document.getElementById(`tasks-${payload.status}`).appendChild(newCard);
        updateColumnCount(oldStatus);
        updateColumnCount(payload.status);
      }
    }

    showToast('Task saved', 'success');
    closeDetailModal();

  } catch (err) {
    console.error('handleSaveDetail error:', err);
    showToast('Error saving task. Please try again.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Save Changes';
  }
}


/* ════════════════════════════════════════════════════════════
   QUICK-CREATE MODAL
════════════════════════════════════════════════════════════ */

// DOM references cached at module level
const modalEl     = document.getElementById('modal-task');
const inputTitle  = document.getElementById('task-title');
const selPriority = document.getElementById('task-priority');
const inputDue    = document.getElementById('task-due');
const selStatus   = document.getElementById('task-status');
const btnSave     = document.getElementById('btn-save-task');
const btnCancel   = document.getElementById('btn-cancel-task');
const btnClose    = document.getElementById('modal-close');

/** Opens the quick-create modal with a pre-selected column. */
function openCreateModal(defaultStatus = 'todo') {
  document.getElementById('modal-title').textContent = 'New Task';
  document.getElementById('task-id').value = '';
  inputTitle.value  = '';
  selPriority.value = 'medium';
  inputDue.value    = '';
  selStatus.value   = defaultStatus;
  modalEl.hidden    = false;
  inputTitle.focus();
}

function closeModal() { modalEl.hidden = true; }

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!modalEl.hidden) closeModal();
  if (!document.getElementById('modal-detail').hidden) closeDetailModal();
});

modalEl.addEventListener('click',  (e) => { if (e.target === modalEl) closeModal(); });
btnClose.addEventListener('click', closeModal);
btnCancel.addEventListener('click', closeModal);

btnSave.addEventListener('click', async () => {
  const title = inputTitle.value.trim();
  if (!title) {
    inputTitle.focus();
    showToast('Please enter a task title.', 'error');
    return;
  }

  const payload = {
    title,
    priority:   selPriority.value,
    due_date:   inputDue.value || null,
    status:     selStatus.value,
    project_id: getProjectId(),
  };

  btnSave.disabled    = true;
  btnSave.textContent = 'Creating…';

  try {
    const newTask = await createTask(payload);
    const card    = buildTaskCard(newTask);
    const body    = document.getElementById(`tasks-${newTask.status}`);

    body.querySelector('.empty-state')?.remove();
    body.appendChild(card);
    updateColumnCount(newTask.status);

    showToast('Task created', 'success');
    closeModal();
  } catch (err) {
    console.error('createTask error:', err);
    showToast('Error creating task. Please try again.', 'error');
  } finally {
    btnSave.disabled    = false;
    btnSave.textContent = 'Save Task';
  }
});


/* ════════════════════════════════════════════════════════════
   DELETE TASK
════════════════════════════════════════════════════════════ */

/**
 * Confirms and deletes a task, then removes its card from the DOM.
 * Shows an empty state if the column is now empty.
 */
async function handleDeleteTask(taskId, cardEl) {
  if (!confirm('Delete this task? This cannot be undone.')) return;

  const status = cardEl.dataset.status;

  try {
    await deleteTask(taskId);
    cardEl.remove();
    updateColumnCount(status);

    const body = document.getElementById(`tasks-${status}`);
    if (!body.querySelector('.task-card')) {
      showEmptyState(
        body,
        'No tasks here',
        'Drag a card here or click + Add Task',
        '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'
      );
    }

    showToast('Task deleted', 'success');

  } catch (err) {
    console.error('deleteTask error:', err);
    showToast('Failed to delete task.', 'error');
  }
}


/* ════════════════════════════════════════════════════════════
   INIT — DOMContentLoaded
════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  const projectId = getProjectId();

  // Show project name in breadcrumb (saved by dashboard.js)
  const projectNameEl = document.getElementById('project-name-heading');
  const savedName     = sessionStorage.getItem(`project_name_${projectId}`);
  if (savedName && projectNameEl) projectNameEl.textContent = savedName;

  // Drag & Drop listeners on column bodies
  document.querySelectorAll('.kanban-column__body').forEach(body => {
    body.addEventListener('dragover',  onDragOver);
    body.addEventListener('dragleave', onDragLeave);
    body.addEventListener('drop',      onDrop);
  });

  // "New Task" button in the topbar
  document.getElementById('btn-new-task')
    ?.addEventListener('click', () => openCreateModal('todo'));

  // "Add Task" buttons at the bottom of each column
  document.querySelectorAll('.kanban-column__add-btn').forEach(btn => {
    btn.addEventListener('click', () => openCreateModal(btn.dataset.status));
  });

  // Detail modal — close / save / comment
  document.getElementById('modal-detail')
    ?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-detail')) closeDetailModal();
    });
  document.getElementById('btn-close-detail')
    ?.addEventListener('click',  closeDetailModal);
  document.getElementById('btn-cancel-detail')
    ?.addEventListener('click',  closeDetailModal);
  document.getElementById('btn-save-detail')
    ?.addEventListener('click',  handleSaveDetail);
  document.getElementById('btn-post-comment')
    ?.addEventListener('click',  handlePostComment);

  // Ctrl+Enter shortcut to post a comment
  document.getElementById('comment-input')
    ?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePostComment();
    });

  // Sidebar toggle (mobile drawer + desktop collapse)
  const toggleBtn = document.getElementById('btn-sidebar-toggle');
  const sidebar   = document.querySelector('.sidebar');
  const backdrop  = document.getElementById('sidebar-backdrop');
  if (toggleBtn && sidebar) {
    const toggle = () => {
      const open = sidebar.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', String(open));
      if (backdrop) backdrop.hidden = !open;
    };
    toggleBtn.addEventListener('click', toggle);
    backdrop?.addEventListener('click', toggle);
  }

  // Guard: no project selected → redirect to dashboard
  if (!projectId) {
    showToast('No project selected. Redirecting…', 'error');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
    return;
  }

  // Show loading spinners in all three columns
  ['todo', 'in_progress', 'done'].forEach(s => {
    showSpinner(document.getElementById(`tasks-${s}`), 'md');
  });

  // Load tasks and members in parallel — members failure is non-fatal
  try {
    const [tasks, members] = await Promise.all([
      fetchTasks(projectId),
      fetchProjectMembers(projectId).catch(() => []),
    ]);

    _members = members;
    renderBoard(tasks);

  } catch (err) {
    console.error('Board initialization error:', err);

    ['todo', 'in_progress', 'done'].forEach(s => {
      showError(
        document.getElementById(`tasks-${s}`),
        'Could not load tasks. Check your connection and refresh the page.'
      );
    });

    showToast('Failed to load board. Please refresh the page.', 'error');
  }
});
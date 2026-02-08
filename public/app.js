let appData = { columns: [], tasks: [], categories: [] };
let draggedCard = null;

// Load data
async function loadData() {
  const res = await fetch('/api/tasks');
  appData = await res.json();
  populateFilters();
  renderBoard();
}

function populateFilters() {
  const catFilter = document.getElementById('filterCategory');
  const catSelect = document.getElementById('taskCategory');
  const colSelect = document.getElementById('taskColumn');
  
  // Category filter
  catFilter.innerHTML = '<option value="">All Categories</option>';
  appData.categories.forEach(c => {
    catFilter.innerHTML += `<option value="${c}">${c}</option>`;
  });
  
  // Category in form
  catSelect.innerHTML = '';
  appData.categories.forEach(c => {
    catSelect.innerHTML += `<option value="${c}">${c}</option>`;
  });
  
  // Columns in form
  colSelect.innerHTML = '';
  appData.columns.forEach(c => {
    colSelect.innerHTML += `<option value="${c}">${c}</option>`;
  });
}

function getFilteredTasks() {
  const cat = document.getElementById('filterCategory').value;
  const assignee = document.getElementById('filterAssignee').value;
  const priority = document.getElementById('filterPriority').value;
  
  return appData.tasks.filter(t => {
    if (cat && t.category !== cat) return false;
    if (assignee && t.assignee !== assignee) return false;
    if (priority && t.priority !== priority) return false;
    return true;
  });
}

function renderBoard() {
  const board = document.getElementById('board');
  const tasks = getFilteredTasks();
  
  board.innerHTML = '';
  
  appData.columns.forEach(col => {
    const colTasks = tasks.filter(t => t.column === col);
    
    const colEl = document.createElement('div');
    colEl.className = 'column';
    colEl.innerHTML = `
      <div class="column-header">
        <span>${col}</span>
        <span class="column-count">${colTasks.length}</span>
      </div>
      <div class="column-body" data-column="${col}"
           ondragover="handleDragOver(event)"
           ondragleave="handleDragLeave(event)"
           ondrop="handleDrop(event, '${col}')">
        ${colTasks.map(t => renderCard(t)).join('')}
      </div>
    `;
    board.appendChild(colEl);
  });
}

function renderCard(task) {
  const dueTag = task.dueDate ? `<span class="tag due">📅 ${formatDate(task.dueDate)}</span>` : '';
  const assigneeClass = task.assignee.toLowerCase() === 'adam' ? 'assignee-adam' : 'assignee-atticus';
  const commentCount = task.comments?.length ? `<span class="tag">💬 ${task.comments.length}</span>` : '';
  
  return `
    <div class="card" draggable="true" 
         ondragstart="handleDragStart(event, ${task.id})"
         ondragend="handleDragEnd(event)"
         onclick="openModal(${task.id})">
      <div class="card-priority ${task.priority}"></div>
      <div class="card-title">${escapeHtml(task.title)}</div>
      <div class="card-meta">
        <span class="tag ${assigneeClass}">${task.assignee === 'Atticus' ? '🦉' : '👤'} ${task.assignee}</span>
        <span class="tag category">${task.category}</span>
        ${dueTag}
        ${commentCount}
      </div>
    </div>
  `;
}

// Drag & Drop
function handleDragStart(e, taskId) {
  draggedCard = taskId;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function handleDrop(e, column) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  if (draggedCard === null) return;
  
  await fetch(`/api/tasks/${draggedCard}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column })
  });
  
  draggedCard = null;
  await loadData();
}

// Modal
function openModal(taskId) {
  const overlay = document.getElementById('modalOverlay');
  const form = document.getElementById('taskForm');
  const title = document.getElementById('modalTitle');
  const deleteBtn = document.getElementById('btnDelete');
  const commentsSection = document.getElementById('commentsSection');
  
  form.reset();
  document.getElementById('taskId').value = '';
  
  if (taskId) {
    const task = appData.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    title.textContent = 'Edit Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitleInput').value = task.title;
    document.getElementById('taskDesc').value = task.description || '';
    document.getElementById('taskColumn').value = task.column;
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskCategory').value = task.category;
    document.getElementById('taskAssignee').value = task.assignee;
    document.getElementById('taskDue').value = task.dueDate || '';
    deleteBtn.style.display = 'block';
    
    // Show comments
    commentsSection.style.display = 'block';
    renderComments(task);
  } else {
    title.textContent = 'New Task';
    document.getElementById('taskColumn').value = 'To Do';
    deleteBtn.style.display = 'none';
    commentsSection.style.display = 'none';
  }
  
  overlay.classList.add('open');
  setTimeout(() => document.getElementById('taskTitleInput').focus(), 100);
}

function closeModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('modalOverlay').classList.remove('open');
}

async function saveTask(e) {
  e.preventDefault();
  
  const id = document.getElementById('taskId').value;
  const data = {
    title: document.getElementById('taskTitleInput').value,
    description: document.getElementById('taskDesc').value,
    column: document.getElementById('taskColumn').value,
    priority: document.getElementById('taskPriority').value,
    category: document.getElementById('taskCategory').value,
    assignee: document.getElementById('taskAssignee').value,
    dueDate: document.getElementById('taskDue').value || null
  };
  
  if (id) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } else {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
  
  closeModal();
  await loadData();
}

async function deleteTask() {
  const id = document.getElementById('taskId').value;
  if (!id) return;
  if (!confirm('Delete this task?')) return;
  
  await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  closeModal();
  await loadData();
}

// Comments
function renderComments(task) {
  const list = document.getElementById('commentsList');
  list.innerHTML = (task.comments || []).map(c => `
    <div class="comment">
      <div class="comment-author">${c.author === 'Atticus' ? '🦉' : '👤'} ${c.author}</div>
      <div class="comment-text">${escapeHtml(c.text)}</div>
      <div class="comment-time">${new Date(c.createdAt).toLocaleString()}</div>
    </div>
  `).join('') || '<div style="color:var(--text-muted);font-size:13px;">No comments yet</div>';
}

async function addComment() {
  const id = document.getElementById('taskId').value;
  const text = document.getElementById('commentText').value.trim();
  if (!id || !text) return;
  
  await fetch(`/api/tasks/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, author: 'Adam' })
  });
  
  document.getElementById('commentText').value = '';
  await loadData();
  
  // Re-open modal to refresh comments
  const task = appData.tasks.find(t => t.id === parseInt(id));
  if (task) renderComments(task);
}

// Helpers
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'n' && !e.target.closest('input, textarea, select')) {
    e.preventDefault();
    openModal();
  }
});

// Filter listeners
document.getElementById('filterCategory').addEventListener('change', renderBoard);
document.getElementById('filterAssignee').addEventListener('change', renderBoard);
document.getElementById('filterPriority').addEventListener('change', renderBoard);

// Init
loadData();

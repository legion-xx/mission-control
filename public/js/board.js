/* Mission Control v2 - Kanban Board Module */

class KanbanBoard {
    constructor() {
        this.dragDropManager = new utils.DragDropManager();
        this.filters = {
            category: null,
            assignee: null,
            priority: null,
            tag: null
        };
        this.sortBy = 'created'; // created, priority, dueDate
        this.collapsedColumns = utils.loadFromLocal('collapsed-columns', []);
    }

    async render() {
        try {
            const data = window.MissionControl.data;
            const container = document.getElementById('content');
            
            container.innerHTML = this.createBoardHTML();
            this.setupEventListeners();
            this.renderColumns();
            this.setupDragDrop();
            
        } catch (error) {
            console.error('Failed to load board:', error);
            this.renderError();
        }
    }

    createBoardHTML() {
        return `
            <div class="board">
                <header class="board-header">
                    <div class="board-title-section">
                        <h1>Task Board</h1>
                        <div class="board-stats">
                            <span class="stat-item">
                                <span class="stat-value">${this.getTotalTasks()}</span>
                                <span class="stat-label">tasks</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="board-controls">
                        <div class="board-filters">
                            <select id="filter-category" class="form-select">
                                <option value="">All Categories</option>
                                ${this.getCategoryOptions()}
                            </select>
                            
                            <select id="filter-assignee" class="form-select">
                                <option value="">All Assignees</option>
                                ${this.getAssigneeOptions()}
                            </select>
                            
                            <select id="filter-priority" class="form-select">
                                <option value="">All Priorities</option>
                                <option value="high">High Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="low">Low Priority</option>
                            </select>
                            
                            <select id="filter-tag" class="form-select">
                                <option value="">All Tags</option>
                                ${this.getTagOptions()}
                            </select>
                        </div>
                        
                        <div class="board-actions">
                            <select id="sort-by" class="form-select">
                                <option value="created">Sort by Created</option>
                                <option value="priority">Sort by Priority</option>
                                <option value="dueDate">Sort by Due Date</option>
                                <option value="title">Sort by Title</option>
                            </select>
                            
                            <button class="btn btn-secondary" id="clear-filters">
                                Clear Filters
                            </button>
                            
                            <button class="btn" onclick="quickCapture.focus()">
                                ➕ Add Task
                            </button>
                        </div>
                    </div>
                </header>

                <div id="board-container" class="board-container">
                    <!-- Columns will be rendered here -->
                </div>
            </div>
        `;
    }

    renderColumns() {
        const container = document.getElementById('board-container');
        const data = window.MissionControl.data;
        const columns = data.columns || [];
        
        container.innerHTML = columns.map(columnName => 
            this.createColumnHTML(columnName)
        ).join('');
        
        this.renderTasks();
    }

    createColumnHTML(columnName) {
        const tasks = this.getFilteredTasks(columnName);
        const isCollapsed = this.collapsedColumns.includes(columnName);
        
        return `
            <div class="board-column" data-column="${columnName}">
                <div class="board-column-header">
                    <div class="column-title-section">
                        <button class="column-toggle ${isCollapsed ? 'collapsed' : ''}" data-column="${columnName}">
                            ${isCollapsed ? '▶️' : '🔽'}
                        </button>
                        <h3 class="board-column-title">${columnName}</h3>
                        <span class="board-column-count">${tasks.length}</span>
                    </div>
                    
                    <button class="btn-ghost btn-small quick-add-btn" data-column="${columnName}">
                        ➕
                    </button>
                </div>
                
                <div class="task-list ${isCollapsed ? 'collapsed' : ''}" data-column="${columnName}">
                    ${isCollapsed ? '' : this.renderColumnTasks(tasks)}
                </div>
                
                ${!isCollapsed ? `
                <div class="column-footer">
                    <button class="add-task-btn" data-column="${columnName}">
                        ➕ Add task to ${columnName}
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    }

    renderColumnTasks(tasks) {
        if (tasks.length === 0) {
            return `
                <div class="column-empty">
                    <div class="empty-icon">📋</div>
                    <p>No tasks</p>
                </div>
            `;
        }

        const sortedTasks = this.sortTasks(tasks);
        return sortedTasks.map(task => this.createTaskCard(task)).join('');
    }

    createTaskCard(task) {
        const priorityIcon = utils.getPriorityIcon(task.priority);
        const dueDateText = task.dueDate ? utils.formatDate(task.dueDate) : '';
        const isOverdue = task.dueDate && utils.isOverdue(task.dueDate);
        const overdueClass = isOverdue ? 'task-overdue' : '';
        
        const tags = task.tags ? task.tags.map(tag => {
            const color = utils.getTagColor(tag, window.MissionControl.data.tags);
            return `<span class="tag ${color ? 'tag-colored' : ''}" ${color ? `style="--tag-color: ${color}"` : ''}>${tag}</span>`;
        }).join('') : '';

        return `
            <div class="task-card ${overdueClass}" data-task-id="${task.id}">
                <div class="task-card-header">
                    <span class="task-priority ${utils.getPriorityClass(task.priority)}">${priorityIcon}</span>
                    <div class="task-actions-menu">
                        <button class="btn-ghost btn-small task-menu-btn" data-task-id="${task.id}">⋮</button>
                        <div class="task-menu" data-task-id="${task.id}">
                            <button class="menu-item" onclick="board.editTask(${task.id})">✏️ Edit</button>
                            <button class="menu-item" onclick="board.duplicateTask(${task.id})">📋 Duplicate</button>
                            <button class="menu-item" onclick="board.addComment(${task.id})">💬 Comment</button>
                            <button class="menu-item danger" onclick="board.deleteTask(${task.id})">🗑️ Delete</button>
                        </div>
                    </div>
                </div>
                
                <div class="task-title">${task.title}</div>
                
                ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                
                ${tags ? `<div class="task-tags">${tags}</div>` : ''}
                
                <div class="task-meta">
                    <div class="task-meta-left">
                        <span class="task-assignee">👤 ${task.assignee}</span>
                        <span class="task-category">${task.category}</span>
                    </div>
                    
                    <div class="task-meta-right">
                        ${task.comments?.length ? `<span class="comment-count">💬 ${task.comments.length}</span>` : ''}
                        ${dueDateText ? `<span class="task-due-date ${isOverdue ? 'overdue' : ''}">📅 ${dueDateText}</span>` : ''}
                    </div>
                </div>
                
                ${task.attachedNotes?.length ? `
                <div class="task-notes">
                    <span class="notes-indicator">📝 ${task.attachedNotes.length} notes</span>
                </div>
                ` : ''}
            </div>
        `;
    }

    setupEventListeners() {
        // Filter controls
        document.getElementById('filter-category').addEventListener('change', (e) => {
            this.filters.category = e.target.value || null;
            this.applyFilters();
        });

        document.getElementById('filter-assignee').addEventListener('change', (e) => {
            this.filters.assignee = e.target.value || null;
            this.applyFilters();
        });

        document.getElementById('filter-priority').addEventListener('change', (e) => {
            this.filters.priority = e.target.value || null;
            this.applyFilters();
        });

        document.getElementById('filter-tag').addEventListener('change', (e) => {
            this.filters.tag = e.target.value || null;
            this.applyFilters();
        });

        // Sort control
        document.getElementById('sort-by').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.renderColumns();
        });

        // Clear filters
        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Column toggles
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('column-toggle')) {
                this.toggleColumn(e.target.dataset.column);
            }
        });

        // Quick add buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-add-btn') || e.target.classList.contains('add-task-btn')) {
                this.showQuickAdd(e.target.dataset.column);
            }
        });

        // Task menu handling
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('task-menu-btn')) {
                this.toggleTaskMenu(e.target.dataset.taskId);
            }
        });

        // Close menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.task-actions-menu')) {
                this.closeAllTaskMenus();
            }
        });

        // Task card clicks
        document.addEventListener('click', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (taskCard && !e.target.closest('.task-actions-menu') && !e.target.closest('button')) {
                this.viewTask(parseInt(taskCard.dataset.taskId));
            }
        });
    }

    setupDragDrop() {
        // Make task cards draggable
        document.querySelectorAll('.task-card').forEach(card => {
            this.dragDropManager.makeDraggable(card, this.onTaskDrop.bind(this));
        });

        // Make columns drop zones
        document.querySelectorAll('.task-list').forEach(list => {
            this.dragDropManager.makeDropZone(list, this.onTaskDrop.bind(this));
        });
    }

    async onTaskDrop(draggedElement, dropZone, afterElement) {
        const taskId = parseInt(draggedElement.dataset.taskId);
        const newColumn = dropZone.dataset.column;
        
        try {
            await utils.API.put(`/tasks/${taskId}`, { column: newColumn });
            utils.showToast('Task moved successfully', 'success');
            
            // Refresh data and re-render
            await utils.loadData();
            this.renderColumns();
            this.setupDragDrop();
            
        } catch (error) {
            console.error('Failed to move task:', error);
            utils.showToast('Failed to move task', 'error');
            
            // Revert the visual change
            this.renderColumns();
            this.setupDragDrop();
        }
    }

    getFilteredTasks(column) {
        const allTasks = window.MissionControl.data.tasks || [];
        
        return allTasks.filter(task => {
            // Column filter
            if (task.column !== column) return false;
            
            // Category filter
            if (this.filters.category && task.category !== this.filters.category) return false;
            
            // Assignee filter
            if (this.filters.assignee && task.assignee !== this.filters.assignee) return false;
            
            // Priority filter
            if (this.filters.priority && task.priority !== this.filters.priority) return false;
            
            // Tag filter
            if (this.filters.tag && (!task.tags || !task.tags.includes(this.filters.tag))) return false;
            
            return true;
        });
    }

    sortTasks(tasks) {
        return [...tasks].sort((a, b) => {
            switch (this.sortBy) {
                case 'priority':
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                
                case 'dueDate':
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate) - new Date(b.dueDate);
                
                case 'title':
                    return a.title.localeCompare(b.title);
                
                case 'created':
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });
    }

    applyFilters() {
        this.renderColumns();
        this.setupDragDrop();
    }

    clearFilters() {
        this.filters = { category: null, assignee: null, priority: null, tag: null };
        
        // Reset form elements
        document.getElementById('filter-category').value = '';
        document.getElementById('filter-assignee').value = '';
        document.getElementById('filter-priority').value = '';
        document.getElementById('filter-tag').value = '';
        
        this.applyFilters();
    }

    toggleColumn(columnName) {
        const index = this.collapsedColumns.indexOf(columnName);
        
        if (index > -1) {
            this.collapsedColumns.splice(index, 1);
        } else {
            this.collapsedColumns.push(columnName);
        }
        
        utils.saveToLocal('collapsed-columns', this.collapsedColumns);
        this.renderColumns();
        this.setupDragDrop();
    }

    showQuickAdd(column) {
        const input = document.getElementById('quick-input');
        input.focus();
        input.placeholder = `Add task to ${column}...`;
        
        // Store the target column for the quick capture
        window.quickCaptureTargetColumn = column;
    }

    toggleTaskMenu(taskId) {
        const menu = document.querySelector(`[data-task-id="${taskId}"].task-menu`);
        if (menu) {
            menu.classList.toggle('show');
        }
    }

    closeAllTaskMenus() {
        document.querySelectorAll('.task-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }

    async editTask(taskId) {
        // This would open a task edit modal
        // For now, we'll use a simple prompt
        const task = window.MissionControl.data.tasks.find(t => t.id === taskId);
        if (!task) return;

        const newTitle = prompt('Edit task title:', task.title);
        if (newTitle && newTitle !== task.title) {
            try {
                await utils.API.put(`/tasks/${taskId}`, { title: newTitle });
                utils.showToast('Task updated', 'success');
                await this.refresh();
            } catch (error) {
                utils.showToast('Failed to update task', 'error');
            }
        }
    }

    async duplicateTask(taskId) {
        const task = window.MissionControl.data.tasks.find(t => t.id === taskId);
        if (!task) return;

        try {
            await utils.API.post('/tasks', {
                ...task,
                title: task.title + ' (Copy)',
                id: undefined,
                createdAt: undefined,
                updatedAt: undefined,
                comments: []
            });
            
            utils.showToast('Task duplicated', 'success');
            await this.refresh();
        } catch (error) {
            utils.showToast('Failed to duplicate task', 'error');
        }
    }

    async addComment(taskId) {
        const comment = prompt('Add a comment:');
        if (!comment) return;

        try {
            await utils.API.post(`/tasks/${taskId}/comments`, {
                text: comment,
                author: 'User'
            });
            
            utils.showToast('Comment added', 'success');
            await this.refresh();
        } catch (error) {
            utils.showToast('Failed to add comment', 'error');
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;

        try {
            await utils.API.delete(`/tasks/${taskId}`);
            utils.showToast('Task deleted', 'success');
            await this.refresh();
        } catch (error) {
            utils.showToast('Failed to delete task', 'error');
        }
    }

    viewTask(taskId) {
        // This would open a task detail modal
        const task = window.MissionControl.data.tasks.find(t => t.id === taskId);
        if (task) {
            console.log('View task:', task);
            // TODO: Implement task detail modal
        }
    }

    getTotalTasks() {
        const tasks = window.MissionControl.data.tasks || [];
        return tasks.filter(task => task.column !== 'Done').length;
    }

    getCategoryOptions() {
        const categories = window.MissionControl.data.categories || [];
        return categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    getAssigneeOptions() {
        const tasks = window.MissionControl.data.tasks || [];
        const assignees = [...new Set(tasks.map(t => t.assignee))];
        return assignees.map(assignee => `<option value="${assignee}">${assignee}</option>`).join('');
    }

    getTagOptions() {
        const tags = window.MissionControl.data.tags || [];
        return tags.map(tag => `<option value="${tag.name}">${tag.name}</option>`).join('');
    }

    async refresh() {
        await utils.loadData();
        this.renderColumns();
        this.setupDragDrop();
    }

    renderError() {
        const container = document.getElementById('content');
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h2>Failed to load board</h2>
                <p>Unable to fetch your tasks. Please try refreshing the page.</p>
                <button class="btn" onclick="location.reload()">Refresh Page</button>
            </div>
        `;
    }

    renderTasks() {
        // Re-render task cards in existing columns
        document.querySelectorAll('.task-list').forEach(list => {
            if (!list.classList.contains('collapsed')) {
                const column = list.dataset.column;
                const tasks = this.getFilteredTasks(column);
                list.innerHTML = this.renderColumnTasks(tasks);
            }
        });
        
        this.setupDragDrop();
    }
}

// Export for global use
window.KanbanBoard = KanbanBoard;
window.board = new KanbanBoard();
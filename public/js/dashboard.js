/* Mission Control v2 - Dashboard Module */

class Dashboard {
    constructor() {
        this.data = null;
        this.refreshInterval = null;
    }

    async render() {
        try {
            // Get dashboard data
            const dashboardData = await utils.API.get('/today');
            this.data = dashboardData;
            
            const container = document.getElementById('content');
            container.innerHTML = this.createDashboardHTML();
            
            this.setupEventListeners();
            this.startAutoRefresh();
            
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.renderError();
        }
    }

    createDashboardHTML() {
        const stats = this.calculateStats();
        
        return `
            <div class="dashboard">
                <header class="dashboard-header">
                    <h1>Dashboard</h1>
                    <p>Welcome back! Here's what's happening today.</p>
                </header>

                <!-- Quick Stats -->
                <div class="dashboard-grid">
                    <div class="card stat-card">
                        <div class="stat-value">${stats.todayCount}</div>
                        <div class="stat-label">Due Today</div>
                    </div>
                    <div class="card stat-card">
                        <div class="stat-value ${stats.overdueCount > 0 ? 'priority-high' : ''}">${stats.overdueCount}</div>
                        <div class="stat-label">Overdue</div>
                    </div>
                    <div class="card stat-card">
                        <div class="stat-value">${stats.upcomingCount}</div>
                        <div class="stat-label">This Week</div>
                    </div>
                    <div class="card stat-card">
                        <div class="stat-value priority-medium">${stats.inProgressCount}</div>
                        <div class="stat-label">In Progress</div>
                    </div>
                </div>

                <div class="dashboard-content">
                    <!-- Today's Tasks -->
                    <div class="dashboard-section">
                        <div class="card">
                            <div class="card-header">
                                <h2 class="card-title">Today's Tasks</h2>
                                <button class="btn btn-small" onclick="window.app.navigateTo('board')">View Board</button>
                            </div>
                            <div class="today-tasks">
                                ${this.renderTodayTasks()}
                            </div>
                        </div>
                    </div>

                    <!-- Overdue Tasks -->
                    ${stats.overdueCount > 0 ? `
                    <div class="dashboard-section">
                        <div class="card">
                            <div class="card-header">
                                <h2 class="card-title priority-high">Overdue Tasks</h2>
                            </div>
                            <div class="overdue-tasks">
                                ${this.renderOverdueTasks()}
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- Upcoming Deadlines -->
                    <div class="dashboard-section">
                        <div class="card">
                            <div class="card-header">
                                <h2 class="card-title">Upcoming (Next 7 Days)</h2>
                            </div>
                            <div class="upcoming-tasks">
                                ${this.renderUpcomingTasks()}
                            </div>
                        </div>
                    </div>

                    <!-- Recent Activity -->
                    <div class="dashboard-section">
                        <div class="card">
                            <div class="card-header">
                                <h2 class="card-title">Recent Activity</h2>
                                <button class="btn btn-small" onclick="window.app.navigateTo('activity')">View All</button>
                            </div>
                            <div class="activity-feed">
                                ${this.renderRecentActivity()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    calculateStats() {
        const allTasks = window.MissionControl.data.tasks || [];
        
        return {
            todayCount: this.data?.todayTasks?.length || 0,
            overdueCount: this.data?.overdueTasks?.length || 0,
            upcomingCount: this.data?.upcomingTasks?.length || 0,
            inProgressCount: allTasks.filter(task => task.column === 'In Progress').length,
            completedThisWeek: this.getCompletedThisWeek(allTasks),
            totalTasks: allTasks.length
        };
    }

    getCompletedThisWeek(tasks) {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        return tasks.filter(task => {
            return task.column === 'Done' && 
                   task.updatedAt && 
                   new Date(task.updatedAt) > oneWeekAgo;
        }).length;
    }

    renderTodayTasks() {
        if (!this.data?.todayTasks?.length) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">🎯</div>
                    <p>No tasks due today!</p>
                    <button class="btn btn-small" onclick="quickCapture.focus()">Add Task</button>
                </div>
            `;
        }

        return this.data.todayTasks.map(task => this.renderTaskItem(task)).join('');
    }

    renderOverdueTasks() {
        if (!this.data?.overdueTasks?.length) {
            return '<div class="empty-state"><p>No overdue tasks</p></div>';
        }

        return this.data.overdueTasks.map(task => this.renderTaskItem(task, true)).join('');
    }

    renderUpcomingTasks() {
        if (!this.data?.upcomingTasks?.length) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <p>No upcoming deadlines</p>
                </div>
            `;
        }

        return this.data.upcomingTasks
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .map(task => this.renderTaskItem(task))
            .join('');
    }

    renderTaskItem(task, isOverdue = false) {
        const dueDateText = task.dueDate ? utils.formatDate(task.dueDate) : '';
        const priorityIcon = utils.getPriorityIcon(task.priority);
        const overdueClass = isOverdue ? 'task-overdue' : '';
        
        const tags = task.tags ? task.tags.map(tag => {
            const color = utils.getTagColor(tag, window.MissionControl.data.tags);
            return `<span class="tag ${color ? 'tag-colored' : ''}" ${color ? `style="--tag-color: ${color}"` : ''}>${tag}</span>`;
        }).join('') : '';

        return `
            <div class="dashboard-task-item ${overdueClass}" data-task-id="${task.id}">
                <div class="task-checkbox" data-task-id="${task.id}">
                    <div class="checkbox"></div>
                </div>
                <div class="task-info">
                    <div class="task-header">
                        <span class="task-priority">${priorityIcon}</span>
                        <span class="task-title">${task.title}</span>
                        <span class="task-category">${task.category}</span>
                    </div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                    <div class="task-meta">
                        <span class="task-assignee">👤 ${task.assignee}</span>
                        ${dueDateText ? `<span class="task-due-date ${isOverdue ? 'overdue' : ''}">📅 ${dueDateText}</span>` : ''}
                        <span class="task-column">📋 ${task.column}</span>
                    </div>
                    ${tags ? `<div class="task-tags">${tags}</div>` : ''}
                </div>
                <div class="task-actions">
                    <button class="btn-ghost btn-small" onclick="dashboard.editTask(${task.id})">
                        ✏️
                    </button>
                </div>
            </div>
        `;
    }

    renderRecentActivity() {
        if (!this.data?.recentActivity?.length) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📈</div>
                    <p>No recent activity</p>
                </div>
            `;
        }

        return this.data.recentActivity.map(activity => {
            const icon = this.getActivityIcon(activity.type);
            const timeAgo = utils.formatDate(activity.timestamp, { relative: true });
            
            return `
                <div class="activity-item">
                    <div class="activity-icon">${icon}</div>
                    <div class="activity-content">
                        <div class="activity-description">${activity.description}</div>
                        <div class="activity-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    getActivityIcon(type) {
        const icons = {
            'task_created': '✅',
            'task_updated': '📝',
            'task_moved': '➡️',
            'task_completed': '🎉',
            'task_deleted': '🗑️',
            'note_created': '📝',
            'note_updated': '✏️',
            'note_deleted': '🗑️',
            'link_created': '🔗',
            'link_updated': '🔗',
            'link_deleted': '🗑️',
            'comment_added': '💬'
        };
        
        return icons[type] || '📌';
    }

    setupEventListeners() {
        // Task checkboxes
        document.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                const taskId = parseInt(e.target.dataset.taskId || e.target.closest('.task-checkbox').dataset.taskId);
                this.toggleTaskComplete(taskId);
            });
        });

        // Task items click
        document.querySelectorAll('.dashboard-task-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.task-checkbox') || e.target.closest('.task-actions')) {
                    return; // Don't navigate if clicking checkbox or actions
                }
                
                const taskId = parseInt(item.dataset.taskId);
                this.viewTask(taskId);
            });
        });
    }

    async toggleTaskComplete(taskId) {
        try {
            const task = window.MissionControl.data.tasks.find(t => t.id === taskId);
            if (!task) return;

            const newColumn = task.column === 'Done' ? 'To Do' : 'Done';
            
            await utils.API.put(`/tasks/${taskId}`, {
                column: newColumn
            });

            utils.showToast(
                newColumn === 'Done' ? 'Task completed!' : 'Task reopened',
                'success'
            );

            // Refresh dashboard
            await this.refresh();
            
        } catch (error) {
            console.error('Failed to toggle task:', error);
            utils.showToast('Failed to update task', 'error');
        }
    }

    viewTask(taskId) {
        // Navigate to board and highlight the task
        window.app.navigateTo('board');
        
        setTimeout(() => {
            const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskElement) {
                taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                taskElement.classList.add('highlight');
                setTimeout(() => taskElement.classList.remove('highlight'), 2000);
            }
        }, 500);
    }

    async editTask(taskId) {
        // This could open a modal or navigate to edit view
        // For now, just navigate to the board
        this.viewTask(taskId);
    }

    async refresh() {
        try {
            await utils.loadData();
            await this.render();
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
        }
    }

    startAutoRefresh() {
        // Refresh dashboard every 5 minutes
        this.refreshInterval = setInterval(() => {
            this.refresh();
        }, 5 * 60 * 1000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    destroy() {
        this.stopAutoRefresh();
    }

    renderError() {
        const container = document.getElementById('content');
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h2>Failed to load dashboard</h2>
                <p>Unable to fetch your data. Please try refreshing the page.</p>
                <button class="btn" onclick="location.reload()">Refresh Page</button>
            </div>
        `;
    }
}

// Export for global use
window.Dashboard = Dashboard;
window.dashboard = new Dashboard();
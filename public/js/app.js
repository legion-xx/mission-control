/* Mission Control v2 - Main Application Controller */

class MissionControlApp {
    constructor() {
        this.currentView = 'dashboard';
        this.views = {
            dashboard: window.dashboardManager,
            board: window.kanbanBoard,
            notes: window.notesManager,
            links: window.linksManager,
            focus: null, // TODO: Implement focus mode
            activity: null, // TODO: Implement activity view
            settings: null // TODO: Implement settings
        };
        
        this.init();
    }

    async init() {
        try {
            // Load initial data
            await this.loadData();
            
            // Initialize theme
            this.initTheme();
            
            // Setup navigation
            this.setupNavigation();
            
            // Setup global shortcuts
            this.setupShortcuts();
            
            // Setup quick capture
            this.setupQuickCapture();
            
            // Setup global search
            this.setupGlobalSearch();
            
            // Load initial view
            await this.navigateToView(this.getInitialView());
            
            console.log('Mission Control v2 initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Mission Control:', error);
            this.showErrorState();
        }
    }

    async loadData() {
        try {
            showLoading();
            const data = await API.get('/data');
            window.MissionControl.data = data;
            window.MissionControl.settings = data.settings || { theme: 'dark' };
        } catch (error) {
            console.error('Failed to load data:', error);
            throw error;
        } finally {
            hideLoading();
        }
    }

    getInitialView() {
        // Check URL hash
        const hash = window.location.hash.substring(1);
        if (hash && this.views[hash]) {
            return hash;
        }
        
        // Check settings
        const defaultView = window.MissionControl.settings.defaultView;
        if (defaultView && this.views[defaultView]) {
            return defaultView;
        }
        
        return 'dashboard';
    }

    initTheme() {
        const theme = window.MissionControl.settings.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme toggle button
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('.theme-icon');
            if (icon) {
                icon.textContent = theme === 'dark' ? '🌙' : '☀️';
            }
            
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    }

    async toggleTheme() {
        const currentTheme = window.MissionControl.settings.theme;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Update settings
        window.MissionControl.settings.theme = newTheme;
        
        try {
            await API.put('/settings', { theme: newTheme });
            
            // Update UI
            document.documentElement.setAttribute('data-theme', newTheme);
            
            const icon = document.querySelector('#theme-toggle .theme-icon');
            if (icon) {
                icon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
            }
            
        } catch (error) {
            console.error('Failed to save theme setting:', error);
            showToast('Failed to save theme preference', 'error');
        }
    }

    setupNavigation() {
        // Desktop sidebar navigation
        document.querySelectorAll('.sidebar .nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.navigateToView(view);
            });
        });

        // Mobile bottom navigation
        document.querySelectorAll('.bottom-nav .bottom-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.navigateToView(view);
            });
        });

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            const view = window.location.hash.substring(1) || this.getInitialView();
            this.navigateToView(view, false);
        });
    }

    async navigateToView(viewName, updateHistory = true) {
        if (!this.views.hasOwnProperty(viewName)) {
            console.warn(`Unknown view: ${viewName}`);
            return;
        }

        try {
            // Update current view
            this.currentView = viewName;
            
            // Update URL if needed
            if (updateHistory) {
                history.pushState(null, '', `#${viewName}`);
            }
            
            // Update navigation active states
            this.updateNavigationState(viewName);
            
            // Render the view
            await this.renderView(viewName);
            
        } catch (error) {
            console.error(`Failed to navigate to ${viewName}:`, error);
            showToast(`Failed to load ${viewName}`, 'error');
        }
    }

    updateNavigationState(activeView) {
        // Update desktop sidebar
        document.querySelectorAll('.sidebar .nav-item').forEach(item => {
            if (item.dataset.view === activeView) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update mobile bottom nav
        document.querySelectorAll('.bottom-nav .bottom-nav-item').forEach(item => {
            if (item.dataset.view === activeView) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    async renderView(viewName) {
        const viewManager = this.views[viewName];
        
        if (!viewManager) {
            this.renderPlaceholder(viewName);
            return;
        }

        // Render the view
        await viewManager.render();
    }

    renderPlaceholder(viewName) {
        const container = document.getElementById('content');
        const placeholders = {
            focus: {
                icon: '🎯',
                title: 'Focus Mode',
                subtitle: 'Distraction-free work environment',
                description: 'Coming soon - a clean interface for deep work sessions'
            },
            activity: {
                icon: '📈',
                title: 'Activity Feed',
                subtitle: 'Track your productivity',
                description: 'Coming soon - detailed activity logging and analytics'
            },
            settings: {
                icon: '⚙️',
                title: 'Settings',
                subtitle: 'Customize your experience',
                description: 'Coming soon - preferences, integrations, and customization'
            }
        };

        const placeholder = placeholders[viewName];
        if (!placeholder) return;

        container.innerHTML = `
            <div class="placeholder-view">
                <div class="placeholder-icon">${placeholder.icon}</div>
                <h1>${placeholder.title}</h1>
                <p class="placeholder-subtitle">${placeholder.subtitle}</p>
                <p class="placeholder-description">${placeholder.description}</p>
                <button class="btn btn-primary" onclick="app.navigateToView('dashboard')">
                    Back to Dashboard
                </button>
            </div>
        `;
    }

    setupShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Global shortcuts
            if (e.metaKey || e.ctrlKey) {
                switch (e.key) {
                    case 'k':
                        e.preventDefault();
                        this.openGlobalSearch();
                        break;
                    case 'n':
                        e.preventDefault();
                        this.showQuickCapture();
                        break;
                    case '1':
                        e.preventDefault();
                        this.navigateToView('dashboard');
                        break;
                    case '2':
                        e.preventDefault();
                        this.navigateToView('board');
                        break;
                    case '3':
                        e.preventDefault();
                        this.navigateToView('notes');
                        break;
                    case '4':
                        e.preventDefault();
                        this.navigateToView('links');
                        break;
                }
            }
            
            // ESC key handling
            if (e.key === 'Escape') {
                // Close any open modals
                const activeModal = document.querySelector('.modal:not(.hidden)');
                if (activeModal) {
                    utils.hideAllModals();
                    return;
                }
                
                // Hide quick capture
                this.hideQuickCapture();
                
                // Close global search
                this.closeGlobalSearch();
            }
        });
    }

    setupQuickCapture() {
        const quickCapture = document.getElementById('quick-capture');
        const quickInput = document.getElementById('quick-input');
        const typeButtons = document.querySelectorAll('.capture-type');
        
        let currentType = 'task';
        let isVisible = false;

        // Type selection
        typeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                typeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentType = btn.dataset.type;
                
                // Update placeholder
                const placeholders = {
                    task: 'Add task... (try: "Fix bug #urgent !high tomorrow")',
                    note: 'Quick note...',
                    link: 'Save link... (paste URL)'
                };
                quickInput.placeholder = placeholders[currentType];
            });
        });

        // Input handling
        quickInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const text = quickInput.value.trim();
                if (text) {
                    await this.processQuickCapture(text, currentType);
                    quickInput.value = '';
                    this.hideQuickCapture();
                }
            }
        });

        // Show/hide quick capture
        this.showQuickCapture = () => {
            if (!isVisible) {
                quickCapture.classList.add('active');
                quickInput.focus();
                isVisible = true;
            }
        };

        this.hideQuickCapture = () => {
            if (isVisible) {
                quickCapture.classList.remove('active');
                quickInput.blur();
                isVisible = false;
            }
        };

        // Global shortcut (already handled in setupShortcuts)
    }

    async processQuickCapture(text, type) {
        try {
            showLoading();
            const result = await API.post('/quick-capture', { text, type });
            
            // Show success message with type-specific text
            const messages = {
                task: 'Task created successfully!',
                note: 'Note saved!',
                link: 'Link bookmarked!'
            };
            showToast(messages[type], 'success');
            
            // Refresh current view if relevant
            if (
                (type === 'task' && this.currentView === 'board') ||
                (type === 'note' && this.currentView === 'notes') ||
                (type === 'link' && this.currentView === 'links') ||
                this.currentView === 'dashboard'
            ) {
                await this.refreshCurrentView();
            }
            
        } catch (error) {
            console.error('Quick capture failed:', error);
            showToast('Failed to save. Try again.', 'error');
        } finally {
            hideLoading();
        }
    }

    async refreshCurrentView() {
        try {
            await this.loadData(); // Reload global data
            await this.renderView(this.currentView);
        } catch (error) {
            console.error('Failed to refresh view:', error);
        }
    }

    setupGlobalSearch() {
        // Global search is handled by search.js
        // We just need to provide the open/close methods
        
        this.openGlobalSearch = () => {
            if (window.globalSearch) {
                window.globalSearch.show();
            }
        };

        this.closeGlobalSearch = () => {
            if (window.globalSearch) {
                window.globalSearch.hide();
            }
        };
    }

    showErrorState() {
        const container = document.getElementById('content');
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h2>Failed to start Mission Control</h2>
                <p>Please refresh the page to try again</p>
                <button class="btn btn-primary" onclick="window.location.reload()">
                    Refresh Page
                </button>
            </div>
        `;
    }

    // Public API methods for other modules
    async reloadData() {
        await this.loadData();
        await this.refreshCurrentView();
    }

    getCurrentView() {
        return this.currentView;
    }

    isViewActive(viewName) {
        return this.currentView === viewName;
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MissionControlApp();
});

// Handle page visibility for potential background sync
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.app) {
        // Page became visible - optionally refresh data
        // window.app.reloadData();
    }
});
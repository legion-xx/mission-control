/* Mission Control v2 - Utility Functions */

// Global state
window.MissionControl = {
    data: {},
    currentView: 'dashboard',
    settings: { theme: 'dark' }
};

// API utilities
class API {
    static async request(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options,
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            showToast('Request failed: ' + error.message, 'error');
            throw error;
        }
    }

    static async get(endpoint) {
        return this.request(endpoint);
    }

    static async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: data,
        });
    }

    static async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data,
        });
    }

    static async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }
}

// Data management
async function loadData() {
    try {
        showLoading(true);
        const data = await API.get('/data');
        window.MissionControl.data = data;
        window.MissionControl.settings = data.settings || { theme: 'dark' };
        applyTheme(window.MissionControl.settings.theme);
        return data;
    } catch (error) {
        console.error('Failed to load data:', error);
        showToast('Failed to load data', 'error');
    } finally {
        showLoading(false);
    }
}

// Theme management
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    window.MissionControl.settings.theme = theme;
    
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
    
    // Save to backend
    API.put('/settings', { theme }).catch(console.error);
}

function toggleTheme() {
    const currentTheme = window.MissionControl.settings.theme;
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// Toast notifications
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 200);
    }, duration);
}

// Loading indicator
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.toggle('hidden', !show);
    }
}

// Date formatting utilities
function formatDate(dateString, options = {}) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (options.relative && diffDays < 7) {
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        return `${diffDays} days ago`;
    }
    
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        ...options
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function isOverdue(dateString) {
    if (!dateString) return false;
    
    const dueDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(23, 59, 59, 999);
    
    return dueDate < today;
}

// Drag and drop utilities
class DragDropManager {
    constructor() {
        this.draggedElement = null;
        this.placeholder = null;
        this.onDrop = null;
    }
    
    makeDraggable(element, onDropCallback) {
        element.draggable = true;
        this.onDrop = onDropCallback;
        
        element.addEventListener('dragstart', (e) => {
            this.draggedElement = element;
            element.classList.add('dragging');
            
            // Create placeholder
            this.placeholder = document.createElement('div');
            this.placeholder.className = 'drag-placeholder';
            this.placeholder.style.height = element.offsetHeight + 'px';
            this.placeholder.style.background = 'var(--border-color)';
            this.placeholder.style.border = '2px dashed var(--accent-primary)';
            this.placeholder.style.borderRadius = 'var(--border-radius)';
            this.placeholder.style.margin = '8px 0';
        });
        
        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
            if (this.placeholder && this.placeholder.parentNode) {
                this.placeholder.parentNode.removeChild(this.placeholder);
            }
            this.draggedElement = null;
        });
    }
    
    makeDropZone(element, onDropCallback) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            if (this.draggedElement && this.placeholder) {
                const afterElement = this.getDragAfterElement(element, e.clientY);
                
                if (afterElement == null) {
                    element.appendChild(this.placeholder);
                } else {
                    element.insertBefore(this.placeholder, afterElement);
                }
            }
        });
        
        element.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (this.draggedElement && this.placeholder && onDropCallback) {
                const afterElement = this.placeholder.nextSibling;
                onDropCallback(this.draggedElement, element, afterElement);
            }
        });
    }
    
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}

// Tag utilities
function createTagElement(tagName, color = null) {
    const tag = document.createElement('span');
    tag.className = color ? 'tag tag-colored' : 'tag';
    tag.textContent = tagName;
    
    if (color) {
        tag.style.setProperty('--tag-color', color);
    }
    
    return tag;
}

function getTagColor(tagName, tags = []) {
    const tag = tags.find(t => t.name === tagName);
    return tag ? tag.color : null;
}

// Priority utilities
function getPriorityClass(priority) {
    return `priority-${priority}`;
}

function getPriorityIcon(priority) {
    const icons = {
        high: '🔴',
        medium: '🟡',
        low: '🟢'
    };
    return icons[priority] || '⚫';
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Global search (Cmd/Ctrl + K)
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            showSearchModal();
        }
        
        // Close modal (Escape)
        if (e.key === 'Escape') {
            closeModals();
        }
        
        // Focus quick capture (/)
        if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            document.getElementById('quick-input').focus();
        }
    });
}

// Modal utilities
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Focus first input
        const firstInput = modal.querySelector('input, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function closeModals() {
    document.querySelectorAll('.modal.show').forEach(modal => {
        modal.classList.remove('show');
    });
    document.body.style.overflow = '';
}

// Local storage utilities
function saveToLocal(key, data) {
    try {
        localStorage.setItem(`mission-control-${key}`, JSON.stringify(data));
    } catch (error) {
        console.warn('Failed to save to localStorage:', error);
    }
}

function loadFromLocal(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(`mission-control-${key}`);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.warn('Failed to load from localStorage:', error);
        return defaultValue;
    }
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle utility
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// URL utilities
function updateURL(view, params = {}) {
    const url = new URL(window.location);
    url.hash = view;
    
    Object.keys(params).forEach(key => {
        if (params[key] !== null) {
            url.searchParams.set(key, params[key]);
        } else {
            url.searchParams.delete(key);
        }
    });
    
    history.pushState({ view, params }, '', url);
}

function getCurrentView() {
    const hash = window.location.hash.substring(1);
    return hash || 'dashboard';
}

// Initialize utilities
function initializeUtils() {
    setupKeyboardShortcuts();
    
    // Theme toggle setup
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    
    // Modal backdrop clicks
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

// Export utilities for use in other modules
window.utils = {
    API,
    loadData,
    applyTheme,
    toggleTheme,
    showToast,
    showLoading,
    formatDate,
    formatDateTime,
    isOverdue,
    DragDropManager,
    createTagElement,
    getTagColor,
    getPriorityClass,
    getPriorityIcon,
    showModal,
    closeModal,
    closeModals,
    saveToLocal,
    loadFromLocal,
    debounce,
    throttle,
    updateURL,
    getCurrentView,
    initializeUtils
};
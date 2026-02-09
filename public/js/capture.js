/* Mission Control v2 - Quick Capture Module */

class QuickCapture {
    constructor() {
        this.input = document.getElementById('quick-input');
        this.typeButtons = document.querySelectorAll('.capture-type');
        this.currentType = 'task';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updatePlaceholder();
    }

    setupEventListeners() {
        // Input handling
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleCapture();
            }
        });

        this.input.addEventListener('input', () => {
            this.detectType();
        });

        // Type button handling
        this.typeButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.setType(button.dataset.type);
            });
        });

        // Auto-detect URLs
        this.input.addEventListener('paste', (e) => {
            setTimeout(() => {
                const text = this.input.value.trim();
                if (this.isURL(text)) {
                    this.setType('link');
                }
            }, 10);
        });
    }

    detectType() {
        const text = this.input.value.trim();
        
        if (this.isURL(text)) {
            this.setType('link');
        } else if (text.includes('\n') || text.length > 100) {
            this.setType('note');
        } else if (this.hasTaskKeywords(text)) {
            this.setType('task');
        }
    }

    isURL(text) {
        try {
            new URL(text);
            return true;
        } catch {
            return text.match(/^(https?:\/\/|www\.)/i) !== null;
        }
    }

    hasTaskKeywords(text) {
        const taskKeywords = [
            'todo', 'task', 'do', 'call', 'email', 'meeting', 
            'deadline', 'due', 'tomorrow', 'today', '!high', '!medium', '!low',
            '#', 'remind', 'schedule'
        ];
        
        const lowerText = text.toLowerCase();
        return taskKeywords.some(keyword => lowerText.includes(keyword));
    }

    setType(type) {
        this.currentType = type;
        
        // Update active button
        this.typeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        
        this.updatePlaceholder();
    }

    updatePlaceholder() {
        const placeholders = {
            task: 'Add task: "Call John tomorrow #work !high"',
            note: 'Add note: "Meeting notes from today..."',
            link: 'Add link: "https://example.com"'
        };
        
        this.input.placeholder = placeholders[this.currentType] || 'Quick capture...';
    }

    async handleCapture() {
        const text = this.input.value.trim();
        if (!text) return;

        try {
            utils.showLoading(true);
            
            let result;
            switch (this.currentType) {
                case 'task':
                    result = await this.captureTask(text);
                    break;
                case 'note':
                    result = await this.captureNote(text);
                    break;
                case 'link':
                    result = await this.captureLink(text);
                    break;
            }

            if (result) {
                this.input.value = '';
                this.showSuccessAnimation();
                utils.showToast(`${this.currentType.charAt(0).toUpperCase() + this.currentType.slice(1)} captured successfully!`, 'success');
                
                // Refresh current view if relevant
                if (window.currentViewManager && window.currentViewManager.refresh) {
                    window.currentViewManager.refresh();
                }
                
                // Reload data to keep everything in sync
                await utils.loadData();
            }
            
        } catch (error) {
            console.error('Capture failed:', error);
            utils.showToast('Capture failed', 'error');
        } finally {
            utils.showLoading(false);
        }
    }

    async captureTask(text) {
        return await utils.API.post('/quick-capture', {
            text,
            type: 'task'
        });
    }

    async captureNote(text) {
        return await utils.API.post('/quick-capture', {
            text,
            type: 'note'
        });
    }

    async captureLink(text) {
        // Ensure URL format
        let url = text.trim();
        if (!url.startsWith('http')) {
            url = 'https://' + url.replace(/^www\./, '');
        }
        
        return await utils.API.post('/quick-capture', {
            text: url,
            type: 'link'
        });
    }

    showSuccessAnimation() {
        const icon = document.querySelector('.quick-capture-icon');
        if (icon) {
            const originalText = icon.textContent;
            icon.textContent = '✅';
            icon.style.transform = 'scale(1.2)';
            
            setTimeout(() => {
                icon.textContent = originalText;
                icon.style.transform = 'scale(1)';
            }, 1000);
        }
    }

    // Programmatic capture (for external use)
    async quickAddTask(title, options = {}) {
        const task = await utils.API.post('/tasks', {
            title,
            description: options.description || '',
            column: options.column || 'To Do',
            priority: options.priority || 'medium',
            category: options.category || 'Personal',
            assignee: options.assignee || 'Atticus',
            dueDate: options.dueDate || null,
            tags: options.tags || []
        });
        
        utils.showToast('Task created', 'success');
        await utils.loadData();
        return task;
    }

    async quickAddNote(title, content = '', tags = []) {
        const note = await utils.API.post('/notes', {
            title,
            content,
            tags
        });
        
        utils.showToast('Note created', 'success');
        await utils.loadData();
        return note;
    }

    async quickAddLink(url, title = '', description = '', tags = []) {
        const link = await utils.API.post('/links', {
            url,
            title,
            description,
            tags
        });
        
        utils.showToast('Link saved', 'success');
        await utils.loadData();
        return link;
    }

    // Natural language parsing utilities
    static parseTaskText(text) {
        let title = text;
        let priority = 'medium';
        let tags = [];
        let dueDate = null;
        let category = 'Personal';
        let assignee = 'Atticus';

        // Extract tags (#tagname)
        const tagMatches = text.match(/#(\w+)/g);
        if (tagMatches) {
            tags = tagMatches.map(tag => tag.substring(1).toLowerCase());
            title = title.replace(/#\w+/g, '').trim();
        }

        // Extract priority (!high, !medium, !low)
        const priorityMatch = text.match(/!(high|medium|low)/i);
        if (priorityMatch) {
            priority = priorityMatch[1].toLowerCase();
            title = title.replace(/!(high|medium|low)/gi, '').trim();
        }

        // Extract assignee (@name)
        const assigneeMatch = text.match(/@(\w+)/i);
        if (assigneeMatch) {
            assignee = assigneeMatch[1];
            title = title.replace(/@\w+/gi, '').trim();
        }

        // Extract due dates
        const today = new Date();
        
        // Tomorrow
        if (/\btomorrow\b/i.test(text)) {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            dueDate = tomorrow.toISOString().split('T')[0];
            title = title.replace(/\btomorrow\b/gi, '').trim();
        }
        
        // Today
        else if (/\btoday\b/i.test(text)) {
            dueDate = today.toISOString().split('T')[0];
            title = title.replace(/\btoday\b/gi, '').trim();
        }
        
        // Next week
        else if (/\bnext\s+week\b/i.test(text)) {
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);
            dueDate = nextWeek.toISOString().split('T')[0];
            title = title.replace(/\bnext\s+week\b/gi, '').trim();
        }
        
        // Specific date patterns (MM/DD, DD/MM, etc.)
        const dateMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
        if (dateMatch) {
            const [, month, day, year] = dateMatch;
            const targetYear = year ? (year.length === 2 ? 2000 + parseInt(year) : parseInt(year)) : today.getFullYear();
            const targetDate = new Date(targetYear, parseInt(month) - 1, parseInt(day));
            
            if (targetDate > today) {
                dueDate = targetDate.toISOString().split('T')[0];
                title = title.replace(dateMatch[0], '').trim();
            }
        }

        // Set category based on tags or keywords
        if (tags.includes('icon') || /\bicon\b/i.test(text)) {
            category = 'ICON';
        } else if (tags.includes('capstone') || /\bcapstone\b/i.test(text)) {
            category = 'Capstone';
        } else if (tags.includes('setup') || tags.includes('config')) {
            category = 'Atticus Setup';
        }

        // Clean up title
        title = title.replace(/\s+/g, ' ').trim();

        return {
            title,
            priority,
            tags,
            dueDate,
            category,
            assignee
        };
    }

    focus() {
        this.input.focus();
        this.input.select();
    }
}

// Initialize quick capture when DOM is loaded
let quickCapture;

document.addEventListener('DOMContentLoaded', () => {
    quickCapture = new QuickCapture();
    
    // Make it globally available
    window.quickCapture = quickCapture;
});

// Export for module use
window.QuickCapture = QuickCapture;
/* Mission Control v2 - Global Search Module */

class GlobalSearch {
    constructor() {
        this.modal = document.getElementById('search-modal');
        this.input = document.getElementById('search-input');
        this.results = document.getElementById('search-results');
        this.searchCache = new Map();
        this.recentSearches = utils.loadFromLocal('recent-searches', []);
        this.currentResults = { tasks: [], notes: [], links: [] };
        this.selectedIndex = -1;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showRecentSearches();
    }

    setupEventListeners() {
        // Search input
        this.input.addEventListener('input', utils.debounce((e) => {
            this.performSearch(e.target.value.trim());
        }, 300));

        // Keyboard navigation
        this.input.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.navigateResults(1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.navigateResults(-1);
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.selectResult();
                    break;
                case 'Escape':
                    this.close();
                    break;
            }
        });

        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }

    show() {
        utils.showModal('search-modal');
        this.input.value = '';
        this.input.focus();
        this.selectedIndex = -1;
        this.showRecentSearches();
    }

    close() {
        utils.closeModal('search-modal');
        this.selectedIndex = -1;
    }

    async performSearch(query) {
        if (!query) {
            this.showRecentSearches();
            return;
        }

        // Check cache first
        if (this.searchCache.has(query)) {
            this.displayResults(query, this.searchCache.get(query));
            return;
        }

        try {
            const results = await utils.API.get(`/search?q=${encodeURIComponent(query)}`);
            this.searchCache.set(query, results);
            this.currentResults = results;
            this.displayResults(query, results);
            
            // Add to recent searches
            this.addToRecentSearches(query);
        } catch (error) {
            console.error('Search failed:', error);
            this.displayError();
        }
    }

    displayResults(query, results) {
        this.results.innerHTML = '';
        this.selectedIndex = -1;
        
        const totalResults = results.tasks.length + results.notes.length + results.links.length;
        
        if (totalResults === 0) {
            this.results.innerHTML = `
                <div class="search-empty">
                    No results found for "${query}"
                </div>
            `;
            return;
        }

        // Tasks section
        if (results.tasks.length > 0) {
            this.results.appendChild(this.createSectionHeader('Tasks', results.tasks.length));
            results.tasks.forEach(task => {
                this.results.appendChild(this.createTaskResult(task, query));
            });
        }

        // Notes section
        if (results.notes.length > 0) {
            this.results.appendChild(this.createSectionHeader('Notes', results.notes.length));
            results.notes.forEach(note => {
                this.results.appendChild(this.createNoteResult(note, query));
            });
        }

        // Links section
        if (results.links.length > 0) {
            this.results.appendChild(this.createSectionHeader('Links', results.links.length));
            results.links.forEach(link => {
                this.results.appendChild(this.createLinkResult(link, query));
            });
        }
    }

    createSectionHeader(title, count) {
        const header = document.createElement('div');
        header.className = 'search-section-title';
        header.textContent = `${title} (${count})`;
        return header;
    }

    createTaskResult(task, query) {
        const item = document.createElement('div');
        item.className = 'search-item';
        item.dataset.type = 'task';
        item.dataset.id = task.id;
        
        const priorityIcon = utils.getPriorityIcon(task.priority);
        const dueDateText = task.dueDate ? ` • Due ${utils.formatDate(task.dueDate)}` : '';
        const overdueClass = task.dueDate && utils.isOverdue(task.dueDate) ? ' overdue' : '';
        
        item.innerHTML = `
            <div class="search-item-icon">${priorityIcon}</div>
            <div class="search-item-content">
                <div class="search-item-title">${this.highlightText(task.title, query)}</div>
                <div class="search-item-subtitle">
                    ${task.category} • ${task.column}${dueDateText}
                    <span class="${overdueClass}"></span>
                </div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            this.goToTask(task);
        });
        
        return item;
    }

    createNoteResult(note, query) {
        const item = document.createElement('div');
        item.className = 'search-item';
        item.dataset.type = 'note';
        item.dataset.id = note.id;
        
        const pinnedIcon = note.pinned ? '📌' : '📝';
        const preview = note.content.substring(0, 100) + (note.content.length > 100 ? '...' : '');
        
        item.innerHTML = `
            <div class="search-item-icon">${pinnedIcon}</div>
            <div class="search-item-content">
                <div class="search-item-title">${this.highlightText(note.title, query)}</div>
                <div class="search-item-subtitle">${this.highlightText(preview, query)}</div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            this.goToNote(note);
        });
        
        return item;
    }

    createLinkResult(link, query) {
        const item = document.createElement('div');
        item.className = 'search-item';
        item.dataset.type = 'link';
        item.dataset.id = link.id;
        
        item.innerHTML = `
            <div class="search-item-icon">🔗</div>
            <div class="search-item-content">
                <div class="search-item-title">${this.highlightText(link.title, query)}</div>
                <div class="search-item-subtitle">${this.highlightText(link.url, query)}</div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            this.goToLink(link);
        });
        
        return item;
    }

    highlightText(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    showRecentSearches() {
        if (this.recentSearches.length === 0) {
            this.results.innerHTML = '<div class="search-empty">Start typing to search...</div>';
            return;
        }

        this.results.innerHTML = '';
        this.results.appendChild(this.createSectionHeader('Recent Searches', this.recentSearches.length));
        
        this.recentSearches.forEach(search => {
            const item = document.createElement('div');
            item.className = 'search-item';
            item.innerHTML = `
                <div class="search-item-icon">🕒</div>
                <div class="search-item-content">
                    <div class="search-item-title">${search}</div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.input.value = search;
                this.performSearch(search);
            });
            
            this.results.appendChild(item);
        });
    }

    addToRecentSearches(query) {
        // Remove if already exists
        this.recentSearches = this.recentSearches.filter(s => s !== query);
        
        // Add to beginning
        this.recentSearches.unshift(query);
        
        // Keep only last 10
        this.recentSearches = this.recentSearches.slice(0, 10);
        
        // Save to localStorage
        utils.saveToLocal('recent-searches', this.recentSearches);
    }

    navigateResults(direction) {
        const items = this.results.querySelectorAll('.search-item');
        if (items.length === 0) return;

        // Remove current selection
        items.forEach(item => item.classList.remove('selected'));

        // Update index
        if (direction === 1) {
            this.selectedIndex = (this.selectedIndex + 1) % items.length;
        } else {
            this.selectedIndex = this.selectedIndex <= 0 ? items.length - 1 : this.selectedIndex - 1;
        }

        // Add new selection
        const selectedItem = items[this.selectedIndex];
        selectedItem.classList.add('selected');
        
        // Scroll into view
        selectedItem.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }

    selectResult() {
        const selectedItem = this.results.querySelector('.search-item.selected');
        if (selectedItem) {
            selectedItem.click();
        } else {
            // If nothing selected, select first item
            const firstItem = this.results.querySelector('.search-item');
            if (firstItem) {
                firstItem.click();
            }
        }
    }

    goToTask(task) {
        this.close();
        window.app.navigateTo('board');
        
        // Highlight the task after a brief delay
        setTimeout(() => {
            const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
            if (taskElement) {
                taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                taskElement.classList.add('highlight');
                setTimeout(() => taskElement.classList.remove('highlight'), 2000);
            }
        }, 500);
    }

    goToNote(note) {
        this.close();
        window.app.navigateTo('notes');
        
        // Highlight the note after a brief delay
        setTimeout(() => {
            const noteElement = document.querySelector(`[data-note-id="${note.id}"]`);
            if (noteElement) {
                noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                noteElement.classList.add('highlight');
                setTimeout(() => noteElement.classList.remove('highlight'), 2000);
            }
        }, 500);
    }

    goToLink(link) {
        this.close();
        
        // Open in new tab and navigate to links view
        window.open(link.url, '_blank');
        window.app.navigateTo('links');
    }

    displayError() {
        this.results.innerHTML = `
            <div class="search-empty">
                Search failed. Please try again.
            </div>
        `;
    }

    clearCache() {
        this.searchCache.clear();
    }

    clearRecentSearches() {
        this.recentSearches = [];
        utils.saveToLocal('recent-searches', []);
        this.showRecentSearches();
    }
}

// Show search modal function for global use
function showSearchModal() {
    if (window.globalSearch) {
        window.globalSearch.show();
    }
}

// Initialize global search when DOM is loaded
let globalSearch;

document.addEventListener('DOMContentLoaded', () => {
    globalSearch = new GlobalSearch();
    window.globalSearch = globalSearch;
    window.showSearchModal = showSearchModal;
});

// Export for module use
window.GlobalSearch = GlobalSearch;
/* Mission Control v2 - Notes Module */

class NotesManager {
    constructor() {
        this.selectedNote = null;
        this.editingMode = false;
        this.searchQuery = '';
        this.filterTag = null;
        this.sortBy = 'updated'; // updated, created, title, pinned
    }

    async render() {
        try {
            const container = document.getElementById('content');
            container.innerHTML = this.createNotesHTML();
            
            this.setupEventListeners();
            this.renderNotes();
            
        } catch (error) {
            console.error('Failed to load notes:', error);
            this.renderError();
        }
    }

    createNotesHTML() {
        return `
            <div class="notes-view">
                <header class="notes-header">
                    <div class="notes-title-section">
                        <h1>Notes</h1>
                        <div class="notes-stats">
                            <span class="stat-item">
                                <span class="stat-value">${this.getTotalNotes()}</span>
                                <span class="stat-label">notes</span>
                            </span>
                            <span class="stat-item">
                                <span class="stat-value">${this.getPinnedNotesCount()}</span>
                                <span class="stat-label">pinned</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="notes-controls">
                        <div class="notes-search">
                            <div class="search-input-container">
                                <span class="search-icon">🔍</span>
                                <input 
                                    id="notes-search" 
                                    type="text" 
                                    placeholder="Search notes..." 
                                    class="form-input"
                                    value="${this.searchQuery}"
                                >
                            </div>
                        </div>
                        
                        <div class="notes-filters">
                            <select id="notes-filter-tag" class="form-select">
                                <option value="">All Tags</option>
                                ${this.getTagFilterOptions()}
                            </select>
                            
                            <select id="notes-sort" class="form-select">
                                <option value="updated">Recently Updated</option>
                                <option value="created">Recently Created</option>
                                <option value="title">Title A-Z</option>
                                <option value="pinned">Pinned First</option>
                            </select>
                        </div>
                        
                        <div class="notes-actions">
                            <button class="btn btn-secondary" id="export-notes">
                                📤 Export
                            </button>
                            <button class="btn" id="create-note">
                                ➕ New Note
                            </button>
                        </div>
                    </div>
                </header>

                <div class="notes-content">
                    <div class="notes-list-container">
                        <div id="notes-grid" class="notes-grid">
                            <!-- Notes will be rendered here -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Note Editor Modal -->
            <div id="note-editor-modal" class="modal">
                <div class="modal-content note-editor-content">
                    <div class="modal-header">
                        <input 
                            id="note-title" 
                            type="text" 
                            placeholder="Note title..." 
                            class="note-title-input"
                        >
                        <div class="note-editor-actions">
                            <button class="btn-ghost" id="pin-note">📌</button>
                            <button class="btn-ghost" id="delete-note">🗑️</button>
                            <button class="btn-ghost" onclick="notesManager.closeEditor()">✕</button>
                        </div>
                    </div>
                    
                    <div class="modal-body">
                        <div class="note-editor-toolbar">
                            <button class="toolbar-btn" data-action="bold" title="Bold">**B**</button>
                            <button class="toolbar-btn" data-action="italic" title="Italic">*I*</button>
                            <button class="toolbar-btn" data-action="heading" title="Heading"># H1</button>
                            <button class="toolbar-btn" data-action="list" title="List">• List</button>
                            <button class="toolbar-btn" data-action="link" title="Link">🔗</button>
                            <button class="toolbar-btn" data-action="code" title="Code">\`Code\`</button>
                            <div class="toolbar-separator"></div>
                            <button class="toolbar-btn" id="preview-toggle">👁️ Preview</button>
                        </div>
                        
                        <div class="note-editor-body">
                            <textarea 
                                id="note-content" 
                                placeholder="Start writing your note..."
                                class="note-content-input"
                            ></textarea>
                            <div id="note-preview" class="note-preview hidden"></div>
                        </div>
                        
                        <div class="note-tags-section">
                            <label class="form-label">Tags</label>
                            <div class="tags-input-container">
                                <input 
                                    id="note-tags" 
                                    type="text" 
                                    placeholder="Add tags (comma separated)..."
                                    class="form-input"
                                >
                                <div id="note-tags-display" class="tags-display"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="notesManager.closeEditor()">Cancel</button>
                        <button class="btn" id="save-note">Save Note</button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Search
        document.getElementById('notes-search').addEventListener('input', utils.debounce((e) => {
            this.searchQuery = e.target.value.trim();
            this.renderNotes();
        }, 300));

        // Filters
        document.getElementById('notes-filter-tag').addEventListener('change', (e) => {
            this.filterTag = e.target.value || null;
            this.renderNotes();
        });

        document.getElementById('notes-sort').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.renderNotes();
        });

        // Actions
        document.getElementById('create-note').addEventListener('click', () => {
            this.createNewNote();
        });

        document.getElementById('export-notes').addEventListener('click', () => {
            this.exportNotes();
        });

        // Editor
        document.getElementById('save-note').addEventListener('click', () => {
            this.saveNote();
        });

        document.getElementById('pin-note').addEventListener('click', () => {
            this.togglePinNote();
        });

        document.getElementById('delete-note').addEventListener('click', () => {
            this.deleteCurrentNote();
        });

        document.getElementById('preview-toggle').addEventListener('click', () => {
            this.togglePreview();
        });

        // Toolbar buttons
        document.querySelectorAll('.toolbar-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyFormatting(btn.dataset.action);
            });
        });

        // Auto-save
        document.getElementById('note-content').addEventListener('input', utils.debounce(() => {
            if (this.selectedNote && this.editingMode) {
                this.autoSave();
            }
        }, 2000));

        // Tags input
        document.getElementById('note-tags').addEventListener('input', () => {
            this.updateTagsDisplay();
        });

        // Keyboard shortcuts in editor
        document.getElementById('note-content').addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveNote();
                        break;
                    case 'b':
                        e.preventDefault();
                        this.applyFormatting('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.applyFormatting('italic');
                        break;
                }
            }
        });
    }

    renderNotes() {
        const grid = document.getElementById('notes-grid');
        const filteredNotes = this.getFilteredNotes();
        const sortedNotes = this.sortNotes(filteredNotes);

        if (sortedNotes.length === 0) {
            grid.innerHTML = this.renderEmptyState();
            return;
        }

        grid.innerHTML = sortedNotes.map(note => this.createNoteCard(note)).join('');
        this.setupNoteCardListeners();
    }

    createNoteCard(note) {
        const preview = this.getContentPreview(note.content);
        const tags = note.tags ? note.tags.map(tag => {
            const color = utils.getTagColor(tag, window.MissionControl.data.tags);
            return `<span class="tag ${color ? 'tag-colored' : ''}" ${color ? `style="--tag-color: ${color}"` : ''}>${tag}</span>`;
        }).join('') : '';

        return `
            <div class="note-card ${note.pinned ? 'pinned' : ''}" data-note-id="${note.id}">
                ${note.pinned ? '<div class="pin-indicator">📌</div>' : ''}
                
                <div class="note-card-header">
                    <h3 class="note-title">${note.title}</h3>
                    <div class="note-actions">
                        <button class="btn-ghost btn-small" onclick="notesManager.editNote(${note.id})">
                            ✏️
                        </button>
                        <button class="btn-ghost btn-small" onclick="notesManager.togglePin(${note.id})">
                            ${note.pinned ? '📌' : '📍'}
                        </button>
                    </div>
                </div>
                
                <div class="note-content">${preview}</div>
                
                ${tags ? `<div class="note-tags">${tags}</div>` : ''}
                
                <div class="note-meta">
                    <span class="note-date">Updated ${utils.formatDate(note.updatedAt, { relative: true })}</span>
                    <span class="note-word-count">${this.getWordCount(note.content)} words</span>
                </div>
            </div>
        `;
    }

    setupNoteCardListeners() {
        document.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.note-actions')) return;
                
                const noteId = parseInt(card.dataset.noteId);
                this.editNote(noteId);
            });
        });
    }

    getFilteredNotes() {
        const notes = window.MissionControl.data.notes || [];
        
        return notes.filter(note => {
            // Search filter
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                if (!note.title.toLowerCase().includes(query) && 
                    !note.content.toLowerCase().includes(query)) {
                    return false;
                }
            }
            
            // Tag filter
            if (this.filterTag && (!note.tags || !note.tags.includes(this.filterTag))) {
                return false;
            }
            
            return true;
        });
    }

    sortNotes(notes) {
        return [...notes].sort((a, b) => {
            switch (this.sortBy) {
                case 'created':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                
                case 'title':
                    return a.title.localeCompare(b.title);
                
                case 'pinned':
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                
                case 'updated':
                default:
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
            }
        });
    }

    getContentPreview(content, maxLength = 150) {
        if (!content) return 'No content';
        
        // Remove markdown syntax for preview
        const plainText = content
            .replace(/#{1,6}\s+/g, '') // Headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
            .replace(/\*(.*?)\*/g, '$1') // Italic
            .replace(/`(.*?)`/g, '$1') // Code
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
            .replace(/^\s*[-*+]\s+/gm, '') // Lists
            .trim();
        
        return plainText.length > maxLength 
            ? plainText.substring(0, maxLength) + '...'
            : plainText;
    }

    getWordCount(content) {
        if (!content) return 0;
        return content.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    renderEmptyState() {
        if (this.searchQuery || this.filterTag) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>No notes found</h3>
                    <p>Try adjusting your search or filters</p>
                    <button class="btn" onclick="notesManager.clearFilters()">Clear Filters</button>
                </div>
            `;
        }

        return `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>No notes yet</h3>
                <p>Create your first note to get started</p>
                <button class="btn" onclick="notesManager.createNewNote()">Create Note</button>
            </div>
        `;
    }

    createNewNote() {
        this.selectedNote = null;
        this.editingMode = true;
        this.openEditor();
        
        // Clear form
        document.getElementById('note-title').value = '';
        document.getElementById('note-content').value = '';
        document.getElementById('note-tags').value = '';
        this.updateTagsDisplay();
        this.updatePinButton(false);
    }

    async editNote(noteId) {
        const note = window.MissionControl.data.notes.find(n => n.id === noteId);
        if (!note) return;

        this.selectedNote = note;
        this.editingMode = true;
        this.openEditor();
        
        // Populate form
        document.getElementById('note-title').value = note.title;
        document.getElementById('note-content').value = note.content;
        document.getElementById('note-tags').value = note.tags ? note.tags.join(', ') : '';
        this.updateTagsDisplay();
        this.updatePinButton(note.pinned);
    }

    openEditor() {
        utils.showModal('note-editor-modal');
        document.getElementById('note-title').focus();
    }

    closeEditor() {
        utils.closeModal('note-editor-modal');
        this.selectedNote = null;
        this.editingMode = false;
    }

    async saveNote() {
        const title = document.getElementById('note-title').value.trim() || 'Untitled Note';
        const content = document.getElementById('note-content').value.trim();
        const tagsInput = document.getElementById('note-tags').value.trim();
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

        try {
            utils.showLoading(true);
            
            if (this.selectedNote) {
                // Update existing note
                await utils.API.put(`/notes/${this.selectedNote.id}`, {
                    title,
                    content,
                    tags
                });
                utils.showToast('Note updated', 'success');
            } else {
                // Create new note
                await utils.API.post('/notes', {
                    title,
                    content,
                    tags
                });
                utils.showToast('Note created', 'success');
            }

            await utils.loadData();
            this.renderNotes();
            this.closeEditor();
            
        } catch (error) {
            console.error('Failed to save note:', error);
            utils.showToast('Failed to save note', 'error');
        } finally {
            utils.showLoading(false);
        }
    }

    async autoSave() {
        if (!this.selectedNote) return;

        const title = document.getElementById('note-title').value.trim() || 'Untitled Note';
        const content = document.getElementById('note-content').value.trim();
        const tagsInput = document.getElementById('note-tags').value.trim();
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

        try {
            await utils.API.put(`/notes/${this.selectedNote.id}`, {
                title,
                content,
                tags
            });
            
            // Update local data
            this.selectedNote.title = title;
            this.selectedNote.content = content;
            this.selectedNote.tags = tags;
            
            // Show auto-save indicator
            const saveBtn = document.getElementById('save-note');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved ✓';
            setTimeout(() => {
                saveBtn.textContent = originalText;
            }, 1000);
            
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }

    async togglePin(noteId) {
        const note = window.MissionControl.data.notes.find(n => n.id === noteId);
        if (!note) return;

        try {
            await utils.API.put(`/notes/${noteId}`, { pinned: !note.pinned });
            utils.showToast(note.pinned ? 'Note unpinned' : 'Note pinned', 'success');
            
            await utils.loadData();
            this.renderNotes();
            
            if (this.selectedNote && this.selectedNote.id === noteId) {
                this.updatePinButton(!note.pinned);
            }
            
        } catch (error) {
            utils.showToast('Failed to update note', 'error');
        }
    }

    async togglePinNote() {
        if (!this.selectedNote) return;
        await this.togglePin(this.selectedNote.id);
    }

    async deleteCurrentNote() {
        if (!this.selectedNote) return;
        if (!confirm(`Are you sure you want to delete "${this.selectedNote.title}"?`)) return;

        try {
            await utils.API.delete(`/notes/${this.selectedNote.id}`);
            utils.showToast('Note deleted', 'success');
            
            await utils.loadData();
            this.renderNotes();
            this.closeEditor();
            
        } catch (error) {
            utils.showToast('Failed to delete note', 'error');
        }
    }

    updatePinButton(pinned) {
        const pinBtn = document.getElementById('pin-note');
        pinBtn.textContent = pinned ? '📌' : '📍';
        pinBtn.title = pinned ? 'Unpin note' : 'Pin note';
    }

    updateTagsDisplay() {
        const input = document.getElementById('note-tags');
        const display = document.getElementById('note-tags-display');
        
        const tagsText = input.value.trim();
        if (!tagsText) {
            display.innerHTML = '';
            return;
        }

        const tags = tagsText.split(',').map(tag => tag.trim()).filter(tag => tag);
        display.innerHTML = tags.map(tag => {
            const color = utils.getTagColor(tag, window.MissionControl.data.tags);
            return `<span class="tag ${color ? 'tag-colored' : ''}" ${color ? `style="--tag-color: ${color}"` : ''}>${tag}</span>`;
        }).join('');
    }

    applyFormatting(action) {
        const textarea = document.getElementById('note-content');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        
        let replacement = '';
        let newCursorPos = start;

        switch (action) {
            case 'bold':
                replacement = `**${selectedText}**`;
                newCursorPos = selectedText ? start + replacement.length : start + 2;
                break;
            
            case 'italic':
                replacement = `*${selectedText}*`;
                newCursorPos = selectedText ? start + replacement.length : start + 1;
                break;
            
            case 'heading':
                replacement = `# ${selectedText}`;
                newCursorPos = start + replacement.length;
                break;
            
            case 'list':
                replacement = `- ${selectedText}`;
                newCursorPos = start + replacement.length;
                break;
            
            case 'link':
                const url = prompt('Enter URL:');
                if (url) {
                    replacement = `[${selectedText || 'Link text'}](${url})`;
                    newCursorPos = start + replacement.length;
                }
                break;
            
            case 'code':
                replacement = `\`${selectedText}\``;
                newCursorPos = selectedText ? start + replacement.length : start + 1;
                break;
        }

        if (replacement) {
            textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
    }

    togglePreview() {
        const content = document.getElementById('note-content');
        const preview = document.getElementById('note-preview');
        const toggleBtn = document.getElementById('preview-toggle');

        if (preview.classList.contains('hidden')) {
            // Show preview
            preview.innerHTML = this.renderMarkdown(content.value);
            preview.classList.remove('hidden');
            content.classList.add('hidden');
            toggleBtn.textContent = '✏️ Edit';
        } else {
            // Show editor
            preview.classList.add('hidden');
            content.classList.remove('hidden');
            toggleBtn.textContent = '👁️ Preview';
        }
    }

    renderMarkdown(text) {
        // Simple markdown parser
        return text
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/\n/g, '<br>');
    }

    exportNotes() {
        const notes = this.getFilteredNotes();
        const exportData = notes.map(note => ({
            title: note.title,
            content: note.content,
            tags: note.tags,
            pinned: note.pinned,
            created: note.createdAt,
            updated: note.updatedAt
        }));

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'mission-control-notes.json';
        link.click();
        
        utils.showToast('Notes exported', 'success');
    }

    clearFilters() {
        this.searchQuery = '';
        this.filterTag = null;
        
        document.getElementById('notes-search').value = '';
        document.getElementById('notes-filter-tag').value = '';
        
        this.renderNotes();
    }

    getTotalNotes() {
        return (window.MissionControl.data.notes || []).length;
    }

    getPinnedNotesCount() {
        return (window.MissionControl.data.notes || []).filter(note => note.pinned).length;
    }

    getTagFilterOptions() {
        const allTags = new Set();
        (window.MissionControl.data.notes || []).forEach(note => {
            if (note.tags) {
                note.tags.forEach(tag => allTags.add(tag));
            }
        });
        
        return Array.from(allTags).sort().map(tag => 
            `<option value="${tag}">${tag}</option>`
        ).join('');
    }

    async refresh() {
        await utils.loadData();
        this.renderNotes();
    }

    renderError() {
        const container = document.getElementById('content');
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h2>Failed to load notes</h2>
                <p>Unable to fetch your notes. Please try refreshing the page.</p>
                <button class="btn" onclick="location.reload()">Refresh Page</button>
            </div>
        `;
    }
}

// Export for global use
window.NotesManager = NotesManager;
window.notesManager = new NotesManager();
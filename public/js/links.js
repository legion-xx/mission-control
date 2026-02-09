/* Mission Control v2 - Links/Bookmarks Module */

class LinksManager {
    constructor() {
        this.links = [];
        this.filteredLinks = [];
        this.currentFilter = 'all';
        this.sortBy = 'created'; // created, title, updated
        this.sortOrder = 'desc';
        this.searchQuery = '';
    }

    async render() {
        try {
            await this.loadLinks();
            const container = document.getElementById('content');
            container.innerHTML = this.createLinksHTML();
            this.setupEventListeners();
            this.renderLinks();
        } catch (error) {
            console.error('Failed to load links:', error);
            this.renderError();
        }
    }

    async loadLinks() {
        try {
            const data = await API.get('/links');
            this.links = data;
            this.applyFilters();
        } catch (error) {
            console.error('Failed to load links:', error);
            this.links = [];
            this.filteredLinks = [];
        }
    }

    createLinksHTML() {
        return `
            <div class="links">
                <header class="links-header">
                    <div class="links-title-section">
                        <h1>Links & Bookmarks</h1>
                        <div class="links-stats">
                            <span class="stat-item">
                                <span class="stat-value">${this.links.length}</span>
                                <span class="stat-label">links saved</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="links-controls">
                        <div class="links-search">
                            <div class="search-input-container">
                                <div class="search-icon">🔍</div>
                                <input 
                                    id="links-search" 
                                    type="text" 
                                    placeholder="Search links..."
                                    value="${this.searchQuery}"
                                    autocomplete="off"
                                >
                            </div>
                        </div>
                        
                        <div class="links-filters">
                            <select id="links-sort" class="form-select">
                                <option value="created-desc">Newest First</option>
                                <option value="created-asc">Oldest First</option>
                                <option value="title-asc">A-Z</option>
                                <option value="title-desc">Z-A</option>
                                <option value="updated-desc">Recently Updated</option>
                            </select>
                        </div>
                        
                        <button id="add-link-btn" class="btn btn-primary">
                            <span class="btn-icon">➕</span>
                            Add Link
                        </button>
                    </div>
                </header>

                <div class="links-content">
                    <div id="links-grid" class="links-grid">
                        <!-- Links will be rendered here -->
                    </div>
                    
                    <div id="links-empty" class="links-empty hidden">
                        <div class="empty-icon">🔗</div>
                        <h3>No links yet</h3>
                        <p>Save your first bookmark to get started</p>
                        <button class="btn btn-primary" onclick="linksManager.showAddLinkModal()">
                            Add Your First Link
                        </button>
                    </div>
                </div>
            </div>

            <!-- Add/Edit Link Modal -->
            <div id="link-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="link-modal-title">Add Link</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    
                    <form id="link-form" class="modal-body">
                        <input type="hidden" id="link-id">
                        
                        <div class="form-group">
                            <label for="link-url">URL *</label>
                            <input 
                                type="url" 
                                id="link-url" 
                                class="form-input" 
                                placeholder="https://example.com"
                                required
                            >
                            <button type="button" id="fetch-title-btn" class="btn-link">
                                🔄 Auto-fetch title
                            </button>
                        </div>
                        
                        <div class="form-group">
                            <label for="link-title">Title</label>
                            <input 
                                type="text" 
                                id="link-title" 
                                class="form-input" 
                                placeholder="Link title"
                            >
                        </div>
                        
                        <div class="form-group">
                            <label for="link-description">Description</label>
                            <textarea 
                                id="link-description" 
                                class="form-textarea" 
                                placeholder="Optional description..."
                                rows="3"
                            ></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="link-tags">Tags</label>
                            <input 
                                type="text" 
                                id="link-tags" 
                                class="form-input" 
                                placeholder="work, resources, design (comma-separated)"
                            >
                            <div class="form-hint">Separate tags with commas</div>
                        </div>
                    </form>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary modal-close">Cancel</button>
                        <button type="submit" form="link-form" class="btn btn-primary">
                            <span id="save-btn-text">Save Link</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Link Detail Modal -->
            <div id="link-detail-modal" class="modal">
                <div class="modal-content modal-wide">
                    <div class="modal-header">
                        <h2 id="detail-link-title">Link Details</h2>
                        <div class="modal-header-actions">
                            <button id="edit-link-btn" class="btn btn-outline">Edit</button>
                            <button id="delete-link-btn" class="btn btn-danger">Delete</button>
                            <button class="modal-close">&times;</button>
                        </div>
                    </div>
                    
                    <div class="modal-body">
                        <div class="link-detail-content">
                            <div class="link-detail-main">
                                <div class="link-detail-url">
                                    <a id="detail-link-url" href="#" target="_blank" rel="noopener">
                                        Visit Link →
                                    </a>
                                </div>
                                
                                <div id="detail-link-description" class="link-detail-description"></div>
                                
                                <div id="detail-link-tags" class="link-detail-tags"></div>
                            </div>
                            
                            <div class="link-detail-meta">
                                <div class="meta-item">
                                    <span class="meta-label">Created:</span>
                                    <span id="detail-link-created"></span>
                                </div>
                                <div class="meta-item">
                                    <span class="meta-label">Updated:</span>
                                    <span id="detail-link-updated"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Search
        document.getElementById('links-search').addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.applyFilters();
            this.renderLinks();
        });

        // Sort
        document.getElementById('links-sort').addEventListener('change', (e) => {
            const [sortBy, sortOrder] = e.target.value.split('-');
            this.sortBy = sortBy;
            this.sortOrder = sortOrder;
            this.applyFilters();
            this.renderLinks();
        });

        // Add link button
        document.getElementById('add-link-btn').addEventListener('click', () => {
            this.showAddLinkModal();
        });

        // Link form
        document.getElementById('link-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveLinkFromForm();
        });

        // Auto-fetch title
        document.getElementById('fetch-title-btn').addEventListener('click', () => {
            this.fetchUrlTitle();
        });

        // Modal management
        utils.setupModalHandlers();
    }

    applyFilters() {
        this.filteredLinks = [...this.links];

        // Apply search
        if (this.searchQuery.trim()) {
            const query = this.searchQuery.toLowerCase();
            this.filteredLinks = this.filteredLinks.filter(link =>
                link.title.toLowerCase().includes(query) ||
                link.description.toLowerCase().includes(query) ||
                link.url.toLowerCase().includes(query) ||
                link.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // Apply sorting
        this.filteredLinks.sort((a, b) => {
            let valueA, valueB;
            
            switch (this.sortBy) {
                case 'title':
                    valueA = a.title.toLowerCase();
                    valueB = b.title.toLowerCase();
                    break;
                case 'created':
                    valueA = new Date(a.createdAt);
                    valueB = new Date(b.createdAt);
                    break;
                case 'updated':
                    valueA = new Date(a.updatedAt);
                    valueB = new Date(b.updatedAt);
                    break;
                default:
                    return 0;
            }

            if (this.sortOrder === 'desc') {
                return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
            } else {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            }
        });
    }

    renderLinks() {
        const grid = document.getElementById('links-grid');
        const emptyState = document.getElementById('links-empty');

        if (this.filteredLinks.length === 0) {
            grid.style.display = 'none';
            emptyState.classList.remove('hidden');
            return;
        }

        grid.style.display = 'grid';
        emptyState.classList.add('hidden');

        grid.innerHTML = this.filteredLinks.map(link => this.createLinkCard(link)).join('');

        // Setup card event listeners
        grid.querySelectorAll('.link-card').forEach(card => {
            const linkId = parseInt(card.dataset.linkId);
            
            card.addEventListener('click', (e) => {
                if (e.target.closest('.link-actions')) return;
                this.showLinkDetail(linkId);
            });
        });
    }

    createLinkCard(link) {
        const domain = this.extractDomain(link.url);
        const timeAgo = utils.formatTimeAgo(link.createdAt);
        
        return `
            <div class="link-card" data-link-id="${link.id}">
                <div class="link-card-header">
                    <div class="link-favicon">
                        <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" 
                             alt="${domain}" 
                             loading="lazy"
                             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 fill=%22%236366f1%22/><text x=%2216%22 y=%2220%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22system-ui%22 font-size=%2214%22>🔗</text></svg>'">
                    </div>
                    <div class="link-actions">
                        <button class="btn-icon" onclick="event.stopPropagation(); linksManager.editLink(${link.id})" title="Edit">
                            ✏️
                        </button>
                        <button class="btn-icon" onclick="event.stopPropagation(); window.open('${link.url}', '_blank')" title="Open">
                            🔗
                        </button>
                        <button class="btn-icon" onclick="event.stopPropagation(); linksManager.deleteLink(${link.id})" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
                
                <div class="link-card-content">
                    <h3 class="link-title">${utils.escapeHtml(link.title)}</h3>
                    <div class="link-url">${domain}</div>
                    ${link.description ? `<p class="link-description">${utils.escapeHtml(link.description)}</p>` : ''}
                </div>
                
                <div class="link-card-footer">
                    <div class="link-tags">
                        ${link.tags.map(tag => `<span class="tag">${utils.escapeHtml(tag)}</span>`).join('')}
                    </div>
                    <div class="link-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }

    extractDomain(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch {
            return 'unknown';
        }
    }

    showAddLinkModal() {
        this.resetLinkForm();
        document.getElementById('link-modal-title').textContent = 'Add Link';
        document.getElementById('save-btn-text').textContent = 'Save Link';
        utils.showModal('link-modal');
        document.getElementById('link-url').focus();
    }

    resetLinkForm() {
        document.getElementById('link-form').reset();
        document.getElementById('link-id').value = '';
    }

    async fetchUrlTitle() {
        const urlInput = document.getElementById('link-url');
        const titleInput = document.getElementById('link-title');
        const fetchBtn = document.getElementById('fetch-title-btn');
        
        const url = urlInput.value.trim();
        if (!url) {
            showToast('Please enter a URL first', 'warning');
            return;
        }

        fetchBtn.textContent = '🔄 Fetching...';
        fetchBtn.disabled = true;

        try {
            // Create a temporary link to let the server fetch the title
            const tempData = await API.post('/quick-capture', { text: url, type: 'link' });
            titleInput.value = tempData.title;
            
            // Delete the temporary link
            await API.delete(`/links/${tempData.id}`);
            
            showToast('Title fetched successfully!', 'success');
        } catch (error) {
            console.error('Failed to fetch title:', error);
            showToast('Failed to fetch title', 'error');
        } finally {
            fetchBtn.textContent = '🔄 Auto-fetch title';
            fetchBtn.disabled = false;
        }
    }

    async saveLinkFromForm() {
        const formData = new FormData(document.getElementById('link-form'));
        const linkId = document.getElementById('link-id').value;
        
        const linkData = {
            url: document.getElementById('link-url').value.trim(),
            title: document.getElementById('link-title').value.trim(),
            description: document.getElementById('link-description').value.trim(),
            tags: document.getElementById('link-tags').value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0)
        };

        if (!linkData.url) {
            showToast('URL is required', 'error');
            return;
        }

        try {
            showLoading();
            
            let savedLink;
            if (linkId) {
                savedLink = await API.put(`/links/${linkId}`, linkData);
                showToast('Link updated successfully!', 'success');
            } else {
                savedLink = await API.post('/links', linkData);
                showToast('Link saved successfully!', 'success');
            }
            
            await this.loadLinks();
            this.renderLinks();
            utils.hideModal('link-modal');
            
        } catch (error) {
            console.error('Failed to save link:', error);
            showToast('Failed to save link', 'error');
        } finally {
            hideLoading();
        }
    }

    editLink(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        document.getElementById('link-id').value = link.id;
        document.getElementById('link-url').value = link.url;
        document.getElementById('link-title').value = link.title;
        document.getElementById('link-description').value = link.description || '';
        document.getElementById('link-tags').value = link.tags.join(', ');
        
        document.getElementById('link-modal-title').textContent = 'Edit Link';
        document.getElementById('save-btn-text').textContent = 'Update Link';
        
        utils.showModal('link-modal');
    }

    async deleteLink(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        if (!confirm(`Delete "${link.title}"?`)) return;

        try {
            showLoading();
            await API.delete(`/links/${linkId}`);
            await this.loadLinks();
            this.renderLinks();
            showToast('Link deleted successfully', 'success');
        } catch (error) {
            console.error('Failed to delete link:', error);
            showToast('Failed to delete link', 'error');
        } finally {
            hideLoading();
        }
    }

    showLinkDetail(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        document.getElementById('detail-link-title').textContent = link.title;
        document.getElementById('detail-link-url').href = link.url;
        document.getElementById('detail-link-url').textContent = link.url;
        
        const descEl = document.getElementById('detail-link-description');
        if (link.description) {
            descEl.textContent = link.description;
            descEl.style.display = 'block';
        } else {
            descEl.style.display = 'none';
        }
        
        const tagsEl = document.getElementById('detail-link-tags');
        if (link.tags.length > 0) {
            tagsEl.innerHTML = link.tags.map(tag => `<span class="tag">${utils.escapeHtml(tag)}</span>`).join('');
            tagsEl.style.display = 'block';
        } else {
            tagsEl.style.display = 'none';
        }
        
        document.getElementById('detail-link-created').textContent = utils.formatDateTime(link.createdAt);
        document.getElementById('detail-link-updated').textContent = utils.formatDateTime(link.updatedAt);
        
        // Setup action buttons
        document.getElementById('edit-link-btn').onclick = () => {
            utils.hideModal('link-detail-modal');
            this.editLink(linkId);
        };
        
        document.getElementById('delete-link-btn').onclick = async () => {
            if (confirm(`Delete "${link.title}"?`)) {
                utils.hideModal('link-detail-modal');
                await this.deleteLink(linkId);
            }
        };
        
        utils.showModal('link-detail-modal');
    }

    renderError() {
        const container = document.getElementById('content');
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h2>Failed to load links</h2>
                <p>Please try refreshing the page</p>
                <button class="btn btn-primary" onclick="linksManager.render()">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Initialize links manager
window.linksManager = new LinksManager();
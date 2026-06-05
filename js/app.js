/* ==========================================================================
   Courseundo — Public Interface Logic (app.js)
   ========================================================================== */

(function () {
    'use strict';

    // ---- Configuration ----
    const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
    const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
    const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
    const REST_BASE = `${SUPABASE_URL}/rest/v1`;

    const PER_PAGE = 20;

    // ---- State ----
    let state = {
        courses: [],
        suggestions: [],
        totalCount: 0,
        currentPage: 1,
        activeTab: 'courses',
        searchQuery: '',
        searchType: 'keyword',
        filters: {
            platform: '',
            category: '',
            certification: '',
            job_available: '',
            difficulty: '',
            cost: ''
        },
        sortBy: localStorage.getItem('courseundo_sort') || 'relevance',
        loading: false,
        sessionId: getSessionId()
    };

    // ---- DOM References ----
    const dom = {};

    function cacheDom() {
        dom.searchInput = document.getElementById('search-input');
        dom.searchBtn = document.getElementById('search-btn');
        dom.searchMode = document.getElementById('search-mode');
        dom.clearFilters = document.getElementById('clear-filters');
        dom.resultsCount = document.getElementById('results-count');
        dom.sortSelect = document.getElementById('sort-select');
        dom.coursesGrid = document.getElementById('courses-grid');
        dom.suggestionsList = document.getElementById('suggestions-list');
        dom.suggestForm = document.getElementById('suggest-form');
        dom.pagination = document.getElementById('pagination');
        dom.loadingOverlay = document.getElementById('loading-overlay');
        dom.toastContainer = document.getElementById('toast-container');
        dom.ratingOverlay = document.getElementById('rating-overlay');
        dom.ratingStars = document.getElementById('rating-stars');
        dom.ratingFeedback = document.getElementById('rating-feedback');
        dom.ratingCourseTitle = document.getElementById('rating-course-title');
        dom.headerCourseCount = document.getElementById('header-course-count');
        dom.headerSearchCount = document.getElementById('header-search-count');

        // Filter selects
        dom.filters = {};
        ['platform', 'category', 'certification', 'job_available', 'difficulty', 'cost'].forEach(f => {
            dom.filters[f] = document.getElementById(`filter-${f}`);
        });

        // Tabs
        dom.tabBtns = document.querySelectorAll('.tab-btn');
        dom.tabPanels = document.querySelectorAll('.tab-panel');

        // Suggestion form fields
        dom.sugTitle = document.getElementById('sug-title');
        dom.sugLink = document.getElementById('sug-link');
        dom.sugPlatform = document.getElementById('sug-platform');
        dom.sugName = document.getElementById('sug-name');
        dom.sugEmail = document.getElementById('sug-email');
        dom.sugNotes = document.getElementById('sug-notes');
        dom.sugHoneypot = document.getElementById('sug-website');
        dom.duplicateWarning = document.getElementById('duplicate-warning');
    }

    // ---- Initialization ----
    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        cacheDom();
        bindEvents();
        initSessionId();
        await Promise.all([loadCourses(), loadStats()]);
        loadSuggestions();
    }

    // ---- Session ID ----
    function getSessionId() {
        let sid = sessionStorage.getItem('courseundo_session');
        if (!sid) {
            sid = 'sess_' + Math.random().toString(36).substring(2, 11);
            sessionStorage.setItem('courseundo_session', sid);
        }
        return sid;
    }

    function initSessionId() {
        state.sessionId = getSessionId();
        logActivity('page_visit', { page: 'home', referrer: document.referrer });
    }

    // ---- Event Binding ----
    function bindEvents() {
        // Search
        dom.searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') performSearch();
        });
        dom.searchBtn.addEventListener('click', performSearch);

        // Filters
        Object.keys(dom.filters).forEach(key => {
            dom.filters[key].addEventListener('change', () => {
                state.filters[key] = dom.filters[key].value;
                dom.filters[key].classList.toggle('has-value', !!state.filters[key]);
                state.currentPage = 1;
                loadCourses();
                if (state.filters[key]) {
                    logActivity('filter_used', { filter: key, value: state.filters[key] });
                }
            });
        });

        // Sort
        dom.sortSelect.addEventListener('change', () => {
            state.sortBy = dom.sortSelect.value;
            localStorage.setItem('courseundo_sort', state.sortBy);
            state.currentPage = 1;
            loadCourses();
            logActivity('sort_used', { sort: state.sortBy });
        });

        // Restore sort preference
        dom.sortSelect.value = state.sortBy;

        // Clear filters
        dom.clearFilters.addEventListener('click', clearAllFilters);

        // Tabs
        dom.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Suggestion form
        dom.suggestForm.addEventListener('submit', handleSuggest);
        dom.sugLink.addEventListener('blur', checkDuplicate);

        // Rating overlay close
        dom.ratingOverlay.addEventListener('click', e => {
            if (e.target === dom.ratingOverlay) closeRatingPicker();
        });

        // Rating stars hover/click
        dom.ratingStars.addEventListener('mouseover', handleRatingHover);
        dom.ratingStars.addEventListener('mouseout', handleRatingHoverOut);
        dom.ratingStars.addEventListener('click', handleRatingClick);
    }

    // ---- API Helpers ----
    async function apiGet(endpoint, params = {}) {
        const url = new URL(endpoint.startsWith('http') ? endpoint : `${REST_BASE}/${endpoint}`);
        Object.entries(params).forEach(([k, v]) => {
            if (v !== '' && v !== undefined && v !== null) url.searchParams.set(k, v);
        });

        const resp = await fetch(url.toString(), {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || `API error: ${resp.status}`);
        }

        const countHeader = resp.headers.get('Content-Range');
        const data = await resp.json();
        let total = data.length;
        if (countHeader) {
            const parts = countHeader.split('/');
            if (parts[1]) total = parseInt(parts[1], 10);
        }
        return { data, total };
    }

    async function apiPost(endpoint, body, isFunction = false) {
        const url = isFunction ? `${FUNCTIONS_BASE}/${endpoint}` : `${REST_BASE}/${endpoint}`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                ...(isFunction ? {} : { 'Prefer': 'return=representation' })
            },
            body: JSON.stringify(body)
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || `API error: ${resp.status}`);
        return data;
    }

    // ---- Load Courses ----
    async function loadCourses() {
        state.loading = true;
        showLoading(true);

        try {
            const query = state.searchQuery.trim();
            let results, total;

            if (query.length > 0 && state.searchType === 'semantic') {
                // Semantic search
                try {
                    const data = await apiPost('semantic-search', {
                        query,
                        limit: 100
                    }, true);

                    if (data.fallback) {
                        // Fallback to keyword
                        state.searchType = 'keyword';
                        updateSearchMode();
                        return loadCourses();
                    }

                    results = applyClientFilters(data.results || []);
                    total = results.length;
                    results = applyClientSort(results);
                    results = paginate(results, state.currentPage, PER_PAGE);
                } catch (err) {
                    console.warn('Semantic search failed, falling back to keyword:', err);
                    state.searchType = 'keyword';
                    updateSearchMode();
                    return loadCourses();
                }
            } else if (query.length > 0) {
                // Keyword search
                const orFilter = `(title.ilike.*${query}*,platform.ilike.*${query}*,institution.ilike.*${query}*,instructor.ilike.*${query}*)`;
                const params = {
                    'status': 'eq.active',
                    'or': orFilter,
                    'limit': PER_PAGE,
                    'offset': (state.currentPage - 1) * PER_PAGE
                };
                addFilterParams(params);
                addSortParam(params);

                const resp = await apiGet('courses', params);
                results = resp.data;
                total = resp.total;
            } else {
                // Browse all
                const params = {
                    'status': 'eq.active',
                    'limit': PER_PAGE,
                    'offset': (state.currentPage - 1) * PER_PAGE
                };
                addFilterParams(params);
                addSortParam(params);

                const resp = await apiGet('courses', params);
                results = resp.data;
                total = resp.total;
            }

            state.courses = results;
            state.totalCount = total;
            renderCourses();
            renderPagination();
            updateResultsCount();

            if (query) {
                logActivity('search', {
                    query,
                    results_count: total,
                    search_type: state.searchType,
                    filters_applied: getActiveFilters()
                });
            }

        } catch (err) {
            console.error('Error loading courses:', err);
            showToast('Failed to load courses. Please try again.', 'error');
            dom.coursesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">!</div>
          <h3>Something went wrong</h3>
          <p>${err.message}</p>
        </div>`;
        } finally {
            state.loading = false;
            showLoading(false);
        }
    }

    function addFilterParams(params) {
        Object.entries(state.filters).forEach(([key, value]) => {
            if (value) params[key] = `eq.${value}`;
        });
    }

    function addSortParam(params) {
        const sortMap = {
            'relevance': 'rating_avg.desc',
            'rating-high': 'rating_avg.desc',
            'rating-low': 'rating_avg.asc',
            'newest': 'created_at.desc',
            'oldest': 'created_at.asc',
            'alpha-az': 'title.asc',
            'alpha-za': 'title.desc',
            'cost-free': 'cost.asc'
        };
        const order = sortMap[state.sortBy] || 'rating_avg.desc';
        params['order'] = order;
    }

    function applyClientFilters(results) {
        return results.filter(course => {
            for (const [key, value] of Object.entries(state.filters)) {
                if (!value) continue;
                const courseVal = course[key];
                if (key === 'job_available') {
                    if (courseVal && courseVal.toLowerCase() !== value.toLowerCase()) return false;
                } else if (courseVal && courseVal.toLowerCase() !== value.toLowerCase()) {
                    return false;
                }
            }
            return true;
        });
    }

    function applyClientSort(results) {
        const sorted = [...results];
        switch (state.sortBy) {
            case 'rating-high': sorted.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0)); break;
            case 'rating-low': sorted.sort((a, b) => (a.rating_avg || 0) - (b.rating_avg || 0)); break;
            case 'newest': sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
            case 'oldest': sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
            case 'alpha-az': sorted.sort((a, b) => a.title.localeCompare(b.title)); break;
            case 'alpha-za': sorted.sort((a, b) => b.title.localeCompare(a.title)); break;
            case 'cost-free': sorted.sort((a, b) => (a.cost === 'Free' ? 0 : 1) - (b.cost === 'Free' ? 0 : 1)); break;
            default: sorted.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0)); break;
        }
        return sorted;
    }

    function paginate(arr, page, perPage) {
        const start = (page - 1) * perPage;
        return arr.slice(start, start + perPage);
    }

    // ---- Render Courses ----
    function renderCourses() {
        if (!state.courses || state.courses.length === 0) {
            dom.coursesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#9744;</div>
          <h3>No courses found</h3>
          <p>Try adjusting your search or filters.</p>
        </div>`;
            return;
        }

        dom.coursesGrid.innerHTML = state.courses.map((course, i) => {
            const platformClass = getPlatformClass(course.platform);
            const badges = buildBadges(course);
            const starsHtml = buildStarsHtml(course.rating_avg || 0);
            const freshnessClass = getFreshnessClass(course.last_verified);
            const freshnessText = getFreshnessText(course.last_verified);
            const meta = buildMeta(course);

            return `
        <article class="course-card" style="animation-delay: ${i * 0.05}s" data-course-id="${course.id}">
          <div class="card-header">
            <h3 class="card-title">
              <a href="${escapeHtml(course.link)}" target="_blank" rel="noopener"
                 onclick="logCourseClick('${course.id}', '${escapeAttr(course.title)}', '${escapeAttr(course.platform || '')}')">
                ${escapeHtml(course.title)}
              </a>
            </h3>
            ${course.platform ? `<span class="card-platform ${platformClass}">${escapeHtml(course.platform)}</span>` : ''}
          </div>
          ${badges ? `<div class="card-badges">${badges}</div>` : ''}
          ${meta ? `<div class="card-meta">${meta}</div>` : ''}
          <div class="card-rating">
            <div class="stars" data-course-id="${course.id}" data-course-title="${escapeAttr(course.title)}">
              ${starsHtml}
            </div>
            <span class="rating-text">
              ${(course.rating_avg || 0).toFixed(1)}
              <span class="count">(${course.rating_count || 0})</span>
            </span>
            ${freshnessText ? `<span class="freshness ${freshnessClass}">${freshnessText}</span>` : ''}
          </div>
        </article>`;
        }).join('');

        // Bind star click
        dom.coursesGrid.querySelectorAll('.stars').forEach(el => {
            el.addEventListener('click', () => {
                openRatingPicker(el.dataset.courseId, el.dataset.courseTitle);
            });
        });
    }

    function getPlatformClass(platform) {
        if (!platform) return 'platform-other';
        const p = platform.toLowerCase();
        if (p.includes('coursera')) return 'platform-coursera';
        if (p.includes('edx')) return 'platform-edx';
        if (p.includes('udemy')) return 'platform-udemy';
        if (p.includes('khan')) return 'platform-khan';
        if (p.includes('udacity')) return 'platform-udacity';
        if (p.includes('futurelearn')) return 'platform-futurelearn';
        if (p.includes('linkedin')) return 'platform-linkedin';
        return 'platform-other';
    }

    function buildBadges(c) {
        const badges = [];
        if (c.category) badges.push(`<span class="badge badge-category">${escapeHtml(c.category)}</span>`);
        if (c.difficulty) {
            const cls = c.difficulty.toLowerCase();
            badges.push(`<span class="badge badge-difficulty-${cls}">${escapeHtml(c.difficulty)}</span>`);
        }
        if (c.cost) {
            const cls = c.cost.toLowerCase();
            badges.push(`<span class="badge badge-cost-${cls}">${escapeHtml(c.cost)}</span>`);
        }
        if (c.certification === 'Yes') badges.push(`<span class="badge badge-cert">Certificate</span>`);
        if (c.job_available === 'Yes') badges.push(`<span class="badge badge-job">Jobs</span>`);
        return badges.join('');
    }

    function buildMeta(c) {
        const items = [];
        if (c.institution) items.push(`<span class="card-meta-item">${escapeHtml(c.institution)}</span>`);
        if (c.instructor) items.push(`<span class="card-meta-item">${escapeHtml(c.instructor)}</span>`);
        if (c.duration) items.push(`<span class="card-meta-item">${escapeHtml(c.duration)}</span>`);
        if (c.language) items.push(`<span class="card-meta-item">${escapeHtml(c.language)}</span>`);
        return items.join('');
    }

    function buildStarsHtml(rating) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            const cls = i <= Math.round(rating) ? 'star' : 'star empty';
            html += `<span class="${cls}">&#9733;</span>`;
        }
        return html;
    }

    function getFreshnessClass(dateStr) {
        if (!dateStr) return 'freshness-red';
        const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
        if (days < 7) return 'freshness-green';
        if (days < 90) return 'freshness-yellow';
        return 'freshness-red';
    }

    function getFreshnessText(dateStr) {
        if (!dateStr) return 'Not verified';
        const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
        if (days === 0) return 'Checked today';
        if (days === 1) return 'Checked yesterday';
        return `Checked ${days}d ago`;
    }

    // ---- Pagination ----
    function renderPagination() {
        const totalPages = Math.ceil(state.totalCount / PER_PAGE);
        if (totalPages <= 1) {
            dom.pagination.innerHTML = '';
            return;
        }

        const current = state.currentPage;
        let html = '';

        html += `<button class="page-btn" ${current <= 1 ? 'disabled' : ''} data-page="${current - 1}">&laquo;</button>`;

        const range = getPageRange(current, totalPages, 5);
        range.forEach(p => {
            if (p === '...') {
                html += `<span class="page-btn" style="cursor:default;border:none">...</span>`;
            } else {
                html += `<button class="page-btn ${p === current ? 'active' : ''}" data-page="${p}">${p}</button>`;
            }
        });

        html += `<button class="page-btn" ${current >= totalPages ? 'disabled' : ''} data-page="${current + 1}">&raquo;</button>`;

        dom.pagination.innerHTML = html;

        dom.pagination.querySelectorAll('.page-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page, 10);
                if (page >= 1 && page <= totalPages) {
                    state.currentPage = page;
                    loadCourses();
                    logActivity('page_change', { page, total_pages: totalPages });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    function getPageRange(current, total, maxVisible) {
        if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i + 1);

        const range = [];
        const left = Math.max(2, current - 1);
        const right = Math.min(total - 1, current + 1);

        range.push(1);
        if (left > 2) range.push('...');
        for (let i = left; i <= right; i++) range.push(i);
        if (right < total - 1) range.push('...');
        range.push(total);

        return range;
    }

    function updateResultsCount() {
        const count = state.totalCount;
        const label = state.searchQuery ? 'results' : 'courses';
        dom.resultsCount.innerHTML = `<strong>${count}</strong> ${label}`;
    }

    // ---- Search ----
    function performSearch() {
        const query = dom.searchInput.value.trim();
        state.searchQuery = query;
        state.currentPage = 1;

        if (query.length > 3) {
            state.searchType = 'semantic';
        } else {
            state.searchType = 'keyword';
        }

        updateSearchMode();
        loadCourses();
    }

    function updateSearchMode() {
        if (state.searchType === 'semantic') {
            dom.searchMode.innerHTML = `<span class="dot"></span> AI semantic search active`;
        } else {
            dom.searchMode.innerHTML = `<span class="dot" style="background:var(--text-muted)"></span> Keyword search`;
        }
    }

    // ---- Filters ----
    function clearAllFilters() {
        Object.keys(state.filters).forEach(key => {
            state.filters[key] = '';
            dom.filters[key].value = '';
            dom.filters[key].classList.remove('has-value');
        });
        state.currentPage = 1;
        loadCourses();
    }

    function getActiveFilters() {
        const active = {};
        Object.entries(state.filters).forEach(([k, v]) => {
            if (v) active[k] = v;
        });
        return active;
    }

    // ---- Tabs ----
    function switchTab(tabId) {
        state.activeTab = tabId;
        dom.tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
        dom.tabPanels.forEach(panel => panel.classList.toggle('active', panel.id === `panel-${tabId}`));

        if (tabId === 'suggestions') loadSuggestions();
    }

    // ---- Load Suggestions ----
    async function loadSuggestions() {
        try {
            const { data } = await apiGet('suggestions', {
                'status': 'eq.pending',
                'order': 'created_at.desc'
            });
            state.suggestions = data;
            renderSuggestions();
        } catch (err) {
            console.error('Error loading suggestions:', err);
        }
    }

    function renderSuggestions() {
        if (!state.suggestions || state.suggestions.length === 0) {
            dom.suggestionsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#9993;</div>
          <h3>No pending suggestions</h3>
          <p>Be the first to suggest a course!</p>
        </div>`;
            return;
        }

        dom.suggestionsList.innerHTML = state.suggestions.map((s, i) => `
      <div class="suggestion-card" style="animation-delay: ${i * 0.05}s">
        <div class="flex-between">
          <h4 class="suggestion-title">
            <a href="${escapeHtml(s.link)}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a>
          </h4>
          <span class="badge badge-pending">Pending Review</span>
        </div>
        <div class="suggestion-meta">
          ${s.platform ? `<span>Platform: ${escapeHtml(s.platform)}</span>` : ''}
          ${s.user_name ? `<span>By: ${escapeHtml(s.user_name)}</span>` : ''}
          <span>${formatDate(s.created_at)}</span>
        </div>
        ${s.notes ? `<p class="suggestion-notes">"${escapeHtml(s.notes)}"</p>` : ''}
      </div>
    `).join('');
    }

    // ---- Suggestion Form ----
    async function handleSuggest(e) {
        e.preventDefault();

        // Honeypot check
        if (dom.sugHoneypot.value) return;

        const title = dom.sugTitle.value.trim();
        const link = dom.sugLink.value.trim();

        if (!title || title.length < 5) {
            showToast('Title must be at least 5 characters.', 'error');
            return;
        }
        if (!link || !link.match(/^https?:\/\//)) {
            showToast('Please enter a valid URL starting with http:// or https://', 'error');
            return;
        }

        const body = {
            title,
            link,
            platform: dom.sugPlatform.value.trim() || null,
            user_name: dom.sugName.value.trim() || null,
            user_email: dom.sugEmail.value.trim() || null,
            notes: dom.sugNotes.value.trim() || null
        };

        try {
            await apiPost('suggestions', body);
            showToast('Suggestion submitted! The admin will review it.', 'success');
            dom.suggestForm.reset();
            dom.duplicateWarning.classList.remove('visible');
            logActivity('suggestion', { title, link, platform: body.platform });
            if (state.activeTab === 'suggestions') loadSuggestions();
        } catch (err) {
            if (err.message && err.message.includes('already exists')) {
                showToast(err.message, 'error');
            } else {
                showToast('Failed to submit suggestion. Please try again.', 'error');
            }
            console.error('Suggestion error:', err);
        }
    }

    async function checkDuplicate() {
        const link = dom.sugLink.value.trim();
        if (!link || !link.match(/^https?:\/\//)) return;

        try {
            const { data } = await apiGet('courses', {
                'link': `eq.${link}`,
                'select': 'id,title',
                'limit': 1
            });
            if (data.length > 0) {
                dom.duplicateWarning.innerHTML = `&#9888; This course already exists: <strong>${escapeHtml(data[0].title)}</strong>`;
                dom.duplicateWarning.classList.add('visible');
            } else {
                dom.duplicateWarning.classList.remove('visible');
            }
        } catch (err) {
            // Silently ignore
        }
    }

    // ---- Ratings ----
    let pendingRating = { courseId: null, courseTitle: null };

    function openRatingPicker(courseId, courseTitle) {
        pendingRating = { courseId, courseTitle };
        dom.ratingCourseTitle.textContent = courseTitle;
        dom.ratingFeedback.textContent = '';
        dom.ratingStars.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
        dom.ratingOverlay.classList.add('active');
    }

    function closeRatingPicker() {
        dom.ratingOverlay.classList.remove('active');
    }

    function handleRatingHover(e) {
        const star = e.target.closest('.star');
        if (!star) return;
        const val = parseInt(star.dataset.value, 10);
        dom.ratingStars.querySelectorAll('.star').forEach(s => {
            s.classList.toggle('active', parseInt(s.dataset.value, 10) <= val);
        });
        const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
        dom.ratingFeedback.textContent = labels[val] || '';
    }

    function handleRatingHoverOut() {
        dom.ratingStars.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
        dom.ratingFeedback.textContent = '';
    }

    async function handleRatingClick(e) {
        const star = e.target.closest('.star');
        if (!star || !pendingRating.courseId) return;

        const rating = parseInt(star.dataset.value, 10);
        if (rating < 1 || rating > 5) return;

        try {
            await apiPost('ratings', {
                course_id: pendingRating.courseId,
                rating
            });
            showToast(`Rated "${pendingRating.courseTitle}" ${rating} stars!`, 'success');
            closeRatingPicker();
            logActivity('rating', { course_id: pendingRating.courseId, rating });

            // Reload courses to update rating display
            loadCourses();
        } catch (err) {
            if (err.message && err.message.includes('already rated')) {
                showToast('You have already rated this course.', 'error');
            } else {
                showToast('Failed to submit rating. Please try again.', 'error');
            }
            closeRatingPicker();
        }
    }

    // ---- Stats ----
    async function loadStats() {
        try {
            const { total: courseCount } = await apiGet('courses', {
                'status': 'eq.active',
                'select': 'id',
                'limit': 1
            });
            if (dom.headerCourseCount) dom.headerCourseCount.textContent = courseCount || 0;
        } catch (err) {
            // Silently ignore
        }
    }

    // ---- Activity Logging ----
    async function logActivity(action, details = {}) {
        try {
            const payload = {
                action,
                details,
                session_id: state.sessionId,
                screen_size: `${window.innerWidth}x${window.innerHeight}`,
                referrer: document.referrer || null
            };

            // Use sendBeacon for non-blocking logging
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                navigator.sendBeacon(`${FUNCTIONS_BASE}/log-activity`, blob);
            } else {
                fetch(`${FUNCTIONS_BASE}/log-activity`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY
                    },
                    body: JSON.stringify(payload),
                    keepalive: true
                }).catch(() => { });
            }
        } catch (err) {
            // Logging failures are silent
        }
    }

    // Global function for course click tracking
    window.logCourseClick = function (id, title, platform) {
        logActivity('course_click', { course_id: id, title, platform });
    };

    // ---- Toast ----
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        dom.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // ---- Loading ----
    function showLoading(show) {
        if (dom.loadingOverlay) {
            dom.loadingOverlay.classList.toggle('hidden', !show);
        }
    }

    // ---- Utilities ----
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

})();

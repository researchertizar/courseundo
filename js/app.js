/* ==========================================================================
   Courseundo — Public Interface Logic (app.js) — FIXED v2
   All DOM IDs are verified against index.html
   ========================================================================== */

(function () {
    'use strict';

    // ================================================================
    // CONFIGURATION — UPDATE THESE WITH YOUR ACTUAL VALUES
    // ================================================================
    const SUPABASE_URL = 'https://kvxfxpqbnmplcuadjmpc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2eGZ4cHFibm1wbGN1YWRqbXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDk2NjUsImV4cCI6MjA5NjIyNTY2NX0.GQ5glAUeNb_6wMS9OvGBu25WPFa1yDs_hquGfYLXS-c';

    const FUNCTIONS_BASE = SUPABASE_URL + '/functions/v1';
    const REST_BASE = SUPABASE_URL + '/rest/v1';
    const PER_PAGE = 20;

    // ================================================================
    // STATE
    // ================================================================
    var state = {
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
            'job-available': '',
            difficulty: '',
            cost: ''
        },
        sortBy: 'relevance',
        loading: false,
        sessionId: ''
    };

    // ================================================================
    // DOM CACHE
    // ================================================================
    var dom = {};

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
        dom.toastContainer = document.getElementById('toast-container');
        dom.ratingOverlay = document.getElementById('rating-overlay');
        dom.ratingStars = document.getElementById('rating-stars');
        dom.ratingFeedback = document.getElementById('rating-feedback');
        dom.ratingCourseTitle = document.getElementById('rating-course-title');
        dom.headerCourseCount = document.getElementById('header-course-count');

        // Filter selects — IDs match HTML exactly
        dom.filters = {
            'platform': document.getElementById('filter-platform'),
            'category': document.getElementById('filter-category'),
            'certification': document.getElementById('filter-certification'),
            'job-available': document.getElementById('filter-job-available'),
            'difficulty': document.getElementById('filter-difficulty'),
            'cost': document.getElementById('filter-cost')
        };

        // Tab buttons — querySelectorAll never returns null
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

        // Debug: log any missing elements
        var required = {
            searchInput: dom.searchInput,
            searchBtn: dom.searchBtn,
            coursesGrid: dom.coursesGrid,
            suggestForm: dom.suggestForm,
            sortSelect: dom.sortSelect,
            pagination: dom.pagination,
            ratingOverlay: dom.ratingOverlay,
            toastContainer: dom.toastContainer,
            suggestionsList: dom.suggestionsList
        };
        for (var key in required) {
            if (!required[key]) {
                console.error('[app.js] Missing DOM element: ' + key);
            }
        }
        for (var fKey in dom.filters) {
            if (!dom.filters[fKey]) {
                console.error('[app.js] Missing filter element: filter-' + fKey);
            }
        }
    }

    // ================================================================
    // INIT
    // ================================================================
    document.addEventListener('DOMContentLoaded', function () {
        cacheDom();
        initSession();
        bindEvents();
        loadCourses();
        loadStats();
    });

    function initSession() {
        var sid = sessionStorage.getItem('courseundo_session');
        if (!sid) {
            sid = 'sess_' + Math.random().toString(36).substring(2, 11);
            sessionStorage.setItem('courseundo_session', sid);
        }
        state.sessionId = sid;

        var saved = localStorage.getItem('courseundo_sort');
        if (saved) {
            state.sortBy = saved;
            if (dom.sortSelect) dom.sortSelect.value = saved;
        }

        logActivity('page_visit', { page: 'home', referrer: document.referrer });
    }

    // ================================================================
    // EVENT BINDING — with null checks on every element
    // ================================================================
    function bindEvents() {
        // Search
        if (dom.searchInput) {
            dom.searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') performSearch();
            });
        }
        if (dom.searchBtn) {
            dom.searchBtn.addEventListener('click', performSearch);
        }

        // Filters
        var filterKeys = Object.keys(dom.filters);
        for (var i = 0; i < filterKeys.length; i++) {
            (function (key) {
                var el = dom.filters[key];
                if (!el) return;
                el.addEventListener('change', function () {
                    state.filters[key] = el.value;
                    if (el.value) {
                        el.classList.add('has-value');
                    } else {
                        el.classList.remove('has-value');
                    }
                    state.currentPage = 1;
                    loadCourses();
                    if (el.value) {
                        logActivity('filter_used', { filter: key, value: el.value });
                    }
                });
            })(filterKeys[i]);
        }

        // Sort
        if (dom.sortSelect) {
            dom.sortSelect.addEventListener('change', function () {
                state.sortBy = dom.sortSelect.value;
                localStorage.setItem('courseundo_sort', state.sortBy);
                state.currentPage = 1;
                loadCourses();
                logActivity('sort_used', { sort: state.sortBy });
            });
        }

        // Clear filters
        if (dom.clearFilters) {
            dom.clearFilters.addEventListener('click', clearAllFilters);
        }

        // Tabs
        if (dom.tabBtns && dom.tabBtns.length) {
            dom.tabBtns.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    switchTab(btn.getAttribute('data-tab'));
                });
            });
        }

        // Suggestion form
        if (dom.suggestForm) {
            dom.suggestForm.addEventListener('submit', handleSuggest);
        }
        if (dom.sugLink) {
            dom.sugLink.addEventListener('blur', checkDuplicate);
        }

        // Rating overlay close on backdrop click
        if (dom.ratingOverlay) {
            dom.ratingOverlay.addEventListener('click', function (e) {
                if (e.target === dom.ratingOverlay) closeRatingPicker();
            });
        }

        // Rating stars
        if (dom.ratingStars) {
            dom.ratingStars.addEventListener('mouseover', handleRatingHover);
            dom.ratingStars.addEventListener('mouseout', handleRatingHoverOut);
            dom.ratingStars.addEventListener('click', handleRatingClick);
        }
    }

    // ================================================================
    // API HELPERS
    // ================================================================
    function apiGet(endpoint, params) {
        params = params || {};
        var url = REST_BASE + '/' + endpoint;
        var first = true;
        for (var key in params) {
            if (params[key] === '' || params[key] === undefined || params[key] === null) continue;
            url += (first ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
            first = false;
        }

        return fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
            }
        })
            .then(function (resp) {
                var countHeader = resp.headers.get('Content-Range');
                return resp.json().then(function (data) {
                    if (!resp.ok) throw new Error(data.message || 'API error ' + resp.status);
                    var total = Array.isArray(data) ? data.length : 0;
                    if (countHeader) {
                        var parts = countHeader.split('/');
                        if (parts[1] && parts[1] !== '*') total = parseInt(parts[1], 10);
                    }
                    return { data: data, total: total };
                });
            });
    }

    function apiPost(endpoint, body, isFunction) {
        var url = isFunction ? (FUNCTIONS_BASE + '/' + endpoint) : (REST_BASE + '/' + endpoint);
        var headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        };
        if (!isFunction) headers['Prefer'] = 'return=representation';

        return fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        })
            .then(function (resp) {
                return resp.json().then(function (data) {
                    if (!resp.ok) throw new Error(data.message || 'API error ' + resp.status);
                    return data;
                });
            });
    }

    // ================================================================
    // LOAD COURSES
    // ================================================================
    function loadCourses() {
        state.loading = true;
        showGridLoading(true);

        var query = state.searchQuery.trim();

        var promise;
        if (query.length > 0 && state.searchType === 'semantic') {
            promise = loadCoursesSemantic(query);
        } else if (query.length > 0) {
            promise = loadCoursesKeyword(query);
        } else {
            promise = loadCoursesBrowse();
        }

        promise
            .then(function (result) {
                state.courses = result.results;
                state.totalCount = result.total;
                renderCourses();
                renderPagination();
                updateResultsCount();

                if (query) {
                    logActivity('search', {
                        query: query,
                        results_count: result.total,
                        search_type: state.searchType
                    });
                }
            })
            .catch(function (err) {
                console.error('[app.js] Error loading courses:', err);
                if (dom.coursesGrid) {
                    dom.coursesGrid.innerHTML =
                        '<div class="empty-state"><div class="empty-state-icon">!</div>' +
                        '<h3>Something went wrong</h3><p>' + escapeHtml(err.message) + '</p></div>';
                }
            })
            .finally(function () {
                state.loading = false;
                showGridLoading(false);
            });
    }

    function loadCoursesBrowse() {
        var params = {
            'status': 'eq.active',
            'limit': PER_PAGE,
            'offset': (state.currentPage - 1) * PER_PAGE
        };
        addFilterParams(params);
        addSortParam(params);

        return apiGet('courses', params).then(function (resp) {
            return { results: resp.data, total: resp.total };
        });
    }

    function loadCoursesKeyword(query) {
        var orFilter = '(title.ilike.*' + query + '*,platform.ilike.*' + query + '*,institution.ilike.*' + query + '*,instructor.ilike.*' + query + '*)';
        var params = {
            'status': 'eq.active',
            'or': orFilter,
            'limit': PER_PAGE,
            'offset': (state.currentPage - 1) * PER_PAGE
        };
        addFilterParams(params);
        addSortParam(params);

        return apiGet('courses', params).then(function (resp) {
            return { results: resp.data, total: resp.total };
        });
    }

    function loadCoursesSemantic(query) {
        return apiPost('semantic-search', { query: query, limit: 100 }, true)
            .then(function (data) {
                if (data.fallback) {
                    state.searchType = 'keyword';
                    updateSearchMode();
                    return loadCoursesKeyword(query);
                }
                var results = data.results || [];
                results = applyClientFilters(results);
                var total = results.length;
                results = applyClientSort(results);
                results = paginateArray(results, state.currentPage, PER_PAGE);
                return { results: results, total: total };
            })
            .catch(function () {
                state.searchType = 'keyword';
                updateSearchMode();
                return loadCoursesKeyword(query);
            });
    }

    function addFilterParams(params) {
        var keys = Object.keys(state.filters);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var val = state.filters[key];
            if (val) params[key] = 'eq.' + val;
        }
    }

    function addSortParam(params) {
        var map = {
            'relevance': 'rating_avg.desc',
            'rating-high': 'rating_avg.desc',
            'rating-low': 'rating_avg.asc',
            'newest': 'created_at.desc',
            'oldest': 'created_at.asc',
            'alpha-az': 'title.asc',
            'alpha-za': 'title.desc',
            'cost-free': 'cost.asc'
        };
        params['order'] = map[state.sortBy] || 'rating_avg.desc';
    }

    function applyClientFilters(results) {
        return results.filter(function (c) {
            var keys = Object.keys(state.filters);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var val = state.filters[key];
                if (!val) continue;
                var courseVal = c[key] || '';
                if (courseVal.toLowerCase() !== val.toLowerCase()) return false;
            }
            return true;
        });
    }

    function applyClientSort(results) {
        var sorted = results.slice();
        switch (state.sortBy) {
            case 'rating-high': sorted.sort(function (a, b) { return (b.rating_avg || 0) - (a.rating_avg || 0); }); break;
            case 'rating-low': sorted.sort(function (a, b) { return (a.rating_avg || 0) - (b.rating_avg || 0); }); break;
            case 'newest': sorted.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }); break;
            case 'oldest': sorted.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); }); break;
            case 'alpha-az': sorted.sort(function (a, b) { return a.title.localeCompare(b.title); }); break;
            case 'alpha-za': sorted.sort(function (a, b) { return b.title.localeCompare(a.title); }); break;
            case 'cost-free': sorted.sort(function (a, b) { return (a.cost === 'Free' ? 0 : 1) - (b.cost === 'Free' ? 0 : 1); }); break;
            default: sorted.sort(function (a, b) { return (b.rating_avg || 0) - (a.rating_avg || 0); }); break;
        }
        return sorted;
    }

    function paginateArray(arr, page, perPage) {
        var start = (page - 1) * perPage;
        return arr.slice(start, start + perPage);
    }

    // ================================================================
    // RENDER COURSES
    // ================================================================
    function renderCourses() {
        if (!dom.coursesGrid) return;

        if (!state.courses || state.courses.length === 0) {
            dom.coursesGrid.innerHTML =
                '<div class="empty-state">' +
                '<div class="empty-state-icon">&#9744;</div>' +
                '<h3>No courses found</h3>' +
                '<p>Try adjusting your search or filters.</p></div>';
            return;
        }

        var html = '';
        for (var idx = 0; idx < state.courses.length; idx++) {
            var c = state.courses[idx];
            var platformClass = getPlatformClass(c.platform);
            var badges = buildBadges(c);
            var starsHtml = buildStarsHtml(c.rating_avg || 0);
            var freshnessClass = getFreshnessClass(c.last_verified);
            var freshnessText = getFreshnessText(c.last_verified);
            var meta = buildMeta(c);
            var delay = (idx * 0.05).toFixed(2);

            html +=
                '<article class="course-card" style="animation-delay:' + delay + 's" data-course-id="' + c.id + '">' +
                '<div class="card-header">' +
                '<h3 class="card-title">' +
                '<a href="' + escapeAttr(c.link) + '" target="_blank" rel="noopener" data-course-id="' + c.id + '" data-course-title="' + escapeAttr(c.title) + '" data-course-platform="' + escapeAttr(c.platform || '') + '" class="course-link">' +
                escapeHtml(c.title) +
                '</a>' +
                '</h3>' +
                (c.platform ? '<span class="card-platform ' + platformClass + '">' + escapeHtml(c.platform) + '</span>' : '') +
                '</div>' +
                (badges ? '<div class="card-badges">' + badges + '</div>' : '') +
                (meta ? '<div class="card-meta">' + meta + '</div>' : '') +
                '<div class="card-rating">' +
                '<div class="stars clickable-stars" data-course-id="' + c.id + '" data-course-title="' + escapeAttr(c.title) + '" role="button" tabindex="0" aria-label="Rate this course">' +
                starsHtml +
                '</div>' +
                '<span class="rating-text">' +
                (c.rating_avg || 0).toFixed(1) +
                ' <span class="count">(' + (c.rating_count || 0) + ')</span>' +
                '</span>' +
                (freshnessText ? '<span class="freshness ' + freshnessClass + '">' + freshnessText + '</span>' : '') +
                '</div>' +
                '</article>';
        }
        dom.coursesGrid.innerHTML = html;

        // Bind click tracking on course links
        var links = dom.coursesGrid.querySelectorAll('.course-link');
        for (var li = 0; li < links.length; li++) {
            links[li].addEventListener('click', function () {
                logActivity('course_click', {
                    course_id: this.getAttribute('data-course-id'),
                    title: this.getAttribute('data-course-title'),
                    platform: this.getAttribute('data-course-platform')
                });
            });
        }

        // Bind star clicks
        var starDivs = dom.coursesGrid.querySelectorAll('.clickable-stars');
        for (var si = 0; si < starDivs.length; si++) {
            (function (el) {
                el.addEventListener('click', function () {
                    openRatingPicker(el.getAttribute('data-course-id'), el.getAttribute('data-course-title'));
                });
                el.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openRatingPicker(el.getAttribute('data-course-id'), el.getAttribute('data-course-title'));
                    }
                });
            })(starDivs[si]);
        }
    }

    function getPlatformClass(platform) {
        if (!platform) return 'platform-other';
        var p = platform.toLowerCase();
        if (p.indexOf('coursera') !== -1) return 'platform-coursera';
        if (p.indexOf('edx') !== -1) return 'platform-edx';
        if (p.indexOf('udemy') !== -1) return 'platform-udemy';
        if (p.indexOf('khan') !== -1) return 'platform-khan';
        if (p.indexOf('udacity') !== -1) return 'platform-udacity';
        if (p.indexOf('futurelearn') !== -1) return 'platform-futurelearn';
        if (p.indexOf('linkedin') !== -1) return 'platform-linkedin';
        return 'platform-other';
    }

    function buildBadges(c) {
        var badges = '';
        if (c.category) badges += '<span class="badge badge-category">' + escapeHtml(c.category) + '</span>';
        if (c.difficulty) badges += '<span class="badge badge-difficulty-' + c.difficulty.toLowerCase() + '">' + escapeHtml(c.difficulty) + '</span>';
        if (c.cost) badges += '<span class="badge badge-cost-' + c.cost.toLowerCase() + '">' + escapeHtml(c.cost) + '</span>';
        if (c.certification === 'Yes') badges += '<span class="badge badge-cert">Certificate</span>';
        if (c.job_available === 'Yes') badges += '<span class="badge badge-job">Jobs</span>';
        return badges;
    }

    function buildMeta(c) {
        var items = '';
        if (c.institution) items += '<span class="card-meta-item">' + escapeHtml(c.institution) + '</span>';
        if (c.instructor) items += '<span class="card-meta-item">' + escapeHtml(c.instructor) + '</span>';
        if (c.duration) items += '<span class="card-meta-item">' + escapeHtml(c.duration) + '</span>';
        if (c.language) items += '<span class="card-meta-item">' + escapeHtml(c.language) + '</span>';
        return items;
    }

    function buildStarsHtml(rating) {
        var html = '';
        var rounded = Math.round(rating);
        for (var i = 1; i <= 5; i++) {
            html += '<span class="star ' + (i <= rounded ? '' : 'empty') + '">&#9733;</span>';
        }
        return html;
    }

    function getFreshnessClass(dateStr) {
        if (!dateStr) return 'freshness-red';
        var days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
        if (days < 7) return 'freshness-green';
        if (days < 90) return 'freshness-yellow';
        return 'freshness-red';
    }

    function getFreshnessText(dateStr) {
        if (!dateStr) return 'Not verified';
        var days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
        if (days === 0) return 'Checked today';
        if (days === 1) return 'Checked yesterday';
        return 'Checked ' + days + 'd ago';
    }

    // ================================================================
    // PAGINATION
    // ================================================================
    function renderPagination() {
        if (!dom.pagination) return;
        var totalPages = Math.ceil(state.totalCount / PER_PAGE);
        if (totalPages <= 1) { dom.pagination.innerHTML = ''; return; }

        var current = state.currentPage;
        var html = '';
        html += '<button class="page-btn" data-page="' + (current - 1) + '"' + (current <= 1 ? ' disabled' : '') + '>&laquo;</button>';

        var range = getPageRange(current, totalPages, 5);
        for (var i = 0; i < range.length; i++) {
            if (range[i] === '...') {
                html += '<span class="page-btn" style="cursor:default;border:none">...</span>';
            } else {
                html += '<button class="page-btn' + (range[i] === current ? ' active' : '') + '" data-page="' + range[i] + '">' + range[i] + '</button>';
            }
        }

        html += '<button class="page-btn" data-page="' + (current + 1) + '"' + (current >= totalPages ? ' disabled' : '') + '>&raquo;</button>';
        dom.pagination.innerHTML = html;

        var btns = dom.pagination.querySelectorAll('.page-btn[data-page]');
        for (var j = 0; j < btns.length; j++) {
            (function (btn) {
                btn.addEventListener('click', function () {
                    var page = parseInt(btn.getAttribute('data-page'), 10);
                    if (page >= 1 && page <= totalPages) {
                        state.currentPage = page;
                        loadCourses();
                        logActivity('page_change', { page: page, total_pages: totalPages });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            })(btns[j]);
        }
    }

    function getPageRange(current, total, maxVisible) {
        if (total <= maxVisible) {
            var arr = [];
            for (var i = 1; i <= total; i++) arr.push(i);
            return arr;
        }
        var range = [];
        var left = Math.max(2, current - 1);
        var right = Math.min(total - 1, current + 1);
        range.push(1);
        if (left > 2) range.push('...');
        for (var j = left; j <= right; j++) range.push(j);
        if (right < total - 1) range.push('...');
        range.push(total);
        return range;
    }

    function updateResultsCount() {
        if (!dom.resultsCount) return;
        var label = state.searchQuery ? 'results' : 'courses';
        dom.resultsCount.innerHTML = '<strong>' + state.totalCount + '</strong> ' + label;
    }

    // ================================================================
    // SEARCH
    // ================================================================
    function performSearch() {
        if (!dom.searchInput) return;
        var query = dom.searchInput.value.trim();
        state.searchQuery = query;
        state.currentPage = 1;
        state.searchType = query.length > 3 ? 'semantic' : 'keyword';
        updateSearchMode();
        loadCourses();
    }

    function updateSearchMode() {
        if (!dom.searchMode) return;
        if (state.searchType === 'semantic') {
            dom.searchMode.innerHTML = '<span class="dot"></span> AI semantic search active';
        } else {
            dom.searchMode.innerHTML = '<span class="dot" style="background:var(--text-muted)"></span> Keyword search';
        }
    }

    // ================================================================
    // FILTERS
    // ================================================================
    function clearAllFilters() {
        var keys = Object.keys(state.filters);
        for (var i = 0; i < keys.length; i++) {
            state.filters[keys[i]] = '';
            if (dom.filters[keys[i]]) {
                dom.filters[keys[i]].value = '';
                dom.filters[keys[i]].classList.remove('has-value');
            }
        }
        state.currentPage = 1;
        loadCourses();
    }

    // ================================================================
    // TABS
    // ================================================================
    function switchTab(tabId) {
        state.activeTab = tabId;

        if (dom.tabBtns) {
            dom.tabBtns.forEach(function (btn) {
                if (btn.getAttribute('data-tab') === tabId) {
                    btn.classList.add('active');
                    btn.setAttribute('aria-selected', 'true');
                } else {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-selected', 'false');
                }
            });
        }

        if (dom.tabPanels) {
            dom.tabPanels.forEach(function (panel) {
                if (panel.id === 'panel-' + tabId) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });
        }

        if (tabId === 'suggestions') loadSuggestions();
    }

    // ================================================================
    // SUGGESTIONS
    // ================================================================
    function loadSuggestions() {
        apiGet('suggestions', {
            'status': 'eq.pending',
            'order': 'created_at.desc'
        })
            .then(function (resp) {
                state.suggestions = resp.data;
                renderSuggestions();
            })
            .catch(function (err) {
                console.error('[app.js] Error loading suggestions:', err);
            });
    }

    function renderSuggestions() {
        if (!dom.suggestionsList) return;

        if (!state.suggestions || state.suggestions.length === 0) {
            dom.suggestionsList.innerHTML =
                '<div class="empty-state">' +
                '<div class="empty-state-icon">&#9993;</div>' +
                '<h3>No pending suggestions</h3>' +
                '<p>Be the first to suggest a course!</p></div>';
            return;
        }

        var html = '';
        for (var i = 0; i < state.suggestions.length; i++) {
            var s = state.suggestions[i];
            html +=
                '<div class="suggestion-card" style="animation-delay:' + (i * 0.05).toFixed(2) + 's">' +
                '<div class="flex-between">' +
                '<h4 class="suggestion-title"><a href="' + escapeAttr(s.link) + '" target="_blank" rel="noopener">' + escapeHtml(s.title) + '</a></h4>' +
                '<span class="badge badge-pending">Pending Review</span>' +
                '</div>' +
                '<div class="suggestion-meta">' +
                (s.platform ? '<span>Platform: ' + escapeHtml(s.platform) + '</span>' : '') +
                (s.user_name ? '<span>By: ' + escapeHtml(s.user_name) + '</span>' : '') +
                '<span>' + formatDate(s.created_at) + '</span>' +
                '</div>' +
                (s.notes ? '<p class="suggestion-notes">"' + escapeHtml(s.notes) + '"</p>' : '') +
                '</div>';
        }
        dom.suggestionsList.innerHTML = html;
    }

    // ================================================================
    // SUGGESTION FORM
    // ================================================================
    function handleSuggest(e) {
        e.preventDefault();

        // Honeypot
        if (dom.sugHoneypot && dom.sugHoneypot.value) return;

        var title = dom.sugTitle ? dom.sugTitle.value.trim() : '';
        var link = dom.sugLink ? dom.sugLink.value.trim() : '';

        if (!title || title.length < 5) {
            showToast('Title must be at least 5 characters.', 'error');
            return;
        }
        if (!link || !link.match(/^https?:\/\//)) {
            showToast('Please enter a valid URL.', 'error');
            return;
        }

        var body = {
            title: title,
            link: link,
            platform: dom.sugPlatform ? dom.sugPlatform.value.trim() : '',
            user_name: dom.sugName ? dom.sugName.value.trim() : '',
            user_email: dom.sugEmail ? dom.sugEmail.value.trim() : '',
            notes: dom.sugNotes ? dom.sugNotes.value.trim() : ''
        };

        // Remove empty optional fields
        if (!body.platform) delete body.platform;
        if (!body.user_name) delete body.user_name;
        if (!body.user_email) delete body.user_email;
        if (!body.notes) delete body.notes;

        apiPost('suggestions', body, false)
            .then(function () {
                showToast('Suggestion submitted! The admin will review it.', 'success');
                if (dom.suggestForm) dom.suggestForm.reset();
                if (dom.duplicateWarning) dom.duplicateWarning.classList.remove('visible');
                logActivity('suggestion', { title: title, link: link });
                if (state.activeTab === 'suggestions') loadSuggestions();
            })
            .catch(function (err) {
                showToast(err.message || 'Failed to submit suggestion.', 'error');
            });
    }

    function checkDuplicate() {
        var link = dom.sugLink ? dom.sugLink.value.trim() : '';
        if (!link || !link.match(/^https?:\/\//)) return;

        apiGet('courses', { 'link': 'eq.' + link, 'select': 'id,title', 'limit': 1 })
            .then(function (resp) {
                if (resp.data.length > 0 && dom.duplicateWarning) {
                    dom.duplicateWarning.innerHTML = '&#9888; This course already exists: <strong>' + escapeHtml(resp.data[0].title) + '</strong>';
                    dom.duplicateWarning.classList.add('visible');
                } else if (dom.duplicateWarning) {
                    dom.duplicateWarning.classList.remove('visible');
                }
            })
            .catch(function () { /* silent */ });
    }

    // ================================================================
    // RATINGS
    // ================================================================
    var pendingRating = { courseId: null, courseTitle: null };

    function openRatingPicker(courseId, courseTitle) {
        pendingRating = { courseId: courseId, courseTitle: courseTitle };
        if (dom.ratingCourseTitle) dom.ratingCourseTitle.textContent = courseTitle;
        if (dom.ratingFeedback) dom.ratingFeedback.textContent = '';
        if (dom.ratingStars) {
            var stars = dom.ratingStars.querySelectorAll('.star');
            for (var i = 0; i < stars.length; i++) stars[i].classList.remove('active');
        }
        if (dom.ratingOverlay) dom.ratingOverlay.classList.add('active');
    }

    function closeRatingPicker() {
        if (dom.ratingOverlay) dom.ratingOverlay.classList.remove('active');
    }

    function handleRatingHover(e) {
        var star = e.target.closest('.star');
        if (!star || !dom.ratingStars) return;
        var val = parseInt(star.getAttribute('data-value'), 10);
        var stars = dom.ratingStars.querySelectorAll('.star');
        for (var i = 0; i < stars.length; i++) {
            if (parseInt(stars[i].getAttribute('data-value'), 10) <= val) {
                stars[i].classList.add('active');
            } else {
                stars[i].classList.remove('active');
            }
        }
        var labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
        if (dom.ratingFeedback) dom.ratingFeedback.textContent = labels[val] || '';
    }

    function handleRatingHoverOut() {
        if (!dom.ratingStars) return;
        var stars = dom.ratingStars.querySelectorAll('.star');
        for (var i = 0; i < stars.length; i++) stars[i].classList.remove('active');
        if (dom.ratingFeedback) dom.ratingFeedback.textContent = '';
    }

    function handleRatingClick(e) {
        var star = e.target.closest('.star');
        if (!star || !pendingRating.courseId) return;

        var rating = parseInt(star.getAttribute('data-value'), 10);
        if (rating < 1 || rating > 5) return;

        apiPost('ratings', { course_id: pendingRating.courseId, rating: rating }, false)
            .then(function () {
                showToast('Rated "' + pendingRating.courseTitle + '" ' + rating + ' stars!', 'success');
                closeRatingPicker();
                logActivity('rating', { course_id: pendingRating.courseId, rating: rating });
                loadCourses();
            })
            .catch(function (err) {
                if (err.message && err.message.indexOf('already rated') !== -1) {
                    showToast('You have already rated this course.', 'error');
                } else {
                    showToast('Failed to submit rating.', 'error');
                }
                closeRatingPicker();
            });
    }

    // ================================================================
    // STATS
    // ================================================================
    function loadStats() {
        apiGet('courses', { 'status': 'eq.active', 'select': 'id', 'limit': 1 })
            .then(function (resp) {
                if (dom.headerCourseCount) dom.headerCourseCount.textContent = resp.total || 0;
            })
            .catch(function () { });
    }

    // ================================================================
    // ACTIVITY LOGGING
    // ================================================================
    function logActivity(action, details) {
        details = details || {};
        try {
            var payload = JSON.stringify({
                action: action,
                details: details,
                session_id: state.sessionId,
                screen_size: window.innerWidth + 'x' + window.innerHeight,
                referrer: document.referrer || null
            });

            if (navigator.sendBeacon) {
                var blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon(FUNCTIONS_BASE + '/log-activity', blob);
            } else {
                fetch(FUNCTIONS_BASE + '/log-activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
                    body: payload,
                    keepalive: true
                }).catch(function () { });
            }
        } catch (err) { /* silent */ }
    }

    // ================================================================
    // UI HELPERS
    // ================================================================
    function showToast(message, type) {
        type = type || 'info';
        if (!dom.toastContainer) return;
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        dom.toastContainer.appendChild(toast);
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 4000);
    }

    function showGridLoading(show) {
        if (!dom.coursesGrid) return;
        if (show) {
            dom.coursesGrid.innerHTML =
                '<div class="loading-spinner" style="grid-column:1/-1"><div class="spinner"></div><span class="loading-text">Loading courses...</span></div>';
        }
    }

    // ================================================================
    // UTILITIES
    // ================================================================
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

})();

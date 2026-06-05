(function () {
    'use strict';

    // ===== CONFIG =====
    var SUPABASE_URL = 'https://kvxfxpqbnmplcuadjmpc.supabase.co'.replace(/\/+$/, '');
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2eGZ4cHFibm1wbGN1YWRqbXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDk2NjUsImV4cCI6MjA5NjIyNTY2NX0.GQ5glAUeNb_6wMS9OvGBu25WPFa1yDs_hquGfYLXS-c';
    var FN = SUPABASE_URL + '/functions/v1';
    var REST = SUPABASE_URL + '/rest/v1';
    var PER_PAGE = 20;

    // ===== STATE =====
    var S = {
        courses: [], suggestions: [], total: 0, page: 1, tab: 'courses',
        query: '', searchType: 'keyword',
        filters: { platform: '', category: '', 'job-available': '', difficulty: '', cost: '', certification: '' },
        sort: localStorage.getItem('cu_sort') || 'relevance',
        sid: ''
    };

    // ===== DOM =====
    var $ = function (id) { return document.getElementById(id); };
    var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
    var D = {};

    function cache() {
        D.searchInput = ('search-input'); D.searchBtn = $('search-btn'); D.searchMode = $('search-mode');
        D.clearFilters = $('clear-filters'); D.resultsCount = $('results-count');
        D.sortSelect = $('sort-select'); D.grid = $('courses-grid');
        D.sugList = $('suggestions-list'); D.sugForm = $('suggest-form');
        D.pagination = $('pagination'); D.toasts = $('toast-container');
        D.rateOverlay = $('rating-overlay'); D.rateStars = $('rating-stars');
        D.rateFeedback = $('rating-feedback'); D.rateTitle = $('rating-course-title');
        D.courseCount = $('header-course-count');
        D.sugTitle = $('sug-title'); D.sugLink = $('sug-link'); D.sugPlatform = $('sug-platform');
        D.sugName = $('sug-name'); D.sugEmail = $('sug-email'); D.sugNotes = $('sug-notes');
        D.hp = $('sug-website'); D.dupWarn = $('duplicate-warning');
        D.tabBtns = $$$$('.tab-btn'); D.tabPanels = $$('.tab-panel');
        D.filt = {};
        ['platform', 'category', 'job-available', 'difficulty', 'cost', 'certification'].forEach(function (k) {
            D.filt[k] = ('filter-' + k);
        });
    }

    // ===== INIT =====
    document.addEventListener('DOMContentLoaded', function () {
        cache();
        var sid = sessionStorage.getItem('cu_sid');
        if (!sid) { sid = 's_' + Math.random().toString(36).substr(2, 9); sessionStorage.setItem('cu_sid', sid); }
        S.sid = sid;
        if (D.sortSelect) D.sortSelect.value = S.sort;
        bind();
        loadCourses();
        loadStats();
        log('page_visit', { page: 'home' });
    });

    // ===== EVENTS =====
    function bind() {
        on(D.searchInput, 'keydown', function (e) { if (e.key === 'Enter') search(); });
        on(D.searchBtn, 'click', search);
        on(D.clearFilters, 'click', clearFilters);
        on(D.sortSelect, 'change', function () { S.sort = D.sortSelect.value; localStorage.setItem('cu_sort', S.sort); S.page = 1; loadCourses(); log('sort_used', { sort: S.sort }); });

        Object.keys(D.filt).forEach(function (k) {
            on(D.filt[k], 'change', function () {
                S.filters[k] = D.filt[k].value;
                D.filt[k].classList.toggle('has-value', !!D.filt[k].value);
                S.page = 1;
                loadCourses();
                if (D.filt[k].value) log('filter_used', { filter: k, value: D.filt[k].value });
            });
        });

        D.tabBtns.forEach(function (b) { on(b, 'click', function () { switchTab(b.getAttribute('data-tab')); }); });
        on(D.sugForm, 'submit', submitSuggestion);
        on(D.sugLink, 'blur', checkDup);
        on(D.rateOverlay, 'click', function (e) { if (e.target === D.rateOverlay) closeRate(); });
        on(D.rateStars, 'mouseover', rateHover);
        on(D.rateStars, 'mouseout', rateHoverOut);
        on(D.rateStars, 'click', rateClick);
    }

    function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

    // ===== API =====
    function get(ep, params) {
        var url = REST + '/' + ep;
        var first = true;
        for (var k in params) {
            if (params[k] === '' || params[k] == null) continue;
            url += (first ? '?' : '&') + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
            first = false;
        }
        return fetch(url, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY } })
            .then(function (r) {
                var cr = r.headers.get('Content-Range');
                return r.json().then(function (d) {
                    if (!r.ok) throw new Error(d.message || 'Error ' + r.status);
                    var t = Array.isArray(d) ? d.length : 0;
                    if (cr) { var p = cr.split('/'); if (p[1] && p[1] !== '*') t = parseInt(p[1], 10); }
                    return { data: d, total: t };
                });
            });
    }

    function post(ep, body, isFn) {
        var url = isFn ? FN + '/' + ep : REST + '/' + ep;
        var h = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
        if (!isFn) h['Prefer'] = 'return=representation';
        return fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) })
            .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.message || 'Error ' + r.status); return d; }); });
    }

    // ===== COURSES =====
    function loadCourses() {
        showLoading();
        var q = S.query.trim();
        var p;
        if (q.length > 0 && S.searchType === 'semantic') p = loadSemantic(q);
        else if (q.length > 0) p = loadKeyword(q);
        else p = loadBrowse();

        p.then(function (res) {
            S.courses = res.results; S.total = res.total;
            renderCourses(); renderPages(); updateCount();
            if (q) log('search', { query: q, count: res.total, type: S.searchType });
        }).catch(function (err) {
            if (D.grid) D.grid.innerHTML = '<div class="empty-state"><h3>Error</h3><p>' + esc(err.message) + '</p></div>';
        });
    }

    function loadBrowse() {
        var pr = { status: 'eq.active', limit: PER_PAGE, offset: (S.page - 1) * PER_PAGE };
        addFilters(pr); addSort(pr);
        return get('courses', pr).then(function (r) { return { results: r.data, total: r.total }; });
    }

    function loadKeyword(q) {
        var pr = { status: 'eq.active', or: '(title.ilike.*' + q + '*,platform.ilike.*' + q + '*,institution.ilike.*' + q + '*,instructor.ilike.*' + q + '*)', limit: PER_PAGE, offset: (S.page - 1) * PER_PAGE };
        addFilters(pr); addSort(pr);
        return get('courses', pr).then(function (r) { return { results: r.data, total: r.total }; });
    }

    function loadSemantic(q) {
        return post('semantic-search', { query: q, limit: 100 }, true).then(function (d) {
            if (d.fallback) { S.searchType = 'keyword'; updateMode(); return loadKeyword(q); }
            var res = clientFilter(d.results || []);
            res = clientSort(res);
            var tot = res.length;
            res = res.slice((S.page - 1) * PER_PAGE, S.page * PER_PAGE);
            return { results: res, total: tot };
        }).catch(function () { S.searchType = 'keyword'; updateMode(); return loadKeyword(q); });
    }

    function addFilters(pr) {
        for (var k in S.filters) { if (S.filters[k]) pr[k] = 'eq.' + S.filters[k]; }
    }
    function addSort(pr) {
        var m = { relevance: 'rating_avg.desc', 'rating-high': 'rating_avg.desc', 'rating-low': 'rating_avg.asc', newest: 'created_at.desc', oldest: 'created_at.asc', 'alpha-az': 'title.asc', 'alpha-za': 'title.desc', 'cost-free': 'cost.asc' };
        pr.order = m[S.sort] || 'rating_avg.desc';
    }
    function clientFilter(arr) {
        return arr.filter(function (c) {
            for (var k in S.filters) { if (S.filters[k] && (c[k] || '').toLowerCase() !== S.filters[k].toLowerCase()) return false; }
            return true;
        });
    }
    function clientSort(arr) {
        var a = arr.slice();
        switch (S.sort) {
            case 'rating-high': a.sort(function (x, y) { return (y.rating_avg || 0) - (x.rating_avg || 0); }); break;
            case 'rating-low': a.sort(function (x, y) { return (x.rating_avg || 0) - (y.rating_avg || 0); }); break;
            case 'newest': a.sort(function (x, y) { return new Date(y.created_at) - new Date(x.created_at); }); break;
            case 'oldest': a.sort(function (x, y) { return new Date(x.created_at) - new Date(y.created_at); }); break;
            case 'alpha-az': a.sort(function (x, y) { return x.title.localeCompare(y.title); }); break;
            case 'alpha-za': a.sort(function (x, y) { return y.title.localeCompare(x.title); }); break;
            case 'cost-free': a.sort(function (x, y) { return (x.cost === 'Free' ? 0 : 1) - (y.cost === 'Free' ? 0 : 1); }); break;
            default: a.sort(function (x, y) { return (y.rating_avg || 0) - (x.rating_avg || 0); });
        }
        return a;
    }

    // ===== RENDER COURSES =====
    function renderCourses() {
        if (!D.grid) return;
        if (!S.courses.length) { D.grid.innerHTML = '<div class="empty-state"><h3>No courses found</h3><p>Try adjusting your search.</p></div>'; return; }
        var h = '';
        S.courses.forEach(function (c, i) {
            var pCls = platCls(c.platform);
            h += '<article class="course-card" style="animation-delay:' + (i * 0.04).toFixed(2) + 's" data-id="' + c.id + '">' +
                '<div class="card-header">' +
                '<h3 class="card-title"><a href="' + escA(c.link) + '" target="_blank" rel="noopener" data-cid="' + c.id + '" data-ct="' + escA(c.title) + '" data-cp="' + escA(c.platform || '') + '" class="clink">' + esc(c.title) + '</a></h3>' +
                (c.platform ? '<span class="card-platform ' + pCls + '">' + esc(c.platform) + '</span>' : '') +
                '</div>' +
                badges(c) +
                meta(c) +
                '<div class="card-rating">' +
                '<div class="stars cstars" data-cid="' + c.id + '" data-ct="' + escA(c.title) + '" role="button" tabindex="0" aria-label="Rate">' + stars(c.rating_avg || 0) + '</div>' +
                '<span class="rating-text">' + (c.rating_avg || 0).toFixed(1) + ' <span class="count">(' + (c.rating_count || 0) + ')</span></span>' +
                freshness(c.last_verified) +
                '</div>' +
                '</article>';
        });
        D.grid.innerHTML = h;

        $$$$('.clink').forEach(function (a) { on(a, 'click', function () { log('course_click', { id: a.getAttribute('data-cid'), title: a.getAttribute('data-ct'), platform: a.getAttribute('data-cp') }); }); });
        $$('.cstars').forEach(function (el) {
            on(el, 'click', function () { openRate(el.getAttribute('data-cid'), el.getAttribute('data-ct')); });
            on(el, 'keydown', function (e) { if (e.key === 'Enter') openRate(el.getAttribute('data-cid'), el.getAttribute('data-ct')); });
        });
    }

    function platCls(p) {
        if (!p) return 'platform-other';
        p = p.toLowerCase();
        if (p.indexOf('coursera') !== -1) return 'platform-coursera';
        if (p.indexOf('edx') !== -1) return 'platform-edx';
        if (p.indexOf('udemy') !== -1) return 'platform-udemy';
        if (p.indexOf('khan') !== -1) return 'platform-khan';
        if (p.indexOf('udacity') !== -1) return 'platform-udacity';
        if (p.indexOf('futurelearn') !== -1) return 'platform-futurelearn';
        if (p.indexOf('linkedin') !== -1) return 'platform-linkedin';
        return 'platform-other';
    }
    function badges(c) {
        var b = '';
        if (c.category) b += '<span class="badge badge-category">' + esc(c.category) + '</span>';
        if (c.difficulty) b += '<span class="badge badge-difficulty-' + c.difficulty.toLowerCase() + '">' + esc(c.difficulty) + '</span>';
        if (c.cost) b += '<span class="badge badge-cost-' + c.cost.toLowerCase() + '">' + esc(c.cost) + '</span>';
        if (c.certification === 'Yes') b += '<span class="badge badge-cert">Certificate</span>';
        if (c.job_available === 'Yes') b += '<span class="badge badge-job">Jobs</span>';
        return b ? '<div class="card-badges">' + b + '</div>' : '';
    }
    function meta(c) {
        var m = '';
        if (c.institution) m += '<span class="card-meta-item">' + esc(c.institution) + '</span>';
        if (c.instructor) m += '<span class="card-meta-item">' + esc(c.instructor) + '</span>';
        if (c.duration) m += '<span class="card-meta-item">' + esc(c.duration) + '</span>';
        return m ? '<div class="card-meta">' + m + '</div>' : '';
    }
    function stars(r) {
        var h = '', n = Math.round(r);
        for (var i = 1; i <= 5; i++) h += '<span class="star' + (i > n ? ' empty' : '') + '">&#9733;</span>';
        return h;
    }
    function freshness(d) {
        if (!d) return '<span class="freshness freshness-red">Not verified</span>';
        var days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
        if (days < 7) return '<span class="freshness freshness-green">Checked ' + days + 'd ago</span>';
        if (days < 90) return '<span class="freshness freshness-yellow">Checked ' + days + 'd ago</span>';
        return '<span class="freshness freshness-red">Checked ' + days + 'd ago</span>';
    }

    // ===== PAGINATION =====
    function renderPages() {
        if (!D.pagination) return;
        var tp = Math.ceil(S.total / PER_PAGE);
        if (tp <= 1) { D.pagination.innerHTML = ''; return; }
        var h = '<button class="page-btn" data-p="' + (S.page - 1) + '"' + (S.page <= 1 ? ' disabled' : '') + '>&laquo;</button>';
        for (var i = 1; i <= tp; i++) {
            if (tp > 7 && i > 2 && i < tp - 1 && Math.abs(i - S.page) > 1) { if (i === 3 || i === tp - 2) h += '<span class="page-btn" style="border:none;cursor:default">...</span>'; continue; }
            h += '<button class="page-btn' + (i === S.page ? ' active' : '') + '" data-p="' + i + '">' + i + '</button>';
        }
        h += '<button class="page-btn" data-p="' + (S.page + 1) + '"' + (S.page >= tp ? ' disabled' : '') + '>&raquo;</button>';
        D.pagination.innerHTML = h;
        $$('.page-btn[data-p]').forEach(function (b) {
            on(b, 'click', function () {
                var p = parseInt(b.getAttribute('data-p'), 10);
                if (p >= 1 && p <= tp) { S.page = p; loadCourses(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
            });
        });
    }
    function updateCount() { if (D.resultsCount) D.resultsCount.innerHTML = '<strong>' + S.total + '</strong> ' + (S.query ? 'results' : 'courses'); }

    // ===== SEARCH =====
    function search() {
        S.query = (D.searchInput ? D.searchInput.value : '').trim();
        S.page = 1;
        S.searchType = S.query.length > 3 ? 'semantic' : 'keyword';
        updateMode();
        loadCourses();
    }
    function updateMode() {
        if (!D.searchMode) return;
        D.searchMode.innerHTML = S.searchType === 'semantic'
            ? '<span class="dot"></span> AI semantic search'
            : '<span class="dot" style="background:var(--text-muted)"></span> Keyword search';
    }

    // ===== FILTERS =====
    function clearFilters() {
        for (var k in S.filters) { S.filters[k] = ''; if (D.filt[k]) { D.filt[k].value = ''; D.filt[k].classList.remove('has-value'); } }
        S.page = 1; loadCourses();
    }

    // ===== TABS =====
    function switchTab(id) {
        S.tab = id;
        D.tabBtns.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === id); });
        D.tabPanels.forEach(function (p) { p.classList.toggle('active', p.id === 'panel-' + id); });
        if (id === 'suggestions') loadSuggestions();
    }

    // ===== SUGGESTIONS =====
    function loadSuggestions() {
        get('suggestions', { status: 'eq.pending', order: 'created_at.desc' }).then(function (r) {
            S.suggestions = r.data;
            if (!D.sugList) return;
            if (!r.data.length) { D.sugList.innerHTML = '<div class="empty-state"><h3>No pending suggestions</h3></div>'; return; }
            var h = '';
            r.data.forEach(function (s, i) {
                h += '<div class="suggestion-card" style="animation-delay:' + (i * 0.04) + 's">' +
                    '<div class="flex-between"><h4 class="suggestion-title"><a href="' + escA(s.link) + '" target="_blank">' + esc(s.title) + '</a></h4><span class="badge badge-pending">Pending</span></div>' +
                    '<div class="suggestion-meta">' + (s.platform ? '<span>' + esc(s.platform) + '</span>' : '') + (s.user_name ? '<span>By: ' + esc(s.user_name) + '</span>' : '') + '<span>' + fmtDate(s.created_at) + '</span></div>' +
                    (s.notes ? '<p class="suggestion-notes">"' + esc(s.notes) + '"</p>' : '') + '</div>';
            });
            D.sugList.innerHTML = h;
        }).catch(function () { });
    }

    function submitSuggestion(e) {
        e.preventDefault();
        if (D.hp && D.hp.value) return;
        var title = D.sugTitle ? D.sugTitle.value.trim() : '';
        var link = D.sugLink ? D.sugLink.value.trim() : '';
        if (!title || title.length < 5) { toast('Title must be 5+ characters.', 'error'); return; }
        if (!link || !/^https?:\/\//.test(link)) { toast('Enter a valid URL.', 'error'); return; }
        var body = { title: title, link: link };
        var plat = D.sugPlatform ? D.sugPlatform.value.trim() : '';
        var name = D.sugName ? D.sugName.value.trim() : '';
        var email = D.sugEmail ? D.sugEmail.value.trim() : '';
        var notes = D.sugNotes ? D.sugNotes.value.trim() : '';
        if (plat) body.platform = plat;
        if (name) body.user_name = name;
        if (email) body.user_email = email;
        if (notes) body.notes = notes;
        post('suggestions', body).then(function () {
            toast('Suggestion submitted!', 'success');
            if (D.sugForm) D.sugForm.reset();
            if (D.dupWarn) D.dupWarn.classList.remove('visible');
            log('suggestion', { title: title, link: link });
            if (S.tab === 'suggestions') loadSuggestions();
        }).catch(function (err) { toast(err.message || 'Submit failed.', 'error'); });
    }

    function checkDup() {
        var link = D.sugLink ? D.sugLink.value.trim() : '';
        if (!link || !/^https?:\/\//.test(link)) return;
        get('courses', { link: 'eq.' + link, select: 'id,title', limit: 1 }).then(function (r) {
            if (r.data.length && D.dupWarn) { D.dupWarn.innerHTML = '&#9888; Already exists: <strong>' + esc(r.data[0].title) + '</strong>'; D.dupWarn.classList.add('visible'); }
            else if (D.dupWarn) D.dupWarn.classList.remove('visible');
        }).catch(function () { });
    }

    // ===== RATINGS =====
    var pRate = { id: null, title: '' };
    function openRate(id, title) {
        pRate = { id: id, title: title };
        if (D.rateTitle) D.rateTitle.textContent = title;
        if (D.rateFeedback) D.rateFeedback.textContent = '';
        $$('.rating-picker-stars .star').forEach(function (s) { s.classList.remove('active'); });
        if (D.rateOverlay) D.rateOverlay.classList.add('active');
    }
    function closeRate() { if (D.rateOverlay) D.rateOverlay.classList.remove('active'); }
    function rateHover(e) {
        var s = e.target.closest('.star'); if (!s) return;
        var v = parseInt(s.getAttribute('data-value'), 10);
        $$('.rating-picker-stars .star').forEach(function (st) { st.classList.toggle('active', parseInt(st.getAttribute('data-value'), 10) <= v); });
        if (D.rateFeedback) D.rateFeedback.textContent = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][v] || '';
    }
    function rateHoverOut() { $$('.rating-picker-stars .star').forEach(function (s) { s.classList.remove('active'); }); if (D.rateFeedback) D.rateFeedback.textContent = ''; }
    function rateClick(e) {
        var s = e.target.closest('.star'); if (!s || !pRate.id) return;
        var v = parseInt(s.getAttribute('data-value'), 10);
        post('ratings', { course_id: pRate.id, rating: v }).then(function () {
            toast('Rated ' + v + ' stars!', 'success'); closeRate(); log('rating', { id: pRate.id, rating: v }); loadCourses();
        }).catch(function (err) { toast(err.message || 'Rating failed.', 'error'); closeRate(); });
    }

    // ===== STATS =====
    function loadStats() {
        get('courses', { status: 'eq.active', select: 'id', limit: 1 }).then(function (r) {
            if (D.courseCount) D.courseCount.textContent = r.total || 0;
        }).catch(function () { });
    }

    // ===== LOGGING (NO sendBeacon — uses fetch with keepalive) =====
    function log(action, details) {
        details = details || {};
        try {
            fetch(FN + '/log-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
                body: JSON.stringify({ action: action, details: details, session_id: S.sid, screen_size: innerWidth + 'x' + innerHeight, referrer: document.referrer || null }),
                keepalive: true
            }).catch(function () { });
        } catch (e) { }
    }

    // ===== HELPERS =====
    function toast(msg, type) {
        if (!D.toasts) return;
        var t = document.createElement('div');
        t.className = 'toast toast-' + (type || 'info');
        t.textContent = msg;
        D.toasts.appendChild(t);
        setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
    }
    function showLoading() { if (D.grid) D.grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span class="loading-text">Loading...</span></div>'; }
    function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function escA(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;'); }
    function fmtDate(d) { if (!d) return ''; try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return d; } }
})();

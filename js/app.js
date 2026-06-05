(function () {
    'use strict';

    /* ===========================================================
       CONFIGURATION — Copy-paste safe URL construction
       =========================================================== */
    var DB_HOST = 'kvxfxpqbnmplcuadjmpc.supabase.co';
    var SUPA_URL = 'https://' + DB_HOST;
    var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2eGZ4cHFibm1wbGN1YWRqbXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDk2NjUsImV4cCI6MjA5NjIyNTY2NX0.GQ5glAUeNb_6wMS9OvGBu25WPFa1yDs_hquGfYLXS-c';

    var FN_URL = SUPA_URL + '/functions/v1';
    var REST = SUPA_URL + '/rest/v1';
    var PER = 20;

    /* ===========================================================
       SAFE HELPERS (no special chars that break during copy-paste)
       =========================================================== */
    function gid(id) { return document.getElementById(id); }
    function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    function on(el, ev, fn) { if (el && el.addEventListener) { el.addEventListener(ev, fn); } }
    function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function escA(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function fmtD(d) { if (!d) return ''; try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return d; } }

    /* ===========================================================
       STATE
       =========================================================== */
    var S = {
        courses: [],
        total: 0,
        page: 1,
        tab: 'courses',
        query: '',
        stype: 'keyword',
        filt: { platform: '', category: '', 'job-available': '', difficulty: '', cost: '', certification: '' },
        sort: 'relevance',
        sid: ''
    };

    /* ===========================================================
       DOM REFERENCES
       =========================================================== */
    var searchInput, searchBtn, searchMode, clearBtn, resultCount, sortSel, grid;
    var sugList, sugForm, pagEl, toastBox;
    var rateOvl, rateStarsEl, rateFb, rateTitleEl;
    var courseCountEl;
    var sugTitle, sugLink, sugPlatform, sugName, sugEmail, sugNotes, hpField, dupWarn;
    var tabBtns, tabPanels;
    var filtEls = {};

    function cacheDom() {
        searchInput = gid('search-input');
        searchBtn = gid('search-btn');
        searchMode = gid('search-mode');
        clearBtn = gid('clear-filters');
        resultCount = gid('results-count');
        sortSel = gid('sort-select');
        grid = gid('courses-grid');
        sugList = gid('suggestions-list');
        sugForm = gid('suggest-form');
        pagEl = gid('pagination');
        toastBox = gid('toast-container');
        rateOvl = gid('rating-overlay');
        rateStarsEl = gid('rating-stars');
        rateFb = gid('rating-feedback');
        rateTitleEl = gid('rating-course-title');
        courseCountEl = gid('header-course-count');
        sugTitle = gid('sug-title');
        sugLink = gid('sug-link');
        sugPlatform = gid('sug-platform');
        sugName = gid('sug-name');
        sugEmail = gid('sug-email');
        sugNotes = gid('sug-notes');
        hpField = gid('sug-website');
        dupWarn = gid('duplicate-warning');
        tabBtns = qsa('.tab-btn');
        tabPanels = qsa('.tab-panel');

        var keys = ['platform', 'category', 'job-available', 'difficulty', 'cost', 'certification'];
        for (var i = 0; i < keys.length; i++) {
            filtEls[keys[i]] = gid('filter-' + keys[i]);
        }
    }

    /* ===========================================================
       INIT
       =========================================================== */
    document.addEventListener('DOMContentLoaded', function () {
        cacheDom();

        /* Startup validation */
        console.log('[Courseundo] API:', SUPA_URL);
        if (ANON_KEY.length < 100) {
            console.error('[Courseundo] ANON_KEY looks truncated. Check config.');
        }
        fetch(SUPA_URL + '/rest/v1/courses?limit=1', {
            headers: { 'apikey': ANON_KEY }
        }).then(function (r) {
            console.log('[Courseundo] Supabase connection:', r.status);
        }).catch(function (e) {
            console.error('[Courseundo] Supabase unreachable:', e);
        });

        var sid = sessionStorage.getItem('cu_sid');
        if (!sid) { sid = 's' + Math.random().toString(36).substr(2, 9); sessionStorage.setItem('cu_sid', sid); }
        S.sid = sid;

        var saved = localStorage.getItem('cu_sort');
        if (saved) { S.sort = saved; if (sortSel) sortSel.value = saved; }

        bindEvents();
        loadCourses();
        loadStats();
        logAct('page_visit', { page: 'home' });
    });

    /* ===========================================================
       EVENT BINDING
       =========================================================== */
    function bindEvents() {
        on(searchInput, 'keydown', function (e) { if (e.key === 'Enter') doSearch(); });
        on(searchBtn, 'click', doSearch);
        on(clearBtn, 'click', clearFilters);
        on(sortSel, 'change', function () {
            S.sort = sortSel.value;
            try { localStorage.setItem('cu_sort', S.sort); } catch (e) { }
            S.page = 1;
            loadCourses();
        });

        var fkeys = Object.keys(filtEls);
        for (var i = 0; i < fkeys.length; i++) {
            (function (k) {
                on(filtEls[k], 'change', function () {
                    S.filt[k] = filtEls[k] ? filtEls[k].value : '';
                    if (filtEls[k]) filtEls[k].classList.toggle('has-value', !!filtEls[k].value);
                    S.page = 1;
                    loadCourses();
                });
            })(fkeys[i]);
        }

        for (var t = 0; t < tabBtns.length; t++) {
            (function (btn) {
                on(btn, 'click', function () { switchTab(btn.getAttribute('data-tab')); });
            })(tabBtns[t]);
        }

        on(sugForm, 'submit', submitSug);
        on(sugLink, 'blur', checkDup);
        on(rateOvl, 'click', function (e) { if (e.target === rateOvl) closeRate(); });
        on(rateStarsEl, 'mouseover', rateHover);
        on(rateStarsEl, 'mouseout', rateHoverOut);
        on(rateStarsEl, 'click', rateClick);
    }

    /* ===========================================================
       API
       =========================================================== */
    function apiGet(ep, params) {
        params = params || {};
        var url = REST + '/' + ep;
        var first = true;
        for (var k in params) {
            if (params[k] === '' || params[k] == null) continue;
            url += (first ? '?' : '&') + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
            first = false;
        }
        return fetch(url, { headers: { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + ANON_KEY } })
            .then(function (r) {
                var cr = r.headers.get('Content-Range');
                return r.json().then(function (d) {
                    if (!r.ok) throw new Error(d.message || 'Error ' + r.status);
                    var total = Array.isArray(d) ? d.length : 0;
                    if (cr) { var parts = cr.split('/'); if (parts[1] && parts[1] !== '*') total = parseInt(parts[1], 10); }
                    return { data: d, total: total };
                });
            });
    }

    function apiPost(ep, body, isFn) {
        var url = isFn ? FN_URL + '/' + ep : REST + '/' + ep;
        var headers = { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' };
        if (!isFn) headers['Prefer'] = 'return=representation';
        return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) })
            .then(function (r) {
                return r.json().then(function (d) {
                    if (!r.ok) throw new Error(d.message || 'Error ' + r.status);
                    return d;
                });
            });
    }

    /* ===========================================================
       COURSE LOADING
       =========================================================== */
    function loadCourses() {
        showLoad();
        var q = S.query.trim();
        var p;
        if (q.length > 0 && S.stype === 'semantic') p = loadSemantic(q);
        else if (q.length > 0) p = loadKeyword(q);
        else p = loadBrowse();

        p.then(function (res) {
            S.courses = res.results;
            S.total = res.total;
            renderCourses();
            renderPages();
            updateCount();
            if (q) logAct('search', { query: q, count: res.total, type: S.stype });
        }).catch(function (err) {
            if (grid) grid.innerHTML = '<div class="empty-state"><h3>Error</h3><p>' + esc(err.message) + '</p></div>';
        });
    }

    function loadBrowse() {
        var pr = { status: 'eq.active', limit: PER, offset: (S.page - 1) * PER };
        addFilt(pr);
        addSort(pr);
        return apiGet('courses', pr).then(function (r) { return { results: r.data, total: r.total }; });
    }

    function loadKeyword(q) {
        var or = '(title.ilike.*' + q + '*,platform.ilike.*' + q + '*,institution.ilike.*' + q + '*,instructor.ilike.*' + q + '*)';
        var pr = { status: 'eq.active', 'or': or, limit: PER, offset: (S.page - 1) * PER };
        addFilt(pr);
        addSort(pr);
        return apiGet('courses', pr).then(function (r) { return { results: r.data, total: r.total }; });
    }

    function loadSemantic(q) {
        return apiPost('semantic-search', { query: q, limit: 100 }, true)
            .then(function (d) {
                if (d.fallback) { S.stype = 'keyword'; updMode(); return loadKeyword(q); }
                var res = clientFilt(d.results || []);
                res = clientSort(res);
                var tot = res.length;
                res = res.slice((S.page - 1) * PER, S.page * PER);
                return { results: res, total: tot };
            })
            .catch(function () { S.stype = 'keyword'; updMode(); return loadKeyword(q); });
    }

    function addFilt(pr) {
        for (var k in S.filt) { if (S.filt[k]) pr[k] = 'eq.' + S.filt[k]; }
    }

    function addSort(pr) {
        var m = {
            'relevance': 'rating_avg.desc', 'rating-high': 'rating_avg.desc', 'rating-low': 'rating_avg.asc',
            'newest': 'created_at.desc', 'oldest': 'created_at.asc',
            'alpha-az': 'title.asc', 'alpha-za': 'title.desc', 'cost-free': 'cost.asc'
        };
        pr.order = m[S.sort] || 'rating_avg.desc';
    }

    function clientFilt(arr) {
        return arr.filter(function (c) {
            for (var k in S.filt) {
                if (S.filt[k] && (c[k] || '').toLowerCase() !== S.filt[k].toLowerCase()) return false;
            }
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

    /* ===========================================================
       RENDER COURSES
       =========================================================== */
    function renderCourses() {
        if (!grid) return;
        if (!S.courses.length) {
            grid.innerHTML = '<div class="empty-state"><h3>No courses found</h3><p>Try adjusting your search or filters.</p></div>';
            return;
        }
        var h = '';
        for (var i = 0; i < S.courses.length; i++) {
            var c = S.courses[i];
            h += '<article class="course-card" style="animation-delay:' + (i * 0.04).toFixed(2) + 's">' +
                '<div class="card-header">' +
                '<h3 class="card-title"><a href="' + escA(c.link) + '" target="_blank" rel="noopener" class="clink" data-id="' + c.id + '" data-t="' + escA(c.title) + '" data-p="' + escA(c.platform || '') + '">' + esc(c.title) + '</a></h3>' +
                (c.platform ? '<span class="card-platform ' + platC(c.platform) + '">' + esc(c.platform) + '</span>' : '') +
                '</div>' +
                buildBadges(c) + buildMeta(c) +
                '<div class="card-rating">' +
                '<div class="stars cstars" data-id="' + c.id + '" data-t="' + escA(c.title) + '" role="button" tabindex="0" aria-label="Rate">' + buildStars(c.rating_avg || 0) + '</div>' +
                '<span class="rating-text">' + (c.rating_avg || 0).toFixed(1) + ' <span class="count">(' + (c.rating_count || 0) + ')</span></span>' +
                buildFreshness(c.last_verified) +
                '</div>' +
                '</article>';
        }
        grid.innerHTML = h;

        /* Bind course link clicks */
        var links = qsa('.clink');
        for (var li = 0; li < links.length; li++) {
            (function (a) {
                on(a, 'click', function () { logAct('course_click', { id: a.getAttribute('data-id'), title: a.getAttribute('data-t') }); });
            })(links[li]);
        }

        /* Bind rating star clicks on course cards */
        var starDivs = qsa('.cstars');
        for (var si = 0; si < starDivs.length; si++) {
            (function (el) {
                on(el, 'click', function () { openRate(el.getAttribute('data-id'), el.getAttribute('data-t')); });
                on(el, 'keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRate(el.getAttribute('data-id'), el.getAttribute('data-t')); } });
            })(starDivs[si]);
        }
    }

    function platC(p) {
        if (!p) return 'platform-other';
        p = p.toLowerCase();
        if (p.indexOf('coursera') >= 0) return 'platform-coursera';
        if (p.indexOf('edx') >= 0) return 'platform-edx';
        if (p.indexOf('udemy') >= 0) return 'platform-udemy';
        if (p.indexOf('khan') >= 0) return 'platform-khan';
        if (p.indexOf('udacity') >= 0) return 'platform-udacity';
        if (p.indexOf('futurelearn') >= 0) return 'platform-futurelearn';
        if (p.indexOf('linkedin') >= 0) return 'platform-linkedin';
        return 'platform-other';
    }

    function buildBadges(c) {
        var b = '';
        if (c.category) b += '<span class="badge badge-category">' + esc(c.category) + '</span>';
        if (c.difficulty) b += '<span class="badge badge-difficulty-' + c.difficulty.toLowerCase() + '">' + esc(c.difficulty) + '</span>';
        if (c.cost) b += '<span class="badge badge-cost-' + c.cost.toLowerCase() + '">' + esc(c.cost) + '</span>';
        if (c.certification === 'Yes') b += '<span class="badge badge-cert">Certificate</span>';
        if (c.job_available === 'Yes') b += '<span class="badge badge-job">Jobs</span>';
        return b ? '<div class="card-badges">' + b + '</div>' : '';
    }

    function buildMeta(c) {
        var m = '';
        if (c.institution) m += '<span class="card-meta-item">' + esc(c.institution) + '</span>';
        if (c.instructor) m += '<span class="card-meta-item">' + esc(c.instructor) + '</span>';
        if (c.duration) m += '<span class="card-meta-item">' + esc(c.duration) + '</span>';
        return m ? '<div class="card-meta">' + m + '</div>' : '';
    }

    function buildStars(r) {
        var h = '', n = Math.round(r);
        for (var i = 1; i <= 5; i++) h += '<span class="star' + (i > n ? ' empty' : '') + '">&#9733;</span>';
        return h;
    }

    function buildFreshness(d) {
        if (!d) return '<span class="freshness freshness-red">Not verified</span>';
        var days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
        if (days < 7) return '<span class="freshness freshness-green">' + days + 'd ago</span>';
        if (days < 90) return '<span class="freshness freshness-yellow">' + days + 'd ago</span>';
        return '<span class="freshness freshness-red">' + days + 'd ago</span>';
    }

    /* ===========================================================
       PAGINATION
       =========================================================== */
    function renderPages() {
        if (!pagEl) return;
        var tp = Math.ceil(S.total / PER);
        if (tp <= 1) { pagEl.innerHTML = ''; return; }
        var h = '<button class="page-btn" data-p="' + (S.page - 1) + '"' + (S.page <= 1 ? ' disabled' : '') + '>&laquo;</button>';
        for (var i = 1; i <= tp; i++) {
            if (tp > 7 && i > 2 && i < tp - 1 && Math.abs(i - S.page) > 1) {
                if (i === 3 || i === tp - 2) h += '<span class="page-btn" style="border:none;cursor:default">...</span>';
                continue;
            }
            h += '<button class="page-btn' + (i === S.page ? ' active' : '') + '" data-p="' + i + '">' + i + '</button>';
        }
        h += '<button class="page-btn" data-p="' + (S.page + 1) + '"' + (S.page >= tp ? ' disabled' : '') + '>&raquo;</button>';
        pagEl.innerHTML = h;

        var btns = qsa('.page-btn[data-p]');
        for (var j = 0; j < btns.length; j++) {
            (function (b) {
                on(b, 'click', function () {
                    var p = parseInt(b.getAttribute('data-p'), 10);
                    if (p >= 1 && p <= tp) { S.page = p; loadCourses(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                });
            })(btns[j]);
        }
    }

    function updateCount() {
        if (resultCount) resultCount.innerHTML = '<strong>' + S.total + '</strong> ' + (S.query ? 'results' : 'courses');
    }

    /* ===========================================================
       SEARCH
       =========================================================== */
    function doSearch() {
        S.query = searchInput ? searchInput.value.trim() : '';
        S.page = 1;
        S.stype = S.query.length > 3 ? 'semantic' : 'keyword';
        updMode();
        loadCourses();
    }

    function updMode() {
        if (!searchMode) return;
        searchMode.innerHTML = S.stype === 'semantic'
            ? '<span class="dot"></span> AI semantic search'
            : '<span class="dot" style="background:var(--text-muted)"></span> Keyword search';
    }

    /* ===========================================================
       FILTERS & TABS
       =========================================================== */
    function clearFilters() {
        var keys = Object.keys(S.filt);
        for (var i = 0; i < keys.length; i++) {
            S.filt[keys[i]] = '';
            if (filtEls[keys[i]]) { filtEls[keys[i]].value = ''; filtEls[keys[i]].classList.remove('has-value'); }
        }
        S.page = 1;
        loadCourses();
    }

    function switchTab(id) {
        S.tab = id;
        for (var i = 0; i < tabBtns.length; i++) tabBtns[i].classList.toggle('active', tabBtns[i].getAttribute('data-tab') === id);
        for (var j = 0; j < tabPanels.length; j++) tabPanels[j].classList.toggle('active', tabPanels[j].id === 'panel-' + id);
        if (id === 'suggestions') loadSugs();
    }

    /* ===========================================================
       SUGGESTIONS
       =========================================================== */
    function loadSugs() {
        apiGet('suggestions', { status: 'eq.pending', order: 'created_at.desc' }).then(function (r) {
            if (!sugList) return;
            if (!r.data.length) { sugList.innerHTML = '<div class="empty-state"><h3>No pending suggestions</h3></div>'; return; }
            var h = '';
            for (var i = 0; i < r.data.length; i++) {
                var s = r.data[i];
                h += '<div class="suggestion-card" style="animation-delay:' + (i * 0.04).toFixed(2) + 's">' +
                    '<div class="flex-between"><h4 class="suggestion-title"><a href="' + escA(s.link) + '" target="_blank">' + esc(s.title) + '</a></h4><span class="badge badge-pending">Pending</span></div>' +
                    '<div class="suggestion-meta">' + (s.platform ? '<span>' + esc(s.platform) + '</span>' : '') + (s.user_name ? '<span>By ' + esc(s.user_name) + '</span>' : '') + '<span>' + fmtD(s.created_at) + '</span></div>' +
                    (s.notes ? '<p class="suggestion-notes">"' + esc(s.notes) + '"</p>' : '') + '</div>';
            }
            sugList.innerHTML = h;
        }).catch(function () { });
    }

    function submitSug(e) {
        e.preventDefault();
        if (hpField && hpField.value) return;
        var title = sugTitle ? sugTitle.value.trim() : '';
        var link = sugLink ? sugLink.value.trim() : '';
        if (!title || title.length < 5) { toast('Title must be 5+ characters.', 'error'); return; }
        if (!link || !/^https?:\/\//.test(link)) { toast('Enter a valid URL.', 'error'); return; }
        var body = { title: title, link: link };
        if (sugPlatform && sugPlatform.value.trim()) body.platform = sugPlatform.value.trim();
        if (sugName && sugName.value.trim()) body.user_name = sugName.value.trim();
        if (sugEmail && sugEmail.value.trim()) body.user_email = sugEmail.value.trim();
        if (sugNotes && sugNotes.value.trim()) body.notes = sugNotes.value.trim();
        apiPost('suggestions', body, false).then(function () {
            toast('Suggestion submitted!', 'success');
            if (sugForm) sugForm.reset();
            if (dupWarn) dupWarn.classList.remove('visible');
            logAct('suggestion', { title: title, link: link });
            if (S.tab === 'suggestions') loadSugs();
        }).catch(function (err) { toast(err.message || 'Submit failed.', 'error'); });
    }

    function checkDup() {
        var link = sugLink ? sugLink.value.trim() : '';
        if (!link || !/^https?:\/\//.test(link)) return;
        apiGet('courses', { link: 'eq.' + link, select: 'id,title', limit: 1 }).then(function (r) {
            if (!dupWarn) return;
            if (r.data.length) { dupWarn.innerHTML = '&#9888; Exists: <strong>' + esc(r.data[0].title) + '</strong>'; dupWarn.classList.add('visible'); }
            else dupWarn.classList.remove('visible');
        }).catch(function () { });
    }

    /* ===========================================================
       RATINGS
       =========================================================== */
    var pRate = { id: null, title: '' };

    function openRate(id, title) {
        pRate = { id: id, title: title };
        if (rateTitleEl) rateTitleEl.textContent = title;
        if (rateFb) rateFb.textContent = '';
        var all = qsa('.rating-picker-stars .star');
        for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
        if (rateOvl) rateOvl.classList.add('active');
    }

    function closeRate() { if (rateOvl) rateOvl.classList.remove('active'); }

    function rateHover(e) {
        var s = e.target.closest('.star');
        if (!s) return;
        var v = parseInt(s.getAttribute('data-value'), 10);
        var all = qsa('.rating-picker-stars .star');
        for (var i = 0; i < all.length; i++) all[i].classList.toggle('active', parseInt(all[i].getAttribute('data-value'), 10) <= v);
        if (rateFb) rateFb.textContent = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][v] || '';
    }

    function rateHoverOut() {
        var all = qsa('.rating-picker-stars .star');
        for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
        if (rateFb) rateFb.textContent = '';
    }

    function rateClick(e) {
        var s = e.target.closest('.star');
        if (!s || !pRate.id) return;
        var v = parseInt(s.getAttribute('data-value'), 10);
        if (v < 1 || v > 5) return;
        apiPost('ratings', { course_id: pRate.id, rating: v }, false)
            .then(function () {
                toast('Rated ' + v + ' stars!', 'success');
                closeRate();
                logAct('rating', { id: pRate.id, rating: v });
                loadCourses();
            })
            .catch(function (err) {
                toast(err.message || 'Rating failed.', 'error');
                closeRate();
            });
    }

    /* ===========================================================
       STATS & LOGGING
       =========================================================== */
    function loadStats() {
        apiGet('courses', { status: 'eq.active', select: 'id', limit: 1 }).then(function (r) {
            if (courseCountEl) courseCountEl.textContent = r.total || 0;
        }).catch(function () { });
    }

    function logAct(action, details) {
        details = details || {};
        try {
            fetch(FN_URL + '/log-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
                body: JSON.stringify({ action: action, details: details, session_id: S.sid, screen_size: window.innerWidth + 'x' + window.innerHeight, referrer: document.referrer || null }),
                keepalive: true
            }).catch(function () { });
        } catch (e) { }
    }

    /* ===========================================================
       UI HELPERS
       =========================================================== */
    function toast(msg, type) {
        if (!toastBox) return;
        var t = document.createElement('div');
        t.className = 'toast toast-' + (type || 'info');
        t.textContent = msg;
        toastBox.appendChild(t);
        setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
    }

    function showLoad() {
        if (!grid) return;
        grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span class="loading-text">Loading...</span></div>';
    }

})();

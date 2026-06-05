(function () {
    'use strict';

    var DB_HOST = 'kvxfxpqbnmplcuadjmpc.supabase.co';
    var SUPA_URL = 'https://' + DB_HOST;
    var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2eGZ4cHFibm1wbGN1YWRqbXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDk2NjUsImV4cCI6MjA5NjIyNTY2NX0.GQ5glAUeNb_6wMS9OvGBu25WPFa1yDs_hquGfYLXS-c';

    var FN_URL = SUPA_URL + '/functions/v1';
    var REST = SUPA_URL + '/rest/v1';

    function gid(id) { return document.getElementById(id); }
    function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    function on(el, ev, fn) { if (el && el.addEventListener) { el.addEventListener(ev, fn); } }
    function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function escA(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function fmtD(d) { if (!d) return ''; try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return d; } }
    function fmtDT(d) { if (!d) return ''; try { var x = new Date(d); return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + x.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return d; } }
    function trunc(s, n) { return (!s || s.length <= n) ? s : s.substr(0, n) + '...'; }

    var TO_COL = { 'cert-type': 'cert_type', 'job-available': 'job_available', 'job-country': 'job_country', 'job-salary': 'job_salary', 'job-mode': 'job_mode' };
    function ck(formKey) { return TO_COL[formKey] || formKey; }

    var S = { token: null, user: null, tab: 'courses', courses: [], filtered: [], editId: null, suggestions: [], logs: [], showArchived: false };

    var loginWrap, dashWrap, loginForm, loginEmail, loginPw, loginErr;
    var sidebarEl, sidebarClose, sidebarToggle, sidebarOverlay;
    var navItems, panels, logoutBtn;
    var cSearch, cArchived, cList, cForm, cFormTitle, cStatus;
    var fetchMetaBtn, aiClassBtn, newBtn, archiveBtn, verifyBtn;
    var extraJson, jsonFb;
    var dropZone, fileIn, importPrev, importSum, importBtn, exportCsvBtn, exportJsonBtn;
    var sugListEl, sugBadge;
    var rateCont;
    var logBody, logAction, logFrom, logDevice, logApplyBtn, logExportBtn;
    var analyticsEl, toastBox;
    var fields = {};

    function cacheDom() {
        loginWrap = gid('login-wrapper');
        dashWrap = gid('dashboard-wrapper');
        loginForm = gid('login-form');
        loginEmail = gid('login-email');
        loginPw = gid('login-password');
        loginErr = gid('login-error');
        sidebarEl = gid('admin-sidebar');
        sidebarClose = gid('admin-sidebar-close');
        sidebarToggle = gid('admin-sidebar-toggle');
        navItems = qsa('.admin-nav-item');
        panels = qsa('.admin-tab-panel');
        logoutBtn = gid('logout-btn');
        cSearch = gid('course-search');
        cArchived = gid('show-archived');
        cList = gid('admin-course-list');
        cForm = gid('course-form');
        cFormTitle = gid('course-form-title');
        cStatus = gid('course-field-status');
        fetchMetaBtn = gid('fetch-meta-btn');
        aiClassBtn = gid('ai-classify-btn');
        newBtn = gid('new-course-btn');
        archiveBtn = gid('archive-course-btn');
        verifyBtn = gid('verify-course-btn');
        extraJson = gid('course-extra-fields');
        jsonFb = gid('json-feedback');
        dropZone = gid('file-drop-zone');
        fileIn = gid('file-input');
        importPrev = gid('import-preview');
        importSum = gid('import-summary');
        importBtn = gid('import-btn');
        exportCsvBtn = gid('export-csv-btn');
        exportJsonBtn = gid('export-json-btn');
        sugListEl = gid('admin-suggestions-list');
        sugBadge = gid('suggestion-badge');
        rateCont = gid('ratings-container');
        logBody = gid('log-table-body');
        logAction = gid('log-filter-action');
        logFrom = gid('log-filter-from');
        logDevice = gid('log-filter-device');
        logApplyBtn = gid('log-apply-filter');
        logExportBtn = gid('log-export-btn');
        analyticsEl = gid('analytics-container');
        toastBox = gid('admin-toast-container');

        var names = ['title', 'link', 'platform', 'category', 'institution', 'instructor', 'difficulty', 'duration', 'mode', 'format', 'cost', 'certification', 'cert-type', 'validation', 'job-available', 'job-country', 'job-salary', 'job-mode', 'language'];
        for (var i = 0; i < names.length; i++) { fields[names[i]] = gid('course-' + names[i]); }
    }

    document.addEventListener('DOMContentLoaded', function () {
        cacheDom();
        console.log('[Admin] API:', SUPA_URL);
        console.log('[Admin] Nav items:', navItems.length, 'Panels:', panels.length);

        var stored = sessionStorage.getItem('cu_admin_token');
        if (stored) { S.token = stored; showDash(); loadAll(); }
        bindEvents();
    });

    function bindEvents() {
        on(loginForm, 'submit', handleLogin);
        on(logoutBtn, 'click', function () { S.token = null; sessionStorage.removeItem('cu_admin_token'); showLogin(); });

        /* Sidebar toggle (mobile) */
        on(sidebarToggle, 'click', function () { if (sidebarEl) { sidebarEl.classList.add('open'); createOverlay(); } });
        on(sidebarClose, 'click', closeSidebar);

        /* Nav items — direct binding */
        for (var i = 0; i < navItems.length; i++) {
            (function (btn) {
                btn.addEventListener('click', function () {
                    var tab = btn.getAttribute('data-tab');
                    console.log('[Admin] Nav click:', tab);
                    switchTab(tab);
                    if (window.innerWidth < 1024) closeSidebar();
                });
            })(navItems[i]);
        }

        on(cSearch, 'input', filterList);
        on(cArchived, 'change', function () { S.showArchived = cArchived.checked; loadCourses(); });
        on(newBtn, 'click', resetForm);
        on(cForm, 'submit', saveCourse);
        on(fetchMetaBtn, 'click', doFetchMeta);
        on(aiClassBtn, 'click', doAiClassify);
        on(archiveBtn, 'click', doArchive);
        on(verifyBtn, 'click', doVerify);
        on(extraJson, 'input', validateJson);

        on(dropZone, 'click', function () { if (fileIn) fileIn.click(); });
        on(dropZone, 'dragover', function (e) { e.preventDefault(); if (dropZone) dropZone.classList.add('dragover'); });
        on(dropZone, 'dragleave', function () { if (dropZone) dropZone.classList.remove('dragover'); });
        on(dropZone, 'drop', handleDrop);
        on(fileIn, 'change', function (e) { if (e.target.files[0]) processFile(e.target.files[0]); });
        on(importBtn, 'click', bulkImport);
        on(exportCsvBtn, 'click', function () { doExport('csv'); });
        on(exportJsonBtn, 'click', function () { doExport('json'); });

        on(logApplyBtn, 'click', loadLogs);
        on(logExportBtn, 'click', exportLogs);
    }

    function createOverlay() {
        if (gid('admin-sidebar-overlay')) return;
        var o = document.createElement('div');
        o.id = 'admin-sidebar-overlay';
        o.className = 'admin-sidebar-overlay active';
        document.body.appendChild(o);
        o.addEventListener('click', closeSidebar);
    }

    function closeSidebar() {
        if (sidebarEl) sidebarEl.classList.remove('open');
        var o = gid('admin-sidebar-overlay');
        if (o) { o.classList.remove('active'); setTimeout(function () { if (o.parentNode) o.remove(); }, 300); }
    }

    function handleLogin(e) {
        e.preventDefault();
        if (loginErr) loginErr.classList.remove('visible');
        var email = loginEmail ? loginEmail.value.trim() : '';
        var pw = loginPw ? loginPw.value : '';
        if (!email || !pw) { showLoginErr('Enter email and password.'); return; }
        fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
            method: 'POST', headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: pw })
        }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
            .then(function (res) {
                if (!res.ok) throw new Error(res.d.error_description || res.d.msg || 'Login failed');
                S.token = res.d.access_token; S.user = { email: email };
                sessionStorage.setItem('cu_admin_token', res.d.access_token);
                showDash(); loadAll(); toast('Logged in.', 'success');
            }).catch(function (err) { showLoginErr(err.message); });
    }

    function showLoginErr(msg) { if (loginErr) { loginErr.textContent = msg; loginErr.classList.add('visible'); } }
    function showDash() { if (loginWrap) loginWrap.classList.add('hidden'); if (dashWrap) dashWrap.classList.remove('hidden'); }
    function showLogin() { if (loginWrap) loginWrap.classList.remove('hidden'); if (dashWrap) dashWrap.classList.add('hidden'); }

    function authH() { return { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + S.token, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }; }

    function aGet(ep, params) {
        params = params || {};
        var url = REST + '/' + ep;
        var first = true;
        for (var k in params) { if (params[k] === '' || params[k] == null) continue; url += (first ? '?' : '&') + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); first = false; }
        return fetch(url, { headers: authH() }).then(function (r) { var cr = r.headers.get('Content-Range'); return r.json().then(function (d) { if (!r.ok) throw new Error(d.message || 'Error ' + r.status); var t = Array.isArray(d) ? d.length : 0; if (cr) { var p = cr.split('/'); if (p[1] && p[1] !== '*') t = parseInt(p[1], 10); } return { data: d, total: t }; }); });
    }
    function aPost(ep, body) { return fetch(REST + '/' + ep, { method: 'POST', headers: authH(), body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.message || 'Error ' + r.status); return d; }); }); }
    function aPatch(ep, body, params) { params = params || {}; var url = REST + '/' + ep; var first = true; for (var k in params) { url += (first ? '?' : '&') + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); first = false; } return fetch(url, { method: 'PATCH', headers: authH(), body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.message || 'Error ' + r.status); return d; }); }); }
    function aFn(name, body) { return fetch(FN_URL + '/' + name, { method: 'POST', headers: authH(), body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.message || 'Error ' + r.status); return d; }); }); }

    function switchTab(id) {
        S.tab = id;
        for (var i = 0; i < navItems.length; i++) navItems[i].classList.toggle('active', navItems[i].getAttribute('data-tab') === id);
        for (var j = 0; j < panels.length; j++) panels[j].classList.toggle('active', panels[j].id === 'tab-' + id);
        if (id === 'courses') loadCourses();
        else if (id === 'suggestions') loadSuggestions();
        else if (id === 'ratings') loadRatings();
        else if (id === 'logs') loadLogs();
        else if (id === 'analytics') loadAnalytics();
    }

    function loadAll() { loadCourses(); loadSuggestions(); loadAnalytics(); }

    function loadCourses() {
        aGet('courses', { status: S.showArchived ? 'eq.archived' : 'eq.active', order: 'created_at.desc', limit: 500 })
            .then(function (r) { S.courses = r.data; filterList(); })
            .catch(function (e) { toast('Load failed: ' + e.message, 'error'); });
    }

    function filterList() {
        var q = cSearch ? cSearch.value.toLowerCase().trim() : '';
        S.filtered = q ? S.courses.filter(function (c) { return c.title.toLowerCase().indexOf(q) >= 0 || (c.platform || '').toLowerCase().indexOf(q) >= 0; }) : S.courses;
        renderList();
    }

    function renderList() {
        if (!cList) return;
        if (!S.filtered.length) { cList.innerHTML = '<div class="empty-state"><p>No courses found.</p></div>'; return; }
        var h = '';
        for (var i = 0; i < S.filtered.length; i++) { var c = S.filtered[i]; h += '<div class="admin-course-item' + (S.editId === c.id ? ' selected' : '') + '" data-id="' + c.id + '"><span class="admin-course-item-title">' + esc(c.title) + '</span><span class="admin-course-item-platform">' + esc(c.platform || '--') + '</span><span class="admin-course-item-status status-' + c.status + '">' + c.status + '</span></div>'; }
        cList.innerHTML = h;
        var items = qsa('.admin-course-item');
        for (var j = 0; j < items.length; j++) { (function (el) { on(el, 'click', function () { editCourse(el.getAttribute('data-id')); }); })(items[j]); }
    }

    function editCourse(id) {
        var c = null;
        for (var i = 0; i < S.courses.length; i++) { if (S.courses[i].id === id) { c = S.courses[i]; break; } }
        if (!c) return;
        S.editId = id;
        if (cFormTitle) cFormTitle.textContent = 'Edit Course';
        var fkeys = Object.keys(fields);
        for (var j = 0; j < fkeys.length; j++) { if (fields[fkeys[j]]) fields[fkeys[j]].value = c[ck(fkeys[j])] || ''; }
        if (extraJson) extraJson.value = c.extra_fields ? JSON.stringify(c.extra_fields, null, 2) : '';
        if (cStatus) cStatus.textContent = 'Status: ' + c.status;
        if (archiveBtn) archiveBtn.classList.remove('hidden');
        if (verifyBtn) verifyBtn.classList.remove('hidden');
        validateJson();
        renderList();
        /* Scroll form into view on mobile */
        if (window.innerWidth < 1024 && cForm) cForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function resetForm() {
        S.editId = null;
        if (cFormTitle) cFormTitle.textContent = 'Add New Course';
        if (cForm) cForm.reset();
        if (extraJson) extraJson.value = '';
        if (jsonFb) jsonFb.textContent = '';
        if (cStatus) cStatus.textContent = '';
        if (archiveBtn) archiveBtn.classList.add('hidden');
        if (verifyBtn) verifyBtn.classList.add('hidden');
        renderList();
    }

    function saveCourse(e) {
        e.preventDefault();
        var title = fields.title ? fields.title.value.trim() : '';
        var link = fields.link ? fields.link.value.trim() : '';
        if (!title || title.length < 5) { toast('Title 5-200 chars.', 'error'); return; }
        if (!link || !/^https?:\/\//.test(link)) { toast('Valid URL required.', 'error'); return; }
        var extra = {};
        if (extraJson && extraJson.value.trim()) { try { extra = JSON.parse(extraJson.value.trim()); } catch (je) { toast('Invalid JSON.', 'error'); return; } }
        var body = { extra_fields: extra };
        var fkeys = Object.keys(fields);
        for (var i = 0; i < fkeys.length; i++) { var v = fields[fkeys[i]] ? fields[fkeys[i]].value.trim() : ''; if (v) body[ck(fkeys[i])] = v; }
        var p;
        if (S.editId) p = aPatch('courses', body, { id: 'eq.' + S.editId });
        else { body.status = 'active'; p = aPost('courses', body); }
        p.then(function (res) {
            toast(S.editId ? 'Updated.' : 'Added.', 'success');
            var cd = Array.isArray(res) ? res[0] : res;
            if (cd && cd.id) aFn('generate-embedding', { course_id: cd.id, title: body.title || '', description: '', category: body.category || '' }).catch(function () { });
            resetForm(); loadCourses();
        }).catch(function (err) { toast('Save failed: ' + err.message, 'error'); });
    }

    function doFetchMeta() {
        var url = fields.link ? fields.link.value.trim() : '';
        if (!url) { toast('Enter URL first.', 'error'); return; }
        if (fetchMetaBtn) { fetchMetaBtn.disabled = true; fetchMetaBtn.textContent = 'Fetching...'; }
        aFn('extract-metadata', { url: url }).then(function (d) {
            if (d.title && fields.title && !fields.title.value) fields.title.value = d.title;
            if (d.platform && fields.platform && !fields.platform.value) fields.platform.value = d.platform;
            toast('Metadata fetched.', 'success');
        }).catch(function () { toast('Fetch failed.', 'error'); }).finally(function () { if (fetchMetaBtn) { fetchMetaBtn.disabled = false; fetchMetaBtn.textContent = 'Fetch Metadata'; } });
    }

    function doAiClassify() {
        var t = fields.title ? fields.title.value.trim() : '';
        if (!t) { toast('Enter title first.', 'error'); return; }
        if (aiClassBtn) { aiClassBtn.disabled = true; aiClassBtn.textContent = 'Classifying...'; }
        aFn('classify-course', { title: t, description: '' }).then(function (d) {
            if (d.category && fields.category && !fields.category.value) fields.category.value = d.category;
            if (d.difficulty && fields.difficulty && !fields.difficulty.value) fields.difficulty.value = d.difficulty;
            if (d.duration && fields.duration && !fields.duration.value) fields.duration.value = d.duration;
            toast('Classified.', 'success');
        }).catch(function () { toast('AI unavailable.', 'error'); }).finally(function () { if (aiClassBtn) { aiClassBtn.disabled = false; aiClassBtn.textContent = 'AI Classify'; } });
    }

    function doArchive() {
        if (!S.editId || !confirm('Archive this course?')) return;
        aPatch('courses', { status: 'archived', embedding: null }, { id: 'eq.' + S.editId })
            .then(function () { toast('Archived.', 'success'); resetForm(); loadCourses(); }).catch(function (e) { toast('Error: ' + e.message, 'error'); });
    }
    function doVerify() {
        if (!S.editId) return;
        aPatch('courses', { last_verified: new Date().toISOString() }, { id: 'eq.' + S.editId })
            .then(function () { toast('Verified.', 'success'); loadCourses(); }).catch(function (e) { toast('Error: ' + e.message, 'error'); });
    }

    function validateJson() {
        if (!extraJson || !jsonFb) return;
        var t = extraJson.value.trim();
        if (!t) { extraJson.classList.remove('json-valid', 'json-invalid'); jsonFb.textContent = ''; return; }
        try { JSON.parse(t); extraJson.classList.remove('json-invalid'); extraJson.classList.add('json-valid'); jsonFb.textContent = 'Valid JSON'; jsonFb.style.color = 'var(--green)'; }
        catch (e) { extraJson.classList.remove('json-valid'); extraJson.classList.add('json-invalid'); jsonFb.textContent = 'Invalid JSON'; jsonFb.style.color = 'var(--red)'; }
    }

    var impData = [];
    function handleDrop(e) { e.preventDefault(); if (dropZone) dropZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }
    function processFile(f) { var r = new FileReader(); r.onload = function (e) { try { impData = f.name.endsWith('.json') ? JSON.parse(e.target.result) : csv2json(e.target.result); validateImport(); } catch (err) { toast('Parse error.', 'error'); } }; r.readAsText(f); }
    function csv2json(csv) { var lines = csv.split('\n').filter(function (l) { return l.trim(); }); if (lines.length < 2) return []; var hdrs = lines[0].split(',').map(function (x) { return x.trim().replace(/"/g, ''); }); return lines.slice(1).map(function (l) { var vals = l.split(',').map(function (x) { return x.trim().replace(/"/g, ''); }); var obj = {}; hdrs.forEach(function (k, i) { if (vals[i]) obj[k] = vals[i]; }); return obj; }); }
    function validateImport() {
        var ok = 0, err = 0, rows = '';
        for (var i = 0; i < impData.length; i++) { var r = impData[i]; var v = r.title && r.title.length >= 5 && r.link && /^https?:\/\//.test(r.link); if (v) ok++; else err++; rows += '<tr class="' + (v ? '' : 'error-row') + '"><td>' + (i + 1) + '</td><td>' + esc(trunc(r.title || '--', 40)) + '</td><td>' + esc(r.platform || '') + '</td><td>' + (v ? 'OK' : 'Error') + '</td></tr>'; }
        if (importPrev) importPrev.innerHTML = '<table><thead><tr><th>#</th><th>Title</th><th>Platform</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>';
        if (importSum) importSum.innerHTML = '<span class="valid">' + ok + ' valid</span> <span class="errors">' + err + ' errors</span>';
        if (importBtn) importBtn.classList.toggle('hidden', ok === 0);
    }
    function bulkImport() {
        if (importBtn) { importBtn.disabled = true; importBtn.textContent = 'Importing...'; }
        var done = 0, skip = 0, idx = 0;
        function next() {
            if (idx >= impData.length) { toast('Done: ' + done + ' imported, ' + skip + ' skipped.', 'success'); if (importBtn) { importBtn.disabled = false; importBtn.textContent = 'Import Valid Rows'; } loadCourses(); return; }
            var r = impData[idx++];
            if (!r.title || r.title.length < 5 || !r.link || !/^https?:\/\//.test(r.link)) { skip++; next(); return; }
            var body = { title: r.title, link: r.link, status: 'active' };
            if (r.platform) body.platform = r.platform; if (r.category) body.category = r.category; if (r.cost) body.cost = r.cost;
            aPost('courses', body).then(function (res) { done++; var c = Array.isArray(res) ? res[0] : res; if (c && c.id) aFn('generate-embedding', { course_id: c.id, title: body.title, description: '', category: body.category || '' }).catch(function () { }); }).catch(function () { skip++; }).finally(function () { setTimeout(next, 200); });
        }
        next();
    }
    function doExport(fmt) {
        aGet('courses', { status: 'eq.active', limit: 10000, order: 'created_at.desc' }).then(function (r) {
            var content, filename, mime;
            if (fmt === 'csv') { var hd = ['title', 'link', 'platform', 'category', 'cost', 'difficulty', 'rating_avg', 'rating_count']; var rows = r.data.map(function (x) { return hd.map(function (h) { return '"' + (x[h] || '').toString().replace(/"/g, '""') + '"'; }).join(','); }); content = hd.join(',') + '\n' + rows.join('\n'); filename = 'courses.csv'; mime = 'text/csv'; }
            else { content = JSON.stringify(r.data, null, 2); filename = 'courses.json'; mime = 'application/json'; }
            var blob = new Blob([content], { type: mime }); var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
            toast('Exported ' + r.data.length + ' courses.', 'success');
        }).catch(function (e) { toast('Export failed.', 'error'); });
    }

    function loadSuggestions() {
        aGet('suggestions', { order: 'created_at.desc', limit: 200 }).then(function (r) {
            S.suggestions = r.data;
            var p = r.data.filter(function (s) { return s.status === 'pending'; }).length;
            if (sugBadge) { sugBadge.textContent = p; sugBadge.classList.toggle('hidden', p === 0); }
            renderSugs();
        }).catch(function (e) { toast('Load failed: ' + e.message, 'error'); });
    }
    function renderSugs() {
        if (!sugListEl) return;
        if (!S.suggestions.length) { sugListEl.innerHTML = '<div class="empty-state"><p>No suggestions yet.</p></div>'; return; }
        var h = '';
        for (var i = 0; i < S.suggestions.length; i++) {
            var s = S.suggestions[i];
            h += '<div class="admin-suggestion-item"><div class="admin-suggestion-info"><h4>' + esc(s.title) + '</h4><div class="detail-row"><span><a href="' + escA(s.link) + '" target="_blank">' + esc(trunc(s.link, 50)) + '</a></span>' + (s.platform ? '<span>' + esc(s.platform) + '</span>' : '') + '<span>Status: <b>' + s.status + '</b></span></div><div class="detail-row">' + (s.user_name ? '<span>By: ' + esc(s.user_name) + '</span>' : '') + (s.user_email ? '<span>' + esc(s.user_email) + '</span>' : '') + '<span>' + fmtD(s.created_at) + '</span></div>' + (s.notes ? '<p style="margin-top:0.4rem;font-size:0.8rem;color:var(--text-secondary);font-style:italic">' + esc(s.notes) + '</p>' : '') + '</div>';
            if (s.status === 'pending') { h += '<div class="admin-suggestion-actions"><button type="button" class="btn btn-primary btn-sm appr-btn" data-id="' + s.id + '">Approve</button> <button type="button" class="btn btn-danger btn-sm rej-btn" data-id="' + s.id + '">Reject</button></div>'; }
            h += '</div>';
        }
        sugListEl.innerHTML = h;
        var apprBtns = qsa('.appr-btn'); for (var a = 0; a < apprBtns.length; a++) { (function (b) { on(b, 'click', function () { approveSug(b.getAttribute('data-id')); }); })(apprBtns[a]); }
        var rejBtns = qsa('.rej-btn'); for (var ri = 0; ri < rejBtns.length; ri++) { (function (b) { on(b, 'click', function () { rejectSug(b.getAttribute('data-id')); }); })(rejBtns[ri]); }
    }
    function approveSug(id) {
        var s = null; for (var i = 0; i < S.suggestions.length; i++) { if (S.suggestions[i].id === id) { s = S.suggestions[i]; break; } } if (!s) return;
        resetForm(); if (fields.title) fields.title.value = s.title; if (fields.link) fields.link.value = s.link; if (s.platform && fields.platform) fields.platform.value = s.platform;
        aPatch('suggestions', { status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: (S.user && S.user.email) || 'admin' }, { id: 'eq.' + id })
            .then(function () { toast('Approved. Form pre-filled.', 'success'); switchTab('courses'); loadSuggestions(); }).catch(function (e) { toast('Error: ' + e.message, 'error'); });
    }
    function rejectSug(id) {
        if (!confirm('Reject?')) return;
        aPatch('suggestions', { status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: (S.user && S.user.email) || 'admin' }, { id: 'eq.' + id })
            .then(function () { toast('Rejected.', 'success'); loadSuggestions(); }).catch(function (e) { toast('Error: ' + e.message, 'error'); });
    }

    function loadRatings() {
        if (!rateCont) return;
        aGet('courses', { status: 'eq.active', rating_count: 'gt.0', order: 'rating_avg.desc', limit: 50 }).then(function (r) {
            if (!r.data.length) { rateCont.innerHTML = '<div class="empty-state"><p>No ratings yet.</p></div>'; return; }
            var h = '';
            for (var i = 0; i < r.data.length; i++) { var c = r.data[i]; h += '<div class="chart-container mb-2"><div class="flex-between mb-1"><h4 style="font-size:0.85rem">' + esc(c.title) + '</h4><span style="font-family:var(--font-mono);font-size:0.75rem;color:var(--accent-text)">' + Number(c.rating_avg).toFixed(1) + ' (' + c.rating_count + ')</span></div></div>'; }
            rateCont.innerHTML = h;
        }).catch(function (e) { toast('Load failed.', 'error'); });
    }

    function loadLogs() {
        var pr = { order: 'timestamp.desc', limit: 200 };
        if (logAction && logAction.value) pr.action = 'eq.' + logAction.value;
        if (logFrom && logFrom.value) pr.timestamp = 'gte.' + logFrom.value + 'T00:00:00Z';
        if (logDevice && logDevice.value) pr.device_type = 'eq.' + logDevice.value;
        aGet('activity_log', pr).then(function (r) { S.logs = r.data; renderLogs(); }).catch(function (e) { toast('Logs failed.', 'error'); });
    }
    function renderLogs() {
        if (!logBody) return;
        if (!S.logs.length) { logBody.innerHTML = '<tr><td colspan="7" style="padding:1.5rem;color:var(--text-muted);text-align:center">No logs found.</td></tr>'; return; }
        var h = '';
        for (var i = 0; i < S.logs.length; i++) { var l = S.logs[i]; h += '<tr><td>' + fmtDT(l.timestamp) + '</td><td><span class="badge badge-category">' + esc(l.action) + '</span></td><td>' + esc(trunc(JSON.stringify(l.details || {}), 60)) + '</td><td>' + esc(l.ip_address || '--') + '</td><td>' + esc(l.device_type || '--') + '</td><td>' + esc(l.browser || '--') + '</td><td>' + esc(l.os || '--') + '</td></tr>'; }
        logBody.innerHTML = h;
    }
    function exportLogs() {
        if (!S.logs.length) { toast('No logs.', 'error'); return; }
        var hd = ['timestamp', 'action', 'details', 'ip_address', 'device_type', 'browser', 'os'];
        var rows = S.logs.map(function (l) { return hd.map(function (h) { return '"' + ((h === 'details' ? JSON.stringify(l[h]) : l[h]) || '').toString().replace(/"/g, '""') + '"'; }).join(','); });
        var blob = new Blob([hd.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' }); var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'logs.csv'; a.click(); URL.revokeObjectURL(url);
        toast('Exported.', 'success');
    }

    function loadAnalytics() {
        if (!analyticsEl) return;
        Promise.all([
            aGet('courses', { status: 'eq.active', select: 'id', limit: 1 }),
            aGet('suggestions', { select: 'id,status', limit: 1000 }),
            aGet('activity_log', { action: 'eq.search', select: 'id,timestamp', limit: 1000 }),
            aGet('activity_log', { action: 'eq.course_click', select: 'id,timestamp', limit: 1000 })
        ]).then(function (r) {
            var now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), week = new Date(today.getTime() - 7 * 86400000);
            var sug = r[1].data || [], srch = r[2].data || [], clk = r[3].data || [];
            var a = { courses: r[0].total || 0, pending: sug.filter(function (s) { return s.status === 'pending'; }).length, approved: sug.filter(function (s) { return s.status === 'approved'; }).length, rejected: sug.filter(function (s) { return s.status === 'rejected'; }).length, st: srch.filter(function (s) { return new Date(s.timestamp) >= today; }).length, sw: srch.filter(function (s) { return new Date(s.timestamp) >= week; }).length, ct: clk.filter(function (c) { return new Date(c.timestamp) >= today; }).length, cw: clk.filter(function (c) { return new Date(c.timestamp) >= week; }).length, ts: srch.length, tsug: sug.length };
            analyticsEl.innerHTML = '<div class="analytics-overview">' + ac(a.courses, 'Courses') + ac(a.pending, 'Pending') + ac(a.st, 'Searches Today') + ac(a.sw, 'Searches Week') + ac(a.ct, 'Clicks Today') + ac(a.cw, 'Clicks Week') + ac(a.approved, 'Approved') + ac(a.ts, 'Total Searches') + '</div><div class="analytics-charts"><div class="chart-container"><div class="chart-title">Suggestions</div>' + br('Pending', a.pending, a.tsug) + br('Approved', a.approved, a.tsug) + br('Rejected', a.rejected, a.tsug) + '</div><div class="chart-container"><div class="chart-title">Search Activity</div>' + br('Today', a.st, Math.max(a.sw, 1)) + br('Week', a.sw, Math.max(a.sw, 1)) + br('All Time', a.ts, Math.max(a.ts, 1)) + '</div></div>';
        }).catch(function (e) { toast('Analytics error.', 'error'); });
    }
    function ac(v, l) { return '<div class="analytics-card"><div class="analytics-card-value">' + v + '</div><div class="analytics-card-label">' + l + '</div></div>'; }
    function br(l, v, m) { var p = m > 0 ? Math.min(100, Math.round(v / m * 100)) : 0; return '<div class="bar-row"><span class="bar-label">' + l + '</span><div class="bar-track"><div class="bar-fill" style="width:' + p + '%"></div></div><span class="bar-value">' + v + '</span></div>'; }

    function toast(msg, type) { if (!toastBox) return; var t = document.createElement('div'); t.className = 'toast toast-' + (type || 'info'); t.textContent = msg; toastBox.appendChild(t); setTimeout(function () { if (t.parentNode) t.remove(); }, 4000); }

})();

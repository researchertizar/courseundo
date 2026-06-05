(function () {
    'use strict';

    // ===== CONFIG =====
    var URL = 'https://kvxfxpqbnmplcuadjmpc.supabase.co'.replace(/\/+$/, '');
    var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2eGZ4cHFibm1wbGN1YWRqbXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDk2NjUsImV4cCI6MjA5NjIyNTY2NX0.GQ5glAUeNb_6wMS9OvGBu25WPFa1yDs_hquGfYLXS-c';
    var FN = URL + '/functions/v1';
    var REST = URL + '/rest/v1';

    var S = { token: null, user: null, tab: 'courses', courses: [], filtered: [], editId: null, suggestions: [], logs: [], analytics: {} };

    var $ = function (id) { return document.getElementById(id); };
    var $$$$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
    var D = {};

    function cache() {
        D.loginWrap = $('login-wrapper'); D.dashWrap = $('dashboard-wrapper');
        D.loginForm = $('login-form'); D.loginEmail = $('login-email'); D.loginPw = $('login-password'); D.loginErr = $('login-error');
        D.nav = $('admin-nav'); D.navItems = $$('.admin-nav-item'); D.panels = $$('.admin-tab-panel');
        D.logout = $('logout-btn');
        D.cSearch = $('course-search'); D.cArchived = $('show-archived'); D.cList = $('admin-course-list');
        D.cForm = $('course-form'); D.cFormTitle = $('course-form-title'); D.cStatus = $('course-field-status');
        D.fetchMeta = $('fetch-meta-btn'); D.aiClass = $('ai-classify-btn'); D.newBtn = $('new-course-btn');
        D.archiveBtn = $('archive-course-btn'); D.verifyBtn = $('verify-course-btn');
        D.extraJson = $('course-extra-fields'); D.jsonFb = $('json-feedback');
        D.dropZone = $('file-drop-zone'); D.fileIn = $('file-input');
        D.importPrev = $('import-preview'); D.importSum = $('import-summary'); D.importBtn = $('import-btn');
        D.exportCsv = $('export-csv-btn'); D.exportJson = $('export-json-btn');
        D.sugList = $('admin-suggestions-list'); D.sugBadge = $('suggestion-badge');
        D.rateCont = $('ratings-container');
        D.logBody = $('log-table-body'); D.logAction = $('log-filter-action');
        D.logFrom = $('log-filter-from'); D.logDevice = $('log-filter-device');
        D.logApply = $('log-apply-filter'); D.logExport = $('log-export-btn');
        D.analytics = $('analytics-container');
        D.toasts = $('admin-toast-container');

        D.fields = {};
        ['title', 'link', 'platform', 'category', 'institution', 'instructor', 'difficulty', 'duration', 'mode', 'format', 'cost', 'certification', 'cert-type', 'validation', 'job-available', 'job-country', 'job-salary', 'job-mode', 'language'].forEach(function (k) {
            D.fields[k] = $('course-' + k);
        });
    }

    // DB column name map for form fields
    var TO_COL = { 'cert-type': 'cert_type', 'job-available': 'job_available', 'job-country': 'job_country', 'job-salary': 'job_salary', 'job-mode': 'job_mode' };
    function colKey(formKey) { return TO_COL[formKey] || formKey; }

    // ===== INIT =====
    document.addEventListener('DOMContentLoaded', function () {
        cache();
        var stored = sessionStorage.getItem('cu_admin_token');
        if (stored) { S.token = stored; showDash(); loadAll(); }
        bindEvents();
    });

    function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

    function bindEvents() {
        on(D.loginForm, 'submit', handleLogin);
        on(D.logout, 'click', function () { S.token = null; sessionStorage.removeItem('cu_admin_token'); showLogin(); });

        // Event delegation for nav (fixes the nav bug)
        on(D.nav, 'click', function (e) {
            var btn = e.target.closest('.admin-nav-item');
            if (!btn) return;
            switchTab(btn.getAttribute('data-tab'));
        });

        on(D.cSearch, 'input', filterList);
        on(D.cArchived, 'change', function () { S.showArchived = D.cArchived.checked; loadCourses(); });
        on(D.newBtn, 'click', resetForm);
        on(D.cForm, 'submit', saveCourse);
        on(D.fetchMeta, 'click', fetchMeta);
        on(D.aiClass, 'click', aiClassify);
        on(D.archiveBtn, 'click', archiveCourse);
        on(D.verifyBtn, 'click', verifyCourse);
        on(D.extraJson, 'input', validateJson);

        on(D.dropZone, 'click', function () { if (D.fileIn) D.fileIn.click(); });
        on(D.dropZone, 'dragover', function (e) { e.preventDefault(); D.dropZone.classList.add('dragover'); });
        on(D.dropZone, 'dragleave', function () { D.dropZone.classList.remove('dragover'); });
        on(D.dropZone, 'drop', handleDrop);
        on(D.fileIn, 'change', function (e) { if (e.target.files[0]) processFile(e.target.files[0]); });
        on(D.importBtn, 'click', bulkImport);
        on(D.exportCsv, 'click', function () { doExport('csv'); });
        on(D.exportJson, 'click', function () { doExport('json'); });

        on(D.logApply, 'click', loadLogs);
        on(D.logExport, 'click', exportLogs);
    }

    // ===== AUTH =====
    function handleLogin(e) {
        e.preventDefault();
        if (D.loginErr) D.loginErr.classList.remove('visible');
        var email = D.loginEmail ? D.loginEmail.value.trim() : '';
        var pw = D.loginPw ? D.loginPw.value : '';
        if (!email || !pw) { loginErr('Enter email and password.'); return; }

        fetch(URL + '/auth/v1/token?grant_type=password', {
            method: 'POST',
            headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: pw })
        }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
            .then(function (res) {
                if (!res.ok) throw new Error(res.d.error_description || res.d.msg || 'Login failed');
                S.token = res.d.access_token; S.user = { email: email };
                sessionStorage.setItem('cu_admin_token', res.d.access_token);
                showDash(); loadAll(); toast('Logged in.', 'success');
            }).catch(function (err) { loginErr(err.message); });
    }
    function loginErr(msg) { if (D.loginErr) { D.loginErr.textContent = msg; D.loginErr.classList.add('visible'); } }
    function showDash() { if (D.loginWrap) D.loginWrap.classList.add('hidden'); if (D.dashWrap) D.dashWrap.classList.remove('hidden'); }
    function showLogin() { if (D.loginWrap) D.loginWrap.classList.remove('hidden'); if (D.dashWrap) D.dashWrap.classList.add('hidden'); }

    // ===== API =====
    function authH() { return { 'apikey': KEY, 'Authorization': 'Bearer ' + S.token, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }; }
    function aGet(ep, pr) {
        pr = pr || {}; var u = REST + '/' + ep, f = true;
        for (var k in pr) { if (pr[k] === '' || pr[k] == null) continue; u += (f ? '?' : '&') + encodeURIComponent(k) + '=' + encodeURIComponent(pr[k]); f = false; }
        return fetch(u, { headers: authH() }).then(function (r) {
            var cr = r.headers.get('Content-Range');
            return r.json().then(function (d) {
                if (!r.ok) throw new Error(d.message || 'Error ' + r.status);
                var t = Array.isArray(d) ? d.length : 0;
                if (cr) { var p = cr.split('/'); if (p[1] && p[1] !== '*') t = parseInt(p[1], 10); }
                return { data: d, total: t };
            });
        });
    }
    function aPost(ep, body) { return fetch(REST + '/' + ep, { method: 'POST', headers: authH(), body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.message || 'Error ' + r.status); return d; }); }); }
    function aPatch(ep, body, pr) {
        pr = pr || {}; var u = REST + '/' + ep, f = true;
        for (var k in pr) { u += (f ? '?' : '&') + encodeURIComponent(k) + '=' + encodeURIComponent(pr[k]); f = false; }
        return fetch(u, { method: 'PATCH', headers: authH(), body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.message || 'Error ' + r.status); return d; }); });
    }
    function aFn(name, body) { return fetch(FN + '/' + name, { method: 'POST', headers: authH(), body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.message || 'Error ' + r.status); return d; }); }); }

    // ===== TABS =====
    function switchTab(id) {
        S.tab = id;
        D.navItems.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === id); });
        D.panels.forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + id); });
        if (id === 'courses') loadCourses();
        else if (id === 'suggestions') loadSuggestions();
        else if (id === 'ratings') loadRatings();
        else if (id === 'logs') loadLogs();
        else if (id === 'analytics') loadAnalytics();
    }
    function loadAll() { loadCourses(); loadSuggestions(); loadAnalytics(); }

    // ===== COURSES =====
    function loadCourses() {
        aGet('courses', { status: S.showArchived ? 'eq.archived' : 'eq.active', order: 'created_at.desc', limit: 500 })
            .then(function (r) { S.courses = r.data; filterList(); })
            .catch(function (e) { toast('Load failed: ' + e.message, 'error'); });
    }
    function filterList() {
        var q = D.cSearch ? D.cSearch.value.toLowerCase().trim() : '';
        S.filtered = q ? S.courses.filter(function (c) { return c.title.toLowerCase().indexOf(q) !== -1 || (c.platform || '').toLowerCase().indexOf(q) !== -1; }) : S.courses;
        renderList();
    }
    function renderList() {
        if (!D.cList) return;
        if (!S.filtered.length) { D.cList.innerHTML = '<div class="empty-state"><p>No courses.</p></div>'; return; }
        var h = '';
        S.filtered.forEach(function (c) {
            h += '<div class="admin-course-item' + (S.editId === c.id ? ' selected' : '') + '" data-id="' + c.id + '">' +
                '<span class="admin-course-item-title">' + esc(c.title) + '</span>' +
                '<span class="admin-course-item-platform">' + esc(c.platform || '—') + '</span>' +
                '<span class="admin-course-item-status status-' + c.status + '">' + c.status + '</span></div>';
        });
        D.cList.innerHTML = h;
        $$('.admin-course-item').forEach(function (el) { on(el, 'click', function () { editCourse(el.getAttribute('data-id')); }); });
    }
    function editCourse(id) {
        var c = null;
        S.courses.forEach(function (x) { if (x.id === id) c = x; });
        if (!c) return;
        S.editId = id;
        if (D.cFormTitle) D.cFormTitle.textContent = 'Edit Course';
        Object.keys(D.fields).forEach(function (k) { if (D.fields[k]) D.fields[k].value = c[colKey(k)] || ''; });
        if (D.extraJson) D.extraJson.value = c.extra_fields ? JSON.stringify(c.extra_fields, null, 2) : '';
        if (D.cStatus) D.cStatus.textContent = 'Status: ' + c.status;
        if (D.archiveBtn) D.archiveBtn.classList.remove('hidden');
        if (D.verifyBtn) D.verifyBtn.classList.remove('hidden');
        validateJson(); renderList();
    }
    function resetForm() {
        S.editId = null;
        if (D.cFormTitle) D.cFormTitle.textContent = 'Add New Course';
        if (D.cForm) D.cForm.reset();
        if (D.extraJson) D.extraJson.value = '';
        if (D.jsonFb) D.jsonFb.textContent = '';
        if (D.cStatus) D.cStatus.textContent = '';
        if (D.archiveBtn) D.archiveBtn.classList.add('hidden');
        if (D.verifyBtn) D.verifyBtn.classList.add('hidden');
        renderList();
    }
    function saveCourse(e) {
        e.preventDefault();
        var title = D.fields.title ? D.fields.title.value.trim() : '';
        var link = D.fields.link ? D.fields.link.value.trim() : '';
        if (!title || title.length < 5) { toast('Title 5-200 chars.', 'error'); return; }
        if (!link || !/^https?:\/\//.test(link)) { toast('Valid URL required.', 'error'); return; }
        var extra = {};
        if (D.extraJson && D.extraJson.value.trim()) { try { extra = JSON.parse(D.extraJson.value.trim()); } catch (j) { toast('Invalid JSON in Extra Fields.', 'error'); return; } }
        var body = { extra_fields: extra };
        Object.keys(D.fields).forEach(function (k) { var v = D.fields[k] ? D.fields[k].value.trim() : ''; if (v) body[colKey(k)] = v; });
        var p = S.editId ? aPatch('courses', body, { id: 'eq.' + S.editId }) : (body.status = 'active', aPost('courses', body));
        p.then(function (res) {
            toast(S.editId ? 'Updated.' : 'Added.', 'success');
            var cd = Array.isArray(res) ? res[0] : res;
            if (cd && cd.id) aFn('generate-embedding', { course_id: cd.id, title: body.title || '', description: '', category: body.category || '' }).catch(function () { });
            resetForm(); loadCourses();
        }).catch(function (err) { toast('Save failed: ' + err.message, 'error'); });
    }
    function fetchMeta() {
        var url = D.fields.link ? D.fields.link.value.trim() : '';
        if (!url) { toast('Enter URL first.', 'error'); return; }
        if (D.fetchMeta) { D.fetchMeta.disabled = true; D.fetchMeta.textContent = 'Fetching...'; }
        aFn('extract-metadata', { url: url }).then(function (d) {
            if (d.title && D.fields.title && !D.fields.title.value) D.fields.title.value = d.title;
            if (d.platform && D.fields.platform && !D.fields.platform.value) D.fields.platform.value = d.platform;
            toast('Metadata from ' + (d.source || 'API') + '.', 'success');
        }).catch(function () { toast('Fetch failed. Enter manually.', 'error'); })
            .finally(function () { if (D.fetchMeta) { D.fetchMeta.disabled = false; D.fetchMeta.textContent = 'Fetch Metadata'; } });
    }
    function aiClassify() {
        var t = D.fields.title ? D.fields.title.value.trim() : '';
        if (!t) { toast('Enter title first.', 'error'); return; }
        if (D.aiClass) { D.aiClass.disabled = true; D.aiClass.textContent = 'Classifying...'; }
        aFn('classify-course', { title: t, description: '' }).then(function (d) {
            if (d.category && D.fields.category && !D.fields.category.value) D.fields.category.value = d.category;
            if (d.difficulty && D.fields.difficulty && !D.fields.difficulty.value) D.fields.difficulty.value = d.difficulty;
            if (d.duration && D.fields.duration && !D.fields.duration.value) D.fields.duration.value = d.duration;
            toast('Classified by ' + (d.model_used || 'AI') + '.', 'success');
        }).catch(function () { toast('AI unavailable.', 'error'); })
            .finally(function () { if (D.aiClass) { D.aiClass.disabled = false; D.aiClass.textContent = 'AI Classify'; } });
    }
    function archiveCourse() {
        if (!S.editId || !confirm('Archive this course?')) return;
        aPatch('courses', { status: 'archived', embedding: null }, { id: 'eq.' + S.editId }).then(function () { toast('Archived.', 'success'); resetForm(); loadCourses(); }).catch(function (e) { toast('Error: ' + e.message, 'error'); });
    }
    function verifyCourse() {
        if (!S.editId) return;
        aPatch('courses', { last_verified: new Date().toISOString() }, { id: 'eq.' + S.editId }).then(function () { toast('Verified.', 'success'); loadCourses(); }).catch(function (e) { toast('Error: ' + e.message, 'error'); });
    }
    function validateJson() {
        if (!D.extraJson || !D.jsonFb) return;
        var t = D.extraJson.value.trim();
        if (!t) { D.extraJson.classList.remove('json-valid', 'json-invalid'); D.jsonFb.textContent = ''; return; }
        try { JSON.parse(t); D.extraJson.classList.remove('json-invalid'); D.extraJson.classList.add('json-valid'); D.jsonFb.textContent = 'Valid JSON'; D.jsonFb.style.color = 'var(--green)'; }
        catch (e) { D.extraJson.classList.remove('json-valid'); D.extraJson.classList.add('json-invalid'); D.jsonFb.textContent = 'Invalid JSON'; D.jsonFb.style.color = 'var(--red)'; }
    }

    // ===== BULK =====
    var impData = [];
    function handleDrop(e) { e.preventDefault(); if (D.dropZone) D.dropZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }
    function processFile(f) {
        var r = new FileReader();
        r.onload = function (e) {
            try { impData = f.name.endsWith('.json') ? JSON.parse(e.target.result) : csv2json(e.target.result); validateImport(); }
            catch (err) { toast('Parse error: ' + err.message, 'error'); }
        };
        r.readAsText(f);
    }
    function csv2json(csv) {
        var lines = csv.split('\n').filter(function (l) { return l.trim(); });
        if (lines.length < 2) return [];
        var h = lines[0].split(',').map(function (x) { return x.trim().replace(/"/g, ''); });
        return lines.slice(1).map(function (l) {
            var v = l.split(',').map(function (x) { return x.trim().replace(/"/g, ''); });
            var o = {}; h.forEach(function (k, i) { if (v[i]) o[k] = v[i]; }); return o;
        });
    }
    function validateImport() {
        var ok = 0, err = 0, rows = '';
        impData.forEach(function (r, i) {
            var v = r.title && r.title.length >= 5 && r.link && /^https?:\/\//.test(r.link);
            if (v) ok++; else err++;
            rows += '<tr class="' + (v ? '' : 'error-row') + '"><td>' + (i + 1) + '</td><td>' + esc(r.title || '—') + '</td><td>' + esc(r.platform || '') + '</td><td>' + (v ? 'OK' : 'Error') + '</td></tr>';
        });
        if (D.importPrev) D.importPrev.innerHTML = '<table><thead><tr><th>#</th><th>Title</th><th>Platform</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>';
        if (D.importSum) D.importSum.innerHTML = '<span class="valid">' + ok + ' valid</span><span class="errors">' + err + ' errors</span>';
        if (D.importBtn) D.importBtn.classList.toggle('hidden', ok === 0);
    }
    function bulkImport() {
        if (D.importBtn) { D.importBtn.disabled = true; D.importBtn.textContent = 'Importing...'; }
        var done = 0, skip = 0, i = 0;
        function next() {
            if (i >= impData.length) { toast('Done: ' + done + ' imported, ' + skip + ' skipped.', 'success'); if (D.importBtn) { D.importBtn.disabled = false; D.importBtn.textContent = 'Import Valid Rows'; } loadCourses(); return; }
            var r = impData[i++];
            if (!r.title || r.title.length < 5 || !r.link || !/^https?:\/\//.test(r.link)) { skip++; next(); return; }
            var b = { title: r.title, link: r.link, status: 'active' };
            if (r.platform) b.platform = r.platform;
            if (r.category) b.category = r.category;
            if (r.cost) b.cost = r.cost;
            aPost('courses', b).then(function (res) { done++; var c = Array.isArray(res) ? res[0] : res; if (c && c.id) aFn('generate-embedding', { course_id: c.id, title: b.title, description: '', category: b.category || '' }).catch(function () { }); }).catch(function () { skip++; }).finally(function () { setTimeout(next, 200); });
        }
        next();
    }
    function doExport(fmt) {
        aGet('courses', { status: 'eq.active', limit: 10000, order: 'created_at.desc' }).then(function (r) {
            var c, fn, mt;
            if (fmt === 'csv') {
                var hd = ['title', 'link', 'platform', 'category', 'cost', 'difficulty', 'rating_avg', 'rating_count'];
                var rows = r.data.map(function (x) { return hd.map(function (h) { return '"' + (x[h] || '').toString().replace(/"/g, '""') + '"'; }).join(','); });
                c = hd.join(',') + '\n' + rows.join('\n'); fn = 'courses.csv'; mt = 'text/csv';
            } else { c = JSON.stringify(r.data, null, 2); fn = 'courses.json'; mt = 'application/json'; }
            var blob = new Blob([c], { type: mt }), u = URL.createObjectURL(blob), a = document.createElement('a');
            a.href = u; a.download = fn; a.click(); URL.revokeObjectURL(u);
            toast('Exported ' + r.data.length + ' courses.', 'success');
        }).catch(function (e) { toast('Export failed: ' + e.message, 'error'); });
    }

    // ===== SUGGESTIONS =====
    function loadSuggestions() {
        aGet('suggestions', { order: 'created_at.desc', limit: 200 }).then(function (r) {
            S.suggestions = r.data;
            var p = r.data.filter(function (s) { return s.status === 'pending'; }).length;
            if (D.sugBadge) { D.sugBadge.textContent = p; D.sugBadge.classList.toggle('hidden', p === 0); }
            renderSugs();
        }).catch(function (e) { toast('Load failed: ' + e.message, 'error'); });
    }
    function renderSugs() {
        if (!D.sugList) return;
        if (!S.suggestions.length) { D.sugList.innerHTML = '<div class="empty-state"><p>No suggestions.</p></div>'; return; }
        var h = '';
        S.suggestions.forEach(function (s) {
            h += '<div class="admin-suggestion-item"><div class="admin-suggestion-info"><h4>' + esc(s.title) + '</h4>' +
                '<div class="detail-row"><span><a href="' + escA(s.link) + '" target="_blank">' + esc(s.link) + '</a></span>' +
                (s.platform ? '<span>' + esc(s.platform) + '</span>' : '') + '<span>Status: <b>' + s.status + '</b></span></div>' +
                '<div class="detail-row">' + (s.user_name ? '<span>By: ' + esc(s.user_name) + '</span>' : '') + (s.user_email ? '<span>' + esc(s.user_email) + '</span>' : '') + '<span>' + fmtDate(s.created_at) + '</span></div>' +
                (s.notes ? '<p style="margin-top:0.4rem;font-size:0.8rem;color:var(--text-secondary);font-style:italic">' + esc(s.notes) + '</p>' : '') + '</div>';
            if (s.status === 'pending') {
                h += '<div class="admin-suggestion-actions"><button type="button" class="btn btn-primary btn-sm appr-btn" data-id="' + s.id + '">Approve</button><button type="button" class="btn btn-danger btn-sm rej-btn" data-id="' + s.id + '">Reject</button></div>';
            }
            h += '</div>';
        });
        D.sugList.innerHTML = h;
        $$('.appr-btn').forEach(function (b) { on(b, 'click', function () { approveSug(b.getAttribute('data-id')); }); });
        $$('.rej-btn').forEach(function (b) { on(b, 'click', function () { rejectSug(b.getAttribute('data-id')); }); });
    }
    function approveSug(id) {
        var s = null; S.suggestions.forEach(function (x) { if (x.id === id) s = x; });
        if (!s) return;
        resetForm();
        if (D.fields.title) D.fields.title.value = s.title;
        if (D.fields.link) D.fields.link.value = s.link;
        if (s.platform && D.fields.platform) D.fields.platform.value = s.platform;
        aPatch('suggestions', { status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: (S.user && S.user.email) || 'admin' }, { id: 'eq.' + id })
            .then(function () { toast('Approved. Form pre-filled.', 'success'); switchTab('courses'); loadSuggestions(); })
            .catch(function (e) { toast('Error: ' + e.message, 'error'); });
    }
    function rejectSug(id) {
        if (!confirm('Reject?')) return;
        aPatch('suggestions', { status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: (S.user && S.user.email) || 'admin' }, { id: 'eq.' + id })
            .then(function () { toast('Rejected.', 'success'); loadSuggestions(); })
            .catch(function (e) { toast('Error: ' + e.message, 'error'); });
    }

    // ===== RATINGS =====
    function loadRatings() {
        if (!D.rateCont) return;
        aGet('courses', { status: 'eq.active', rating_count: 'gt.0', order: 'rating_avg.desc', limit: 50 }).then(function (r) {
            if (!r.data.length) { D.rateCont.innerHTML = '<div class="empty-state"><p>No ratings yet.</p></div>'; return; }
            var h = '';
            r.data.forEach(function (c) {
                h += '<div class="chart-container mb-2"><div class="flex-between mb-1"><h4 style="font-size:0.85rem">' + esc(c.title) + '</h4>' +
                    '<span style="font-family:var(--font-mono);font-size:0.75rem;color:var(--accent-text)">' + Number(c.rating_avg).toFixed(1) + ' (' + c.rating_count + ')</span></div></div>';
            });
            D.rateCont.innerHTML = h;
        }).catch(function (e) { toast('Load failed: ' + e.message, 'error'); });
    }

    // ===== LOGS =====
    function loadLogs() {
        var pr = { order: 'timestamp.desc', limit: 200 };
        if (D.logAction && D.logAction.value) pr.action = 'eq.' + D.logAction.value;
        if (D.logFrom && D.logFrom.value) pr.timestamp = 'gte.' + D.logFrom.value + 'T00:00:00Z';
        if (D.logDevice && D.logDevice.value) pr.device_type = 'eq.' + D.logDevice.value;
        aGet('activity_log', pr).then(function (r) { S.logs = r.data; renderLogs(); }).catch(function (e) { toast('Logs failed: ' + e.message, 'error'); });
    }
    function renderLogs() {
        if (!D.logBody) return;
        if (!S.logs.length) { D.logBody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:1.5rem;color:var(--text-muted)">No logs.</td></tr>'; return; }
        var h = '';
        S.logs.forEach(function (l) {
            h += '<tr><td>' + fmtDT(l.timestamp) + '</td><td><span class="badge badge-category">' + esc(l.action) + '</span></td>' +
                '<td>' + esc(trunc(JSON.stringify(l.details || {}), 60)) + '</td><td>' + esc(l.ip_address || '—') + '</td>' +
                '<td>' + esc(l.device_type || '—') + '</td><td>' + esc(l.browser || '—') + '</td><td>' + esc(l.os || '—') + '</td></tr>';
        });
        D.logBody.innerHTML = h;
    }
    function exportLogs() {
        if (!S.logs.length) { toast('No logs.', 'error'); return; }
        var hd = ['timestamp', 'action', 'details', 'ip_address', 'device_type', 'browser', 'os'];
        var rows = S.logs.map(function (l) { return hd.map(function (h) { return '"' + ((h === 'details' ? JSON.stringify(l[h]) : l[h]) || '').toString().replace(/"/g, '""') + '"'; }).join(','); });
        var blob = new Blob([hd.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
        var u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = 'logs.csv'; a.click(); URL.revokeObjectURL(u);
        toast('Logs exported.', 'success');
    }

    // ===== ANALYTICS =====
    function loadAnalytics() {
        if (!D.analytics) return;
        Promise.all([
            aGet('courses', { status: 'eq.active', select: 'id', limit: 1 }),
            aGet('suggestions', { select: 'id,status', limit: 1000 }),
            aGet('activity_log', { action: 'eq.search', select: 'id,timestamp', limit: 1000 }),
            aGet('activity_log', { action: 'eq.course_click', select: 'id,timestamp', limit: 1000 })
        ]).then(function (r) {
            var now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), week = new Date(today - 7 * 86400000);
            var sug = r[1].data || [], srch = r[2].data || [], clk = r[3].data || [];
            var a = {
                courses: r[0].total, pending: sug.filter(function (s) { return s.status === 'pending'; }).length,
                approved: sug.filter(function (s) { return s.status === 'approved'; }).length,
                rejected: sug.filter(function (s) { return s.status === 'rejected'; }).length,
                st: srch.filter(function (s) { return new Date(s.timestamp) >= today; }).length,
                sw: srch.filter(function (s) { return new Date(s.timestamp) >= week; }).length,
                ct: clk.filter(function (c) { return new Date(c.timestamp) >= today; }).length,
                cw: clk.filter(function (c) { return new Date(c.timestamp) >= week; }).length,
                ts: srch.length, tsug: sug.length
            };
            renderAnalytics(a);
        }).catch(function (e) { toast('Analytics error: ' + e.message, 'error'); });
    }
    function renderAnalytics(a) {
        D.analytics.innerHTML =
            '<div class="analytics-overview">' + ac(a.courses, 'Courses') + ac(a.pending, 'Pending') + ac(a.st, 'Searches Today') + ac(a.sw, 'Searches Week') + ac(a.ct, 'Clicks Today') + ac(a.cw, 'Clicks Week') + ac(a.approved, 'Approved') + ac(a.ts, 'Total Searches') + '</div>' +
            '<div class="analytics-charts"><div class="chart-container"><div class="chart-title">Suggestions</div>' + br('Pending', a.pending, a.tsug) + br('Approved', a.approved, a.tsug) + br('Rejected', a.rejected, a.tsug) + '</div>' +
            '<div class="chart-container"><div class="chart-title">Search Activity</div>' + br('Today', a.st, Math.max(a.sw, 1)) + br('Week', a.sw, Math.max(a.sw, 1)) + br('All Time', a.ts, Math.max(a.ts, 1)) + '</div></div>';
    }
    function ac(v, l) { return '<div class="analytics-card"><div class="analytics-card-value">' + v + '</div><div class="analytics-card-label">' + l + '</div></div>'; }
    function br(l, v, m) { var p = m > 0 ? Math.min(100, Math.round(v / m * 100)) : 0; return '<div class="bar-row"><span class="bar-label">' + l + '</span><div class="bar-track"><div class="bar-fill" style="width:' + p + '%"></div></div><span class="bar-value">' + v + '</span></div>'; }

    // ===== HELPERS =====
    function toast(msg, type) { if (!D.toasts) return; var t = document.createElement('div'); t.className = 'toast toast-' + (type || 'info'); t.textContent = msg; D.toasts.appendChild(t); setTimeout(function () { if (t.parentNode) t.remove(); }, 4000); }
    function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function escA(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
    function fmtDate(d) { if (!d) return ''; try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return d; } }
    function fmtDT(d) { if (!d) return ''; try { var x = new Date(d); return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + x.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return d; } }
    function trunc(s, n) { return (!s || s.length <= n) ? s : s.substr(0, n) + '...'; }
})();

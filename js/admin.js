/* ==========================================================================
   Courseundo — Admin Dashboard Logic (admin.js) — FIXED v2
   ========================================================================== */

(function () {
    'use strict';

    // ================================================================
    // CONFIGURATION — UPDATE WITH YOUR ACTUAL VALUES
    // ================================================================
    var SUPABASE_URL = 'https://kvxfxpqbnmplcuadjmpc.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2eGZ4cHFibm1wbGN1YWRqbXBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDk2NjUsImV4cCI6MjA5NjIyNTY2NX0.GQ5glAUeNb_6wMS9OvGBu25WPFa1yDs_hquGfYLXS-c';
    var FUNCTIONS_BASE = SUPABASE_URL + '/functions/v1';
    var REST_BASE = SUPABASE_URL + '/rest/v1';

    // ================================================================
    // STATE
    // ================================================================
    var state = {
        token: null,
        user: null,
        activeTab: 'courses',
        courses: [],
        filteredCourses: [],
        courseSearch: '',
        showArchived: false,
        editingCourseId: null,
        suggestions: [],
        activityLogs: [],
        analytics: {}
    };

    // ================================================================
    // DOM
    // ================================================================
    var dom = {};

    function cacheDom() {
        dom.loginWrapper = document.getElementById('login-wrapper');
        dom.dashboardWrapper = document.getElementById('dashboard-wrapper');
        dom.loginForm = document.getElementById('login-form');
        dom.loginEmail = document.getElementById('login-email');
        dom.loginPassword = document.getElementById('login-password');
        dom.loginError = document.getElementById('login-error');
        dom.navItems = document.querySelectorAll('.admin-nav-item');
        dom.tabPanels = document.querySelectorAll('.admin-tab-panel');
        dom.logoutBtn = document.getElementById('logout-btn');

        dom.courseSearch = document.getElementById('course-search');
        dom.showArchivedToggle = document.getElementById('show-archived');
        dom.courseList = document.getElementById('admin-course-list');
        dom.courseForm = document.getElementById('course-form');
        dom.courseFormTitle = document.getElementById('course-form-title');
        dom.fetchMetaBtn = document.getElementById('fetch-meta-btn');
        dom.aiClassifyBtn = document.getElementById('ai-classify-btn');
        dom.saveCourseBtn = document.getElementById('save-course-btn');
        dom.archiveCourseBtn = document.getElementById('archive-course-btn');
        dom.verifyCourseBtn = document.getElementById('verify-course-btn');
        dom.newCourseBtn = document.getElementById('new-course-btn');
        dom.courseFieldStatus = document.getElementById('course-field-status');
        dom.extraFieldsInput = document.getElementById('course-extra-fields');
        dom.jsonFeedback = document.getElementById('json-feedback');

        dom.fields = {};
        var fieldNames = [
            'title', 'link', 'platform', 'category', 'institution', 'instructor',
            'difficulty', 'duration', 'mode', 'format', 'cost', 'certification',
            'cert-type', 'validation', 'job-available', 'job-country',
            'job-salary', 'job-mode', 'language'
        ];
        for (var i = 0; i < fieldNames.length; i++) {
            dom.fields[fieldNames[i]] = document.getElementById('course-' + fieldNames[i]);
        }

        dom.fileDropZone = document.getElementById('file-drop-zone');
        dom.fileInput = document.getElementById('file-input');
        dom.importPreview = document.getElementById('import-preview');
        dom.importSummary = document.getElementById('import-summary');
        dom.importBtn = document.getElementById('import-btn');
        dom.exportCsvBtn = document.getElementById('export-csv-btn');
        dom.exportJsonBtn = document.getElementById('export-json-btn');

        dom.suggestionsListAdmin = document.getElementById('admin-suggestions-list');
        dom.suggestionBadge = document.getElementById('suggestion-badge');

        dom.ratingsContainer = document.getElementById('ratings-container');

        dom.logTableBody = document.getElementById('log-table-body');
        dom.logFilterAction = document.getElementById('log-filter-action');
        dom.logFilterFrom = document.getElementById('log-filter-from');
        dom.logFilterTo = document.getElementById('log-filter-to');
        dom.logFilterIp = document.getElementById('log-filter-ip');
        dom.logFilterDevice = document.getElementById('log-filter-device');
        dom.logApplyFilter = document.getElementById('log-apply-filter');
        dom.logExportBtn = document.getElementById('log-export-btn');

        dom.analyticsContainer = document.getElementById('analytics-container');

        dom.toastContainer = document.getElementById('admin-toast-container');

        dom.modalOverlay = document.getElementById('admin-modal');
        dom.modalTitle = document.getElementById('modal-title');
        dom.modalBody = document.getElementById('modal-body');
        dom.modalActions = document.getElementById('modal-actions');

        // Debug: log missing
        var checks = {
            loginWrapper: dom.loginWrapper,
            dashboardWrapper: dom.dashboardWrapper,
            loginForm: dom.loginForm,
            courseForm: dom.courseForm,
            courseList: dom.courseList,
            suggestionsListAdmin: dom.suggestionsListAdmin,
            analyticsContainer: dom.analyticsContainer,
            logTableBody: dom.logTableBody,
            toastContainer: dom.toastContainer
        };
        for (var key in checks) {
            if (!checks[key]) console.error('[admin.js] Missing DOM: ' + key);
        }
    }

    // ================================================================
    // INIT
    // ================================================================
    document.addEventListener('DOMContentLoaded', function () {
        cacheDom();
        checkSession();
        bindEvents();
    });

    function checkSession() {
        var stored = sessionStorage.getItem('courseundo_admin_token');
        if (stored) {
            state.token = stored;
            showDashboard();
            loadAllData();
        }
    }

    function showDashboard() {
        if (dom.loginWrapper) dom.loginWrapper.classList.add('hidden');
        if (dom.dashboardWrapper) dom.dashboardWrapper.classList.remove('hidden');
    }

    function showLogin() {
        if (dom.loginWrapper) dom.loginWrapper.classList.remove('hidden');
        if (dom.dashboardWrapper) dom.dashboardWrapper.classList.add('hidden');
    }

    // ================================================================
    // EVENTS — all with null guards
    // ================================================================
    function bindEvents() {
        if (dom.loginForm) dom.loginForm.addEventListener('submit', handleLogin);
        if (dom.logoutBtn) dom.logoutBtn.addEventListener('click', handleLogout);

        if (dom.navItems && dom.navItems.length) {
            dom.navItems.forEach(function (item) {
                item.addEventListener('click', function () {
                    switchTab(item.getAttribute('data-tab'));
                });
            });
        }

        if (dom.courseSearch) dom.courseSearch.addEventListener('input', filterCourseList);
        if (dom.showArchivedToggle) dom.showArchivedToggle.addEventListener('change', function () {
            state.showArchived = dom.showArchivedToggle.checked;
            loadCourses();
        });
        if (dom.newCourseBtn) dom.newCourseBtn.addEventListener('click', resetCourseForm);
        if (dom.courseForm) dom.courseForm.addEventListener('submit', handleSaveCourse);
        if (dom.fetchMetaBtn) dom.fetchMetaBtn.addEventListener('click', handleFetchMetadata);
        if (dom.aiClassifyBtn) dom.aiClassifyBtn.addEventListener('click', handleAiClassify);
        if (dom.archiveCourseBtn) dom.archiveCourseBtn.addEventListener('click', handleArchiveCourse);
        if (dom.verifyCourseBtn) dom.verifyCourseBtn.addEventListener('click', handleMarkVerified);
        if (dom.extraFieldsInput) dom.extraFieldsInput.addEventListener('input', validateJson);

        if (dom.fileDropZone) {
            dom.fileDropZone.addEventListener('click', function () { if (dom.fileInput) dom.fileInput.click(); });
            dom.fileDropZone.addEventListener('dragover', function (e) { e.preventDefault(); dom.fileDropZone.classList.add('dragover'); });
            dom.fileDropZone.addEventListener('dragleave', function () { dom.fileDropZone.classList.remove('dragover'); });
            dom.fileDropZone.addEventListener('drop', handleFileDrop);
        }
        if (dom.fileInput) dom.fileInput.addEventListener('change', handleFileSelect);
        if (dom.importBtn) dom.importBtn.addEventListener('click', handleBulkImport);
        if (dom.exportCsvBtn) dom.exportCsvBtn.addEventListener('click', function () { handleExport('csv'); });
        if (dom.exportJsonBtn) dom.exportJsonBtn.addEventListener('click', function () { handleExport('json'); });
        if (dom.logApplyFilter) dom.logApplyFilter.addEventListener('click', loadActivityLogs);
        if (dom.logExportBtn) dom.logExportBtn.addEventListener('click', handleLogExport);
        if (dom.modalOverlay) dom.modalOverlay.addEventListener('click', function (e) {
            if (e.target === dom.modalOverlay) closeModal();
        });
    }

    // ================================================================
    // AUTH
    // ================================================================
    function handleLogin(e) {
        e.preventDefault();
        if (dom.loginError) dom.loginError.classList.remove('visible');

        var email = dom.loginEmail ? dom.loginEmail.value.trim() : '';
        var password = dom.loginPassword ? dom.loginPassword.value : '';

        if (!email || !password) {
            showLoginError('Please enter email and password.');
            return;
        }

        fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        })
            .then(function (resp) { return resp.json().then(function (data) { return { ok: resp.ok, data: data }; }); })
            .then(function (result) {
                if (!result.ok) throw new Error(result.data.error_description || result.data.msg || 'Login failed');
                state.token = result.data.access_token;
                state.user = { email: email };
                sessionStorage.setItem('courseundo_admin_token', result.data.access_token);
                showDashboard();
                loadAllData();
                showToast('Logged in successfully.', 'success');
            })
            .catch(function (err) {
                showLoginError(err.message);
            });
    }

    function showLoginError(msg) {
        if (dom.loginError) {
            dom.loginError.textContent = msg;
            dom.loginError.classList.add('visible');
        }
    }

    function handleLogout() {
        state.token = null;
        state.user = null;
        sessionStorage.removeItem('courseundo_admin_token');
        showLogin();
    }

    // ================================================================
    // API HELPERS
    // ================================================================
    function authHeaders() {
        return {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + state.token,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    function adminGet(endpoint, params) {
        params = params || {};
        var url = REST_BASE + '/' + endpoint;
        var first = true;
        for (var key in params) {
            if (params[key] === '' || params[key] === undefined) continue;
            url += (first ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
            first = false;
        }
        return fetch(url, { headers: authHeaders() })
            .then(function (resp) {
                var countHeader = resp.headers.get('Content-Range');
                return resp.json().then(function (data) {
                    if (!resp.ok) throw new Error(data.message || 'Error ' + resp.status);
                    var total = Array.isArray(data) ? data.length : 0;
                    if (countHeader) {
                        var parts = countHeader.split('/');
                        if (parts[1] && parts[1] !== '*') total = parseInt(parts[1], 10);
                    }
                    return { data: data, total: total };
                });
            });
    }

    function adminPost(endpoint, body) {
        return fetch(REST_BASE + '/' + endpoint, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
            .then(function (resp) { return resp.json().then(function (data) { if (!resp.ok) throw new Error(data.message || 'Error ' + resp.status); return data; }); });
    }

    function adminPatch(endpoint, body, params) {
        params = params || {};
        var url = REST_BASE + '/' + endpoint;
        var first = true;
        for (var key in params) {
            url += (first ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
            first = false;
        }
        return fetch(url, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) })
            .then(function (resp) { return resp.json().then(function (data) { if (!resp.ok) throw new Error(data.message || 'Error ' + resp.status); return data; }); });
    }

    function adminFunction(name, body) {
        return fetch(FUNCTIONS_BASE + '/' + name, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
            .then(function (resp) { return resp.json().then(function (data) { if (!resp.ok) throw new Error(data.message || 'Error ' + resp.status); return data; }); });
    }

    // ================================================================
    // TABS
    // ================================================================
    function switchTab(tabId) {
        state.activeTab = tabId;
        if (dom.navItems) dom.navItems.forEach(function (item) { item.classList.toggle('active', item.getAttribute('data-tab') === tabId); });
        if (dom.tabPanels) dom.tabPanels.forEach(function (panel) { panel.classList.toggle('active', panel.id === 'tab-' + tabId); });
        if (tabId === 'courses') loadCourses();
        if (tabId === 'suggestions') loadSuggestionsAdmin();
        if (tabId === 'ratings') loadRatingsManagement();
        if (tabId === 'logs') loadActivityLogs();
        if (tabId === 'analytics') loadAnalytics();
    }

    function loadAllData() {
        loadCourses();
        loadSuggestionsAdmin();
        loadAnalytics();
    }

    // ================================================================
    // COURSES
    // ================================================================
    function loadCourses() {
        var statusFilter = state.showArchived ? 'eq.archived' : 'eq.active';
        adminGet('courses', { status: statusFilter, order: 'created_at.desc', limit: 500 })
            .then(function (resp) {
                state.courses = resp.data;
                filterCourseList();
            })
            .catch(function (err) { showToast('Failed to load courses: ' + err.message, 'error'); });
    }

    function filterCourseList() {
        var search = dom.courseSearch ? dom.courseSearch.value.toLowerCase().trim() : '';
        var source = state.courses;
        state.filteredCourses = search
            ? source.filter(function (c) { return c.title.toLowerCase().indexOf(search) !== -1 || (c.platform || '').toLowerCase().indexOf(search) !== -1; })
            : source;
        renderCourseList();
    }

    function renderCourseList() {
        if (!dom.courseList) return;
        if (!state.filteredCourses.length) {
            dom.courseList.innerHTML = '<div class="empty-state"><p>No courses found.</p></div>';
            return;
        }
        var html = '';
        for (var i = 0; i < state.filteredCourses.length; i++) {
            var c = state.filteredCourses[i];
            html += '<div class="admin-course-item' + (state.editingCourseId === c.id ? ' selected' : '') + '" data-id="' + c.id + '">' +
                '<span class="admin-course-item-title">' + escapeHtml(c.title) + '</span>' +
                '<span class="admin-course-item-platform">' + escapeHtml(c.platform || '—') + '</span>' +
                '<span class="admin-course-item-status status-' + c.status + '">' + c.status + '</span></div>';
        }
        dom.courseList.innerHTML = html;

        var items = dom.courseList.querySelectorAll('.admin-course-item');
        for (var j = 0; j < items.length; j++) {
            (function (el) {
                el.addEventListener('click', function () { loadCourseIntoForm(el.getAttribute('data-id')); });
            })(items[j]);
        }
    }

    function loadCourseIntoForm(courseId) {
        var course = null;
        var all = state.courses;
        for (var i = 0; i < all.length; i++) { if (all[i].id === courseId) { course = all[i]; break; } }
        if (!course) return;

        state.editingCourseId = courseId;
        if (dom.courseFormTitle) dom.courseFormTitle.textContent = 'Edit Course';

        // Map field keys to course data keys
        var fieldToDataKey = {
            'title': 'title', 'link': 'link', 'platform': 'platform', 'category': 'category',
            'institution': 'institution', 'instructor': 'instructor', 'difficulty': 'difficulty',
            'duration': 'duration', 'mode': 'mode', 'format': 'format', 'cost': 'cost',
            'certification': 'certification', 'cert-type': 'cert_type', 'validation': 'validation',
            'job-available': 'job_available', 'job-country': 'job_country', 'job-salary': 'job_salary',
            'job-mode': 'job_mode', 'language': 'language'
        };
        var fKeys = Object.keys(dom.fields);
        for (var j = 0; j < fKeys.length; j++) {
            var fKey = fKeys[j];
            var dataKey = fieldToDataKey[fKey] || fKey;
            if (dom.fields[fKey]) dom.fields[fKey].value = course[dataKey] || '';
        }

        if (dom.extraFieldsInput) dom.extraFieldsInput.value = course.extra_fields ? JSON.stringify(course.extra_fields, null, 2) : '';
        if (dom.courseFieldStatus) dom.courseFieldStatus.textContent = 'Status: ' + course.status;
        if (dom.archiveCourseBtn) dom.archiveCourseBtn.classList.remove('hidden');
        if (dom.verifyCourseBtn) dom.verifyCourseBtn.classList.remove('hidden');
        validateJson();
        renderCourseList();
    }

    function resetCourseForm() {
        state.editingCourseId = null;
        if (dom.courseFormTitle) dom.courseFormTitle.textContent = 'Add New Course';
        if (dom.courseForm) dom.courseForm.reset();
        if (dom.extraFieldsInput) dom.extraFieldsInput.value = '';
        if (dom.jsonFeedback) dom.jsonFeedback.textContent = '';
        if (dom.courseFieldStatus) dom.courseFieldStatus.textContent = '';
        if (dom.archiveCourseBtn) dom.archiveCourseBtn.classList.add('hidden');
        if (dom.verifyCourseBtn) dom.verifyCourseBtn.classList.add('hidden');
        renderCourseList();
    }

    function handleSaveCourse(e) {
        e.preventDefault();
        var title = dom.fields['title'] ? dom.fields['title'].value.trim() : '';
        var link = dom.fields['link'] ? dom.fields['link'].value.trim() : '';

        if (!title || title.length < 5) { showToast('Title must be 5-200 characters.', 'error'); return; }
        if (!link || !link.match(/^https?:\/\//)) { showToast('Enter a valid URL.', 'error'); return; }

        var extraFields = {};
        var jsonText = dom.extraFieldsInput ? dom.extraFieldsInput.value.trim() : '';
        if (jsonText) {
            try { extraFields = JSON.parse(jsonText); } catch (je) { showToast('Extra Fields: invalid JSON.', 'error'); return; }
        }

        // Build body from form fields
        var body = {};
        var fieldToColKey = {
            'title': 'title', 'link': 'link', 'platform': 'platform', 'category': 'category',
            'institution': 'institution', 'instructor': 'instructor', 'difficulty': 'difficulty',
            'duration': 'duration', 'mode': 'mode', 'format': 'format', 'cost': 'cost',
            'certification': 'certification', 'cert-type': 'cert_type', 'validation': 'validation',
            'job-available': 'job_available', 'job-country': 'job_country', 'job-salary': 'job_salary',
            'job-mode': 'job_mode', 'language': 'language'
        };
        var fKeys = Object.keys(dom.fields);
        for (var i = 0; i < fKeys.length; i++) {
            var fKey = fKeys[i];
            var colKey = fieldToColKey[fKey] || fKey;
            var val = dom.fields[fKey] ? dom.fields[fKey].value.trim() : '';
            if (val) body[colKey] = val;
        }
        body.extra_fields = extraFields;

        var savePromise;
        if (state.editingCourseId) {
            savePromise = adminPatch('courses', body, { 'id': 'eq.' + state.editingCourseId })
                .then(function (result) { showToast('Course updated.', 'success'); return result; });
        } else {
            body.status = 'active';
            savePromise = adminPost('courses', body)
                .then(function (result) { showToast('Course added.', 'success'); return result; });
        }

        savePromise
            .then(function (result) {
                var courseData = Array.isArray(result) ? result[0] : result;
                if (courseData && courseData.id) {
                    adminFunction('generate-embedding', {
                        course_id: courseData.id,
                        title: body.title || '',
                        description: '',
                        category: body.category || ''
                    }).catch(function () { });
                }
                resetCourseForm();
                loadCourses();
            })
            .catch(function (err) { showToast('Save failed: ' + err.message, 'error'); });
    }

    function handleFetchMetadata() {
        var linkField = dom.fields['link'];
        var url = linkField ? linkField.value.trim() : '';
        if (!url) { showToast('Enter a URL first.', 'error'); return; }

        if (dom.fetchMetaBtn) { dom.fetchMetaBtn.disabled = true; dom.fetchMetaBtn.textContent = 'Fetching...'; }

        adminFunction('extract-metadata', { url: url })
            .then(function (data) {
                if (data.title && dom.fields['title'] && !dom.fields['title'].value) dom.fields['title'].value = data.title;
                if (data.platform && dom.fields['platform'] && !dom.fields['platform'].value) dom.fields['platform'].value = data.platform;
                showToast('Metadata fetched from ' + (data.source || 'API') + '.', 'success');
            })
            .catch(function () { showToast('Could not fetch metadata. Enter manually.', 'error'); })
            .finally(function () { if (dom.fetchMetaBtn) { dom.fetchMetaBtn.disabled = false; dom.fetchMetaBtn.textContent = 'Auto-fetch Metadata'; } });
    }

    function handleAiClassify() {
        var titleVal = dom.fields['title'] ? dom.fields['title'].value.trim() : '';
        if (!titleVal) { showToast('Enter a title first.', 'error'); return; }

        if (dom.aiClassifyBtn) { dom.aiClassifyBtn.disabled = true; dom.aiClassifyBtn.textContent = 'Classifying...'; }

        adminFunction('classify-course', { title: titleVal, description: '' })
            .then(function (data) {
                if (data.category && dom.fields['category'] && !dom.fields['category'].value) dom.fields['category'].value = data.category;
                if (data.difficulty && dom.fields['difficulty'] && !dom.fields['difficulty'].value) dom.fields['difficulty'].value = data.difficulty;
                if (data.duration && dom.fields['duration'] && !dom.fields['duration'].value) dom.fields['duration'].value = data.duration;
                showToast('Classified by ' + (data.model_used || 'AI') + '.', 'success');
            })
            .catch(function () { showToast('AI classification unavailable.', 'error'); })
            .finally(function () { if (dom.aiClassifyBtn) { dom.aiClassifyBtn.disabled = false; dom.aiClassifyBtn.textContent = 'AI Classify'; } });
    }

    function handleArchiveCourse() {
        if (!state.editingCourseId) return;
        if (!confirm('Archive this course?')) return;
        adminPatch('courses', { status: 'archived', embedding: null }, { 'id': 'eq.' + state.editingCourseId })
            .then(function () { showToast('Archived.', 'success'); resetCourseForm(); loadCourses(); })
            .catch(function (err) { showToast('Archive failed: ' + err.message, 'error'); });
    }

    function handleMarkVerified() {
        if (!state.editingCourseId) return;
        adminPatch('courses', { last_verified: new Date().toISOString() }, { 'id': 'eq.' + state.editingCourseId })
            .then(function () { showToast('Marked as verified.', 'success'); loadCourses(); })
            .catch(function (err) { showToast('Verify failed: ' + err.message, 'error'); });
    }

    function validateJson() {
        if (!dom.extraFieldsInput || !dom.jsonFeedback) return;
        var text = dom.extraFieldsInput.value.trim();
        if (!text) {
            dom.extraFieldsInput.classList.remove('json-valid', 'json-invalid');
            dom.jsonFeedback.textContent = '';
            return;
        }
        try {
            JSON.parse(text);
            dom.extraFieldsInput.classList.remove('json-invalid');
            dom.extraFieldsInput.classList.add('json-valid');
            dom.jsonFeedback.textContent = 'Valid JSON';
            dom.jsonFeedback.style.color = 'var(--green)';
        } catch (e) {
            dom.extraFieldsInput.classList.remove('json-valid');
            dom.extraFieldsInput.classList.add('json-invalid');
            dom.jsonFeedback.textContent = 'Invalid JSON';
            dom.jsonFeedback.style.color = 'var(--red)';
        }
    }

    // ================================================================
    // BULK IMPORT / EXPORT
    // ================================================================
    var importData = [];

    function handleFileDrop(e) {
        e.preventDefault();
        if (dom.fileDropZone) dom.fileDropZone.classList.remove('dragover');
        var file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }

    function handleFileSelect(e) {
        var file = e.target.files[0];
        if (file) processFile(file);
    }

    function processFile(file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var text = e.target.result;
                if (file.name.endsWith('.json')) {
                    importData = JSON.parse(text);
                } else {
                    importData = csvToJson(text);
                }
                validateImportData();
            } catch (err) { showToast('File parse error: ' + err.message, 'error'); }
        };
        reader.readAsText(file);
    }

    function csvToJson(csv) {
        var lines = csv.split('\n').filter(function (l) { return l.trim(); });
        if (lines.length < 2) return [];
        var headers = lines[0].split(',').map(function (h) { return h.trim().replace(/"/g, ''); });
        return lines.slice(1).map(function (line) {
            var values = line.split(',').map(function (v) { return v.trim().replace(/"/g, ''); });
            var obj = {};
            headers.forEach(function (h, i) { if (values[i]) obj[h] = values[i]; });
            return obj;
        });
    }

    function validateImportData() {
        var valid = 0, errors = 0;
        var rows = '';
        for (var i = 0; i < importData.length; i++) {
            var r = importData[i];
            var ok = r.title && r.title.length >= 5 && r.link && r.link.match(/^https?:\/\//);
            if (ok) valid++; else errors++;
            rows += '<tr class="' + (ok ? '' : 'error-row') + '"><td>' + (i + 1) + '</td><td>' + escapeHtml(r.title || '(missing)') + '</td><td>' + escapeHtml(r.link || '(missing)') + '</td><td>' + escapeHtml(r.platform || '') + '</td><td>' + (ok ? 'OK' : 'Error') + '</td></tr>';
        }
        if (dom.importPreview) dom.importPreview.innerHTML = '<table><thead><tr><th>#</th><th>Title</th><th>Link</th><th>Platform</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>';
        if (dom.importSummary) dom.importSummary.innerHTML = '<span class="valid">' + valid + ' valid</span><span class="errors">' + errors + ' errors</span><span>Total: ' + importData.length + '</span>';
        if (dom.importBtn) { if (valid > 0) dom.importBtn.classList.remove('hidden'); else dom.importBtn.classList.add('hidden'); }
    }

    function handleBulkImport() {
        if (dom.importBtn) { dom.importBtn.disabled = true; dom.importBtn.textContent = 'Importing...'; }
        var imported = 0, skipped = 0, idx = 0;

        function importNext() {
            if (idx >= importData.length) {
                showToast('Import done: ' + imported + ' imported, ' + skipped + ' skipped.', 'success');
                if (dom.importBtn) { dom.importBtn.disabled = false; dom.importBtn.textContent = 'Import Valid Rows'; }
                loadCourses();
                return;
            }
            var r = importData[idx];
            idx++;
            if (!r.title || r.title.length < 5 || !r.link || !r.link.match(/^https?:\/\//)) { skipped++; importNext(); return; }

            var body = { title: r.title, link: r.link, status: 'active' };
            if (r.platform) body.platform = r.platform;
            if (r.category) body.category = r.category;
            if (r.cost) body.cost = r.cost;
            if (r.difficulty) body.difficulty = r.difficulty;
            if (r.language) body.language = r.language;

            adminPost('courses', body)
                .then(function (result) {
                    imported++;
                    var c = Array.isArray(result) ? result[0] : result;
                    if (c && c.id) {
                        adminFunction('generate-embedding', { course_id: c.id, title: body.title, description: '', category: body.category || '' }).catch(function () { });
                    }
                })
                .catch(function () { skipped++; })
                .finally(function () { setTimeout(importNext, 200); });
        }
        importNext();
    }

    function handleExport(format) {
        adminGet('courses', { status: 'eq.active', limit: 10000, order: 'created_at.desc' })
            .then(function (resp) {
                var data = resp.data;
                var content, filename, mime;
                if (format === 'csv') {
                    var headers = ['title', 'link', 'platform', 'category', 'cost', 'difficulty', 'language', 'rating_avg', 'rating_count'];
                    var rows = data.map(function (c) { return headers.map(function (h) { return '"' + (c[h] || '').toString().replace(/"/g, '""') + '"'; }).join(','); });
                    content = headers.join(',') + '\n' + rows.join('\n');
                    filename = 'courseundo-export.csv'; mime = 'text/csv';
                } else {
                    content = JSON.stringify(data, null, 2);
                    filename = 'courseundo-export.json'; mime = 'application/json';
                }
                var blob = new Blob([content], { type: mime });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a'); a.href = url; a.download = filename; a.click();
                URL.revokeObjectURL(url);
                showToast('Exported ' + data.length + ' courses.', 'success');
            })
            .catch(function (err) { showToast('Export failed: ' + err.message, 'error'); });
    }

    // ================================================================
    // SUGGESTIONS
    // ================================================================
    function loadSuggestionsAdmin() {
        adminGet('suggestions', { order: 'created_at.desc', limit: 200 })
            .then(function (resp) {
                state.suggestions = resp.data;
                var pending = resp.data.filter(function (s) { return s.status === 'pending'; }).length;
                if (dom.suggestionBadge) {
                    dom.suggestionBadge.textContent = pending;
                    if (pending > 0) dom.suggestionBadge.classList.remove('hidden'); else dom.suggestionBadge.classList.add('hidden');
                }
                renderSuggestionsAdmin();
            })
            .catch(function (err) { showToast('Failed to load suggestions: ' + err.message, 'error'); });
    }

    function renderSuggestionsAdmin() {
        if (!dom.suggestionsListAdmin) return;
        if (!state.suggestions.length) { dom.suggestionsListAdmin.innerHTML = '<div class="empty-state"><p>No suggestions yet.</p></div>'; return; }

        var html = '';
        for (var i = 0; i < state.suggestions.length; i++) {
            var s = state.suggestions[i];
            html += '<div class="admin-suggestion-item"><div class="admin-suggestion-info"><h4>' + escapeHtml(s.title) + '</h4>' +
                '<div class="detail-row"><span><a href="' + escapeAttr(s.link) + '" target="_blank">' + escapeHtml(s.link) + '</a></span>' +
                (s.platform ? '<span>Platform: ' + escapeHtml(s.platform) + '</span>' : '') +
                '<span>Status: <strong>' + s.status + '</strong></span></div>' +
                '<div class="detail-row">' + (s.user_name ? '<span>By: ' + escapeHtml(s.user_name) + '</span>' : '') +
                (s.user_email ? '<span>Email: ' + escapeHtml(s.user_email) + '</span>' : '') +
                '<span>' + formatDate(s.created_at) + '</span></div>' +
                (s.notes ? '<p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-secondary);font-style:italic">' + escapeHtml(s.notes) + '</p>' : '') +
                '</div>';
            if (s.status === 'pending') {
                html += '<div class="admin-suggestion-actions">' +
                    '<button type="button" class="btn btn-primary btn-sm approve-btn" data-id="' + s.id + '">Approve</button>' +
                    '<button type="button" class="btn btn-danger btn-sm reject-btn" data-id="' + s.id + '">Reject</button></div>';
            }
            html += '</div>';
        }
        dom.suggestionsListAdmin.innerHTML = html;

        // Bind approve/reject
        var approveBtns = dom.suggestionsListAdmin.querySelectorAll('.approve-btn');
        for (var a = 0; a < approveBtns.length; a++) {
            (function (btn) { btn.addEventListener('click', function () { approveSuggestion(btn.getAttribute('data-id')); }); })(approveBtns[a]);
        }
        var rejectBtns = dom.suggestionsListAdmin.querySelectorAll('.reject-btn');
        for (var r = 0; r < rejectBtns.length; r++) {
            (function (btn) { btn.addEventListener('click', function () { rejectSuggestion(btn.getAttribute('data-id')); }); })(rejectBtns[r]);
        }
    }

    function approveSuggestion(id) {
        var suggestion = null;
        for (var i = 0; i < state.suggestions.length; i++) { if (state.suggestions[i].id === id) { suggestion = state.suggestions[i]; break; } }
        if (!suggestion) return;

        resetCourseForm();
        if (dom.fields['title']) dom.fields['title'].value = suggestion.title;
        if (dom.fields['link']) dom.fields['link'].value = suggestion.link;
        if (suggestion.platform && dom.fields['platform']) dom.fields['platform'].value = suggestion.platform;

        adminPatch('suggestions', { status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: (state.user && state.user.email) || 'admin' }, { 'id': 'eq.' + id })
            .then(function () { showToast('Approved. Course form pre-filled.', 'success'); switchTab('courses'); loadSuggestionsAdmin(); })
            .catch(function (err) { showToast('Approve failed: ' + err.message, 'error'); });
    }

    function rejectSuggestion(id) {
        if (!confirm('Reject this suggestion?')) return;
        adminPatch('suggestions', { status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: (state.user && state.user.email) || 'admin' }, { 'id': 'eq.' + id })
            .then(function () { showToast('Rejected.', 'success'); loadSuggestionsAdmin(); })
            .catch(function (err) { showToast('Reject failed: ' + err.message, 'error'); });
    }

    // ================================================================
    // RATINGS
    // ================================================================
    function loadRatingsManagement() {
        if (!dom.ratingsContainer) return;
        adminGet('courses', { status: 'eq.active', rating_count: 'gt.0', order: 'rating_avg.desc', limit: 50 })
            .then(function (resp) {
                if (!resp.data.length) { dom.ratingsContainer.innerHTML = '<div class="empty-state"><p>No ratings yet.</p></div>'; return; }
                var html = '';
                for (var i = 0; i < resp.data.length; i++) {
                    var c = resp.data[i];
                    html += '<div class="chart-container mb-2"><div class="flex-between mb-1"><h4 style="font-size:0.9rem;color:var(--text-primary)">' + escapeHtml(c.title) + '</h4>' +
                        '<span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--accent-text)">' + Number(c.rating_avg).toFixed(1) + ' (' + c.rating_count + ' ratings)</span></div></div>';
                }
                dom.ratingsContainer.innerHTML = html;
            })
            .catch(function (err) { showToast('Failed to load ratings: ' + err.message, 'error'); });
    }

    // ================================================================
    // ACTIVITY LOG
    // ================================================================
    function loadActivityLogs() {
        var params = { order: 'timestamp.desc', limit: 200 };
        if (dom.logFilterAction && dom.logFilterAction.value) params.action = 'eq.' + dom.logFilterAction.value;
        if (dom.logFilterFrom && dom.logFilterFrom.value) params.timestamp = 'gte.' + dom.logFilterFrom.value + 'T00:00:00Z';
        if (dom.logFilterIp && dom.logFilterIp.value.trim()) params.ip_address = 'eq.' + dom.logFilterIp.value.trim();
        if (dom.logFilterDevice && dom.logFilterDevice.value) params.device_type = 'eq.' + dom.logFilterDevice.value;

        adminGet('activity_log', params)
            .then(function (resp) {
                state.activityLogs = resp.data;
                renderActivityLogs();
            })
            .catch(function (err) { showToast('Failed to load logs: ' + err.message, 'error'); });
    }

    function renderActivityLogs() {
        if (!dom.logTableBody) return;
        if (!state.activityLogs.length) {
            dom.logTableBody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:2rem;color:var(--text-muted)">No logs found.</td></tr>';
            return;
        }
        var html = '';
        for (var i = 0; i < state.activityLogs.length; i++) {
            var l = state.activityLogs[i];
            html += '<tr><td>' + formatDateTime(l.timestamp) + '</td><td><span class="badge badge-category">' + escapeHtml(l.action) + '</span></td>' +
                '<td>' + escapeHtml(truncate(JSON.stringify(l.details || {}), 80)) + '</td>' +
                '<td>' + escapeHtml(l.ip_address || '—') + '</td><td>' + escapeHtml(l.ip_country || '—') + '</td>' +
                '<td>' + escapeHtml(l.device_type || '—') + '</td><td>' + escapeHtml(l.browser || '—') + '</td>' +
                '<td>' + escapeHtml(l.os || '—') + '</td></tr>';
        }
        dom.logTableBody.innerHTML = html;
    }

    function handleLogExport() {
        if (!state.activityLogs.length) { showToast('No logs to export.', 'error'); return; }
        var headers = ['timestamp', 'action', 'details', 'ip_address', 'ip_country', 'device_type', 'browser', 'os'];
        var rows = state.activityLogs.map(function (l) {
            return headers.map(function (h) { return '"' + ((h === 'details' ? JSON.stringify(l[h]) : l[h]) || '').toString().replace(/"/g, '""') + '"'; }).join(',');
        });
        var csv = headers.join(',') + '\n' + rows.join('\n');
        var blob = new Blob([csv], { type: 'text/csv' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a'); a.href = url; a.download = 'activity-log.csv'; a.click();
        URL.revokeObjectURL(url);
        showToast('Log exported.', 'success');
    }

    // ================================================================
    // ANALYTICS
    // ================================================================
    function loadAnalytics() {
        if (!dom.analyticsContainer) return;

        Promise.all([
            adminGet('courses', { status: 'eq.active', select: 'id', limit: 1 }),
            adminGet('suggestions', { select: 'id,status', limit: 1000 }),
            adminGet('activity_log', { action: 'eq.search', select: 'id,timestamp', limit: 1000 }),
            adminGet('activity_log', { action: 'eq.course_click', select: 'id,timestamp', limit: 1000 })
        ])
            .then(function (results) {
                var coursesTotal = results[0].total || 0;
                var suggestions = results[1].data || [];
                var searches = results[2].data || [];
                var clicks = results[3].data || [];

                var now = new Date();
                var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                var weekAgo = new Date(today.getTime() - 7 * 86400000);

                var a = {
                    totalCourses: coursesTotal,
                    totalSuggestions: suggestions.length,
                    pending: suggestions.filter(function (s) { return s.status === 'pending'; }).length,
                    approved: suggestions.filter(function (s) { return s.status === 'approved'; }).length,
                    rejected: suggestions.filter(function (s) { return s.status === 'rejected'; }).length,
                    searchesToday: searches.filter(function (s) { return new Date(s.timestamp) >= today; }).length,
                    searchesWeek: searches.filter(function (s) { return new Date(s.timestamp) >= weekAgo; }).length,
                    clicksToday: clicks.filter(function (c) { return new Date(c.timestamp) >= today; }).length,
                    clicksWeek: clicks.filter(function (c) { return new Date(c.timestamp) >= weekAgo; }).length,
                    totalSearches: searches.length
                };
                state.analytics = a;
                renderAnalytics(a);
            })
            .catch(function (err) { showToast('Analytics load failed: ' + err.message, 'error'); });
    }

    function renderAnalytics(a) {
        if (!dom.analyticsContainer) return;
        dom.analyticsContainer.innerHTML =
            '<div class="analytics-overview">' +
            card(a.totalCourses, 'Active Courses') +
            card(a.pending, 'Pending Suggestions') +
            card(a.searchesToday, 'Searches Today') +
            card(a.searchesWeek, 'Searches This Week') +
            card(a.clicksToday, 'Clicks Today') +
            card(a.clicksWeek, 'Clicks This Week') +
            card(a.approved, 'Approved') +
            card(a.totalSearches, 'Total Searches') +
            '</div>' +
            '<div class="analytics-charts">' +
            '<div class="chart-container"><div class="chart-title">Suggestions Summary</div>' +
            bar('Pending', a.pending, a.totalSuggestions) +
            bar('Approved', a.approved, a.totalSuggestions) +
            bar('Rejected', a.rejected, a.totalSuggestions) +
            '</div>' +
            '<div class="chart-container"><div class="chart-title">Search Activity</div>' +
            bar('Today', a.searchesToday, Math.max(a.searchesWeek, 1)) +
            bar('This Week', a.searchesWeek, Math.max(a.searchesWeek, 1)) +
            bar('All Time', a.totalSearches, Math.max(a.totalSearches, 1)) +
            '</div>' +
            '</div>';
    }

    function card(value, label) {
        return '<div class="analytics-card"><div class="analytics-card-value">' + value + '</div><div class="analytics-card-label">' + label + '</div></div>';
    }

    function bar(label, value, max) {
        var pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
        return '<div class="bar-row"><span class="bar-label">' + label + '</span><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div><span class="bar-value">' + value + '</span></div>';
    }

    // ================================================================
    // TOAST / MODAL / UTILS
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

    function closeModal() { if (dom.modalOverlay) dom.modalOverlay.classList.remove('active'); }

    function escapeHtml(str) {
        if (!str) return '';
        var d = document.createElement('div'); d.textContent = str; return d.innerHTML;
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function formatDate(ds) {
        if (!ds) return '';
        try { return new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ds; }
    }

    function formatDateTime(ds) {
        if (!ds) return '';
        try {
            var d = new Date(ds);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } catch (e) { return ds; }
    }

    function truncate(str, max) {
        if (!str || str.length <= max) return str;
        return str.substring(0, max) + '...';
    }

})();

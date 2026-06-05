/* ==========================================================================
   Courseundo — Admin Dashboard Logic (admin.js)
   ========================================================================== */

(function () {
    'use strict';

    // ---- Configuration ----
    const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
    const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
    const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
    const REST_BASE = `${SUPABASE_URL}/rest/v1`;

    // ---- State ----
    let state = {
        token: null,
        user: null,
        activeTab: 'courses',
        courses: [],
        filteredCourses: [],
        archivedCourses: [],
        courseSearch: '',
        showArchived: false,
        editingCourseId: null,
        suggestions: [],
        ratings: {},
        activityLogs: [],
        logFilters: { action: '', dateFrom: '', dateTo: '', ip: '', device: '' },
        analytics: {
            totalCourses: 0,
            totalSuggestions: 0,
            pendingSuggestions: 0,
            searchesToday: 0,
            searchesWeek: 0,
            clicksToday: 0,
            clicksWeek: 0
        }
    };

    // ---- DOM ----
    const dom = {};

    function cacheDom() {
        // Login
        dom.loginWrapper = document.getElementById('login-wrapper');
        dom.dashboardWrapper = document.getElementById('dashboard-wrapper');
        dom.loginForm = document.getElementById('login-form');
        dom.loginEmail = document.getElementById('login-email');
        dom.loginPassword = document.getElementById('login-password');
        dom.loginError = document.getElementById('login-error');

        // Nav
        dom.navItems = document.querySelectorAll('.admin-nav-item');
        dom.tabPanels = document.querySelectorAll('.admin-tab-panel');
        dom.logoutBtn = document.getElementById('logout-btn');

        // Courses
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

        // Course fields
        dom.fields = {};
        ['title', 'link', 'platform', 'category', 'institution', 'instructor', 'difficulty',
            'duration', 'mode', 'format', 'cost', 'certification', 'cert_type', 'validation',
            'job_available', 'job_country', 'job_salary', 'job_mode', 'language'].forEach(f => {
                dom.fields[f] = document.getElementById(`course-${f.replace(/_/g, '-')}`);
            });

        // Bulk
        dom.fileDropZone = document.getElementById('file-drop-zone');
        dom.fileInput = document.getElementById('file-input');
        dom.importPreview = document.getElementById('import-preview');
        dom.importSummary = document.getElementById('import-summary');
        dom.importBtn = document.getElementById('import-btn');
        dom.exportCsvBtn = document.getElementById('export-csv-btn');
        dom.exportJsonBtn = document.getElementById('export-json-btn');

        // Suggestions
        dom.suggestionsListAdmin = document.getElementById('admin-suggestions-list');
        dom.suggestionBadge = document.getElementById('suggestion-badge');

        // Ratings
        dom.ratingsContainer = document.getElementById('ratings-container');

        // Activity Log
        dom.logTableBody = document.getElementById('log-table-body');
        dom.logFilterAction = document.getElementById('log-filter-action');
        dom.logFilterFrom = document.getElementById('log-filter-from');
        dom.logFilterTo = document.getElementById('log-filter-to');
        dom.logFilterIp = document.getElementById('log-filter-ip');
        dom.logFilterDevice = document.getElementById('log-filter-device');
        dom.logApplyFilter = document.getElementById('log-apply-filter');
        dom.logExportBtn = document.getElementById('log-export-btn');

        // Analytics
        dom.analyticsContainer = document.getElementById('analytics-container');

        // Toast
        dom.toastContainer = document.getElementById('admin-toast-container');

        // Modals
        dom.modalOverlay = document.getElementById('admin-modal');
        dom.modalTitle = document.getElementById('modal-title');
        dom.modalBody = document.getElementById('modal-body');
        dom.modalActions = document.getElementById('modal-actions');
    }

    // ---- Init ----
    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        cacheDom();
        checkSession();
        bindEvents();
    }

    // ---- Session ----
    function checkSession() {
        const stored = sessionStorage.getItem('courseundo_admin_token');
        if (stored) {
            state.token = stored;
            showDashboard();
            loadAllData();
        }
    }

    function showDashboard() {
        dom.loginWrapper.classList.add('hidden');
        dom.dashboardWrapper.classList.remove('hidden');
    }

    function showLogin() {
        dom.loginWrapper.classList.remove('hidden');
        dom.dashboardWrapper.classList.add('hidden');
    }

    // ---- Events ----
    function bindEvents() {
        // Login
        dom.loginForm.addEventListener('submit', handleLogin);
        dom.logoutBtn.addEventListener('click', handleLogout);

        // Nav
        dom.navItems.forEach(item => {
            item.addEventListener('click', () => switchTab(item.dataset.tab));
        });

        // Courses
        dom.courseSearch.addEventListener('input', filterCourseList);
        dom.showArchivedToggle.addEventListener('change', () => {
            state.showArchived = dom.showArchivedToggle.checked;
            if (state.showArchived) loadArchivedCourses();
            renderCourseList();
        });
        dom.newCourseBtn.addEventListener('click', resetCourseForm);
        dom.courseForm.addEventListener('submit', handleSaveCourse);
        dom.fetchMetaBtn.addEventListener('click', handleFetchMetadata);
        dom.aiClassifyBtn.addEventListener('click', handleAiClassify);
        dom.archiveCourseBtn.addEventListener('click', handleArchiveCourse);
        dom.verifyCourseBtn.addEventListener('click', handleMarkVerified);

        // JSON validation
        dom.extraFieldsInput.addEventListener('input', validateJson);

        // Bulk
        dom.fileDropZone.addEventListener('click', () => dom.fileInput.click());
        dom.fileDropZone.addEventListener('dragover', e => {
            e.preventDefault();
            dom.fileDropZone.classList.add('dragover');
        });
        dom.fileDropZone.addEventListener('dragleave', () => {
            dom.fileDropZone.classList.remove('dragover');
        });
        dom.fileDropZone.addEventListener('drop', handleFileDrop);
        dom.fileInput.addEventListener('change', handleFileSelect);
        dom.importBtn.addEventListener('click', handleBulkImport);
        dom.exportCsvBtn.addEventListener('click', () => handleExport('csv'));
        dom.exportJsonBtn.addEventListener('click', () => handleExport('json'));

        // Logs
        dom.logApplyFilter.addEventListener('click', loadActivityLogs);
        dom.logExportBtn.addEventListener('click', handleLogExport);

        // Modal close
        dom.modalOverlay.addEventListener('click', e => {
            if (e.target === dom.modalOverlay) closeModal();
        });
    }

    // ---- Auth ----
    async function handleLogin(e) {
        e.preventDefault();
        dom.loginError.classList.remove('visible');

        const email = dom.loginEmail.value.trim();
        const password = dom.loginPassword.value;

        if (!email || !password) {
            dom.loginError.textContent = 'Please enter email and password.';
            dom.loginError.classList.add('visible');
            return;
        }

        try {
            const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.error_description || data.msg || 'Login failed');
            }

            state.token = data.access_token;
            state.user = { email };
            sessionStorage.setItem('courseundo_admin_token', data.access_token);
            showDashboard();
            loadAllData();
            showToast('Logged in successfully.', 'success');
        } catch (err) {
            dom.loginError.textContent = err.message;
            dom.loginError.classList.add('visible');
        }
    }

    function handleLogout() {
        state.token = null;
        state.user = null;
        sessionStorage.removeItem('courseundo_admin_token');
        showLogin();
    }

    // ---- API Helpers ----
    function authHeaders() {
        return {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${state.token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    async function adminGet(endpoint, params = {}) {
        const url = new URL(`${REST_BASE}/${endpoint}`);
        Object.entries(params).forEach(([k, v]) => {
            if (v !== '' && v !== undefined && v !== null) url.searchParams.set(k, v);
        });
        const resp = await fetch(url.toString(), { headers: authHeaders() });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || `Error ${resp.status}`);
        }
        const countHeader = resp.headers.get('Content-Range');
        const data = await resp.json();
        let total = data.length;
        if (countHeader) {
            const parts = countHeader.split('/');
            if (parts[1] !== '*') total = parseInt(parts[1], 10);
        }
        return { data, total };
    }

    async function adminPost(endpoint, body) {
        const resp = await fetch(`${REST_BASE}/${endpoint}`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(body)
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || `Error ${resp.status}`);
        return data;
    }

    async function adminPatch(endpoint, body, params = {}) {
        const url = new URL(`${REST_BASE}/${endpoint}`);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        const resp = await fetch(url.toString(), {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify(body)
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || `Error ${resp.status}`);
        return data;
    }

    async function adminDelete(endpoint, params) {
        const url = new URL(`${REST_BASE}/${endpoint}`);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        const resp = await fetch(url.toString(), {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data.message || `Error ${resp.status}`);
        }
    }

    async function adminFunction(name, body) {
        const resp = await fetch(`${FUNCTIONS_BASE}/${name}`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(body)
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || `Error ${resp.status}`);
        return data;
    }

    // ---- Tab Switching ----
    function switchTab(tabId) {
        state.activeTab = tabId;
        dom.navItems.forEach(item => item.classList.toggle('active', item.dataset.tab === tabId));
        dom.tabPanels.forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tabId}`));

        // Load data for specific tabs
        if (tabId === 'courses') loadCourses();
        if (tabId === 'suggestions') loadSuggestionsAdmin();
        if (tabId === 'ratings') loadRatingsManagement();
        if (tabId === 'logs') loadActivityLogs();
        if (tabId === 'analytics') loadAnalytics();
        if (tabId === 'bulk') { /* bulk operations tab */ }
    }

    // ---- Load All Data ----
    async function loadAllData() {
        await loadCourses();
        loadSuggestionsAdmin();
        loadAnalytics();
    }

    // ---- Courses ----
    async function loadCourses() {
        try {
            const { data } = await adminGet('courses', {
                'status': state.showArchived ? 'eq.archived' : 'eq.active',
                'order': 'created_at.desc',
                'limit': 500
            });
            state.courses = data;
            filterCourseList();
        } catch (err) {
            showToast('Failed to load courses: ' + err.message, 'error');
        }
    }

    async function loadArchivedCourses() {
        try {
            const { data } = await adminGet('courses', {
                'status': 'eq.archived',
                'order': 'created_at.desc',
                'limit': 500
            });
            state.archivedCourses = data;
        } catch (err) {
            console.error('Error loading archived courses:', err);
        }
    }

    function filterCourseList() {
        const search = dom.courseSearch.value.toLowerCase().trim();
        const source = state.showArchived ? state.archivedCourses : state.courses;
        state.filteredCourses = search
            ? source.filter(c => c.title.toLowerCase().includes(search) ||
                (c.platform || '').toLowerCase().includes(search) ||
                (c.category || '').toLowerCase().includes(search))
            : source;
        renderCourseList();
    }

    function renderCourseList() {
        if (!state.filteredCourses.length) {
            dom.courseList.innerHTML = `<div class="empty-state"><p>No courses found.</p></div>`;
            return;
        }

        dom.courseList.innerHTML = state.filteredCourses.map(c => `
      <div class="admin-course-item ${state.editingCourseId === c.id ? 'selected' : ''}"
           data-id="${c.id}">
        <span class="admin-course-item-title">${escapeHtml(c.title)}</span>
        <span class="admin-course-item-platform">${escapeHtml(c.platform || '—')}</span>
        <span class="admin-course-item-status status-${c.status}">${c.status}</span>
      </div>
    `).join('');

        dom.courseList.querySelectorAll('.admin-course-item').forEach(el => {
            el.addEventListener('click', () => loadCourseIntoForm(el.dataset.id));
        });
    }

    function loadCourseIntoForm(courseId) {
        const course = [...state.courses, ...state.archivedCourses].find(c => c.id === courseId);
        if (!course) return;

        state.editingCourseId = courseId;
        dom.courseFormTitle.textContent = 'Edit Course';

        Object.keys(dom.fields).forEach(key => {
            if (dom.fields[key]) dom.fields[key].value = course[key] || '';
        });

        dom.extraFieldsInput.value = course.extra_fields ? JSON.stringify(course.extra_fields, null, 2) : '';
        dom.courseFieldStatus.textContent = `Status: ${course.status}`;
        dom.archiveCourseBtn.classList.remove('hidden');
        dom.verifyCourseBtn.classList.remove('hidden');
        validateJson();
        renderCourseList();
    }

    function resetCourseForm() {
        state.editingCourseId = null;
        dom.courseFormTitle.textContent = 'Add New Course';
        dom.courseForm.reset();
        dom.extraFieldsInput.value = '';
        dom.jsonFeedback.textContent = '';
        dom.courseFieldStatus.textContent = '';
        dom.archiveCourseBtn.classList.add('hidden');
        dom.verifyCourseBtn.classList.add('hidden');
        renderCourseList();
    }

    async function handleSaveCourse(e) {
        e.preventDefault();

        const title = dom.fields.title.value.trim();
        const link = dom.fields.link.value.trim();

        if (!title || title.length < 5) {
            showToast('Title must be between 5 and 200 characters.', 'error');
            return;
        }
        if (!link || !link.match(/^https?:\/\//)) {
            showToast('Please enter a valid course URL.', 'error');
            return;
        }

        // Validate JSON
        let extraFields = {};
        const jsonText = dom.extraFieldsInput.value.trim();
        if (jsonText) {
            try {
                extraFields = JSON.parse(jsonText);
            } catch {
                showToast('Extra Fields contains invalid JSON.', 'error');
                return;
            }
        }

        const body = {};
        Object.keys(dom.fields).forEach(key => {
            const val = dom.fields[key].value.trim();
            if (val) body[key] = val;
        });
        body.extra_fields = extraFields;

        try {
            let result;
            if (state.editingCourseId) {
                result = await adminPatch('courses', body, { 'id': `eq.${state.editingCourseId}` });
                showToast('Course updated successfully.', 'success');
            } else {
                // Check duplicate
                const { data: existing } = await adminGet('courses', { 'link': `eq.${link}`, 'select': 'id', 'limit': 1 });
                if (existing.length > 0) {
                    showToast('A course with this URL already exists.', 'error');
                    return;
                }
                body.status = 'active';
                result = await adminPost('courses', body);
                showToast('Course added successfully.', 'success');
            }

            // Generate embedding
            const courseData = result[0] || result;
            try {
                await adminFunction('generate-embedding', {
                    course_id: courseData.id,
                    title: body.title,
                    description: extraFields.description || '',
                    category: body.category || ''
                });
            } catch (embedErr) {
                console.warn('Embedding generation failed:', embedErr);
            }

            resetCourseForm();
            loadCourses();
        } catch (err) {
            showToast('Failed to save course: ' + err.message, 'error');
        }
    }

    async function handleFetchMetadata() {
        const url = dom.fields.link.value.trim();
        if (!url) {
            showToast('Please enter a course URL first.', 'error');
            return;
        }

        dom.fetchMetaBtn.disabled = true;
        dom.fetchMetaBtn.textContent = 'Fetching...';

        try {
            const data = await adminFunction('extract-metadata', { url });
            if (data.title && !dom.fields.title.value) dom.fields.title.value = data.title;
            if (data.platform && !dom.fields.platform.value) dom.fields.platform.value = data.platform;
            showToast(`Metadata fetched from ${data.source || 'API'}.`, 'success');
        } catch (err) {
            showToast('Could not fetch metadata. Enter details manually.', 'error');
        } finally {
            dom.fetchMetaBtn.disabled = false;
            dom.fetchMetaBtn.textContent = 'Auto-fetch Metadata';
        }
    }

    async function handleAiClassify() {
        const title = dom.fields.title.value.trim();
        const description = dom.extraFieldsInput.value.trim();

        if (!title) {
            showToast('Please enter a course title first.', 'error');
            return;
        }

        dom.aiClassifyBtn.disabled = true;
        dom.aiClassifyBtn.textContent = 'Classifying...';

        try {
            const data = await adminFunction('classify-course', {
                title,
                description: description ? JSON.parse(description).description || description : ''
            });

            if (data.category && !dom.fields.category.value) dom.fields.category.value = data.category;
            if (data.difficulty && !dom.fields.difficulty.value) dom.fields.difficulty.value = data.difficulty;
            if (data.duration && !dom.fields.duration.value) dom.fields.duration.value = data.duration;
            showToast(`AI classified using ${data.model_used || 'AI'}.`, 'success');
        } catch (err) {
            showToast('AI classification unavailable. Fill fields manually.', 'error');
        } finally {
            dom.aiClassifyBtn.disabled = false;
            dom.aiClassifyBtn.textContent = 'AI Classify';
        }
    }

    async function handleArchiveCourse() {
        if (!state.editingCourseId) return;

        if (!confirm('Archive this course? It will be hidden from public view but can be restored later.')) return;

        try {
            await adminPatch('courses', { status: 'archived', embedding: null }, { 'id': `eq.${state.editingCourseId}` });
            showToast('Course archived.', 'success');
            resetCourseForm();
            loadCourses();
        } catch (err) {
            showToast('Failed to archive: ' + err.message, 'error');
        }
    }

    async function handleMarkVerified() {
        if (!state.editingCourseId) return;

        try {
            await adminPatch('courses', { last_verified: new Date().toISOString() }, { 'id': `eq.${state.editingCourseId}` });
            showToast('Course marked as verified.', 'success');
            loadCourses();
        } catch (err) {
            showToast('Failed to verify: ' + err.message, 'error');
        }
    }

    function validateJson() {
        const text = dom.extraFieldsInput.value.trim();
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
        } catch {
            dom.extraFieldsInput.classList.remove('json-valid');
            dom.extraFieldsInput.classList.add('json-invalid');
            dom.jsonFeedback.textContent = 'Invalid JSON';
            dom.jsonFeedback.style.color = 'var(--red)';
        }
    }

    // ---- Bulk Import/Export ----
    let importData = [];

    function handleFileDrop(e) {
        e.preventDefault();
        dom.fileDropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) processFile(file);
    }

    function processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                if (file.name.endsWith('.json')) {
                    importData = JSON.parse(text);
                } else if (file.name.endsWith('.csv')) {
                    importData = csvToJson(text);
                } else {
                    showToast('Unsupported file type. Use CSV or JSON.', 'error');
                    return;
                }
                validateImportData();
            } catch (err) {
                showToast('Failed to parse file: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    function csvToJson(csv) {
        const lines = csv.split('\n').filter(l => l.trim());
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const obj = {};
            headers.forEach((h, i) => { if (values[i]) obj[h] = values[i]; });
            return obj;
        });
    }

    function validateImportData() {
        let valid = 0, errors = 0;
        const previewHtml = importData.map((row, i) => {
            const hasTitle = row.title && row.title.length >= 5;
            const hasLink = row.link && row.link.match(/^https?:\/\//);
            const isValid = hasTitle && hasLink;
            if (isValid) valid++; else errors++;
            return `<tr class="${isValid ? '' : 'error-row'}">
        <td>${i + 1}</td>
        <td>${escapeHtml(row.title || '(missing)')}</td>
        <td>${escapeHtml(row.link || '(missing)')}</td>
        <td>${escapeHtml(row.platform || '')}</td>
        <td>${isValid ? 'OK' : 'Error'}</td>
      </tr>`;
        }).join('');

        dom.importPreview.innerHTML = `<table>
      <thead><tr><th>#</th><th>Title</th><th>Link</th><th>Platform</th><th>Status</th></tr></thead>
      <tbody>${previewHtml}</tbody>
    </table>`;

        dom.importSummary.innerHTML = `
      <span class="valid">${valid} valid</span>
      <span class="errors">${errors} errors</span>
      <span>Total: ${importData.length}</span>`;

        dom.importBtn.classList.toggle('hidden', valid === 0);
    }

    async function handleBulkImport() {
        dom.importBtn.disabled = true;
        dom.importBtn.textContent = 'Importing...';
        let imported = 0, skipped = 0;

        for (const row of importData) {
            if (!row.title || row.title.length < 5 || !row.link || !row.link.match(/^https?:\/\//)) {
                skipped++;
                continue;
            }

            try {
                const body = {
                    title: row.title,
                    link: row.link,
                    platform: row.platform || null,
                    category: row.category || null,
                    institution: row.institution || null,
                    instructor: row.instructor || null,
                    difficulty: row.difficulty || null,
                    duration: row.duration || null,
                    cost: row.cost || null,
                    certification: row.certification || null,
                    language: row.language || null,
                    status: 'active',
                    extra_fields: {}
                };

                // Remove nulls
                Object.keys(body).forEach(k => { if (body[k] === null && k !== 'extra_fields') delete body[k]; });

                const result = await adminPost('courses', body);
                imported++;

                // Generate embedding
                try {
                    const c = result[0] || result;
                    await adminFunction('generate-embedding', {
                        course_id: c.id,
                        title: body.title,
                        description: '',
                        category: body.category || ''
                    });
                } catch { /* non-critical */ }

                // Rate limit: small delay
                await new Promise(r => setTimeout(r, 200));
            } catch (err) {
                skipped++;
            }
        }

        showToast(`Import complete: ${imported} imported, ${skipped} skipped.`, 'success');
        dom.importBtn.disabled = false;
        dom.importBtn.textContent = 'Import Valid Rows';
        loadCourses();
    }

    async function handleExport(format) {
        try {
            const { data } = await adminGet('courses', {
                'status': 'eq.active',
                'limit': 10000,
                'order': 'created_at.desc'
            });

            let content, filename, mime;
            if (format === 'csv') {
                const headers = ['title', 'link', 'platform', 'category', 'institution', 'instructor',
                    'difficulty', 'duration', 'cost', 'certification', 'language', 'rating_avg', 'rating_count'];
                const rows = data.map(c => headers.map(h => `"${(c[h] || '').toString().replace(/"/g, '""')}"`).join(','));
                content = [headers.join(','), ...rows].join('\n');
                filename = 'courseundo-export.csv';
                mime = 'text/csv';
            } else {
                content = JSON.stringify(data, null, 2);
                filename = 'courseundo-export.json';
                mime = 'application/json';
            }

            const blob = new Blob([content], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            showToast(`Exported ${data.length} courses as ${format.toUpperCase()}.`, 'success');
        } catch (err) {
            showToast('Export failed: ' + err.message, 'error');
        }
    }

    // ---- Suggestions ----
    async function loadSuggestionsAdmin() {
        try {
            const { data } = await adminGet('suggestions', {
                'order': 'created_at.desc',
                'limit': 200
            });
            state.suggestions = data;
            const pending = data.filter(s => s.status === 'pending').length;
            if (dom.suggestionBadge) {
                dom.suggestionBadge.textContent = pending;
                dom.suggestionBadge.classList.toggle('hidden', pending === 0);
            }
            renderSuggestionsAdmin();
        } catch (err) {
            showToast('Failed to load suggestions: ' + err.message, 'error');
        }
    }

    function renderSuggestionsAdmin() {
        if (!state.suggestions.length) {
            dom.suggestionsListAdmin.innerHTML = `<div class="empty-state"><p>No suggestions yet.</p></div>`;
            return;
        }

        dom.suggestionsListAdmin.innerHTML = state.suggestions.map(s => `
      <div class="admin-suggestion-item" data-id="${s.id}">
        <div class="admin-suggestion-info">
          <h4>${escapeHtml(s.title)}</h4>
          <div class="detail-row">
            <span><a href="${escapeHtml(s.link)}" target="_blank">${escapeHtml(s.link)}</a></span>
            ${s.platform ? `<span>Platform: ${escapeHtml(s.platform)}</span>` : ''}
            <span>Status: <strong>${s.status}</strong></span>
          </div>
          <div class="detail-row">
            ${s.user_name ? `<span>By: ${escapeHtml(s.user_name)}</span>` : ''}
            ${s.user_email ? `<span>Email: ${escapeHtml(s.user_email)}</span>` : ''}
            ${s.ip_address ? `<span>IP: ${escapeHtml(s.ip_address)}</span>` : ''}
            <span>${formatDate(s.created_at)}</span>
          </div>
          ${s.notes ? `<p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-secondary);font-style:italic">${escapeHtml(s.notes)}</p>` : ''}
        </div>
        ${s.status === 'pending' ? `
        <div class="admin-suggestion-actions">
          <button class="btn btn-primary btn-sm" onclick="approveSuggestion('${s.id}')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="rejectSuggestion('${s.id}')">Reject</button>
        </div>` : ''}
      </div>
    `).join('');
    }

    // Global functions for suggestion actions
    window.approveSuggestion = async function (id) {
        try {
            const suggestion = state.suggestions.find(s => s.id === id);
            if (!suggestion) return;

            // Pre-fill course form with suggestion data
            resetCourseForm();
            dom.fields.title.value = suggestion.title;
            dom.fields.link.value = suggestion.link;
            if (suggestion.platform) dom.fields.platform.value = suggestion.platform;

            // Mark as approved
            await adminPatch('suggestions', {
                status: 'approved',
                reviewed_at: new Date().toISOString(),
                reviewed_by: state.user?.email || 'admin'
            }, { 'id': `eq.${id}` });

            showToast('Suggestion approved. Course form pre-filled — review and save.', 'success');
            switchTab('courses');
            loadSuggestionsAdmin();
        } catch (err) {
            showToast('Failed to approve: ' + err.message, 'error');
        }
    };

    window.rejectSuggestion = async function (id) {
        if (!confirm('Reject this suggestion?')) return;

        try {
            await adminPatch('suggestions', {
                status: 'rejected',
                reviewed_at: new Date().toISOString(),
                reviewed_by: state.user?.email || 'admin'
            }, { 'id': `eq.${id}` });

            showToast('Suggestion rejected.', 'success');
            loadSuggestionsAdmin();
        } catch (err) {
            showToast('Failed to reject: ' + err.message, 'error');
        }
    };

    // ---- Ratings Management ----
    async function loadRatingsManagement() {
        try {
            const { data: courses } = await adminGet('courses', {
                'status': 'eq.active',
                'rating_count': 'gt.0',
                'order': 'rating_avg.desc',
                'limit': 100
            });

            if (!courses.length) {
                dom.ratingsContainer.innerHTML = `<div class="empty-state"><p>No ratings yet.</p></div>`;
                return;
            }

            dom.ratingsContainer.innerHTML = courses.map(c => {
                return `
          <div class="chart-container mb-2">
            <div class="flex-between mb-1">
              <h4 style="font-size:0.9rem;color:var(--text-primary)">${escapeHtml(c.title)}</h4>
              <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--accent-text)">
                ${Number(c.rating_avg).toFixed(1)} (${c.rating_count} ratings)
              </span>
            </div>
            <div class="rating-dist-bar">
              <span class="rating-dist-label">5</span>
              <div class="rating-dist-track"><div class="rating-dist-fill" style="width:60%"></div></div>
              <span class="rating-dist-count">—</span>
            </div>
            <div class="rating-dist-bar">
              <span class="rating-dist-label">4</span>
              <div class="rating-dist-track"><div class="rating-dist-fill" style="width:25%"></div></div>
              <span class="rating-dist-count">—</span>
            </div>
            <div class="rating-dist-bar">
              <span class="rating-dist-label">3</span>
              <div class="rating-dist-track"><div class="rating-dist-fill" style="width:10%"></div></div>
              <span class="rating-dist-count">—</span>
            </div>
            <div class="rating-dist-bar">
              <span class="rating-dist-label">2</span>
              <div class="rating-dist-track"><div class="rating-dist-fill" style="width:3%"></div></div>
              <span class="rating-dist-count">—</span>
            </div>
            <div class="rating-dist-bar">
              <span class="rating-dist-label">1</span>
              <div class="rating-dist-track"><div class="rating-dist-fill" style="width:2%"></div></div>
              <span class="rating-dist-count">—</span>
            </div>
          </div>`;
            }).join('');
        } catch (err) {
            showToast('Failed to load ratings: ' + err.message, 'error');
        }
    }

    // ---- Activity Log ----
    async function loadActivityLogs() {
        try {
            const params = {
                'order': 'timestamp.desc',
                'limit': 200
            };

            const action = dom.logFilterAction.value;
            const from = dom.logFilterFrom.value;
            const to = dom.logFilterTo.value;
            const ip = dom.logFilterIp.value.trim();
            const device = dom.logFilterDevice.value;

            if (action) params['action'] = `eq.${action}`;
            if (from) params['timestamp'] = `gte.${from}T00:00:00Z`;
            if (ip) params['ip_address'] = `eq.${ip}`;
            if (device) params['device_type'] = `eq.${device}`;

            const { data } = await adminGet('activity_log', params);
            state.activityLogs = data;
            renderActivityLogs();
        } catch (err) {
            showToast('Failed to load activity logs: ' + err.message, 'error');
        }
    }

    function renderActivityLogs() {
        if (!state.activityLogs.length) {
            dom.logTableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:2rem;color:var(--text-muted)">No logs found.</td></tr>`;
            return;
        }

        dom.logTableBody.innerHTML = state.activityLogs.map(log => `
      <tr>
        <td>${formatDateTime(log.timestamp)}</td>
        <td><span class="badge badge-category">${escapeHtml(log.action)}</span></td>
        <td>${escapeHtml(truncate(JSON.stringify(log.details || {}), 80))}</td>
        <td>${escapeHtml(log.ip_address || '—')}</td>
        <td>${escapeHtml(log.ip_country || '—')}</td>
        <td>${escapeHtml(log.device_type || '—')}</td>
        <td>${escapeHtml(log.browser || '—')}</td>
        <td>${escapeHtml(log.os || '—')}</td>
      </tr>
    `).join('');
    }

    function handleLogExport() {
        if (!state.activityLogs.length) {
            showToast('No logs to export.', 'error');
            return;
        }
        const headers = ['timestamp', 'action', 'details', 'ip_address', 'ip_country', 'ip_city', 'device_type', 'browser', 'os', 'referrer', 'session_id'];
        const rows = state.activityLogs.map(l =>
            headers.map(h => `"${((h === 'details' ? JSON.stringify(l[h]) : l[h]) || '').toString().replace(/"/g, '""')}"`).join(',')
        );
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'activity-log-export.csv';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Activity log exported.', 'success');
    }

    // ---- Analytics ----
    async function loadAnalytics() {
        try {
            const [coursesResp, suggestionsResp, searchResp, clickResp] = await Promise.all([
                adminGet('courses', { 'status': 'eq.active', 'select': 'id', 'limit': 1 }),
                adminGet('suggestions', { 'select': 'id,status', 'limit': 1000 }),
                adminGet('activity_log', { 'action': 'eq.search', 'select': 'id,timestamp', 'limit': 1000 }),
                adminGet('activity_log', { 'action': 'eq.course_click', 'select': 'id,timestamp', 'limit': 1000 })
            ]);

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekAgo = new Date(today.getTime() - 7 * 86400000);

            const allSuggestions = suggestionsResp.data || [];
            const allSearches = searchResp.data || [];
            const allClicks = clickResp.data || [];

            state.analytics = {
                totalCourses: coursesResp.total || 0,
                totalSuggestions: allSuggestions.length,
                pendingSuggestions: allSuggestions.filter(s => s.status === 'pending').length,
                approvedSuggestions: allSuggestions.filter(s => s.status === 'approved').length,
                rejectedSuggestions: allSuggestions.filter(s => s.status === 'rejected').length,
                searchesToday: allSearches.filter(s => new Date(s.timestamp) >= today).length,
                searchesWeek: allSearches.filter(s => new Date(s.timestamp) >= weekAgo).length,
                clicksToday: allClicks.filter(c => new Date(c.timestamp) >= today).length,
                clicksWeek: allClicks.filter(c => new Date(c.timestamp) >= weekAgo).length,
                totalSearches: allSearches.length
            };

            renderAnalytics();
        } catch (err) {
            showToast('Failed to load analytics: ' + err.message, 'error');
        }
    }

    function renderAnalytics() {
        const a = state.analytics;

        dom.analyticsContainer.innerHTML = `
      <div class="analytics-overview">
        <div class="analytics-card">
          <div class="analytics-card-value">${a.totalCourses}</div>
          <div class="analytics-card-label">Active Courses</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-card-value">${a.pendingSuggestions}</div>
          <div class="analytics-card-label">Pending Suggestions</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-card-value">${a.searchesToday}</div>
          <div class="analytics-card-label">Searches Today</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-card-value">${a.searchesWeek}</div>
          <div class="analytics-card-label">Searches This Week</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-card-value">${a.clicksToday}</div>
          <div class="analytics-card-label">Clicks Today</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-card-value">${a.clicksWeek}</div>
          <div class="analytics-card-label">Clicks This Week</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-card-value">${a.approvedSuggestions}</div>
          <div class="analytics-card-label">Approved Suggestions</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-card-value">${a.totalSearches}</div>
          <div class="analytics-card-label">Total Searches</div>
        </div>
      </div>

      <div class="analytics-charts">
        <div class="chart-container">
          <div class="chart-title">Suggestions Summary</div>
          <div class="bar-chart">
            <div class="bar-row">
              <span class="bar-label">Pending</span>
              <div class="bar-track"><div class="bar-fill" style="width:${pct(a.pendingSuggestions, a.totalSuggestions)}%"></div></div>
              <span class="bar-value">${a.pendingSuggestions}</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">Approved</span>
              <div class="bar-track"><div class="bar-fill" style="width:${pct(a.approvedSuggestions, a.totalSuggestions)}%"></div></div>
              <span class="bar-value">${a.approvedSuggestions}</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">Rejected</span>
              <div class="bar-track"><div class="bar-fill" style="width:${pct(a.rejectedSuggestions, a.totalSuggestions)}%"></div></div>
              <span class="bar-value">${a.rejectedSuggestions}</span>
            </div>
          </div>
        </div>

        <div class="chart-container">
          <div class="chart-title">Search Activity</div>
          <div class="bar-chart">
            <div class="bar-row">
              <span class="bar-label">Today</span>
              <div class="bar-track"><div class="bar-fill" style="width:${pct(a.searchesToday, a.searchesWeek)}%"></div></div>
              <span class="bar-value">${a.searchesToday}</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">This Week</span>
              <div class="bar-track"><div class="bar-fill" style="width:100%"></div></div>
              <span class="bar-value">${a.searchesWeek}</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">All Time</span>
              <div class="bar-track"><div class="bar-fill" style="width:100%"></div></div>
              <span class="bar-value">${a.totalSearches}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-container full-width">
        <div class="chart-title">Platform Insights</div>
        <div class="insights-list">
          <div class="insight-item">Total active courses: <strong>${a.totalCourses}</strong>. ${a.totalCourses < 50 ? 'Consider adding more courses to improve search coverage.' : 'Good course coverage.'}</div>
          <div class="insight-item">Pending suggestions: <strong>${a.pendingSuggestions}</strong>. ${a.pendingSuggestions > 0 ? 'Review pending suggestions to keep the community engaged.' : 'All suggestions reviewed.'}</div>
          <div class="insight-item">Weekly search activity: <strong>${a.searchesWeek}</strong> searches. ${a.searchesWeek > 100 ? 'High engagement — consider scaling infrastructure.' : 'Moderate traffic — free tier is sufficient.'}</div>
        </div>
      </div>`;
    }

    function pct(value, total) {
        if (!total) return 0;
        return Math.min(100, Math.round((value / total) * 100));
    }

    // ---- Toast ----
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        dom.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // ---- Modal ----
    function openModal(title, body, actions) {
        dom.modalTitle.textContent = title;
        dom.modalBody.innerHTML = body;
        dom.modalActions.innerHTML = actions;
        dom.modalOverlay.classList.add('active');
    }

    function closeModal() {
        dom.modalOverlay.classList.remove('active');
    }

    // ---- Utilities ----
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function truncate(str, max) {
        if (!str || str.length <= max) return str;
        return str.substring(0, max) + '...';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
            d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

})();

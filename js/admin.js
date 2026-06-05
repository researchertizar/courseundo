// Initialize Supabase client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

// DOM Elements
const menuItems = document.querySelectorAll('.menu-item');
const contentSections = document.querySelectorAll('.content-section');
const logoutBtn = document.getElementById('logoutBtn');

// State
let currentUser = null;

// Event Listeners
menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.getAttribute('href').substring(1);
        switchSection(target);
    });
});

logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
});

/**
 * Switch content section
 */
function switchSection(sectionId) {
    // Update menu items
    menuItems.forEach(item => item.classList.remove('active'));
    document.querySelector(`a[href="#${sectionId}"]`).classList.add('active');

    // Update content sections
    contentSections.forEach(section => section.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');

    // Load section data
    loadSectionData(sectionId);
}

/**
 * Load data for the selected section
 */
async function loadSectionData(sectionId) {
    try {
        switch (sectionId) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'courses':
                loadCourses();
                break;
            case 'functions':
                loadFunctions();
                break;
            case 'logs':
                loadLogs();
                break;
            case 'settings':
                loadSettings();
                break;
        }
    } catch (error) {
        console.error('Error loading section:', error);
    }
}

/**
 * Load dashboard data
 */
async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard-stats', {
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        const stats = await response.json();

        document.getElementById('totalCourses').textContent = stats.totalCourses;
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('searchesToday').textContent = stats.searchesToday;
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

/**
 * Load courses list
 */
async function loadCourses() {
    try {
        const response = await fetch('/api/courses', {
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        const courses = await response.json();
        const coursesList = document.getElementById('coursesList');

        if (courses.length === 0) {
            coursesList.innerHTML = '<p>No courses found.</p>';
            return;
        }

        const html = `
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Platform</th>
                        <th>URL</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${courses.map(course => `
                        <tr>
                            <td>${escapeHtml(course.title)}</td>
                            <td>${escapeHtml(course.platform || 'N/A')}</td>
                            <td><a href="${escapeHtml(course.url)}" target="_blank">View</a></td>
                            <td>
                                <button class="btn btn-secondary" onclick="editCourse(${course.id})">Edit</button>
                                <button class="btn btn-danger" onclick="deleteCourse(${course.id})">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        coursesList.innerHTML = html;
    } catch (error) {
        console.error('Courses error:', error);
    }
}

/**
 * Load cloud functions status
 */
async function loadFunctions() {
    try {
        const functions = [
            { name: 'classify-course', description: 'AI course classification' },
            { name: 'extract-metadata', description: 'URL metadata extraction' },
            { name: 'generate-embedding', description: 'Vector embedding generation' },
            { name: 'semantic-search', description: 'pgvector semantic search' },
            { name: 'send-notification', description: 'Email notifications' },
            { name: 'log-activity', description: 'Activity logging' }
        ];

        const functionsList = document.getElementById('functionsList');
        const html = functions.map(fn => `
            <div class="function-item">
                <div class="function-name">${fn.name}</div>
                <div class="function-description">${fn.description}</div>
                <div class="function-status">✓ Active</div>
            </div>
        `).join('');

        functionsList.innerHTML = html;
    } catch (error) {
        console.error('Functions error:', error);
    }
}

/**
 * Load activity logs
 */
async function loadLogs() {
    try {
        const response = await fetch('/api/logs?limit=50', {
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        const logs = await response.json();
        const logsList = document.getElementById('logsList');

        if (logs.length === 0) {
            logsList.innerHTML = '<p>No logs found.</p>';
            return;
        }

        const html = logs.map(log => `
            <div class="log-item">
                <span class="log-time">${new Date(log.timestamp).toLocaleString()}</span>
                <div class="log-message">${escapeHtml(log.action)}: ${escapeHtml(JSON.stringify(log.details))}</div>
            </div>
        `).join('');

        logsList.innerHTML = html;
    } catch (error) {
        console.error('Logs error:', error);
    }
}

/**
 * Load settings
 */
function loadSettings() {
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', saveSettings);
    }
}

/**
 * Save settings
 */
async function saveSettings(e) {
    e.preventDefault();
    const apiKey = document.getElementById('apiKey').value;

    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({ apiKey })
        });

        alert('Settings saved successfully');
    } catch (error) {
        console.error('Settings error:', error);
        alert('Error saving settings');
    }
}

/**
 * Edit course
 */
function editCourse(courseId) {
    alert(`Edit course ${courseId} (not implemented)`);
}

/**
 * Delete course
 */
async function deleteCourse(courseId) {
    if (confirm('Are you sure you want to delete this course?')) {
        try {
            await fetch(`/api/courses/${courseId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            loadCourses();
        } catch (error) {
            console.error('Delete error:', error);
            alert('Error deleting course');
        }
    }
}

/**
 * Logout
 */
function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = 'index.html';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Check authentication
 */
async function checkAuth() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = 'index.html';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    console.log('Admin dashboard initialized');
    switchSection('dashboard');
});

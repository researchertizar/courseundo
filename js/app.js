// Initialize Supabase client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const resultsContainer = document.getElementById('results');

// Event Listeners
searchButton.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

/**
 * Perform semantic search for courses
 */
async function performSearch() {
    const query = searchInput.value.trim();
    
    if (!query) {
        alert('Please enter a search query');
        return;
    }

    try {
        // Show loading state
        resultsContainer.innerHTML = '<p class="loading">Searching...</p>';

        // Call semantic-search function
        const response = await fetch('/api/semantic-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const results = await response.json();
        displayResults(results);

        // Log activity
        logActivity('search', { query, resultsCount: results.length });

    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = `
            <div class="error-message">
                <p>An error occurred while searching. Please try again.</p>
            </div>
        `;
    }
}

/**
 * Display search results
 */
function displayResults(results) {
    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <p>No courses found matching your query. Try different keywords.</p>
            </div>
        `;
        return;
    }

    const html = results.map(course => `
        <div class="result-item">
            <h3 class="result-title">${escapeHtml(course.title)}</h3>
            <p class="result-description">${escapeHtml(course.description || '')}</p>
            <div class="result-meta">
                <span class="result-match">
                    Match: ${(course.similarity * 100).toFixed(1)}%
                </span>
                ${course.platform ? `<span class="result-platform">${escapeHtml(course.platform)}</span>` : ''}
            </div>
            <a href="${escapeHtml(course.url)}" target="_blank" class="btn btn-secondary" style="margin-top: 1rem;">
                View Course
            </a>
        </div>
    `).join('');

    resultsContainer.innerHTML = html;
}

/**
 * Log user activity
 */
async function logActivity(action, details = {}) {
    try {
        await fetch('/api/log-activity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({
                action,
                details,
                timestamp: new Date().toISOString()
            })
        });
    } catch (error) {
        console.error('Activity logging error:', error);
    }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('CourseUndo app initialized');
    searchInput.focus();
});

/**
 * Utility Functions for JEE Study Tracker
 */

// Format time from minutes to readable string
function formatTime(minutes) {
    if (!minutes || minutes < 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Format time from seconds to mm:ss
function formatTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Format date to readable string
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
}

// Format date to relative time
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
}

// Calculate success rate percentage
function calculateSuccessRate(ontime, total) {
    if (total === 0) return 0;
    return Math.round((ontime / total) * 100);
}

// Get subject color class
function getSubjectClass(subject) {
    const subjectMap = {
        'Maths': 'maths',
        'Physics': 'physics',
        'Chemistry': 'chemistry',
        'Other': 'other'
    };
    return subjectMap[subject] || 'other';
}

// Get status text and class
function getStatusInfo(status) {
    const statusMap = {
        'pending': { text: '⏳ Pending', class: 'pending' },
        'in_progress': { text: '▶️ In Progress', class: 'in_progress' },
        'completed_ontime': { text: '✅ On Time', class: 'completed_ontime' },
        'completed_delayed': { text: '⏰ Delayed', class: 'completed_delayed' }
    };
    return statusMap[status] || { text: status, class: '' };
}

// Show toast notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// API helper function
async function api(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
    };

    const response = await fetch(endpoint, { ...defaultOptions, ...options });
    
    if (response.status === 401) {
        window.location.href = '/';
        return null;
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Get initials from name
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Calculate percentage
function calculatePercentage(value, total) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// Check if user is logged in
async function checkAuth() {
    try {
        const user = await api('/api/current-user');
        return user;
    } catch (error) {
        return null;
    }
}

// Logout function
async function logout() {
    try {
        await api('/api/logout');
        window.location.href = '/';
    } catch (error) {
        showToast('Error logging out', 'error');
    }
}

// Add logout listener
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});

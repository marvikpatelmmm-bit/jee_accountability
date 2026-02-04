/* ============================================
   JEE STUDY TRACKER - UTILITY FUNCTIONS
   ============================================ */

// Format minutes to human readable
function formatMinutes(minutes) {
    if (!minutes || minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
}

// Format time (seconds) to MM:SS or HH:MM:SS
function formatTime(seconds) {
    if (!seconds || seconds < 0) seconds = 0;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format date
function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Format short date
function formatShortDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

// Format time from date
function formatTimeFromDate(date) {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Calculate success rate
function calculateSuccessRate(ontime, total) {
    if (total === 0) return 0;
    return Math.round((ontime / total) * 100);
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// Get yesterday's date
function getYesterdayDate() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
}

// Show toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Check if user is logged in
async function checkAuth() {
    try {
        const response = await fetch('/api/current-user');
        if (!response.ok) {
            window.location.href = '/index.html';
            return null;
        }
        return await response.json();
    } catch (error) {
        window.location.href = '/index.html';
        return null;
    }
}

// Get current user
async function getCurrentUser() {
    try {
        const response = await fetch('/api/current-user');
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    }
}

// Logout
async function logout() {
    try {
        await fetch('/api/logout');
        window.location.href = '/index.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Gradient colors for avatars
function getGradientForUser(userId) {
    const gradients = ['purple', 'blue', 'orange', 'green', 'pink'];
    return gradients[userId % gradients.length];
}

// API helper with error handling
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
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

// Modal functions
function openModal(modalId) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById(modalId);
    
    if (overlay && modal) {
        // Hide all modals first
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        
        modal.style.display = 'block';
        overlay.classList.add('active');
    }
}

function closeModal(modalId) {
    const overlay = document.getElementById('modal-overlay');
    
    if (overlay) {
        overlay.classList.remove('active');
    }
}

function closeAllModals() {
    const overlay = document.getElementById('modal-overlay');
    
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Initialize modal close buttons
document.addEventListener('DOMContentLoaded', () => {
    // Close on overlay click
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeAllModals();
            }
        });
    }
    
    // Close on close button click
    document.querySelectorAll('[data-modal-close]').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});

// Get subject icon
function getSubjectIcon(subject) {
    const icons = {
        'maths': '📐',
        'physics': '⚛️',
        'chemistry': '🧪',
        'other': '📚'
    };
    return icons[subject.toLowerCase()] || icons.other;
}

// Get status icon
function getStatusIcon(status) {
    const icons = {
        'pending': '⏳',
        'in_progress': '▶️',
        'completed_ontime': '✅',
        'completed_delayed': '⏰',
        'stopped': '⏸️',
        'paused': '⏸️'
    };
    return icons[status] || '❓';
}

// Get status label
function getStatusLabel(status) {
    const labels = {
        'pending': 'Pending',
        'in_progress': 'In Progress',
        'completed_ontime': 'Completed On Time',
        'completed_delayed': 'Completed Delayed',
        'stopped': 'Stopped',
        'paused': 'Paused'
    };
    return labels[status] || status;
}

// Animate number counter
function animateNumber(element, target, duration = 1000, suffix = '') {
    const start = 0;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(start + (target - start) * easeOutQuart);
        
        element.textContent = current + suffix;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target + suffix;
        }
    }
    
    requestAnimationFrame(update);
}

// Set date input to today
document.addEventListener('DOMContentLoaded', () => {
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (!input.value) {
            input.value = getTodayDate();
        }
    });
});

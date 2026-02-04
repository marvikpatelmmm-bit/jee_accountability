/**
 * Authentication Module for JEE Study Tracker
 */

// Check if user is authenticated on protected pages
async function initAuth() {
    const publicPages = ['/', '/index.html'];
    const currentPath = window.location.pathname;
    
    // Allow public pages
    if (publicPages.includes(currentPath)) {
        return;
    }

    // Check authentication
    const user = await checkAuth();
    if (!user) {
        window.location.href = '/';
        return;
    }

    // Store current user info
    window.currentUser = user;
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    try {
        const result = await api('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (result && result.success) {
            showToast('Login successful!', 'success');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 500);
        }
    } catch (error) {
        showToast(error.message || 'Login failed', 'error');
    }
}

// Handle register form submission
async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('regName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!name || !username || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        const result = await api('/api/register', {
            method: 'POST',
            body: JSON.stringify({ name, username, password })
        });

        if (result && result.success) {
            showToast('Account created successfully!', 'success');
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 500);
        }
    } catch (error) {
        showToast(error.message || 'Registration failed', 'error');
    }
}

// Initialize auth tabs on login page
function initAuthTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show corresponding form
            forms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${targetTab}Form`) {
                    form.classList.add('active');
                }
            });
        });
    });
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize auth check
    initAuth();

    // Setup login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Setup register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Setup auth tabs
    initAuthTabs();
});

/* ============================================
   JEE STUDY TRACKER - AUTHENTICATION (UPGRADED)
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Tab Switching Logic ---
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Update tabs UI
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update forms UI
            authForms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${targetTab}-form`) {
                    form.classList.add('active');
                }
            });
            
            clearErrors();
        });
    });
    
    // --- 2. Login Logic ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();
            
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            const loginBtn = document.getElementById('login-btn');
            
            // Validation
            if (!username) return showError('login-username', 'Username is required');
            if (!password) return showError('login-password', 'Password is required');
            
            // Set Loading State
            setLoading(loginBtn, true, 'Logging in...');
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    safeShowToast('Login successful!', 'success');
                    window.location.href = '/dashboard.html';
                } else {
                    showError('login-general', data.error || 'Invalid credentials');
                    setLoading(loginBtn, false, 'Login');
                }
            } catch (error) {
                console.error('Login Error:', error);
                showError('login-general', 'Server unreachable. Check your connection.');
                setLoading(loginBtn, false, 'Login');
            }
        });
    }
    
    // --- 3. Register Logic ---
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();
            
            const name = document.getElementById('register-name').value.trim();
            const username = document.getElementById('register-username').value.trim();
            const password = document.getElementById('register-password').value;
            const confirm = document.getElementById('register-confirm').value;
            const registerBtn = document.getElementById('register-btn');
            
            // Strict Validation
            if (!name) return showError('register-name', 'Name is required');
            if (!username) return showError('register-username', 'Username is required');
            if (username.length < 3) return showError('register-username', 'Username too short (min 3 chars)');
            if (!password) return showError('register-password', 'Password is required');
            if (password.length < 6) return showError('register-password', 'Password too short (min 6 chars)');
            if (password !== confirm) return showError('register-confirm', 'Passwords do not match');
            
            // Set Loading State
            setLoading(registerBtn, true, 'Creating Account...');
            
            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, username, password })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    safeShowToast('Account created! Redirecting...', 'success');
                    // Automatically log them in or send to dashboard
                    setTimeout(() => {
                        window.location.href = '/dashboard.html';
                    }, 1000);
                } else {
                    showError('register-general', data.error || 'Registration failed');
                    setLoading(registerBtn, false, 'Create Account');
                }
            } catch (error) {
                console.error('Register Error:', error);
                showError('register-general', 'Server error. Please try again later.');
                setLoading(registerBtn, false, 'Create Account');
            }
        });
    }
    
    // --- 4. Auto-Redirect Check (THE FIX) ---
    // We define a local checkAuth here to ensure this works even if utils.js fails
    const verifySession = async () => {
        try {
            const res = await fetch('/api/current-user');
            if (res.ok) {
                return await res.json();
            }
            return null;
        } catch (e) {
            return null;
        }
    };

    verifySession().then(user => {
        const path = window.location.pathname;
        
        // CRITICAL FIX: Parentheses added around the OR (||) logic
        // Only redirect if USER exists AND (path is index OR path is /)
        if (user && (path === '/index.html' || path === '/')) {
            console.log('User already logged in, redirecting to dashboard');
            window.location.href = '/dashboard.html';
        }
    });
});

// --- Helper Functions ---

function showError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
        // Shake animation for visibility
        const inputField = document.getElementById(fieldId);
        if(inputField) {
            inputField.classList.add('input-error');
            setTimeout(() => inputField.classList.remove('input-error'), 500);
        }
    }
}

function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.textContent = '';
        el.classList.remove('show');
    });
    document.querySelectorAll('input').forEach(el => {
        el.classList.remove('input-error');
    });
}

// Button loading state helper
function setLoading(button, isLoading, text) {
    if (isLoading) {
        button.dataset.originalText = button.textContent; // Save original text
        button.textContent = text;
        button.disabled = true;
        button.style.opacity = '0.7';
        button.style.cursor = 'not-allowed';
    } else {
        button.textContent = text || button.dataset.originalText || 'Submit';
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
    }
}

// Safe Toast wrapper (checks if showToast exists from utils.js, else uses alert)
function safeShowToast(msg, type) {
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${msg}`);
    }
}
/* ============================================
   JEE STUDY TRACKER - AUTHENTICATION
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Update tabs
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update forms
            authForms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${targetTab}-form`) {
                    form.classList.add('active');
                }
            });
            
            // Clear errors
            clearErrors();
        });
    });
    
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();
            
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            
            // Validation
            let hasError = false;
            
            if (!username) {
                showError('login-username', 'Username is required');
                hasError = true;
            }
            
            if (!password) {
                showError('login-password', 'Password is required');
                hasError = true;
            }
            
            if (hasError) return;
            
            // Show loading
            const loginBtn = document.getElementById('login-btn');
            const originalText = loginBtn.textContent;
            loginBtn.textContent = 'Logging in...';
            loginBtn.disabled = true;
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    showToast('Login successful!', 'success');
                    window.location.href = '/dashboard.html';
                } else {
                    showError('login-general', data.error || 'Invalid credentials');
                    loginBtn.textContent = originalText;
                    loginBtn.disabled = false;
                }
            } catch (error) {
                showError('login-general', 'Network error. Please try again.');
                loginBtn.textContent = originalText;
                loginBtn.disabled = false;
            }
        });
    }
    
    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();
            
            const name = document.getElementById('register-name').value.trim();
            const username = document.getElementById('register-username').value.trim();
            const password = document.getElementById('register-password').value;
            const confirm = document.getElementById('register-confirm').value;
            
            // Validation
            let hasError = false;
            
            if (!name) {
                showError('register-name', 'Name is required');
                hasError = true;
            }
            
            if (!username) {
                showError('register-username', 'Username is required');
                hasError = true;
            } else if (username.length < 3) {
                showError('register-username', 'Username must be at least 3 characters');
                hasError = true;
            }
            
            if (!password) {
                showError('register-password', 'Password is required');
                hasError = true;
            } else if (password.length < 6) {
                showError('register-password', 'Password must be at least 6 characters');
                hasError = true;
            }
            
            if (password !== confirm) {
                showError('register-confirm', 'Passwords do not match');
                hasError = true;
            }
            
            if (hasError) return;
            
            // Show loading
            const registerBtn = document.getElementById('register-btn');
            const originalText = registerBtn.textContent;
            registerBtn.textContent = 'Creating account...';
            registerBtn.disabled = true;
            
            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, username, password })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    showToast('Account created successfully!', 'success');
                    window.location.href = '/dashboard.html';
                } else {
                    showError('register-general', data.error || 'Registration failed');
                    registerBtn.textContent = originalText;
                    registerBtn.disabled = false;
                }
            } catch (error) {
                showError('register-general', 'Network error. Please try again.');
                registerBtn.textContent = originalText;
                registerBtn.disabled = false;
            }
        });
    }
    
    // Check if already logged in
    checkAuth().then(user => {
        if (user && window.location.pathname === '/index.html' || window.location.pathname === '/') {
            window.location.href = '/dashboard.html';
        }
    });
});

// Show error message
function showError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

// Clear all errors
function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => {
        el.textContent = '';
        el.classList.remove('show');
    });
}

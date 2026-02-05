/* ============================================
   JEE STUDY TRACKER - DASHBOARD
   ============================================ */

// Global state
let currentUser = null;
let activeTaskId = null;
let timerInterval = null;
let timerStartTime = null;
let taskEntriesCount = 0;
let liveFeedInterval = null;
let currentFilter = 'all';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await checkAuth();
    if (!currentUser) return;
    
    // Set user name
    document.getElementById('current-user-name').textContent = currentUser.name;
    document.getElementById('welcome-name').textContent = currentUser.name;
    document.getElementById('today-date').textContent = formatDate(new Date());
    
    // Load initial data
    await loadTodaysTasks();
    await loadQuickStats();
    await loadLiveFeed();
    await checkActiveTask();
    
    // Start live feed polling
    startLiveFeedPolling();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup modals
    setupModals();
});

// Setup event listeners
function setupEventListeners() {
    // Task filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTasks();
        });
    });
    
    // Complete task button
    document.getElementById('complete-task-btn')?.addEventListener('click', completeActiveTask);
    
    // Stop task button
    document.getElementById('stop-task-btn')?.addEventListener('click', stopActiveTask);
    
    // Plan day button
    document.getElementById('plan-day-btn')?.addEventListener('click', () => {
        openPlanDayModal();
    });
    
    // End day button
    document.getElementById('end-day-btn')?.addEventListener('click', () => {
        openEndDayModal();
    });
    
    // Add task row button
    document.getElementById('add-task-row')?.addEventListener('click', addTaskEntryRow);
    
    // Save tasks button
    document.getElementById('save-tasks-btn')?.addEventListener('click', saveTasks);
    
    // Submit end day button
    document.getElementById('submit-end-day')?.addEventListener('click', submitEndDay);
    
    // Star rating
    setupStarRating();
}

// Setup modals
function setupModals() {
    // Add initial task row
    addTaskEntryRow();
}

// Setup star rating
function setupStarRating() {
    const stars = document.querySelectorAll('#star-rating .star');
    let selectedRating = 0;
    
    stars.forEach((star, index) => {
        star.addEventListener('click', () => {
            selectedRating = index + 1;
            updateStarDisplay(selectedRating);
        });
        
        star.addEventListener('mouseenter', () => {
            updateStarDisplay(index + 1);
        });
    });
    
    document.getElementById('star-rating')?.addEventListener('mouseleave', () => {
        updateStarDisplay(selectedRating);
    });
}

function updateStarDisplay(rating) {
    const stars = document.querySelectorAll('#star-rating .star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

// Get selected rating
function getSelectedRating() {
    const stars = document.querySelectorAll('#star-rating .star.active');
    return stars.length;
}

// Load today's tasks
let todaysTasks = [];

async function loadTodaysTasks() {
    try {
        const data = await apiCall('/api/tasks/today');
        todaysTasks = data.tasks || [];
        renderTasks();
    } catch (error) {
        showToast('Failed to load tasks', 'error');
    }
}

// Render tasks based on filter
function renderTasks() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;
    
    let filteredTasks = todaysTasks;
    
    // FIX 1: If filter is 'all', HIDE completed tasks to reduce clutter
    if (currentFilter === 'all') {
        filteredTasks = todaysTasks.filter(t => 
            t.status !== 'completed_ontime' && t.status !== 'completed_delayed'
        );
    } else if (currentFilter === 'pending') {
        filteredTasks = todaysTasks.filter(t => t.status === 'pending');
    } else if (currentFilter === 'completed') {
        filteredTasks = todaysTasks.filter(t => 
            t.status === 'completed_ontime' || t.status === 'completed_delayed'
        );
    }
    
    // Handle empty states
    if (filteredTasks.length === 0) {
        if (currentFilter === 'all' && todaysTasks.length > 0) {
             taskList.innerHTML = `
                <div class="empty-tasks">
                    <div class="empty-tasks-icon">🎉</div>
                    <div class="empty-state-title">All active tasks done!</div>
                    <div class="empty-state-text">Check the "Completed" tab to see history.</div>
                </div>
            `;
            return;
        }

        taskList.innerHTML = `
            <div class="empty-tasks">
                <div class="empty-tasks-icon">📝</div>
                <div class="empty-state-title">No tasks found</div>
                <div class="empty-state-text">Click the + button to plan your day!</div>
            </div>
        `;
        return;
    }
    
    taskList.innerHTML = filteredTasks.map(task => {
        const subjectLower = task.subject.toLowerCase();
        const isActive = task.status === 'in_progress';
        // FIX 2: Check if task is paused or stopped
        const isPaused = task.status === 'paused' || task.status === 'stopped';
        const isCompleted = task.status === 'completed_ontime' || task.status === 'completed_delayed';
        const isDelayed = task.status === 'completed_delayed';
        
        let actions = '';
        
        // FIX 3: LOGIC TO SHOW RESUME BUTTON
        if (isActive) {
            // Running: Show Pause
            actions = `
                <button class="task-btn stop" onclick="stopTask(${task.id})" title="Stop">
                    ⏸️
                </button>
                <button class="task-btn success" onclick="completeTaskById(${task.id})" title="Done">
                    ✅
                </button>
            `;
        } else if (isCompleted) {
            // Completed: Show only Delete
             actions = `
                <button class="task-btn delete" onclick="deleteTask(${task.id})" title="Delete">
                    🗑️
                </button>
            `;
        } else {
            // Pending OR Paused OR Stopped -> Show START (Resume)
            actions = `
                <button class="task-btn start" onclick="startTask(${task.id})" title="${isPaused ? 'Resume' : 'Start'}">
                    ▶️
                </button>
                ${task.status !== 'pending' ? `
                <button class="task-btn success" onclick="completeTaskById(${task.id})" title="Done">
                    ✅
                </button>` : ''}
                <button class="task-btn delete" onclick="deleteTask(${task.id})" title="Delete">
                    🗑️
                </button>
            `;
        }
        
        return `
            <div class="task-item ${task.status} ${isDelayed ? 'completed-delayed' : ''}">
                <div class="task-icon ${subjectLower}">${getSubjectIcon(task.subject)}</div>
                <div class="task-content">
                    <div class="task-title">${task.task_name}</div>
                    <div class="task-meta">
                        <span class="subject-tag ${subjectLower}">${task.subject}</span>
                        <span>⏱️ ${formatMinutes(task.estimated_minutes)}</span>
                        ${task.actual_minutes ? `<span>✓ ${formatMinutes(task.actual_minutes)}</span>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    ${actions}
                </div>
            </div>
        `;
    }).join('');
}

// Load quick stats
async function loadQuickStats() {
    try {
        const users = await apiCall('/api/users');
        const user = users.users.find(u => u.id === currentUser.id);
        
        if (user) {
            document.getElementById('stat-hours').textContent = formatMinutes(user.today_stats.total_minutes);
            document.getElementById('stat-tasks').textContent = user.today_stats.tasks_completed;
            document.getElementById('stat-rate').textContent = user.today_stats.success_rate + '%';
            document.getElementById('stat-streak').textContent = user.current_streak || 0;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Check for active task
async function checkActiveTask() {
    try {
        const data = await apiCall(`/api/users/${currentUser.id}/tasks/active`);
        
        if (data.has_active && data.task) {
            showActiveTask(data.task);
        } else {
            hideActiveTask();
        }
    } catch (error) {
        console.error('Failed to check active task:', error);
    }
}

// Show active task
function showActiveTask(task) {
    activeTaskId = task.id;
    
    document.getElementById('no-active-task').style.display = 'none';
    document.getElementById('active-task-content').style.display = 'block';
    document.getElementById('active-task-card').classList.remove('no-active');
    
    document.getElementById('active-task-subject').textContent = task.subject;
    document.getElementById('active-task-subject').className = `subject-tag ${task.subject.toLowerCase()}`;
    document.getElementById('active-task-name').textContent = task.task_name;
    document.getElementById('timer-estimated').textContent = formatMinutes(task.estimated_minutes * 60);
    
    // Start timer
    startTimer(task.started_at, task.estimated_minutes);
}

// Hide active task
function hideActiveTask() {
    activeTaskId = null;
    stopTimer();
    
    document.getElementById('no-active-task').style.display = 'block';
    document.getElementById('active-task-content').style.display = 'none';
    document.getElementById('active-task-card').classList.add('no-active');
}

// Start timer
function startTimer(startedAt, estimatedMinutes) {
    stopTimer();
    
    const startTime = new Date(startedAt).getTime();
    const estimatedMs = estimatedMinutes * 60 * 1000;
    
    timerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        const elapsedMinutes = elapsed / 60;
        
        // Update timer display
        document.getElementById('timer-elapsed').textContent = formatTime(elapsed);
        
        // Update progress ring
        const progress = Math.min((elapsed * 1000 / estimatedMs) * 100, 100);
        const circumference = 2 * Math.PI * 90;
        const offset = circumference - (progress / 100) * circumference;
        document.getElementById('ring-progress').style.strokeDashoffset = offset;
        
        // Update status
        const statusEl = document.getElementById('timer-status');
        if (elapsedMinutes > estimatedMinutes) {
            statusEl.textContent = '⚠️ Overtime!';
            statusEl.className = 'timer-status overtime';
        } else if (elapsedMinutes > estimatedMinutes * 0.8) {
            statusEl.textContent = '⏰ Almost done';
            statusEl.className = 'timer-status warning';
        } else {
            statusEl.textContent = '✓ On Track';
            statusEl.className = 'timer-status on-track';
        }
    }, 1000);
}

// Stop timer
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Start a task
async function startTask(taskId) {
    try {
        const data = await apiCall(`/api/tasks/${taskId}/start`, { method: 'POST' });
        
        if (data.previous_task_stopped) {
            showToast(`Previous task "${data.previous_task_name}" stopped automatically`, 'info');
        }
        
        showActiveTask(data.task);
        showToast(`Started: ${data.task.task_name}`, 'success');
        await loadTodaysTasks();
        await loadLiveFeed();
    } catch (error) {
        showToast(error.message || 'Failed to start task', 'error');
    }
}

// Complete active task
async function completeActiveTask() {
    if (!activeTaskId) return;
    
    try {
        const data = await apiCall(`/api/tasks/${activeTaskId}/complete`, { method: 'POST' });
        
        hideActiveTask();
        
        const statusText = data.status === 'completed_ontime' ? 'on time! ✅' : 'delayed ⏰';
        showToast(`Task completed ${statusText}`, 'success');
        
        await loadTodaysTasks();
        await loadQuickStats();
        await loadLiveFeed();
    } catch (error) {
        showToast(error.message || 'Failed to complete task', 'error');
    }
}

// Stop active task
async function stopActiveTask() {
    if (!activeTaskId) return;
    
    try {
        const data = await apiCall(`/api/tasks/${activeTaskId}/stop`, { method: 'POST' });
        
        hideActiveTask();
        showToast(`Task stopped. Time logged: ${formatMinutes(data.time_logged_minutes)}`, 'info');
        
        await loadTodaysTasks();
        await loadLiveFeed();
    } catch (error) {
        showToast(error.message || 'Failed to stop task', 'error');
    }
}

// Stop a task (for non-active tasks)
async function stopTask(taskId) {
    try {
        const data = await apiCall(`/api/tasks/${taskId}/stop`, { method: 'POST' });
        showToast(`Task stopped. Time logged: ${formatMinutes(data.time_logged_minutes)}`, 'info');
        await loadTodaysTasks();
        await loadLiveFeed();
    } catch (error) {
        showToast(error.message || 'Failed to stop task', 'error');
    }
}

// Delete a task
async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        await apiCall(`/api/tasks/${taskId}`, { method: 'DELETE' });
        showToast('Task deleted', 'success');
        await loadTodaysTasks();
    } catch (error) {
        showToast(error.message || 'Failed to delete task', 'error');
    }
}

// Load live feed
async function loadLiveFeed() {
    try {
        const data = await apiCall('/api/feed/active');
        renderLiveFeed(data.users);
        updateGroupStats(data.groupStats);
    } catch (error) {
        console.error('Failed to load live feed:', error);
    }
}

// Render live feed
function renderLiveFeed(users) {
    const feedContainer = document.getElementById('live-feed');
    if (!feedContainer) return;
    
    if (users.length === 0) {
        feedContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <div class="empty-state-title">No users yet</div>
                <div class="empty-state-text">Invite your friends to join!</div>
            </div>
        `;
        return;
    }
    
    feedContainer.innerHTML = users.map(user => {
        const isActive = user.active_task;
        const gradient = getGradientForUser(user.id);
        
        return `
            <div class="feed-user-card ${isActive ? 'active' : ''}" onclick="viewUserProfile(${user.id})">
                <div class="feed-user-header">
                    <div class="avatar avatar-md gradient-${gradient}">${user.name.charAt(0)}</div>
                    <div class="feed-user-info">
                        <h4>${user.name}</h4>
                        <span class="last-seen">${user.is_online ? '● Online' : user.last_seen}</span>
                    </div>
                </div>
                
                <div class="feed-user-activity">
                    ${isActive ? `
                        <div class="activity-indicator">
                            <span class="pulse-dot"></span>
                            <span class="activity-text">Studying now</span>
                        </div>
                        <div class="activity-task">${user.active_task.task_name}</div>
                        <div class="activity-subject">${user.active_task.subject} • ${formatMinutes(user.active_task.elapsed_minutes)}</div>
                    ` : `
                        <span class="idle-text">Not studying right now</span>
                    `}
                </div>
                
                <div class="feed-user-stats">
                    <span>✅ ${user.today_stats.tasks_completed}</span>
                    <span>⏱️ ${formatMinutes(user.today_stats.total_minutes)}</span>
                    <span>🔥 ${user.streak}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Update group stats
function updateGroupStats(stats) {
    document.getElementById('group-tasks').textContent = stats.total_tasks;
    document.getElementById('group-hours').textContent = formatMinutes(stats.total_hours * 60);
    document.getElementById('group-rate').textContent = stats.avg_success + '%';
}

// Start live feed polling
function startLiveFeedPolling() {
    // Poll every 5 seconds
    liveFeedInterval = setInterval(loadLiveFeed, 5000);
}

// View user profile
function viewUserProfile(userId) {
    window.location.href = `/profile.html?userId=${userId}`;
}

// Open plan day modal
function openPlanDayModal() {
    // Clear existing rows
    document.getElementById('task-entries').innerHTML = '';
    taskEntriesCount = 0;
    
    // Add first row
    addTaskEntryRow();
    
    // Update total time
    updatePlanTotalTime();
    
    openModal('plan-day-modal');
}

// Add task entry row
function addTaskEntryRow() {
    taskEntriesCount++;
    
    const row = document.createElement('div');
    row.className = 'task-entry-row';
    row.innerHTML = `
        <input type="text" class="input task-name-input" placeholder="Task name (e.g., Integration Practice)" required>
        <select class="select subject-select">
            <option value="Maths">Maths</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Other">Other</option>
        </select>
        <div class="time-input-group">
            <input type="number" class="input hours-input" placeholder="0" min="0" max="23" value="0">
            <span class="time-separator">h</span>
            <input type="number" class="input minutes-input" placeholder="0" min="0" max="59" step="5" value="30">
            <span class="time-separator">m</span>
        </div>
        <button type="button" class="btn-remove-task" onclick="removeTaskRow(this)">×</button>
    `;
    
    document.getElementById('task-entries').appendChild(row);
    
    // Add event listeners for time inputs
    row.querySelectorAll('.hours-input, .minutes-input').forEach(input => {
        input.addEventListener('input', updatePlanTotalTime);
    });
}

// Remove task row
function removeTaskRow(btn) {
    const rows = document.querySelectorAll('.task-entry-row');
    if (rows.length > 1) {
        btn.closest('.task-entry-row').remove();
        updatePlanTotalTime();
    }
}

// Update plan total time
function updatePlanTotalTime() {
    let totalMinutes = 0;
    
    document.querySelectorAll('.task-entry-row').forEach(row => {
        const hours = parseInt(row.querySelector('.hours-input').value) || 0;
        const minutes = parseInt(row.querySelector('.minutes-input').value) || 0;
        totalMinutes += (hours * 60) + minutes;
    });
    
    document.getElementById('plan-total-time').textContent = formatMinutes(totalMinutes);
}

// Save tasks
async function saveTasks() {
    const rows = document.querySelectorAll('.task-entry-row');
    const tasks = [];
    
    rows.forEach(row => {
        const taskName = row.querySelector('.task-name-input').value.trim();
        const subject = row.querySelector('.subject-select').value;
        const hours = parseInt(row.querySelector('.hours-input').value) || 0;
        const minutes = parseInt(row.querySelector('.minutes-input').value) || 0;
        const estimatedMinutes = (hours * 60) + minutes;
        
        if (taskName && estimatedMinutes > 0) {
            tasks.push({ task_name: taskName, subject, estimated_minutes: estimatedMinutes });
        }
    });
    
    if (tasks.length === 0) {
        showToast('Please add at least one task', 'error');
        return;
    }
    
    try {
        await apiCall('/api/tasks/batch-add', {
            method: 'POST',
            body: JSON.stringify({ tasks })
        });
        
        showToast(`Added ${tasks.length} tasks!`, 'success');
        closeAllModals();
        await loadTodaysTasks();
    } catch (error) {
        showToast(error.message || 'Failed to add tasks', 'error');
    }
}

// Open end day modal
async function openEndDayModal() {
    try {
        // Get today's tasks
        const tasks = await apiCall('/api/tasks/today');
        
        const completed = tasks.tasks.filter(t => 
            t.status === 'completed_ontime' || t.status === 'completed_delayed'
        );
        const ontime = tasks.tasks.filter(t => t.status === 'completed_ontime');
        const delayed = tasks.tasks.filter(t => t.status === 'completed_delayed');
        const pending = tasks.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
        
        const successRate = completed.length > 0 ? Math.round((ontime.length / completed.length) * 100) : 0;
        
        document.getElementById('summary-ontime').textContent = ontime.length;
        document.getElementById('summary-delayed').textContent = delayed.length;
        document.getElementById('summary-incomplete').textContent = pending.length;
        document.getElementById('summary-rate').textContent = successRate + '%';
        
        // Reset form
        document.getElementById('maths-problems').value = 0;
        document.getElementById('physics-problems').value = 0;
        document.getElementById('chemistry-problems').value = 0;
        document.getElementById('topics-covered').value = '';
        document.getElementById('day-notes').value = '';
        updateStarDisplay(0);
        
        openModal('end-day-modal');
    } catch (error) {
        showToast('Failed to load task summary', 'error');
    }
}

// Submit end day
async function submitEndDay() {
    const mathsProblems = parseInt(document.getElementById('maths-problems').value) || 0;
    const physicsProblems = parseInt(document.getElementById('physics-problems').value) || 0;
    const chemistryProblems = parseInt(document.getElementById('chemistry-problems').value) || 0;
    const topicsCovered = document.getElementById('topics-covered').value.trim();
    const notes = document.getElementById('day-notes').value.trim();
    const selfRating = getSelectedRating() || 3;
    
    try {
        const data = await apiCall('/api/summary/end-day', {
            method: 'POST',
            body: JSON.stringify({
                maths_problems: mathsProblems,
                physics_problems: physicsProblems,
                chemistry_problems: chemistryProblems,
                topics_covered: topicsCovered,
                notes,
                self_rating: selfRating
            })
        });
        
        if (data.streak_updated) {
            showToast(`Day ended! New streak: ${data.new_streak} days 🔥`, 'success');
        } else {
            showToast('Day ended successfully!', 'success');
        }
        
        closeAllModals();
        await loadQuickStats();
    } catch (error) {
        showToast(error.message || 'Failed to end day', 'error');
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (liveFeedInterval) {
        clearInterval(liveFeedInterval);
    }
    stopTimer(); // <--- Put this INSIDE the brackets
});

// Helper to complete task from list view
async function completeTaskById(id) {
    activeTaskId = id; 
    await completeActiveTask();
}
/**
 * Task Management Module for JEE Study Tracker
 */

let currentTasks = [];
let activeTaskId = null;
let taskTimerInterval = null;
let taskStartTime = null;
let taskEstimatedMinutes = 0;

// Load today's tasks
async function loadTodaysTasks() {
    try {
        const tasks = await api('/api/tasks/today');
        currentTasks = tasks || [];
        renderTasksList();
        return tasks;
    } catch (error) {
        showToast('Failed to load tasks', 'error');
        return [];
    }
}

// Render tasks list
function renderTasksList(filter = 'all') {
    const container = document.getElementById('tasksList');
    if (!container) return;

    let filteredTasks = currentTasks;
    if (filter === 'pending') {
        filteredTasks = currentTasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    } else if (filter === 'completed') {
        filteredTasks = currentTasks.filter(t => t.status === 'completed_ontime' || t.status === 'completed_delayed');
    }

    if (filteredTasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p>No tasks ${filter === 'all' ? 'planned for today' : 'in this category'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredTasks.map(task => {
        const statusInfo = getStatusInfo(task.status);
        const subjectClass = getSubjectClass(task.subject);
        const isActive = task.status === 'in_progress';
        
        return `
            <div class="task-card ${isActive ? 'active' : ''}" data-task-id="${task.id}" data-status="${task.status}">
                <div class="task-card-header">
                    <span class="subject-tag ${subjectClass}">${task.subject || 'Other'}</span>
                    <span class="task-status ${statusInfo.class}">${statusInfo.text}</span>
                </div>
                <div class="task-card-title">${escapeHtml(task.task_name)}</div>
                <div class="task-card-meta">
                    <span>⏱️ ${formatTime(task.estimated_minutes)} estimated</span>
                    ${task.actual_minutes ? `<span>• ${formatTime(task.actual_minutes)} actual</span>` : ''}
                </div>
                ${task.status === 'pending' ? `
                    <div class="task-card-actions">
                        <button class="btn btn-primary btn-sm" onclick="startTask(${task.id})">Start</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Start a task
async function startTask(taskId) {
    try {
        const result = await api(`/api/tasks/${taskId}/start`, {
            method: 'POST'
        });

        if (result && result.success) {
            showToast('Task started!', 'success');
            activeTaskId = taskId;
            const task = currentTasks.find(t => t.id === taskId);
            if (task) {
                startTaskTimer(task);
            }
            await loadTodaysTasks();
        }
    } catch (error) {
        showToast(error.message || 'Failed to start task', 'error');
    }
}

// Start task timer display
function startTaskTimer(task) {
    activeTaskId = task.id;
    taskStartTime = new Date(task.started_at || new Date());
    taskEstimatedMinutes = task.estimated_minutes;

    // Show active task section
    const noTaskContent = document.getElementById('noTaskContent');
    const activeTaskContent = document.getElementById('activeTaskContent');
    
    if (noTaskContent) noTaskContent.style.display = 'none';
    if (activeTaskContent) {
        activeTaskContent.style.display = 'block';
        
        // Update task info
        document.getElementById('activeTaskName').textContent = task.task_name;
        document.getElementById('activeSubjectTag').textContent = task.subject || 'Other';
        document.getElementById('activeSubjectTag').className = `subject-tag ${getSubjectClass(task.subject)}`;
        document.getElementById('timerEstimated').textContent = formatTime(task.estimated_minutes);
    }

    // Start timer interval
    if (taskTimerInterval) clearInterval(taskTimerInterval);
    
    updateTimerDisplay();
    taskTimerInterval = setInterval(updateTimerDisplay, 1000);
}

// Update timer display
function updateTimerDisplay() {
    if (!taskStartTime) return;

    const now = new Date();
    const elapsedMs = now - taskStartTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    // Update timer text
    const timerElapsed = document.getElementById('timerElapsed');
    if (timerElapsed) {
        timerElapsed.textContent = formatTimer(elapsedSeconds);
    }

    // Update progress circle
    const timerProgress = document.getElementById('timerProgress');
    const timerStatus = document.getElementById('timerStatus');
    const timerStatusText = document.getElementById('timerStatusText');

    if (timerProgress && taskEstimatedMinutes > 0) {
        const estimatedSeconds = taskEstimatedMinutes * 60;
        const progress = Math.min(elapsedSeconds / estimatedSeconds, 1);
        const circumference = 565.48; // 2 * PI * 90
        const offset = circumference * (1 - progress);
        
        timerProgress.style.strokeDashoffset = offset;

        // Update status based on progress
        if (timerStatus && timerStatusText) {
            if (progress < 0.8) {
                timerStatus.className = 'timer-status on-track';
                timerProgress.className = 'timer-progress';
                timerStatusText.textContent = 'On Track';
            } else if (progress < 1) {
                timerStatus.className = 'timer-status warning';
                timerProgress.className = 'timer-progress warning';
                timerStatusText.textContent = 'Almost Due';
            } else {
                timerStatus.className = 'timer-status overdue';
                timerProgress.className = 'timer-progress danger';
                timerStatusText.textContent = 'Overdue';
            }
        }
    }
}

// Complete current task
async function completeCurrentTask() {
    if (!activeTaskId) {
        showToast('No active task', 'error');
        return;
    }

    try {
        const result = await api(`/api/tasks/${activeTaskId}/complete`, {
            method: 'POST'
        });

        if (result && result.success) {
            // Stop timer
            if (taskTimerInterval) {
                clearInterval(taskTimerInterval);
                taskTimerInterval = null;
            }

            activeTaskId = null;
            taskStartTime = null;

            // Reset display
            const noTaskContent = document.getElementById('noTaskContent');
            const activeTaskContent = document.getElementById('activeTaskContent');
            
            if (noTaskContent) noTaskContent.style.display = 'block';
            if (activeTaskContent) activeTaskContent.style.display = 'none';

            const statusMsg = result.is_on_time ? 'completed on time!' : 'completed (delayed)';
            showToast(`Task ${statusMsg}`, result.is_on_time ? 'success' : 'warning');
            
            await loadTodaysTasks();
        }
    } catch (error) {
        showToast(error.message || 'Failed to complete task', 'error');
    }
}

// Initialize Add Tasks Modal
function initAddTasksModal() {
    const modal = document.getElementById('addTasksModal');
    const addBtn = document.getElementById('addTasksBtn');
    const closeBtn = document.getElementById('closeAddTasksModal');
    const cancelBtn = document.getElementById('cancelAddTasks');
    const addAnotherBtn = document.getElementById('addAnotherTask');
    const saveBtn = document.getElementById('saveTasks');
    const container = document.getElementById('tasksContainer');

    if (!modal) return;

    // Open modal
    addBtn?.addEventListener('click', () => {
        modal.classList.add('active');
        if (container.children.length === 0) {
            addTaskEntryRow();
            addTaskEntryRow();
            addTaskEntryRow();
        }
        updateTotalTime();
    });

    // Close modal
    const closeModal = () => modal.classList.remove('active');
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    // Add another task row
    addAnotherBtn?.addEventListener('click', () => {
        addTaskEntryRow();
        updateTotalTime();
    });

    // Save tasks
    saveBtn?.addEventListener('click', async () => {
        const tasks = collectTasksFromForm();
        if (tasks.length === 0) {
            showToast('Please add at least one task', 'error');
            return;
        }

        try {
            const result = await api('/api/tasks/batch-add', {
                method: 'POST',
                body: JSON.stringify({ tasks })
            });

            if (result && result.success) {
                showToast(`${result.count} tasks added!`, 'success');
                closeModal();
                container.innerHTML = '';
                await loadTodaysTasks();
            }
        } catch (error) {
            showToast(error.message || 'Failed to add tasks', 'error');
        }
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

// Add a task entry row to the form
function addTaskEntryRow() {
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'task-entry-row';
    row.innerHTML = `
        <input type="text" class="form-input task-name" placeholder="Task name (e.g., Solve 50 Integration Problems)" required>
        <select class="form-select task-subject">
            <option value="Maths">Maths</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Other">Other</option>
        </select>
        <select class="form-select task-time">
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60" selected>1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
        </select>
        <button type="button" class="btn-remove-task" onclick="this.parentElement.remove(); updateTotalTime();">&times;</button>
    `;

    // Add change listeners for time calculation
    row.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', updateTotalTime);
    });

    container.appendChild(row);
}

// Collect tasks from form
function collectTasksFromForm() {
    const container = document.getElementById('tasksContainer');
    if (!container) return [];

    const tasks = [];
    container.querySelectorAll('.task-entry-row').forEach(row => {
        const name = row.querySelector('.task-name').value.trim();
        const subject = row.querySelector('.task-subject').value;
        const minutes = parseInt(row.querySelector('.task-time').value);

        if (name) {
            tasks.push({
                task_name: name,
                subject,
                estimated_minutes: minutes
            });
        }
    });

    return tasks;
}

// Update total time display
function updateTotalTime() {
    const tasks = collectTasksFromForm();
    const totalMinutes = tasks.reduce((sum, t) => sum + t.estimated_minutes, 0);
    const totalTimeEl = document.getElementById('totalTime');
    if (totalTimeEl) {
        totalTimeEl.textContent = formatTime(totalMinutes);
    }
}

// Initialize End Day Modal
function initEndDayModal() {
    const modal = document.getElementById('endDayModal');
    const endDayBtn = document.getElementById('endDayBtn');
    const closeBtn = document.getElementById('closeEndDayModal');
    const cancelBtn = document.getElementById('cancelEndDay');
    const confirmBtn = document.getElementById('confirmEndDay');

    if (!modal) return;

    // Open modal
    endDayBtn?.addEventListener('click', async () => {
        const summary = await calculateTodaySummary();
        renderTodaySummary(summary);
        modal.classList.add('active');
    });

    // Close modal
    const closeModal = () => modal.classList.remove('active');
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    // Star rating
    const stars = modal.querySelectorAll('.star');
    let selectedRating = 0;
    
    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.rating);
            stars.forEach((s, i) => {
                s.classList.toggle('active', i < selectedRating);
            });
        });
    });

    // Confirm end day
    confirmBtn?.addEventListener('click', async () => {
        const data = {
            maths_problems: parseInt(document.getElementById('mathsProblems')?.value) || 0,
            physics_problems: parseInt(document.getElementById('physicsProblems')?.value) || 0,
            chemistry_problems: parseInt(document.getElementById('chemistryProblems')?.value) || 0,
            topics_covered: document.getElementById('topicsCovered')?.value || '',
            total_study_hours: parseFloat(document.getElementById('totalStudyHours')?.value) || 0,
            notes: document.getElementById('dayNotes')?.value || '',
            self_rating: selectedRating
        };

        try {
            const result = await api('/api/summary/end-day', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (result && result.success) {
                showToast(`Day ended! Streak: ${result.streak} days`, 'success');
                closeModal();
                await loadTodaysTasks();
            }
        } catch (error) {
            showToast(error.message || 'Failed to end day', 'error');
        }
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

// Calculate today's summary
async function calculateTodaySummary() {
    const tasks = await loadTodaysTasks();
    const completed = tasks.filter(t => t.status === 'completed_ontime' || t.status === 'completed_delayed');
    const ontime = tasks.filter(t => t.status === 'completed_ontime').length;
    const delayed = tasks.filter(t => t.status === 'completed_delayed').length;
    const skipped = tasks.filter(t => t.status === 'pending').length;
    
    const totalMinutes = completed.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
    const successRate = completed.length > 0 ? Math.round((ontime / completed.length) * 100) : 0;

    return {
        total: tasks.length,
        completed: completed.length,
        ontime,
        delayed,
        skipped,
        successRate,
        totalHours: Math.round(totalMinutes / 60 * 10) / 10
    };
}

// Render today summary in modal
function renderTodaySummary(summary) {
    const container = document.getElementById('todaySummary');
    if (!container) return;

    container.innerHTML = `
        <div class="summary-row">
            <span>✅ Completed On-time</span>
            <strong>${summary.ontime} tasks</strong>
        </div>
        <div class="summary-row">
            <span>⏰ Completed Delayed</span>
            <strong>${summary.delayed} tasks</strong>
        </div>
        <div class="summary-row">
            <span>❌ Skipped</span>
            <strong>${summary.skipped} tasks</strong>
        </div>
        <div class="summary-row success-rate">
            <span>Success Rate</span>
            <strong>${summary.successRate}%</strong>
        </div>
    `;

    // Pre-fill study hours
    const hoursInput = document.getElementById('totalStudyHours');
    if (hoursInput) {
        hoursInput.value = summary.totalHours;
    }
}

// Initialize task filters
function initTaskFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTasksList(btn.dataset.filter);
        });
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on dashboard
    if (!document.getElementById('tasksList')) return;

    loadTodaysTasks();
    initAddTasksModal();
    initEndDayModal();
    initTaskFilters();

    // Complete task button
    document.getElementById('completeTaskBtn')?.addEventListener('click', completeCurrentTask);
});

/* ============================================
   JEE STUDY TRACKER - TIMELINE
   Hour-by-hour activity view
   ============================================ */

let currentUser = null;
let viewingUserId = null;
let currentDate = getTodayDate();
let allUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await checkAuth();
    if (!currentUser) return;
    
    // Set current user name in nav
    document.getElementById('current-user-name').textContent = currentUser.name;
    
    // Get userId from URL params or default to current user
    const urlParams = new URLSearchParams(window.location.search);
    viewingUserId = parseInt(urlParams.get('userId')) || currentUser.id;
    
    // Set date input
    document.getElementById('timeline-date').value = currentDate;
    
    // Load all users for tabs
    await loadAllUsers();
    
    // Load timeline
    await loadTimeline(viewingUserId, currentDate);
    
    // Setup event listeners
    setupEventListeners();
    
    // Generate timeline grid
    generateTimelineGrid();
});

// Setup event listeners
function setupEventListeners() {
    // Date navigation
    document.getElementById('prev-day')?.addEventListener('click', () => {
        const date = new Date(currentDate);
        date.setDate(date.getDate() - 1);
        currentDate = date.toISOString().split('T')[0];
        document.getElementById('timeline-date').value = currentDate;
        loadTimeline(viewingUserId, currentDate);
    });
    
    document.getElementById('next-day')?.addEventListener('click', () => {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + 1);
        currentDate = date.toISOString().split('T')[0];
        document.getElementById('timeline-date').value = currentDate;
        loadTimeline(viewingUserId, currentDate);
    });
    
    document.getElementById('today-btn')?.addEventListener('click', () => {
        currentDate = getTodayDate();
        document.getElementById('timeline-date').value = currentDate;
        loadTimeline(viewingUserId, currentDate);
    });
    
    document.getElementById('timeline-date')?.addEventListener('change', (e) => {
        currentDate = e.target.value;
        loadTimeline(viewingUserId, currentDate);
    });
    
    // Comparison toggle
    document.getElementById('show-comparison')?.addEventListener('click', () => {
        const comparisonView = document.getElementById('comparison-view');
        const isVisible = comparisonView.style.display !== 'none';
        
        if (isVisible) {
            comparisonView.style.display = 'none';
            document.getElementById('show-comparison').textContent = 'Show Side-by-Side Comparison';
        } else {
            comparisonView.style.display = 'grid';
            document.getElementById('show-comparison').textContent = 'Hide Comparison';
            loadComparisonView();
        }
    });
}

// Load all users
async function loadAllUsers() {
    try {
        const data = await apiCall('/api/users');
        allUsers = data.users || [];
        
        // Populate user tabs
        const tabsContainer = document.getElementById('user-tabs');
        tabsContainer.innerHTML = allUsers.map(user => `
            <button class="user-tab ${user.id === viewingUserId ? 'active' : ''}" 
                    data-user-id="${user.id}">
                ${user.id === currentUser.id ? 'You' : user.name}
            </button>
        `).join('');
        
        // Add click handlers
        tabsContainer.querySelectorAll('.user-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                viewingUserId = parseInt(tab.dataset.userId);
                
                // Update active tab
                tabsContainer.querySelectorAll('.user-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update viewing user text
                const user = allUsers.find(u => u.id === viewingUserId);
                document.getElementById('viewing-user').textContent = 
                    viewingUserId === currentUser.id ? 'Your Timeline' : `${user.name}'s Timeline`;
                
                // Load timeline
                loadTimeline(viewingUserId, currentDate);
            });
        });
        
        // Set viewing user text
        const viewingUser = allUsers.find(u => u.id === viewingUserId);
        document.getElementById('viewing-user').textContent = 
            viewingUserId === currentUser.id ? 'Your Timeline' : `${viewingUser?.name || 'User'}'s Timeline`;
        
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

// Generate timeline grid (24 hours)
function generateTimelineGrid() {
    const grid = document.getElementById('timeline-grid');
    
    grid.innerHTML = '';
    
    for (let hour = 0; hour < 24; hour++) {
        const hourLabel = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
        
        const hourRow = document.createElement('div');
        hourRow.className = 'timeline-hour';
        hourRow.dataset.hour = hour;
        hourRow.innerHTML = `
            <div class="hour-label">${hourLabel}</div>
            <div class="hour-bar"></div>
        `;
        
        grid.appendChild(hourRow);
    }
    
    // Add current time indicator if viewing today
    updateCurrentTimeIndicator();
}

// Update current time indicator
function updateCurrentTimeIndicator() {
    // Remove existing indicator
    const existing = document.querySelector('.current-time-line');
    if (existing) existing.remove();
    
    // Only show if viewing today
    if (currentDate !== getTodayDate()) return;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const hourRow = document.querySelector(`.timeline-hour[data-hour="${currentHour}"]`);
    if (!hourRow) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'current-time-line';
    indicator.style.top = `${(currentMinute / 60) * 50}px`;
    
    hourRow.querySelector('.hour-bar').appendChild(indicator);
}

// Load timeline
async function loadTimeline(userId, date) {
    try {
        const data = await apiCall(`/api/timeline/${userId}/date/${date}`);
        
        // Clear existing task blocks
        document.querySelectorAll('.task-block').forEach(el => el.remove());
        
        // Render sessions
        if (data.sessions && data.sessions.length > 0) {
            renderSessions(data.sessions);
        }
        
        // Update summary
        updateTimelineSummary(data.summary);
        
        // Update current time indicator
        updateCurrentTimeIndicator();
        
    } catch (error) {
        console.error('Failed to load timeline:', error);
        showToast('Failed to load timeline', 'error');
    }
}

// Render sessions on timeline
function renderSessions(sessions) {
    sessions.forEach(session => {
        if (!session.started_at) return;
        
        const startTime = new Date(session.started_at);
        const endTime = session.ended_at ? new Date(session.ended_at) : new Date();
        const durationMinutes = session.duration_minutes || Math.floor((endTime - startTime) / 60000);
        
        const startHour = startTime.getHours();
        const startMinute = startTime.getMinutes();
        const subjectLower = (session.subject || 'other').toLowerCase();
        
        // Calculate position and height
        const topPosition = startMinute;
        const height = Math.max(durationMinutes, 20); // Minimum height for visibility
        
        // Create task block
        const taskBlock = document.createElement('div');
        taskBlock.className = `task-block ${subjectLower}`;
        taskBlock.style.top = `${topPosition}px`;
        taskBlock.style.height = `${Math.min(height, 50 - topPosition)}px`;
        taskBlock.innerHTML = `
            <div class="task-block-content">
                <div class="task-block-name">${session.task_name}</div>
                <div class="task-block-duration">${formatMinutes(durationMinutes)}</div>
            </div>
        `;
        
        // Add to appropriate hour
        const hourBar = document.querySelector(`.timeline-hour[data-hour="${startHour}"] .hour-bar`);
        if (hourBar) {
            hourBar.appendChild(taskBlock);
        }
        
        // If task spans multiple hours, create additional blocks
        if (durationMinutes > (60 - startMinute)) {
            let remainingMinutes = durationMinutes - (60 - startMinute);
            let currentHour = startHour + 1;
            
            while (remainingMinutes > 0 && currentHour < 24) {
                const blockHeight = Math.min(remainingMinutes, 50);
                
                const spanBlock = document.createElement('div');
                spanBlock.className = `task-block ${subjectLower}`;
                spanBlock.style.top = '0px';
                spanBlock.style.height = `${blockHeight}px`;
                spanBlock.innerHTML = `
                    <div class="task-block-content">
                        <div class="task-block-name">${session.task_name}</div>
                    </div>
                `;
                
                const spanHourBar = document.querySelector(`.timeline-hour[data-hour="${currentHour}"] .hour-bar`);
                if (spanHourBar) {
                    spanHourBar.appendChild(spanBlock);
                }
                
                remainingMinutes -= 60;
                currentHour++;
            }
        }
    });
}

// Update timeline summary
function updateTimelineSummary(summary) {
    document.getElementById('timeline-total-hours').textContent = formatMinutes(summary.total_study_minutes);
    document.getElementById('timeline-sessions').textContent = summary.total_sessions;
    document.getElementById('timeline-productive-hour').textContent = summary.most_productive_hour || '-';
    
    // Count subjects
    const subjects = Object.keys(summary.subject_breakdown || {});
    document.getElementById('timeline-subjects').textContent = subjects.length > 0 ? subjects.join(', ') : '-';
}

// Load comparison view
async function loadComparisonView() {
    const container = document.getElementById('comparison-view');
    
    try {
        const data = await apiCall('/api/timeline/all/today');
        
        container.innerHTML = Object.entries(data.users).map(([userId, userData]) => {
            const user = allUsers.find(u => u.id === parseInt(userId));
            if (!user) return '';
            
            const gradient = getGradientForUser(user.id);
            
            // Generate mini timeline
            let miniTimelineHtml = '';
            for (let hour = 6; hour < 24; hour += 2) {
                miniTimelineHtml += `
                    <div class="mini-hour">
                        <div class="mini-hour-label">${hour}</div>
                        <div class="mini-hour-bar"></div>
                    </div>
                `;
            }
            
            return `
                <div class="comparison-user">
                    <h4>
                        <div class="avatar avatar-sm gradient-${gradient}">${user.name.charAt(0)}</div>
                        ${user.name}
                    </h4>
                    <div class="mini-timeline">
                        ${miniTimelineHtml}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Failed to load comparison:', error);
    }
}

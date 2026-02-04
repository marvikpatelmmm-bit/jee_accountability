/**
 * Dashboard Module for JEE Study Tracker
 */

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Only run on dashboard page
    if (!document.getElementById('tasksList')) return;

    // Check for active task on load
    await checkActiveTask();
});

// Check if user has an active task
async function checkActiveTask() {
    try {
        const feed = await api('/api/feed/active');
        if (!feed) return;

        const currentUser = feed.find(u => u.id === window.currentUser?.id);
        if (currentUser && currentUser.activeTask) {
            // User has an active task, restore the timer
            const tasks = await api('/api/tasks/today');
            const activeTask = tasks.find(t => t.id === currentUser.activeTask.id);
            if (activeTask) {
                startTaskTimer(activeTask);
            }
        }
    } catch (error) {
        console.error('Failed to check active task:', error);
    }
}

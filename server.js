const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./jee_study.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

// Initialize database tables
function initDatabase() {
    db.exec(`
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            profile_picture TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            current_streak INTEGER DEFAULT 0,
            best_streak INTEGER DEFAULT 0,
            last_active_date DATE
        );

        -- Tasks table
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_name TEXT NOT NULL,
            subject TEXT NOT NULL,
            estimated_minutes INTEGER NOT NULL,
            actual_minutes INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            started_at DATETIME,
            completed_at DATETIME,
            paused_at DATETIME,
            task_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        -- Task sessions table (for timeline tracking)
        CREATE TABLE IF NOT EXISTS task_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_id INTEGER NOT NULL,
            started_at DATETIME NOT NULL,
            ended_at DATETIME,
            duration_minutes INTEGER DEFAULT 0,
            end_reason TEXT,
            session_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (task_id) REFERENCES tasks(id)
        );

        -- Daily summaries table
        CREATE TABLE IF NOT EXISTS daily_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            summary_date DATE NOT NULL,
            maths_problems INTEGER DEFAULT 0,
            physics_problems INTEGER DEFAULT 0,
            chemistry_problems INTEGER DEFAULT 0,
            topics_covered TEXT,
            total_study_hours REAL DEFAULT 0,
            notes TEXT,
            self_rating INTEGER CHECK(self_rating >= 1 AND self_rating <= 5),
            tasks_completed INTEGER DEFAULT 0,
            tasks_total INTEGER DEFAULT 0,
            tasks_ontime INTEGER DEFAULT 0,
            tasks_delayed INTEGER DEFAULT 0,
            success_rate REAL DEFAULT 0,
            ended_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, summary_date)
        );

        -- Active sessions table (for real-time tracking)
        CREATE TABLE IF NOT EXISTS active_sessions (
            user_id INTEGER PRIMARY KEY,
            active_task_id INTEGER,
            active_session_id INTEGER,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (active_task_id) REFERENCES tasks(id),
            FOREIGN KEY (active_session_id) REFERENCES task_sessions(id)
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, task_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON task_sessions(user_id, session_date);
        CREATE INDEX IF NOT EXISTS idx_sessions_date ON task_sessions(session_date);
        CREATE INDEX IF NOT EXISTS idx_summaries_user_date ON daily_summaries(user_id, summary_date);
    `, (err) => {
        if (err) {
            console.error('Error creating tables:', err);
        } else {
            console.log('Database tables initialized');
        }
    });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'jee-study-tracker-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

// Helper: Run database query with promise
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Helper: Get today's date
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// ============================================
// AUTH ROUTES
// ============================================

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, name } = req.body;
        
        if (!username || !password || !name) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        // Check if username exists
        const existing = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const result = await dbRun(
            'INSERT INTO users (username, password, name) VALUES (?, ?, ?)',
            [username, hashedPassword, name]
        );
        
        // Set session
        req.session.userId = result.lastID;
        
        res.json({
            success: true,
            user: { id: result.lastID, username, name }
        });
        
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        // Find user
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Set session
        req.session.userId = user.id;
        
        // Update last seen
        await dbRun('UPDATE users SET last_active_date = ? WHERE id = ?', [getTodayDate(), user.id]);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                current_streak: user.current_streak,
                best_streak: user.best_streak
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout
app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get current user
app.get('/api/current-user', requireAuth, async (req, res) => {
    try {
        const user = await dbGet(
            'SELECT id, username, name, created_at, current_streak, best_streak FROM users WHERE id = ?',
            [req.session.userId]
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
        
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// ============================================
// TASK ROUTES
// ============================================

// Batch add tasks
app.post('/api/tasks/batch-add', requireAuth, async (req, res) => {
    try {
        const { tasks } = req.body;
        const userId = req.session.userId;
        const today = getTodayDate();
        
        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
            return res.status(400).json({ error: 'No tasks provided' });
        }
        
        const createdTasks = [];
        
        for (const task of tasks) {
            const { task_name, subject, estimated_minutes } = task;
            const taskDate = task.task_date || today;
            
            if (!task_name || !subject || !estimated_minutes) {
                continue;
            }
            
            const result = await dbRun(
                `INSERT INTO tasks (user_id, task_name, subject, estimated_minutes, task_date)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, task_name, subject, estimated_minutes, taskDate]
            );
            
            createdTasks.push({
                id: result.lastID,
                task_name,
                subject,
                estimated_minutes,
                task_date: taskDate,
                status: 'pending'
            });
        }
        
        res.json({ success: true, tasks: createdTasks });
        
    } catch (error) {
        console.error('Batch add error:', error);
        res.status(500).json({ error: 'Failed to add tasks' });
    }
});

// Get today's tasks
app.get('/api/tasks/today', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const today = getTodayDate();
        
        const tasks = await dbAll(
            `SELECT * FROM tasks WHERE user_id = ? AND task_date = ? ORDER BY created_at`,
            [userId, today]
        );
        
        res.json({ tasks });
        
    } catch (error) {
        console.error('Get today tasks error:', error);
        res.status(500).json({ error: 'Failed to get tasks' });
    }
});

// Get single task
app.get('/api/tasks/:taskId', requireAuth, async (req, res) => {
    try {
        const { taskId } = req.params;
        
        const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [taskId]);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        res.json({ task });
        
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ error: 'Failed to get task' });
    }
});

// Start task (with auto-stop of current task)
app.post('/api/tasks/:taskId/start', requireAuth, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.session.userId;
        const now = new Date().toISOString();
        const today = getTodayDate();
        
        // Check if task belongs to user
        const task = await dbGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        let previousTaskStopped = false;
        let previousTaskName = null;
        
        // Check for any active task and stop it
        const activeSession = await dbGet(
            'SELECT * FROM active_sessions WHERE user_id = ?',
            [userId]
        );
        
        if (activeSession && activeSession.active_task_id) {
            // Get the active task
            const activeTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [activeSession.active_task_id]);
            
            if (activeTask && activeTask.id !== parseInt(taskId)) {
                previousTaskStopped = true;
                previousTaskName = activeTask.task_name;
                
                // End the current session
                const currentSession = await dbGet(
                    'SELECT * FROM task_sessions WHERE id = ?',
                    [activeSession.active_session_id]
                );
                
                if (currentSession) {
                    const duration = Math.floor((new Date(now) - new Date(currentSession.started_at)) / 60000);
                    
                    await dbRun(
                        `UPDATE task_sessions SET ended_at = ?, duration_minutes = ?, end_reason = 'switched'
                         WHERE id = ?`,
                        [now, duration, currentSession.id]
                    );
                    
                    // Update the task's actual_minutes
                    await dbRun(
                        `UPDATE tasks SET actual_minutes = actual_minutes + ?, status = 'paused'
                         WHERE id = ?`,
                        [duration, activeTask.id]
                    );
                }
            }
        }
        
        // Create new session
        const sessionResult = await dbRun(
            `INSERT INTO task_sessions (user_id, task_id, started_at, session_date)
             VALUES (?, ?, ?, ?)`,
            [userId, taskId, now, today]
        );
        
        // Update task status
        await dbRun(
            `UPDATE tasks SET status = 'in_progress', started_at = COALESCE(started_at, ?)
             WHERE id = ?`,
            [now, taskId]
        );
        
        // Update active sessions
        await dbRun(
            `INSERT OR REPLACE INTO active_sessions (user_id, active_task_id, active_session_id, last_seen)
             VALUES (?, ?, ?, ?)`,
            [userId, taskId, sessionResult.lastID, now]
        );
        
        // Get updated task
        const updatedTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [taskId]);
        
        res.json({
            success: true,
            task: updatedTask,
            session_id: sessionResult.lastID,
            previous_task_stopped: previousTaskStopped,
            previous_task_name: previousTaskName
        });
        
    } catch (error) {
        console.error('Start task error:', error);
        res.status(500).json({ error: 'Failed to start task' });
    }
});

// Complete task
app.post('/api/tasks/:taskId/complete', requireAuth, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.session.userId;
        const now = new Date().toISOString();
        
        // Get task
        const task = await dbGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        // End current session
        const activeSession = await dbGet(
            'SELECT * FROM active_sessions WHERE user_id = ?',
            [userId]
        );
        
        if (activeSession && activeSession.active_session_id) {
            const currentSession = await dbGet(
                'SELECT * FROM task_sessions WHERE id = ?',
                [activeSession.active_session_id]
            );
            
            if (currentSession) {
                const duration = Math.floor((new Date(now) - new Date(currentSession.started_at)) / 60000);
                
                await dbRun(
                    `UPDATE task_sessions SET ended_at = ?, duration_minutes = ?, end_reason = 'completed'
                     WHERE id = ?`,
                    [now, duration, currentSession.id]
                );
            }
        }
        
        // Calculate total actual minutes
        const sessions = await dbAll(
            'SELECT SUM(duration_minutes) as total FROM task_sessions WHERE task_id = ?',
            [taskId]
        );
        const totalMinutes = (sessions[0]?.total || 0);
        
        // Determine status
        const status = totalMinutes <= task.estimated_minutes ? 'completed_ontime' : 'completed_delayed';
        
        // Update task
        await dbRun(
            `UPDATE tasks SET status = ?, actual_minutes = ?, completed_at = ?
             WHERE id = ?`,
            [status, totalMinutes, now, taskId]
        );
        
        // Clear active session
        await dbRun('DELETE FROM active_sessions WHERE user_id = ?', [userId]);
        
        // Get updated task
        const updatedTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [taskId]);
        
        res.json({
            success: true,
            task: updatedTask,
            status
        });
        
    } catch (error) {
        console.error('Complete task error:', error);
        res.status(500).json({ error: 'Failed to complete task' });
    }
});

// Stop task (without completing)
app.post('/api/tasks/:taskId/stop', requireAuth, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.session.userId;
        const now = new Date().toISOString();
        
        // Get task
        const task = await dbGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        // End current session
        const activeSession = await dbGet(
            'SELECT * FROM active_sessions WHERE user_id = ?',
            [userId]
        );
        
        let timeLogged = 0;
        
        if (activeSession && activeSession.active_session_id) {
            const currentSession = await dbGet(
                'SELECT * FROM task_sessions WHERE id = ?',
                [activeSession.active_session_id]
            );
            
            if (currentSession) {
                const duration = Math.floor((new Date(now) - new Date(currentSession.started_at)) / 60000);
                timeLogged = duration;
                
                await dbRun(
                    `UPDATE task_sessions SET ended_at = ?, duration_minutes = ?, end_reason = 'stopped'
                     WHERE id = ?`,
                    [now, duration, currentSession.id]
                );
            }
        }
        
        // Calculate total actual minutes
        const sessions = await dbAll(
            'SELECT SUM(duration_minutes) as total FROM task_sessions WHERE task_id = ?',
            [taskId]
        );
        const totalMinutes = (sessions[0]?.total || 0);
        
        // Update task
        await dbRun(
            `UPDATE tasks SET status = 'stopped', actual_minutes = ?, paused_at = ?
             WHERE id = ?`,
            [totalMinutes, now, taskId]
        );
        
        // Clear active session
        await dbRun('DELETE FROM active_sessions WHERE user_id = ?', [userId]);
        
        // Get updated task
        const updatedTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [taskId]);
        
        res.json({
            success: true,
            task: updatedTask,
            time_logged_minutes: timeLogged
        });
        
    } catch (error) {
        console.error('Stop task error:', error);
        res.status(500).json({ error: 'Failed to stop task' });
    }
});

// Pause task
app.post('/api/tasks/:taskId/pause', requireAuth, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.session.userId;
        const now = new Date().toISOString();
        
        // Get task
        const task = await dbGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        // End current session
        const activeSession = await dbGet(
            'SELECT * FROM active_sessions WHERE user_id = ?',
            [userId]
        );
        
        if (activeSession && activeSession.active_session_id) {
            const currentSession = await dbGet(
                'SELECT * FROM task_sessions WHERE id = ?',
                [activeSession.active_session_id]
            );
            
            if (currentSession) {
                const duration = Math.floor((new Date(now) - new Date(currentSession.started_at)) / 60000);
                
                await dbRun(
                    `UPDATE task_sessions SET ended_at = ?, duration_minutes = ?, end_reason = 'paused'
                     WHERE id = ?`,
                    [now, duration, currentSession.id]
                );
            }
        }
        
        // Calculate total actual minutes
        const sessions = await dbAll(
            'SELECT SUM(duration_minutes) as total FROM task_sessions WHERE task_id = ?',
            [taskId]
        );
        const totalMinutes = (sessions[0]?.total || 0);
        
        // Update task
        await dbRun(
            `UPDATE tasks SET status = 'paused', actual_minutes = ?, paused_at = ?
             WHERE id = ?`,
            [totalMinutes, now, taskId]
        );
        
        // Clear active session
        await dbRun('DELETE FROM active_sessions WHERE user_id = ?', [userId]);
        
        // Get updated task
        const updatedTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [taskId]);
        
        res.json({ success: true, task: updatedTask });
        
    } catch (error) {
        console.error('Pause task error:', error);
        res.status(500).json({ error: 'Failed to pause task' });
    }
});

// Delete task
app.delete('/api/tasks/:taskId', requireAuth, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.session.userId;
        
        // Get task
        const task = await dbGet('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        // Cannot delete in_progress or completed tasks
        if (task.status === 'in_progress') {
            return res.status(400).json({ error: 'Cannot delete an active task. Stop it first.' });
        }
        
        if (task.status === 'completed_ontime' || task.status === 'completed_delayed') {
            return res.status(400).json({ error: 'Cannot delete completed tasks' });
        }
        
        // Delete task
        await dbRun('DELETE FROM tasks WHERE id = ?', [taskId]);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// ============================================
// USER DATA ROUTES (FULL TRANSPARENCY)
// ============================================

// Get all users
app.get('/api/users', requireAuth, async (req, res) => {
    try {
        const today = getTodayDate();
        
        const users = await dbAll(`
            SELECT 
                u.id, u.username, u.name, u.created_at, 
                u.current_streak, u.best_streak
            FROM users u
            ORDER BY u.name
        `);
        
        // Get today's stats for each user
        for (const user of users) {
            const todayTasks = await dbAll(
                `SELECT * FROM tasks WHERE user_id = ? AND task_date = ?`,
                [user.id, today]
            );
            
            const completed = todayTasks.filter(t => 
                t.status === 'completed_ontime' || t.status === 'completed_delayed'
            );
            const ontime = todayTasks.filter(t => t.status === 'completed_ontime');
            const pending = todayTasks.filter(t => t.status === 'pending');
            const inProgress = todayTasks.filter(t => t.status === 'in_progress');
            
            const totalMinutes = completed.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
            
            user.today_stats = {
                tasks_completed: completed.length,
                tasks_pending: pending.length,
                tasks_in_progress: inProgress.length,
                total_minutes: totalMinutes,
                success_rate: completed.length > 0 
                    ? Math.round((ontime.length / completed.length) * 100) 
                    : 0
            };
        }
        
        res.json({ users });
        
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get user's complete profile
app.get('/api/users/:userId/profile', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await dbGet(
            `SELECT id, username, name, created_at, current_streak, best_streak 
             FROM users WHERE id = ?`,
            [userId]
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Overall stats
        const allTasks = await dbAll(
            `SELECT * FROM tasks WHERE user_id = ? AND 
             (status = 'completed_ontime' OR status = 'completed_delayed')`,
            [userId]
        );
        
        const allSummaries = await dbAll(
            'SELECT * FROM daily_summaries WHERE user_id = ?',
            [userId]
        );
        
        const totalProblems = allSummaries.reduce((sum, s) => 
            sum + s.maths_problems + s.physics_problems + s.chemistry_problems, 0
        );
        
        const totalHours = allTasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0) / 60;
        const ontimeTasks = allTasks.filter(t => t.status === 'completed_ontime').length;
        
        // This week stats
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        const weekTasks = await dbAll(
            `SELECT * FROM tasks WHERE user_id = ? AND task_date >= ? AND 
             (status = 'completed_ontime' OR status = 'completed_delayed')`,
            [userId, weekStartStr]
        );
        
        const weekSummaries = await dbAll(
            'SELECT * FROM daily_summaries WHERE user_id = ? AND summary_date >= ?',
            [userId, weekStartStr]
        );
        
        const weekProblems = weekSummaries.reduce((sum, s) => 
            sum + s.maths_problems + s.physics_problems + s.chemistry_problems, 0
        );
        
        const weekHours = weekTasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0) / 60;
        const weekOntime = weekTasks.filter(t => t.status === 'completed_ontime').length;
        
        // Subject breakdown
        const subjectBreakdown = {
            maths: { tasks: 0, hours: 0, problems: 0 },
            physics: { tasks: 0, hours: 0, problems: 0 },
            chemistry: { tasks: 0, hours: 0, problems: 0 }
        };
        
        for (const task of allTasks) {
            const subject = task.subject.toLowerCase();
            if (subjectBreakdown[subject]) {
                subjectBreakdown[subject].tasks++;
                subjectBreakdown[subject].hours += (task.actual_minutes || 0) / 60;
            }
        }
        
        for (const summary of allSummaries) {
            subjectBreakdown.maths.problems += summary.maths_problems;
            subjectBreakdown.physics.problems += summary.physics_problems;
            subjectBreakdown.chemistry.problems += summary.chemistry_problems;
        }
        
        res.json({
            user,
            overall_stats: {
                total_tasks: allTasks.length,
                completed_tasks: allTasks.length,
                total_hours: Math.round(totalHours * 10) / 10,
                total_problems: totalProblems,
                success_rate: allTasks.length > 0 ? Math.round((ontimeTasks / allTasks.length) * 100) : 0,
                avg_rating: allSummaries.length > 0 
                    ? Math.round((allSummaries.reduce((sum, s) => sum + (s.self_rating || 0), 0) / allSummaries.length) * 10) / 10
                    : 0
            },
            this_week_stats: {
                tasks_completed: weekTasks.length,
                tasks_ontime: weekOntime,
                tasks_delayed: weekTasks.length - weekOntime,
                hours: Math.round(weekHours * 10) / 10,
                problems: weekProblems,
                success_rate: weekTasks.length > 0 ? Math.round((weekOntime / weekTasks.length) * 100) : 0
            },
            subject_breakdown: subjectBreakdown
        });
        
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Get user's today's tasks (viewable by everyone)
app.get('/api/users/:userId/tasks/today', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const today = getTodayDate();
        
        const user = await dbGet('SELECT id, name FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const tasks = await dbAll(
            `SELECT * FROM tasks WHERE user_id = ? AND task_date = ? ORDER BY created_at`,
            [userId, today]
        );
        
        const pending = tasks.filter(t => t.status === 'pending');
        const inProgress = tasks.filter(t => t.status === 'in_progress');
        const completed = tasks.filter(t => 
            t.status === 'completed_ontime' || t.status === 'completed_delayed'
        );
        
        res.json({
            user_id: userId,
            user_name: user.name,
            date: today,
            tasks,
            summary: {
                pending: pending.length,
                in_progress: inProgress.length,
                completed: completed.length,
                total_estimated: tasks.reduce((sum, t) => sum + t.estimated_minutes, 0),
                total_actual: completed.reduce((sum, t) => sum + (t.actual_minutes || 0), 0)
            }
        });
        
    } catch (error) {
        console.error('Get user tasks error:', error);
        res.status(500).json({ error: 'Failed to get tasks' });
    }
});

// Get user's active task
app.get('/api/users/:userId/tasks/active', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const activeSession = await dbGet(
            'SELECT * FROM active_sessions WHERE user_id = ?',
            [userId]
        );
        
        if (!activeSession || !activeSession.active_task_id) {
            return res.json({ has_active: false, task: null });
        }
        
        const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [activeSession.active_task_id]);
        const session = await dbGet('SELECT * FROM task_sessions WHERE id = ?', [activeSession.active_session_id]);
        
        const elapsedMinutes = session 
            ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000)
            : 0;
        
        res.json({
            has_active: true,
            task: {
                ...task,
                elapsed_minutes: elapsedMinutes,
                session_id: activeSession.active_session_id
            }
        });
        
    } catch (error) {
        console.error('Get active task error:', error);
        res.status(500).json({ error: 'Failed to get active task' });
    }
});

// Get user's task history
app.get('/api/users/:userId/tasks/history', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate, subject } = req.query;
        
        let sql = `SELECT * FROM tasks WHERE user_id = ? AND 
                   (status = 'completed_ontime' OR status = 'completed_delayed' OR status = 'stopped')`;
        const params = [userId];
        
        if (startDate) {
            sql += ' AND task_date >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            sql += ' AND task_date <= ?';
            params.push(endDate);
        }
        
        if (subject) {
            sql += ' AND subject = ?';
            params.push(subject);
        }
        
        sql += ' ORDER BY task_date DESC, completed_at DESC';
        
        const tasks = await dbAll(sql, params);
        
        const totalHours = tasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0) / 60;
        
        res.json({
            tasks,
            summary: {
                total: tasks.length,
                completed: tasks.filter(t => t.status === 'completed_ontime' || t.status === 'completed_delayed').length,
                hours: Math.round(totalHours * 10) / 10
            }
        });
        
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Failed to get history' });
    }
});

// Get user's daily summary for a date
app.get('/api/users/:userId/summary/:date', requireAuth, async (req, res) => {
    try {
        const { userId, date } = req.params;
        
        const summary = await dbGet(
            'SELECT * FROM daily_summaries WHERE user_id = ? AND summary_date = ?',
            [userId, date]
        );
        
        if (!summary) {
            return res.json({ exists: false, summary: null });
        }
        
        // Get tasks for that day
        const tasks = await dbAll(
            `SELECT * FROM tasks WHERE user_id = ? AND task_date = ? AND
             (status = 'completed_ontime' OR status = 'completed_delayed')`,
            [userId, date]
        );
        
        res.json({
            exists: true,
            summary,
            tasks_that_day: tasks
        });
        
    } catch (error) {
        console.error('Get summary error:', error);
        res.status(500).json({ error: 'Failed to get summary' });
    }
});

// Get user's recent summaries
app.get('/api/users/:userId/summaries', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 7 } = req.query;
        
        const summaries = await dbAll(
            'SELECT * FROM daily_summaries WHERE user_id = ? ORDER BY summary_date DESC LIMIT ?',
            [userId, limit]
        );
        
        res.json({ summaries });
        
    } catch (error) {
        console.error('Get summaries error:', error);
        res.status(500).json({ error: 'Failed to get summaries' });
    }
});

// ============================================
// TIMELINE ENDPOINTS
// ============================================

// Get user's timeline for today
app.get('/api/timeline/:userId/today', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const today = getTodayDate();
        
        const sessions = await dbAll(
            `SELECT ts.*, t.task_name, t.subject 
             FROM task_sessions ts
             JOIN tasks t ON ts.task_id = t.id
             WHERE ts.user_id = ? AND ts.session_date = ?
             ORDER BY ts.started_at`,
            [userId, today]
        );
        
        const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
        
        // Calculate most productive hour
        const hourStats = {};
        sessions.forEach(s => {
            const hour = new Date(s.started_at).getHours();
            hourStats[hour] = (hourStats[hour] || 0) + (s.duration_minutes || 0);
        });
        
        let mostProductiveHour = '-';
        let maxMinutes = 0;
        for (const [hour, minutes] of Object.entries(hourStats)) {
            if (minutes > maxMinutes) {
                maxMinutes = minutes;
                mostProductiveHour = `${hour}:00 - ${parseInt(hour) + 1}:00`;
            }
        }
        
        // Subject breakdown
        const subjectBreakdown = {};
        sessions.forEach(s => {
            if (!subjectBreakdown[s.subject]) {
                subjectBreakdown[s.subject] = 0;
            }
            subjectBreakdown[s.subject] += (s.duration_minutes || 0);
        });
        
        res.json({
            user_id: userId,
            date: today,
            sessions,
            summary: {
                total_study_minutes: totalMinutes,
                total_sessions: sessions.length,
                most_productive_hour: mostProductiveHour,
                subject_breakdown: subjectBreakdown
            }
        });
        
    } catch (error) {
        console.error('Get timeline error:', error);
        res.status(500).json({ error: 'Failed to get timeline' });
    }
});

// Get user's timeline for specific date
app.get('/api/timeline/:userId/date/:date', requireAuth, async (req, res) => {
    try {
        const { userId, date } = req.params;
        
        const sessions = await dbAll(
            `SELECT ts.*, t.task_name, t.subject 
             FROM task_sessions ts
             JOIN tasks t ON ts.task_id = t.id
             WHERE ts.user_id = ? AND ts.session_date = ?
             ORDER BY ts.started_at`,
            [userId, date]
        );
        
        const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
        
        res.json({
            user_id: userId,
            date,
            sessions,
            summary: {
                total_study_minutes: totalMinutes,
                total_sessions: sessions.length
            }
        });
        
    } catch (error) {
        console.error('Get timeline error:', error);
        res.status(500).json({ error: 'Failed to get timeline' });
    }
});

// Get all users' timelines for today
app.get('/api/timeline/all/today', requireAuth, async (req, res) => {
    try {
        const today = getTodayDate();
        
        const users = await dbAll('SELECT id, name FROM users');
        const result = { date: today, users: {} };
        
        for (const user of users) {
            const sessions = await dbAll(
                `SELECT ts.*, t.task_name, t.subject 
                 FROM task_sessions ts
                 JOIN tasks t ON ts.task_id = t.id
                 WHERE ts.user_id = ? AND ts.session_date = ?
                 ORDER BY ts.started_at`,
                [user.id, today]
            );
            
            result.users[user.id] = {
                user_name: user.name,
                sessions
            };
        }
        
        res.json(result);
        
    } catch (error) {
        console.error('Get all timelines error:', error);
        res.status(500).json({ error: 'Failed to get timelines' });
    }
});

// ============================================
// DAILY SUMMARY ROUTES
// ============================================

// End day summary
app.post('/api/summary/end-day', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const today = getTodayDate();
        const now = new Date().toISOString();
        
        const { 
            maths_problems = 0, 
            physics_problems = 0, 
            chemistry_problems = 0,
            topics_covered = '',
            notes = '',
            self_rating = 3
        } = req.body;
        
        // Get today's tasks
        const tasks = await dbAll(
            'SELECT * FROM tasks WHERE user_id = ? AND task_date = ?',
            [userId, today]
        );
        
        const completed = tasks.filter(t => 
            t.status === 'completed_ontime' || t.status === 'completed_delayed'
        );
        const ontime = tasks.filter(t => t.status === 'completed_ontime');
        const delayed = tasks.filter(t => t.status === 'completed_delayed');
        
        const totalMinutes = completed.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
        const totalHours = totalMinutes / 60;
        
        const successRate = completed.length > 0 
            ? Math.round((ontime.length / completed.length) * 100) 
            : 0;
        
        // Check if summary already exists
        const existing = await dbGet(
            'SELECT id FROM daily_summaries WHERE user_id = ? AND summary_date = ?',
            [userId, today]
        );
        
        if (existing) {
            // Update existing
            await dbRun(
                `UPDATE daily_summaries SET
                 maths_problems = ?, physics_problems = ?, chemistry_problems = ?,
                 topics_covered = ?, total_study_hours = ?, notes = ?, self_rating = ?,
                 tasks_completed = ?, tasks_total = ?, tasks_ontime = ?, tasks_delayed = ?,
                 success_rate = ?, ended_at = ?
                 WHERE id = ?`,
                [
                    maths_problems, physics_problems, chemistry_problems,
                    topics_covered, totalHours, notes, self_rating,
                    completed.length, tasks.length, ontime.length, delayed.length,
                    successRate, now, existing.id
                ]
            );
        } else {
            // Create new
            await dbRun(
                `INSERT INTO daily_summaries 
                 (user_id, summary_date, maths_problems, physics_problems, chemistry_problems,
                  topics_covered, total_study_hours, notes, self_rating,
                  tasks_completed, tasks_total, tasks_ontime, tasks_delayed, success_rate, ended_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, today, maths_problems, physics_problems, chemistry_problems,
                    topics_covered, totalHours, notes, self_rating,
                    completed.length, tasks.length, ontime.length, delayed.length,
                    successRate, now
                ]
            );
        }
        
        // Update streak
        const user = await dbGet('SELECT last_active_date, current_streak FROM users WHERE id = ?', [userId]);
        
        let newStreak = 1;
        let streakUpdated = false;
        
        if (user && user.last_active_date) {
            const lastDate = new Date(user.last_active_date);
            const todayDate = new Date(today);
            const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                newStreak = (user.current_streak || 0) + 1;
                streakUpdated = true;
            } else if (diffDays === 0) {
                newStreak = user.current_streak || 1;
            }
        }
        
        await dbRun(
            'UPDATE users SET current_streak = ?, best_streak = MAX(best_streak, ?), last_active_date = ? WHERE id = ?',
            [newStreak, newStreak, today, userId]
        );
        
        res.json({
            success: true,
            summary: {
                summary_date: today,
                maths_problems,
                physics_problems,
                chemistry_problems,
                topics_covered,
                total_study_hours: totalHours,
                notes,
                self_rating,
                tasks_completed: completed.length,
                tasks_total: tasks.length,
                tasks_ontime: ontime.length,
                tasks_delayed: delayed.length,
                success_rate: successRate,
                ended_at: now
            },
            streak_updated: streakUpdated,
            new_streak: newStreak
        });
        
    } catch (error) {
        console.error('End day error:', error);
        res.status(500).json({ error: 'Failed to end day' });
    }
});

// Get today's summary
app.get('/api/summary/today', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const today = getTodayDate();
        
        const summary = await dbGet(
            'SELECT * FROM daily_summaries WHERE user_id = ? AND summary_date = ?',
            [userId, today]
        );
        
        res.json({ exists: !!summary, summary });
        
    } catch (error) {
        console.error('Get summary error:', error);
        res.status(500).json({ error: 'Failed to get summary' });
    }
});

// Check if day has been ended
app.get('/api/summary/check/:date', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { date } = req.params;
        
        const summary = await dbGet(
            'SELECT id FROM daily_summaries WHERE user_id = ? AND summary_date = ?',
            [userId, date]
        );
        
        res.json({ ended: !!summary });
        
    } catch (error) {
        console.error('Check summary error:', error);
        res.status(500).json({ error: 'Failed to check summary' });
    }
});

// ============================================
// LIVE FEED ENDPOINTS
// ============================================

// Get active feed
app.get('/api/feed/active', requireAuth, async (req, res) => {
    try {
        const today = getTodayDate();
        
        const users = await dbAll(`
            SELECT u.id, u.name, u.current_streak,
                   a.active_task_id, a.last_seen
            FROM users u
            LEFT JOIN active_sessions a ON u.id = a.user_id
            ORDER BY u.name
        `);
        
        const result = [];
        let groupStats = { total_tasks: 0, total_hours: 0, avg_success: 0 };
        
        for (const user of users) {
            // Get today's tasks
            const tasks = await dbAll(
                'SELECT * FROM tasks WHERE user_id = ? AND task_date = ?',
                [user.id, today]
            );
            
            const completed = tasks.filter(t => 
                t.status === 'completed_ontime' || t.status === 'completed_delayed'
            );
            const ontime = tasks.filter(t => t.status === 'completed_ontime');
            const inProgress = tasks.filter(t => t.status === 'in_progress');
            
            const totalMinutes = completed.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
            
            // Get active task details
            let activeTask = null;
            if (user.active_task_id) {
                const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [user.active_task_id]);
                const session = await dbGet(
                    'SELECT * FROM task_sessions WHERE task_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
                    [user.active_task_id]
                );
                
                if (task && session) {
                    const elapsedMinutes = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000);
                    activeTask = {
                        task_name: task.task_name,
                        subject: task.subject,
                        started_at: session.started_at,
                        elapsed_minutes: elapsedMinutes
                    };
                }
            }
            
            // Calculate last seen
            let lastSeen = 'Never';
            let isOnline = false;
            
            if (user.last_seen) {
                const lastSeenDate = new Date(user.last_seen);
                const now = new Date();
                const diffMinutes = Math.floor((now - lastSeenDate) / 60000);
                
                if (diffMinutes < 2) {
                    lastSeen = 'Just now';
                    isOnline = true;
                } else if (diffMinutes < 60) {
                    lastSeen = `${diffMinutes} min ago`;
                } else {
                    const diffHours = Math.floor(diffMinutes / 60);
                    lastSeen = `${diffHours}h ago`;
                }
            }
            
            result.push({
                id: user.id,
                name: user.name,
                is_online: isOnline || !!activeTask,
                last_seen: lastSeen,
                active_task: activeTask,
                today_stats: {
                    tasks_completed: completed.length,
                    tasks_pending: tasks.filter(t => t.status === 'pending').length,
                    tasks_in_progress: inProgress.length,
                    hours_studied: Math.round((totalMinutes / 60) * 10) / 10,
                    success_rate: completed.length > 0 ? Math.round((ontime.length / completed.length) * 100) : 0
                },
                streak: user.current_streak || 0
            });
            
            // Update group stats
            groupStats.total_tasks += completed.length;
            groupStats.total_hours += totalMinutes / 60;
        }
        
        // Calculate average success rate
        const successRates = result.map(u => u.today_stats.success_rate).filter(r => r > 0);
        groupStats.avg_success = successRates.length > 0 
            ? Math.round(successRates.reduce((a, b) => a + b, 0) / successRates.length) 
            : 0;
        groupStats.total_hours = Math.round(groupStats.total_hours * 10) / 10;
        
        res.json({ users: result, groupStats });
        
    } catch (error) {
        console.error('Get feed error:', error);
        res.status(500).json({ error: 'Failed to get feed' });
    }
});

// SSE stream for real-time updates
app.get('/api/stream', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial data
    const sendUpdate = async () => {
        try {
            const today = getTodayDate();
            
            const users = await dbAll(`
                SELECT u.id, u.name, u.current_streak,
                       a.active_task_id, a.last_seen
                FROM users u
                LEFT JOIN active_sessions a ON u.id = a.user_id
                ORDER BY u.name
            `);
            
            const result = [];
            
            for (const user of users) {
                const tasks = await dbAll(
                    'SELECT * FROM tasks WHERE user_id = ? AND task_date = ?',
                    [user.id, today]
                );
                
                const completed = tasks.filter(t => 
                    t.status === 'completed_ontime' || t.status === 'completed_delayed'
                );
                const ontime = tasks.filter(t => t.status === 'completed_ontime');
                
                const totalMinutes = completed.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
                
                let activeTask = null;
                if (user.active_task_id) {
                    const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [user.active_task_id]);
                    const session = await dbGet(
                        'SELECT * FROM task_sessions WHERE task_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
                        [user.active_task_id]
                    );
                    
                    if (task && session) {
                        const elapsedMinutes = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000);
                        activeTask = {
                            task_name: task.task_name,
                            subject: task.subject,
                            started_at: session.started_at,
                            elapsed_minutes: elapsedMinutes
                        };
                    }
                }
                
                let lastSeen = 'Never';
                let isOnline = false;
                
                if (user.last_seen) {
                    const lastSeenDate = new Date(user.last_seen);
                    const now = new Date();
                    const diffMinutes = Math.floor((now - lastSeenDate) / 60000);
                    
                    if (diffMinutes < 2) {
                        lastSeen = 'Just now';
                        isOnline = true;
                    } else if (diffMinutes < 60) {
                        lastSeen = `${diffMinutes} min ago`;
                    } else {
                        const diffHours = Math.floor(diffMinutes / 60);
                        lastSeen = `${diffHours}h ago`;
                    }
                }
                
                result.push({
                    id: user.id,
                    name: user.name,
                    is_online: isOnline || !!activeTask,
                    last_seen: lastSeen,
                    active_task: activeTask,
                    today_stats: {
                        tasks_completed: completed.length,
                        tasks_pending: tasks.filter(t => t.status === 'pending').length,
                        hours_studied: Math.round((totalMinutes / 60) * 10) / 10,
                        success_rate: completed.length > 0 ? Math.round((ontime.length / completed.length) * 100) : 0
                    },
                    streak: user.current_streak || 0
                });
            }
            
            res.write(`data: ${JSON.stringify({ users: result })}

`);
        } catch (error) {
            console.error('SSE update error:', error);
        }
    };
    
    // Send update immediately
    sendUpdate();
    
    // Send updates every 5 seconds
    const interval = setInterval(sendUpdate, 5000);
    
    // Clean up on client disconnect
    req.on('close', () => {
        clearInterval(interval);
    });
});

// ============================================
// LEADERBOARD ENDPOINTS
// ============================================

// Get leaderboard
app.get('/api/leaderboard/:period/:category', requireAuth, async (req, res) => {
    try {
        const { period, category } = req.params;
        
        let dateFilter = '';
        const today = new Date();
        
        if (period === 'weekly') {
            const weekStart = new Date(today);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            dateFilter = weekStart.toISOString().split('T')[0];
        } else if (period === 'monthly') {
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            dateFilter = monthStart.toISOString().split('T')[0];
        }
        
        const users = await dbAll('SELECT id, name FROM users');
        const rankings = [];
        
        for (const user of users) {
            let primaryValue = 0;
            let secondaryStats = {
                tasks_completed: 0,
                tasks_ontime: 0,
                problems_total: 0,
                hours_total: 0,
                success_rate: 0
            };
            
            if (period === 'alltime') {
                // All-time stats
                const tasks = await dbAll(
                    `SELECT * FROM tasks WHERE user_id = ? AND 
                     (status = 'completed_ontime' OR status = 'completed_delayed')`,
                    [user.id]
                );
                
                const summaries = await dbAll(
                    'SELECT * FROM daily_summaries WHERE user_id = ?',
                    [user.id]
                );
                
                const totalMinutes = tasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
                const ontime = tasks.filter(t => t.status === 'completed_ontime').length;
                const problems = summaries.reduce((sum, s) => 
                    sum + s.maths_problems + s.physics_problems + s.chemistry_problems, 0
                );
                
                secondaryStats = {
                    tasks_completed: tasks.length,
                    tasks_ontime: ontime,
                    problems_total: problems,
                    hours_total: Math.round((totalMinutes / 60) * 10) / 10,
                    success_rate: tasks.length > 0 ? Math.round((ontime / tasks.length) * 100) : 0
                };
                
                if (category === 'hours') primaryValue = secondaryStats.hours_total;
                else if (category === 'problems') primaryValue = secondaryStats.problems_total;
                else if (category === 'success') primaryValue = secondaryStats.success_rate;
                else if (category === 'tasks') primaryValue = secondaryStats.tasks_completed;
                
            } else {
                // Weekly/Monthly stats
                const tasks = await dbAll(
                    `SELECT * FROM tasks WHERE user_id = ? AND task_date >= ? AND 
                     (status = 'completed_ontime' OR status = 'completed_delayed')`,
                    [user.id, dateFilter]
                );
                
                const summaries = await dbAll(
                    'SELECT * FROM daily_summaries WHERE user_id = ? AND summary_date >= ?',
                    [user.id, dateFilter]
                );
                
                const totalMinutes = tasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
                const ontime = tasks.filter(t => t.status === 'completed_ontime').length;
                const problems = summaries.reduce((sum, s) => 
                    sum + s.maths_problems + s.physics_problems + s.chemistry_problems, 0
                );
                
                secondaryStats = {
                    tasks_completed: tasks.length,
                    tasks_ontime: ontime,
                    problems_total: problems,
                    hours_total: Math.round((totalMinutes / 60) * 10) / 10,
                    success_rate: tasks.length > 0 ? Math.round((ontime / tasks.length) * 100) : 0
                };
                
                if (category === 'hours') primaryValue = secondaryStats.hours_total;
                else if (category === 'problems') primaryValue = secondaryStats.problems_total;
                else if (category === 'success') primaryValue = secondaryStats.success_rate;
                else if (category === 'tasks') primaryValue = secondaryStats.tasks_completed;
            }
            
            rankings.push({
                user_id: user.id,
                user_name: user.name,
                primary_value: primaryValue,
                secondary_stats: secondaryStats
            });
        }
        
        // Sort by primary value (descending)
        rankings.sort((a, b) => b.primary_value - a.primary_value);
        
        // Add rank
        rankings.forEach((r, i) => {
            r.rank = i + 1;
        });
        
        res.json({
            period,
            category,
            generated_at: new Date().toISOString(),
            rankings
        });
        
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Failed to get leaderboard' });
    }
});

// ============================================
// STATS ENDPOINTS
// ============================================

// Get app overview stats
app.get('/api/stats/overview', requireAuth, async (req, res) => {
    try {
        const today = getTodayDate();
        
        const totalUsers = await dbGet('SELECT COUNT(*) as count FROM users');
        
        const todayTasks = await dbAll(
            `SELECT * FROM tasks WHERE task_date = ? AND 
             (status = 'completed_ontime' OR status = 'completed_delayed')`,
            [today]
        );
        
        const totalMinutes = todayTasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
        
        // Get most active user today
        const users = await dbAll('SELECT id, name FROM users');
        let mostActiveUser = null;
        let maxMinutes = 0;
        
        for (const user of users) {
            const userTasks = await dbAll(
                `SELECT * FROM tasks WHERE user_id = ? AND task_date = ? AND 
                 (status = 'completed_ontime' OR status = 'completed_delayed')`,
                [user.id, today]
            );
            const userMinutes = userTasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
            
            if (userMinutes > maxMinutes) {
                maxMinutes = userMinutes;
                mostActiveUser = user.name;
            }
        }
        
        res.json({
            total_users: totalUsers.count,
            total_tasks_today: todayTasks.length,
            total_hours_today: Math.round((totalMinutes / 60) * 10) / 10,
            most_active_user_today: mostActiveUser || 'No one yet'
        });
        
    } catch (error) {
        console.error('Get overview error:', error);
        res.status(500).json({ error: 'Failed to get overview' });
    }
});

// Get user's weekly stats
app.get('/api/stats/user/:userId/weekly', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const days = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const tasks = await dbAll(
                `SELECT * FROM tasks WHERE user_id = ? AND task_date = ? AND 
                 (status = 'completed_ontime' OR status = 'completed_delayed')`,
                [userId, dateStr]
            );
            
            const summary = await dbGet(
                'SELECT * FROM daily_summaries WHERE user_id = ? AND summary_date = ?',
                [userId, dateStr]
            );
            
            const totalMinutes = tasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
            const problems = summary 
                ? summary.maths_problems + summary.physics_problems + summary.chemistry_problems 
                : 0;
            
            days.push({
                date: dateStr,
                day_name: date.toLocaleDateString('en-US', { weekday: 'short' }),
                hours: Math.round((totalMinutes / 60) * 10) / 10,
                tasks: tasks.length,
                problems,
                success_rate: summary ? summary.success_rate : 0
            });
        }
        
        res.json({ days });
        
    } catch (error) {
        console.error('Get weekly stats error:', error);
        res.status(500).json({ error: 'Failed to get weekly stats' });
    }
});

// ============================================
// HTML ROUTES
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/profile.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/leaderboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
});

app.get('/leaderboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
});

app.get('/timeline', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'timeline.html'));
});

app.get('/timeline.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'timeline.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`JEE Study Tracker server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

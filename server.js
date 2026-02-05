const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs'); // standard bcrypt sometimes has issues in some envs, bcryptjs is safer, but bcrypt is fine if it works for you.
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Database setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper wrapper for DB queries
// This replaces your old dbRun, dbGet, dbAll with a unified Postgres approach
const db = {
    query: (text, params) => pool.query(text, params)
};

// Initialize database tables
const initDatabase = async () => {
    try {
        await db.query(`
            -- Users table
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                profile_picture TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                current_streak INTEGER DEFAULT 0,
                best_streak INTEGER DEFAULT 0,
                last_active_date DATE
            );

            -- Tasks table
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                task_name TEXT NOT NULL,
                subject TEXT NOT NULL,
                estimated_minutes INTEGER NOT NULL,
                actual_minutes INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                paused_at TIMESTAMP,
                task_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Task sessions table (for timeline tracking)
            CREATE TABLE IF NOT EXISTS task_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                started_at TIMESTAMP NOT NULL,
                ended_at TIMESTAMP,
                duration_minutes INTEGER DEFAULT 0,
                end_reason TEXT,
                session_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Daily summaries table
            CREATE TABLE IF NOT EXISTS daily_summaries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                summary_date DATE NOT NULL,
                maths_problems INTEGER DEFAULT 0,
                physics_problems INTEGER DEFAULT 0,
                chemistry_problems INTEGER DEFAULT 0,
                topics_covered TEXT,
                total_study_hours DOUBLE PRECISION DEFAULT 0,
                notes TEXT,
                self_rating INTEGER CHECK(self_rating >= 1 AND self_rating <= 5),
                tasks_completed INTEGER DEFAULT 0,
                tasks_total INTEGER DEFAULT 0,
                tasks_ontime INTEGER DEFAULT 0,
                tasks_delayed INTEGER DEFAULT 0,
                success_rate DOUBLE PRECISION DEFAULT 0,
                ended_at TIMESTAMP,
                UNIQUE(user_id, summary_date)
            );

            -- Active sessions table (for real-time tracking)
            CREATE TABLE IF NOT EXISTS active_sessions (
                user_id INTEGER PRIMARY KEY REFERENCES users(id),
                active_task_id INTEGER REFERENCES tasks(id),
                active_session_id INTEGER REFERENCES task_sessions(id),
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database tables initialized (Postgres)');
    } catch (err) {
        console.error('Error creating tables:', err);
    }
};

// Run Init
initDatabase();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'jee-study-tracker-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true in production
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
        const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        // Postgres uses RETURNING id to get the new ID immediately
        const result = await db.query(
            'INSERT INTO users (username, password, name) VALUES ($1, $2, $3) RETURNING id',
            [username, hashedPassword, name]
        );
        
        const newUserId = result.rows[0].id;

        // Set session
        req.session.userId = newUserId;
        
        res.json({
            success: true,
            user: { id: newUserId, username, name }
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
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

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
        await db.query('UPDATE users SET last_active_date = $1 WHERE id = $2', [getTodayDate(), user.id]);
        
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
        const result = await db.query(
            'SELECT id, username, name, created_at, current_streak, best_streak FROM users WHERE id = $1',
            [req.session.userId]
        );
        
        const user = result.rows[0];

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
        
        // Postgres is best handled with a loop for simple batch inserts like this
        for (const task of tasks) {
            const { task_name, subject, estimated_minutes } = task;
            const taskDate = task.task_date || today;
            
            if (!task_name || !subject || !estimated_minutes) {
                continue;
            }
            
            const result = await db.query(
                `INSERT INTO tasks (user_id, task_name, subject, estimated_minutes, task_date)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [userId, task_name, subject, estimated_minutes, taskDate]
            );
            
            createdTasks.push({
                id: result.rows[0].id,
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
        
        const result = await db.query(
            `SELECT * FROM tasks WHERE user_id = $1 AND task_date = $2 ORDER BY created_at`,
            [userId, today]
        );
        
        res.json({ tasks: result.rows });
        
    } catch (error) {
        console.error('Get today tasks error:', error);
        res.status(500).json({ error: 'Failed to get tasks' });
    }
});

// Get single task
app.get('/api/tasks/:taskId', requireAuth, async (req, res) => {
    try {
        const { taskId } = req.params;
        
        const result = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        const task = result.rows[0];

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
        const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
        const task = taskRes.rows[0];

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        let previousTaskStopped = false;
        let previousTaskName = null;
        
        // Check for any active task and stop it
        const activeRes = await db.query(
            'SELECT * FROM active_sessions WHERE user_id = $1',
            [userId]
        );
        const activeSession = activeRes.rows[0];
        
        if (activeSession && activeSession.active_task_id) {
            // Get the active task
            const activeTaskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [activeSession.active_task_id]);
            const activeTask = activeTaskRes.rows[0];
            
            if (activeTask && activeTask.id !== parseInt(taskId)) {
                previousTaskStopped = true;
                previousTaskName = activeTask.task_name;
                
                // End the current session
                const currentSessionRes = await db.query(
                    'SELECT * FROM task_sessions WHERE id = $1',
                    [activeSession.active_session_id]
                );
                const currentSession = currentSessionRes.rows[0];
                
                if (currentSession) {
                    const duration = Math.floor((new Date(now) - new Date(currentSession.started_at)) / 60000);
                    
                    await db.query(
                        `UPDATE task_sessions SET ended_at = $1, duration_minutes = $2, end_reason = 'switched'
                         WHERE id = $3`,
                        [now, duration, currentSession.id]
                    );
                    
                    // Update the task's actual_minutes
                    await db.query(
                        `UPDATE tasks SET actual_minutes = actual_minutes + $1, status = 'paused'
                         WHERE id = $2`,
                        [duration, activeTask.id]
                    );
                }
            }
        }
        
        // Create new session
        const sessionResult = await db.query(
            `INSERT INTO task_sessions (user_id, task_id, started_at, session_date)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [userId, taskId, now, today]
        );
        const newSessionId = sessionResult.rows[0].id;
        
        // Update task status
        await db.query(
            `UPDATE tasks SET status = 'in_progress', started_at = COALESCE(started_at, $1)
             WHERE id = $2`,
            [now, taskId]
        );
        
        // Update active sessions (Postgres UPSERT syntax)
        await db.query(
            `INSERT INTO active_sessions (user_id, active_task_id, active_session_id, last_seen)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id) 
             DO UPDATE SET active_task_id = EXCLUDED.active_task_id, 
                           active_session_id = EXCLUDED.active_session_id,
                           last_seen = EXCLUDED.last_seen`,
            [userId, taskId, newSessionId, now]
        );
        
        // Get updated task
        const updatedTaskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        
        res.json({
            success: true,
            task: updatedTaskRes.rows[0],
            session_id: newSessionId,
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
        const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
        const task = taskRes.rows[0];

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        // End current session
        const activeRes = await db.query(
            'SELECT * FROM active_sessions WHERE user_id = $1',
            [userId]
        );
        const activeSession = activeRes.rows[0];
        
        if (activeSession && activeSession.active_session_id) {
            const currentSessionRes = await db.query(
                'SELECT * FROM task_sessions WHERE id = $1',
                [activeSession.active_session_id]
            );
            const currentSession = currentSessionRes.rows[0];
            
            if (currentSession) {
                const duration = Math.floor((new Date(now) - new Date(currentSession.started_at)) / 60000);
                
                await db.query(
                    `UPDATE task_sessions SET ended_at = $1, duration_minutes = $2, end_reason = 'completed'
                     WHERE id = $3`,
                    [now, duration, currentSession.id]
                );
            }
        }
        
        // Calculate total actual minutes
        const sessionsRes = await db.query(
            'SELECT SUM(duration_minutes) as total FROM task_sessions WHERE task_id = $1',
            [taskId]
        );
        const totalMinutes = (sessionsRes.rows[0]?.total || 0);
        
        // Determine status
        const status = totalMinutes <= task.estimated_minutes ? 'completed_ontime' : 'completed_delayed';
        
        // Update task
        await db.query(
            `UPDATE tasks SET status = $1, actual_minutes = $2, completed_at = $3
             WHERE id = $4`,
            [status, totalMinutes, now, taskId]
        );
        
        // Clear active session
        await db.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);
        
        // Get updated task
        const updatedTaskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        
        res.json({
            success: true,
            task: updatedTaskRes.rows[0],
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
        const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
        if (!taskRes.rows[0]) return res.status(404).json({ error: 'Task not found' });
        
        // End current session
        const activeRes = await db.query(
            'SELECT * FROM active_sessions WHERE user_id = $1',
            [userId]
        );
        const activeSession = activeRes.rows[0];
        
        let timeLogged = 0;
        
        if (activeSession && activeSession.active_session_id) {
            const currentSessionRes = await db.query(
                'SELECT * FROM task_sessions WHERE id = $1',
                [activeSession.active_session_id]
            );
            const currentSession = currentSessionRes.rows[0];
            
            if (currentSession) {
                const duration = Math.floor((new Date(now) - new Date(currentSession.started_at)) / 60000);
                timeLogged = duration;
                
                await db.query(
                    `UPDATE task_sessions SET ended_at = $1, duration_minutes = $2, end_reason = 'stopped'
                     WHERE id = $3`,
                    [now, duration, currentSession.id]
                );
            }
        }
        
        // Calculate total actual minutes
        const sessionsRes = await db.query(
            'SELECT SUM(duration_minutes) as total FROM task_sessions WHERE task_id = $1',
            [taskId]
        );
        const totalMinutes = (sessionsRes.rows[0]?.total || 0);
        
        // Update task
        await db.query(
            `UPDATE tasks SET status = 'stopped', actual_minutes = $1, paused_at = $2
             WHERE id = $3`,
            [totalMinutes, now, taskId]
        );
        
        // Clear active session
        await db.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);
        
        // Get updated task
        const updatedTaskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        
        res.json({
            success: true,
            task: updatedTaskRes.rows[0],
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
        const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
        if (!taskRes.rows[0]) return res.status(404).json({ error: 'Task not found' });
        
        // End current session
        const activeRes = await db.query('SELECT * FROM active_sessions WHERE user_id = $1', [userId]);
        const activeSession = activeRes.rows[0];
        
        if (activeSession && activeSession.active_session_id) {
            const currentSessionRes = await db.query('SELECT * FROM task_sessions WHERE id = $1', [activeSession.active_session_id]);
            const currentSession = currentSessionRes.rows[0];
            
            if (currentSession) {
                const duration = Math.floor((new Date(now) - new Date(currentSession.started_at)) / 60000);
                
                await db.query(
                    `UPDATE task_sessions SET ended_at = $1, duration_minutes = $2, end_reason = 'paused'
                     WHERE id = $3`,
                    [now, duration, currentSession.id]
                );
            }
        }
        
        // Calculate total actual minutes
        const sessionsRes = await db.query(
            'SELECT SUM(duration_minutes) as total FROM task_sessions WHERE task_id = $1',
            [taskId]
        );
        const totalMinutes = (sessionsRes.rows[0]?.total || 0);
        
        // Update task
        await db.query(
            `UPDATE tasks SET status = 'paused', actual_minutes = $1, paused_at = $2
             WHERE id = $3`,
            [totalMinutes, now, taskId]
        );
        
        // Clear active session
        await db.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);
        
        const updatedTaskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        res.json({ success: true, task: updatedTaskRes.rows[0] });
        
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
        
        const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
        const task = taskRes.rows[0];

        if (!task) return res.status(404).json({ error: 'Task not found' });
        
        if (task.status === 'in_progress') {
            return res.status(400).json({ error: 'Cannot delete an active task. Stop it first.' });
        }
        
        if (task.status === 'completed_ontime' || task.status === 'completed_delayed') {
            return res.status(400).json({ error: 'Cannot delete completed tasks' });
        }
        
        await db.query('DELETE FROM tasks WHERE id = $1', [taskId]);
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
        
        const usersRes = await db.query(`
            SELECT 
                u.id, u.username, u.name, u.created_at, 
                u.current_streak, u.best_streak
            FROM users u
            ORDER BY u.name
        `);
        const users = usersRes.rows;
        
        // Get today's stats for each user
        for (const user of users) {
            const todayTasksRes = await db.query(
                `SELECT * FROM tasks WHERE user_id = $1 AND task_date = $2`,
                [user.id, today]
            );
            const todayTasks = todayTasksRes.rows;
            
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
        
        const userRes = await db.query(
            `SELECT id, username, name, created_at, current_streak, best_streak 
             FROM users WHERE id = $1`,
            [userId]
        );
        const user = userRes.rows[0];
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Overall stats
        const allTasksRes = await db.query(
            `SELECT * FROM tasks WHERE user_id = $1 AND 
             (status = 'completed_ontime' OR status = 'completed_delayed')`,
            [userId]
        );
        const allTasks = allTasksRes.rows;
        
        const allSummariesRes = await db.query(
            'SELECT * FROM daily_summaries WHERE user_id = $1',
            [userId]
        );
        const allSummaries = allSummariesRes.rows;
        
        const totalProblems = allSummaries.reduce((sum, s) => 
            sum + s.maths_problems + s.physics_problems + s.chemistry_problems, 0
        );
        
        const totalHours = allTasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0) / 60;
        const ontimeTasks = allTasks.filter(t => t.status === 'completed_ontime').length;
        
        // This week stats
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        const weekTasksRes = await db.query(
            `SELECT * FROM tasks WHERE user_id = $1 AND task_date >= $2 AND 
             (status = 'completed_ontime' OR status = 'completed_delayed')`,
            [userId, weekStartStr]
        );
        const weekTasks = weekTasksRes.rows;
        
        const weekSummariesRes = await db.query(
            'SELECT * FROM daily_summaries WHERE user_id = $1 AND summary_date >= $2',
            [userId, weekStartStr]
        );
        const weekSummaries = weekSummariesRes.rows;
        
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

// Get user's today's tasks
app.get('/api/users/:userId/tasks/today', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const today = getTodayDate();
        
        const userRes = await db.query('SELECT id, name FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const tasksRes = await db.query(
            `SELECT * FROM tasks WHERE user_id = $1 AND task_date = $2 ORDER BY created_at`,
            [userId, today]
        );
        const tasks = tasksRes.rows;
        
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
        
        const activeRes = await db.query('SELECT * FROM active_sessions WHERE user_id = $1', [userId]);
        const activeSession = activeRes.rows[0];
        
        if (!activeSession || !activeSession.active_task_id) {
            return res.json({ has_active: false, task: null });
        }
        
        const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [activeSession.active_task_id]);
        const sessionRes = await db.query('SELECT * FROM task_sessions WHERE id = $1', [activeSession.active_session_id]);
        const task = taskRes.rows[0];
        const session = sessionRes.rows[0];
        
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
        
        let sql = `SELECT * FROM tasks WHERE user_id = $1 AND 
                   (status = 'completed_ontime' OR status = 'completed_delayed' OR status = 'stopped')`;
        const params = [userId];
        
        if (startDate) {
            sql += ` AND task_date >= $${params.length + 1}`;
            params.push(startDate);
        }
        
        if (endDate) {
            sql += ` AND task_date <= $${params.length + 1}`;
            params.push(endDate);
        }
        
        if (subject) {
            sql += ` AND subject = $${params.length + 1}`;
            params.push(subject);
        }
        
        sql += ' ORDER BY task_date DESC, completed_at DESC';
        
        const tasksRes = await db.query(sql, params);
        const tasks = tasksRes.rows;
        
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
        
        const summaryRes = await db.query(
            'SELECT * FROM daily_summaries WHERE user_id = $1 AND summary_date = $2',
            [userId, date]
        );
        const summary = summaryRes.rows[0];
        
        if (!summary) {
            return res.json({ exists: false, summary: null });
        }
        
        const tasksRes = await db.query(
            `SELECT * FROM tasks WHERE user_id = $1 AND task_date = $2 AND
             (status = 'completed_ontime' OR status = 'completed_delayed')`,
            [userId, date]
        );
        
        res.json({
            exists: true,
            summary,
            tasks_that_day: tasksRes.rows
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
        
        const summariesRes = await db.query(
            'SELECT * FROM daily_summaries WHERE user_id = $1 ORDER BY summary_date DESC LIMIT $2',
            [userId, limit]
        );
        
        res.json({ summaries: summariesRes.rows });
        
    } catch (error) {
        console.error('Get summaries error:', error);
        res.status(500).json({ error: 'Failed to get summaries' });
    }
});

// ============================================
// TIMELINE ENDPOINTS
// ============================================

app.get('/api/timeline/:userId/today', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const today = getTodayDate();
        
        const sessionsRes = await db.query(
            `SELECT ts.*, t.task_name, t.subject 
             FROM task_sessions ts
             JOIN tasks t ON ts.task_id = t.id
             WHERE ts.user_id = $1 AND ts.session_date = $2
             ORDER BY ts.started_at`,
            [userId, today]
        );
        const sessions = sessionsRes.rows;
        
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

app.get('/api/timeline/:userId/date/:date', requireAuth, async (req, res) => {
    try {
        const { userId, date } = req.params;
        
        const sessionsRes = await db.query(
            `SELECT ts.*, t.task_name, t.subject 
             FROM task_sessions ts
             JOIN tasks t ON ts.task_id = t.id
             WHERE ts.user_id = $1 AND ts.session_date = $2
             ORDER BY ts.started_at`,
            [userId, date]
        );
        const sessions = sessionsRes.rows;
        
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

app.get('/api/timeline/all/today', requireAuth, async (req, res) => {
    try {
        const today = getTodayDate();
        
        const usersRes = await db.query('SELECT id, name FROM users');
        const users = usersRes.rows;
        const result = { date: today, users: {} };
        
        for (const user of users) {
            const sessionsRes = await db.query(
                `SELECT ts.*, t.task_name, t.subject 
                 FROM task_sessions ts
                 JOIN tasks t ON ts.task_id = t.id
                 WHERE ts.user_id = $1 AND ts.session_date = $2
                 ORDER BY ts.started_at`,
                [user.id, today]
            );
            
            result.users[user.id] = {
                user_name: user.name,
                sessions: sessionsRes.rows
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
        
        const tasksRes = await db.query(
            'SELECT * FROM tasks WHERE user_id = $1 AND task_date = $2',
            [userId, today]
        );
        const tasks = tasksRes.rows;
        
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
        
        // Postgres UPSERT (INSERT ... ON CONFLICT ... DO UPDATE)
        await db.query(
            `INSERT INTO daily_summaries 
             (user_id, summary_date, maths_problems, physics_problems, chemistry_problems,
              topics_covered, total_study_hours, notes, self_rating,
              tasks_completed, tasks_total, tasks_ontime, tasks_delayed, success_rate, ended_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (user_id, summary_date) DO UPDATE SET
             maths_problems = EXCLUDED.maths_problems,
             physics_problems = EXCLUDED.physics_problems,
             chemistry_problems = EXCLUDED.chemistry_problems,
             topics_covered = EXCLUDED.topics_covered,
             total_study_hours = EXCLUDED.total_study_hours,
             notes = EXCLUDED.notes,
             self_rating = EXCLUDED.self_rating,
             tasks_completed = EXCLUDED.tasks_completed,
             tasks_total = EXCLUDED.tasks_total,
             tasks_ontime = EXCLUDED.tasks_ontime,
             tasks_delayed = EXCLUDED.tasks_delayed,
             success_rate = EXCLUDED.success_rate,
             ended_at = EXCLUDED.ended_at`,
            [
                userId, today, maths_problems, physics_problems, chemistry_problems,
                topics_covered, totalHours, notes, self_rating,
                completed.length, tasks.length, ontime.length, delayed.length,
                successRate, now
            ]
        );
        
        // Update streak
        const userRes = await db.query('SELECT last_active_date, current_streak FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];
        
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
        
        await db.query(
            'UPDATE users SET current_streak = $1, best_streak = GREATEST(best_streak, $2), last_active_date = $3 WHERE id = $4',
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
        
        const summaryRes = await db.query(
            'SELECT * FROM daily_summaries WHERE user_id = $1 AND summary_date = $2',
            [userId, today]
        );
        
        res.json({ exists: !!summaryRes.rows[0], summary: summaryRes.rows[0] });
        
    } catch (error) {
        console.error('Get summary error:', error);
        res.status(500).json({ error: 'Failed to get summary' });
    }
});

app.get('/api/summary/check/:date', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { date } = req.params;
        
        const summaryRes = await db.query(
            'SELECT id FROM daily_summaries WHERE user_id = $1 AND summary_date = $2',
            [userId, date]
        );
        
        res.json({ ended: !!summaryRes.rows[0] });
        
    } catch (error) {
        console.error('Check summary error:', error);
        res.status(500).json({ error: 'Failed to check summary' });
    }
});

// ============================================
// LIVE FEED ENDPOINTS
// ============================================

app.get('/api/feed/active', requireAuth, async (req, res) => {
    try {
        const today = getTodayDate();
        
        const usersRes = await db.query(`
            SELECT u.id, u.name, u.current_streak,
                   a.active_task_id, a.last_seen
            FROM users u
            LEFT JOIN active_sessions a ON u.id = a.user_id
            ORDER BY u.name
        `);
        const users = usersRes.rows;
        
        const result = [];
        let groupStats = { total_tasks: 0, total_hours: 0, avg_success: 0 };
        
        for (const user of users) {
            const tasksRes = await db.query(
                'SELECT * FROM tasks WHERE user_id = $1 AND task_date = $2',
                [user.id, today]
            );
            const tasks = tasksRes.rows;
            
            const completed = tasks.filter(t => 
                t.status === 'completed_ontime' || t.status === 'completed_delayed'
            );
            const ontime = tasks.filter(t => t.status === 'completed_ontime');
            const inProgress = tasks.filter(t => t.status === 'in_progress');
            
            const totalMinutes = completed.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
            
            let activeTask = null;
            if (user.active_task_id) {
                const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [user.active_task_id]);
                const sessionRes = await db.query(
                    'SELECT * FROM task_sessions WHERE task_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
                    [user.active_task_id]
                );
                const task = taskRes.rows[0];
                const session = sessionRes.rows[0];
                
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
                    tasks_in_progress: inProgress.length,
                    hours_studied: Math.round((totalMinutes / 60) * 10) / 10,
                    success_rate: completed.length > 0 ? Math.round((ontime.length / completed.length) * 100) : 0
                },
                streak: user.current_streak || 0
            });
            
            groupStats.total_tasks += completed.length;
            groupStats.total_hours += totalMinutes / 60;
        }
        
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

// SSE stream
app.get('/api/stream', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const sendUpdate = async () => {
        try {
            const today = getTodayDate();
            
            const usersRes = await db.query(`
                SELECT u.id, u.name, u.current_streak,
                       a.active_task_id, a.last_seen
                FROM users u
                LEFT JOIN active_sessions a ON u.id = a.user_id
                ORDER BY u.name
            `);
            const users = usersRes.rows;
            
            const result = [];
            
            for (const user of users) {
                const tasksRes = await db.query(
                    'SELECT * FROM tasks WHERE user_id = $1 AND task_date = $2',
                    [user.id, today]
                );
                const tasks = tasksRes.rows;
                
                const completed = tasks.filter(t => 
                    t.status === 'completed_ontime' || t.status === 'completed_delayed'
                );
                const ontime = tasks.filter(t => t.status === 'completed_ontime');
                
                const totalMinutes = completed.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
                
                let activeTask = null;
                if (user.active_task_id) {
                    const taskRes = await db.query('SELECT * FROM tasks WHERE id = $1', [user.active_task_id]);
                    const sessionRes = await db.query(
                        'SELECT * FROM task_sessions WHERE task_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
                        [user.active_task_id]
                    );
                    const task = taskRes.rows[0];
                    const session = sessionRes.rows[0];
                    
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
            
            res.write(`data: ${JSON.stringify({ users: result })}\n\n`);
        } catch (error) {
            console.error('SSE update error:', error);
        }
    };
    
    sendUpdate();
    const interval = setInterval(sendUpdate, 5000);
    req.on('close', () => { clearInterval(interval); });
});

// ============================================
// LEADERBOARD ENDPOINTS
// ============================================

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
        
        const usersRes = await db.query('SELECT id, name FROM users');
        const users = usersRes.rows;
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
                const tasksRes = await db.query(
                    `SELECT * FROM tasks WHERE user_id = $1 AND 
                     (status = 'completed_ontime' OR status = 'completed_delayed')`,
                    [user.id]
                );
                const summariesRes = await db.query(
                    'SELECT * FROM daily_summaries WHERE user_id = $1',
                    [user.id]
                );
                
                const tasks = tasksRes.rows;
                const summaries = summariesRes.rows;
                
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
            } else {
                const tasksRes = await db.query(
                    `SELECT * FROM tasks WHERE user_id = $1 AND task_date >= $2 AND 
                     (status = 'completed_ontime' OR status = 'completed_delayed')`,
                    [user.id, dateFilter]
                );
                const summariesRes = await db.query(
                    'SELECT * FROM daily_summaries WHERE user_id = $1 AND summary_date >= $2',
                    [user.id, dateFilter]
                );
                
                const tasks = tasksRes.rows;
                const summaries = summariesRes.rows;
                
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
            }
            
            if (category === 'hours') primaryValue = secondaryStats.hours_total;
            else if (category === 'problems') primaryValue = secondaryStats.problems_total;
            else if (category === 'success') primaryValue = secondaryStats.success_rate;
            else if (category === 'tasks') primaryValue = secondaryStats.tasks_completed;
            
            rankings.push({
                user_id: user.id,
                user_name: user.name,
                primary_value: primaryValue,
                secondary_stats: secondaryStats
            });
        }
        
        rankings.sort((a, b) => b.primary_value - a.primary_value);
        rankings.forEach((r, i) => { r.rank = i + 1; });
        
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

app.get('/api/stats/overview', requireAuth, async (req, res) => {
    try {
        const today = getTodayDate();
        
        const totalUsersRes = await db.query('SELECT COUNT(*) as count FROM users');
        const todayTasksRes = await db.query(
            `SELECT * FROM tasks WHERE task_date = $1 AND 
             (status = 'completed_ontime' OR status = 'completed_delayed')`,
            [today]
        );
        
        const todayTasks = todayTasksRes.rows;
        const totalMinutes = todayTasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
        
        const usersRes = await db.query('SELECT id, name FROM users');
        const users = usersRes.rows;
        let mostActiveUser = null;
        let maxMinutes = 0;
        
        for (const user of users) {
            const userTasksRes = await db.query(
                `SELECT * FROM tasks WHERE user_id = $1 AND task_date = $2 AND 
                 (status = 'completed_ontime' OR status = 'completed_delayed')`,
                [user.id, today]
            );
            const userMinutes = userTasksRes.rows.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);
            
            if (userMinutes > maxMinutes) {
                maxMinutes = userMinutes;
                mostActiveUser = user.name;
            }
        }
        
        res.json({
            total_users: parseInt(totalUsersRes.rows[0].count),
            total_tasks_today: todayTasks.length,
            total_hours_today: Math.round((totalMinutes / 60) * 10) / 10,
            most_active_user_today: mostActiveUser || 'No one yet'
        });
        
    } catch (error) {
        console.error('Get overview error:', error);
        res.status(500).json({ error: 'Failed to get overview' });
    }
});

app.get('/api/stats/user/:userId/weekly', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const days = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const tasksRes = await db.query(
                `SELECT * FROM tasks WHERE user_id = $1 AND task_date = $2 AND 
                 (status = 'completed_ontime' OR status = 'completed_delayed')`,
                [userId, dateStr]
            );
            
            const summaryRes = await db.query(
                'SELECT * FROM daily_summaries WHERE user_id = $1 AND summary_date = $2',
                [userId, dateStr]
            );
            
            const tasks = tasksRes.rows;
            const summary = summaryRes.rows[0];
            
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
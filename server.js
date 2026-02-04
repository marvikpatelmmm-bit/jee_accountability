const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./jee_study.db', (err) => {
    if (err) console.error('Database connection error:', err);
    else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

function initDatabase() {
    db.exec(`
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

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_name TEXT NOT NULL,
            subject TEXT,
            estimated_minutes INTEGER NOT NULL,
            actual_minutes INTEGER,
            status TEXT DEFAULT 'pending',
            started_at DATETIME,
            completed_at DATETIME,
            task_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

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
            self_rating INTEGER,
            tasks_completed INTEGER DEFAULT 0,
            tasks_total INTEGER DEFAULT 0,
            success_rate REAL DEFAULT 0,
            ended_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, summary_date)
        );

        CREATE TABLE IF NOT EXISTS active_sessions (
            user_id INTEGER PRIMARY KEY,
            active_task_id INTEGER,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (active_task_id) REFERENCES tasks(id)
        );
    `, (err) => {
        if (err) console.error('Database initialization error:', err);
        else console.log('Database tables initialized');
    });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: 'jee-study-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

// Helper function to get today's date in local timezone
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, name } = req.body;
        
        if (!username || !password || !name) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            'INSERT INTO users (username, password, name) VALUES (?, ?, ?)',
            [username, hashedPassword, name],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Username already exists' });
                    }
                    return res.status(500).json({ error: 'Failed to create user' });
                }
                req.session.userId = this.lastID;
                res.json({ success: true, userId: this.lastID, name });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
            if (err || !user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            req.session.userId = user.id;
            res.json({ success: true, userId: user.id, name: user.name });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout
app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get current user
app.get('/api/current-user', requireAuth, (req, res) => {
    db.get('SELECT id, username, name, created_at, current_streak, best_streak FROM users WHERE id = ?', 
        [req.session.userId], 
        (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'User not found' });
            res.json(user);
        }
    );
});

// ==================== TASK ROUTES ====================

// Batch add tasks
app.post('/api/tasks/batch-add', requireAuth, (req, res) => {
    const { tasks } = req.body;
    const userId = req.session.userId;
    const taskDate = getTodayDate();

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({ error: 'Tasks array required' });
    }

    const stmt = db.prepare(
        'INSERT INTO tasks (user_id, task_name, subject, estimated_minutes, task_date) VALUES (?, ?, ?, ?, ?)'
    );

    let completed = 0;
    let errors = [];

    tasks.forEach(task => {
        stmt.run([userId, task.task_name, task.subject, task.estimated_minutes, taskDate], function(err) {
            if (err) errors.push(err.message);
            completed++;
            if (completed === tasks.length) {
                stmt.finalize();
                if (errors.length > 0) {
                    res.status(500).json({ error: 'Some tasks failed to add', details: errors });
                } else {
                    res.json({ success: true, count: tasks.length });
                }
            }
        });
    });
});

// Start task
app.post('/api/tasks/:id/start', requireAuth, (req, res) => {
    const taskId = req.params.id;
    const userId = req.session.userId;
    const now = new Date().toISOString();

    db.run('BEGIN TRANSACTION');
    
    // Check if user already has an active task
    db.get('SELECT active_task_id FROM active_sessions WHERE user_id = ?', [userId], (err, session) => {
        if (session && session.active_task_id) {
            db.run('ROLLBACK');
            return res.status(400).json({ error: 'You already have an active task' });
        }

        // Update task status
        db.run(
            "UPDATE tasks SET status = 'in_progress', started_at = ? WHERE id = ? AND user_id = ? AND status = 'pending'",
            [now, taskId, userId],
            function(err) {
                if (err || this.changes === 0) {
                    db.run('ROLLBACK');
                    return res.status(400).json({ error: 'Task not found or already started' });
                }

                // Update active session
                db.run(
                    'INSERT OR REPLACE INTO active_sessions (user_id, active_task_id, last_seen) VALUES (?, ?, ?)',
                    [userId, taskId, now],
                    (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to update session' });
                        }
                        db.run('COMMIT');
                        res.json({ success: true, started_at: now });
                    }
                );
            }
        );
    });
});

// Complete task
app.post('/api/tasks/:id/complete', requireAuth, (req, res) => {
    const taskId = req.params.id;
    const userId = req.session.userId;
    const now = new Date();
    const nowISO = now.toISOString();

    db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId], (err, task) => {
        if (err || !task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (task.status !== 'in_progress') {
            return res.status(400).json({ error: 'Task is not in progress' });
        }

        const startedAt = new Date(task.started_at);
        const actualMinutes = Math.floor((now - startedAt) / 60000);
        const isOnTime = actualMinutes <= task.estimated_minutes;
        const status = isOnTime ? 'completed_ontime' : 'completed_delayed';

        db.run('BEGIN TRANSACTION');

        db.run(
            'UPDATE tasks SET status = ?, actual_minutes = ?, completed_at = ? WHERE id = ?',
            [status, actualMinutes, nowISO, taskId],
            function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to complete task' });
                }

                db.run(
                    'UPDATE active_sessions SET active_task_id = NULL WHERE user_id = ?',
                    [userId],
                    (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to clear session' });
                        }
                        db.run('COMMIT');
                        res.json({ 
                            success: true, 
                            status, 
                            actual_minutes: actualMinutes,
                            is_on_time: isOnTime
                        });
                    }
                );
            }
        );
    });
});

// Get today's tasks
app.get('/api/tasks/today', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const today = getTodayDate();

    db.all(
        'SELECT * FROM tasks WHERE user_id = ? AND task_date = ? ORDER BY created_at',
        [userId, today],
        (err, tasks) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch tasks' });
            res.json(tasks);
        }
    );
});

// Get tasks for specific user
app.get('/api/tasks/user/:userId', requireAuth, (req, res) => {
    const targetUserId = req.params.userId;
    const { startDate, endDate, subject } = req.query;

    let query = 'SELECT * FROM tasks WHERE user_id = ?';
    let params = [targetUserId];

    if (startDate) {
        query += ' AND task_date >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND task_date <= ?';
        params.push(endDate);
    }
    if (subject && subject !== 'All') {
        query += ' AND subject = ?';
        params.push(subject);
    }

    query += ' ORDER BY task_date DESC, created_at DESC';

    db.all(query, params, (err, tasks) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch tasks' });
        res.json(tasks);
    });
});

// ==================== USER DATA ROUTES ====================

// Get all users with stats
app.get('/api/users', requireAuth, (req, res) => {
    db.all(`
        SELECT 
            u.id, u.username, u.name, u.current_streak, u.best_streak,
            COUNT(t.id) as total_tasks,
            SUM(CASE WHEN t.status = 'completed_ontime' THEN 1 ELSE 0 END) as ontime_tasks,
            SUM(CASE WHEN t.status = 'completed_delayed' THEN 1 ELSE 0 END) as delayed_tasks
        FROM users u
        LEFT JOIN tasks t ON u.id = t.user_id
        GROUP BY u.id
    `, (err, users) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch users' });
        res.json(users);
    });
});

// Get user profile
app.get('/api/users/:userId/profile', requireAuth, (req, res) => {
    const targetUserId = req.params.userId;

    db.get('SELECT id, username, name, created_at, current_streak, best_streak FROM users WHERE id = ?', 
        [targetUserId], 
        (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'User not found' });

            // Get overall stats
            db.get(`
                SELECT 
                    COUNT(*) as total_tasks,
                    SUM(CASE WHEN status = 'completed_ontime' THEN 1 ELSE 0 END) as ontime_tasks,
                    SUM(CASE WHEN status = 'completed_delayed' THEN 1 ELSE 0 END) as delayed_tasks,
                    SUM(actual_minutes) as total_minutes
                FROM tasks 
                WHERE user_id = ? AND status LIKE 'completed_%'
            `, [targetUserId], (err, stats) => {
                
                // Get this week's stats
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                
                db.get(`
                    SELECT 
                        COUNT(*) as week_tasks,
                        SUM(CASE WHEN status = 'completed_ontime' THEN 1 ELSE 0 END) as week_ontime,
                        SUM(CASE WHEN status = 'completed_delayed' THEN 1 ELSE 0 END) as week_delayed,
                        SUM(actual_minutes) as week_minutes
                    FROM tasks 
                    WHERE user_id = ? AND task_date >= ? AND status LIKE 'completed_%'
                `, [targetUserId, weekAgo.toISOString().split('T')[0]], (err, weekStats) => {

                    // Get daily history
                    db.all(`
                        SELECT 
                            task_date,
                            COUNT(*) as total,
                            SUM(CASE WHEN status = 'completed_ontime' THEN 1 ELSE 0 END) as ontime,
                            SUM(CASE WHEN status = 'completed_delayed' THEN 1 ELSE 0 END) as delayed
                        FROM tasks 
                        WHERE user_id = ? AND status LIKE 'completed_%'
                        GROUP BY task_date
                        ORDER BY task_date DESC
                        LIMIT 30
                    `, [targetUserId], (err, history) => {
                        res.json({
                            user,
                            stats: {
                                total: stats.total_tasks || 0,
                                ontime: stats.ontime_tasks || 0,
                                delayed: stats.delayed_tasks || 0,
                                totalHours: Math.round((stats.total_minutes || 0) / 60 * 10) / 10,
                                successRate: stats.total_tasks > 0 
                                    ? Math.round((stats.ontime_tasks / (stats.ontime_tasks + stats.delayed_tasks)) * 100) 
                                    : 0
                            },
                            weekStats: {
                                total: weekStats.week_tasks || 0,
                                ontime: weekStats.week_ontime || 0,
                                delayed: weekStats.week_delayed || 0,
                                hours: Math.round((weekStats.week_minutes || 0) / 60 * 10) / 10,
                                successRate: (weekStats.week_ontime + weekStats.week_delayed) > 0
                                    ? Math.round((weekStats.week_ontime / (weekStats.week_ontime + weekStats.week_delayed)) * 100)
                                    : 0
                            },
                            history
                        });
                    });
                });
            });
        }
    );
});

// ==================== DAILY SUMMARY ROUTES ====================

// End day
app.post('/api/summary/end-day', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const today = getTodayDate();
    const { 
        maths_problems, physics_problems, chemistry_problems,
        topics_covered, notes, self_rating, total_study_hours 
    } = req.body;

    db.get('SELECT * FROM daily_summaries WHERE user_id = ? AND summary_date = ?', 
        [userId, today], 
        (err, existing) => {
            if (existing) {
                return res.status(400).json({ error: 'Day already ended' });
            }

            // Get today's task stats
            db.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'completed_ontime' THEN 1 ELSE 0 END) as ontime,
                    SUM(CASE WHEN status = 'completed_delayed' THEN 1 ELSE 0 END) as delayed
                FROM tasks 
                WHERE user_id = ? AND task_date = ? AND status LIKE 'completed_%'
            `, [userId, today], (err, taskStats) => {
                
                const tasksCompleted = taskStats.ontime + taskStats.delayed;
                const successRate = tasksCompleted > 0 
                    ? Math.round((taskStats.ontime / tasksCompleted) * 100) 
                    : 0;

                db.run(`
                    INSERT INTO daily_summaries 
                    (user_id, summary_date, maths_problems, physics_problems, chemistry_problems,
                     topics_covered, total_study_hours, notes, self_rating, 
                     tasks_completed, tasks_total, success_rate, ended_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    userId, today, maths_problems || 0, physics_problems || 0, chemistry_problems || 0,
                    topics_covered || '', total_study_hours || 0, notes || '', self_rating || 0,
                    tasksCompleted, taskStats.total, successRate, new Date().toISOString()
                ], function(err) {
                    if (err) return res.status(500).json({ error: 'Failed to save summary' });

                    // Update streak
                    updateStreak(userId, today, (err, streak) => {
                        if (err) console.error('Streak update error:', err);
                        res.json({ 
                            success: true, 
                            summaryId: this.lastID,
                            streak: streak
                        });
                    });
                });
            });
        }
    );
});

function updateStreak(userId, today, callback) {
    db.get('SELECT last_active_date, current_streak FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return callback(err);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let newStreak = 1;
        if (user.last_active_date === yesterdayStr) {
            newStreak = user.current_streak + 1;
        } else if (user.last_active_date === today) {
            newStreak = user.current_streak;
        }

        const newBestStreak = Math.max(newStreak, user.best_streak || 0);

        db.run(
            'UPDATE users SET current_streak = ?, best_streak = ?, last_active_date = ? WHERE id = ?',
            [newStreak, newBestStreak, today, userId],
            (err) => callback(err, newStreak)
        );
    });
}

// Get summary for specific date
app.get('/api/summary/user/:userId/date/:date', requireAuth, (req, res) => {
    db.get(
        'SELECT * FROM daily_summaries WHERE user_id = ? AND summary_date = ?',
        [req.params.userId, req.params.date],
        (err, summary) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch summary' });
            res.json(summary || null);
        }
    );
});

// ==================== LIVE FEED ROUTES ====================

// Get active feed
app.get('/api/feed/active', requireAuth, (req, res) => {
    db.all(`
        SELECT 
            u.id, u.name,
            t.id as task_id, t.task_name, t.subject, t.estimated_minutes, t.started_at, t.status,
            (julianday('now') - julianday(t.started_at)) * 24 * 60 as elapsed_minutes
        FROM users u
        LEFT JOIN active_sessions s ON u.id = s.user_id
        LEFT JOIN tasks t ON s.active_task_id = t.id
        ORDER BY u.name
    `, (err, users) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch feed' });

        // Get quick stats for each user
        const userIds = users.map(u => u.id);
        if (userIds.length === 0) return res.json([]);

        const placeholders = userIds.map(() => '?').join(',');
        db.all(`
            SELECT 
                user_id,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed_ontime' THEN 1 ELSE 0 END) as ontime,
                SUM(CASE WHEN status = 'completed_delayed' THEN 1 ELSE 0 END) as delayed
            FROM tasks 
            WHERE user_id IN (${placeholders}) AND task_date = ? AND status LIKE 'completed_%'
            GROUP BY user_id
        `, [...userIds, getTodayDate()], (err, stats) => {
            
            const statsMap = {};
            stats.forEach(s => {
                statsMap[s.user_id] = s;
            });

            const result = users.map(u => ({
                id: u.id,
                name: u.name,
                activeTask: u.task_id ? {
                    id: u.task_id,
                    name: u.task_name,
                    subject: u.subject,
                    estimatedMinutes: u.estimated_minutes,
                    elapsedMinutes: Math.floor(u.elapsed_minutes || 0)
                } : null,
                todayStats: statsMap[u.id] || { total: 0, ontime: 0, delayed: 0 }
            }));

            res.json(result);
        });
    });
});

// SSE Stream for real-time updates
app.get('/api/stream', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendUpdate = () => {
        db.all(`
            SELECT 
                u.id, u.name,
                t.id as task_id, t.task_name, t.subject, t.estimated_minutes, t.started_at,
                (julianday('now') - julianday(t.started_at)) * 24 * 60 as elapsed_minutes
            FROM users u
            LEFT JOIN active_sessions s ON u.id = s.user_id
            LEFT JOIN tasks t ON s.active_task_id = t.id
        `, (err, users) => {
            if (!err) {
                res.write(`data: ${JSON.stringify(users)}\n\n`);
            }
        });
    };

    sendUpdate();
    const interval = setInterval(sendUpdate, 5000);

    req.on('close', () => {
        clearInterval(interval);
    });
});

// ==================== LEADERBOARD ROUTES ====================

// Weekly leaderboard
app.get('/api/leaderboard/weekly', requireAuth, (req, res) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    db.all(`
        SELECT 
            u.id, u.name,
            COUNT(t.id) as total_tasks,
            SUM(CASE WHEN t.status = 'completed_ontime' THEN 1 ELSE 0 END) as ontime_tasks,
            SUM(CASE WHEN t.status = 'completed_delayed' THEN 1 ELSE 0 END) as delayed_tasks,
            SUM(t.actual_minutes) as total_minutes
        FROM users u
        LEFT JOIN tasks t ON u.id = t.user_id 
            AND t.task_date >= ? 
            AND t.status LIKE 'completed_%'
        GROUP BY u.id
        ORDER BY ontime_tasks DESC, total_tasks DESC
    `, [weekAgo.toISOString().split('T')[0]], (err, users) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch leaderboard' });
        
        const ranked = users.map((u, i) => ({
            ...u,
            rank: i + 1,
            successRate: (u.ontime_tasks + u.delayed_tasks) > 0
                ? Math.round((u.ontime_tasks / (u.ontime_tasks + u.delayed_tasks)) * 100)
                : 0,
            hours: Math.round((u.total_minutes || 0) / 60 * 10) / 10
        }));

        res.json(ranked);
    });
});

// Monthly leaderboard
app.get('/api/leaderboard/monthly', requireAuth, (req, res) => {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    db.all(`
        SELECT 
            u.id, u.name,
            COUNT(t.id) as total_tasks,
            SUM(CASE WHEN t.status = 'completed_ontime' THEN 1 ELSE 0 END) as ontime_tasks,
            SUM(CASE WHEN t.status = 'completed_delayed' THEN 1 ELSE 0 END) as delayed_tasks,
            SUM(t.actual_minutes) as total_minutes
        FROM users u
        LEFT JOIN tasks t ON u.id = t.user_id 
            AND t.task_date >= ? 
            AND t.status LIKE 'completed_%'
        GROUP BY u.id
        ORDER BY ontime_tasks DESC, total_tasks DESC
    `, [monthAgo.toISOString().split('T')[0]], (err, users) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch leaderboard' });
        
        const ranked = users.map((u, i) => ({
            ...u,
            rank: i + 1,
            successRate: (u.ontime_tasks + u.delayed_tasks) > 0
                ? Math.round((u.ontime_tasks / (u.ontime_tasks + u.delayed_tasks)) * 100)
                : 0,
            hours: Math.round((u.total_minutes || 0) / 60 * 10) / 10
        }));

        res.json(ranked);
    });
});

// All-time leaderboard
app.get('/api/leaderboard/alltime', requireAuth, (req, res) => {
    db.all(`
        SELECT 
            u.id, u.name, u.current_streak, u.best_streak,
            COUNT(t.id) as total_tasks,
            SUM(CASE WHEN t.status = 'completed_ontime' THEN 1 ELSE 0 END) as ontime_tasks,
            SUM(CASE WHEN t.status = 'completed_delayed' THEN 1 ELSE 0 END) as delayed_tasks,
            SUM(t.actual_minutes) as total_minutes
        FROM users u
        LEFT JOIN tasks t ON u.id = t.user_id AND t.status LIKE 'completed_%'
        GROUP BY u.id
        ORDER BY ontime_tasks DESC, total_tasks DESC
    `, (err, users) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch leaderboard' });
        
        const ranked = users.map((u, i) => ({
            ...u,
            rank: i + 1,
            successRate: (u.ontime_tasks + u.delayed_tasks) > 0
                ? Math.round((u.ontime_tasks / (u.ontime_tasks + u.delayed_tasks)) * 100)
                : 0,
            hours: Math.round((u.total_minutes || 0) / 60 * 10) / 10
        }));

        res.json(ranked);
    });
});

// ==================== HTML ROUTES ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/leaderboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

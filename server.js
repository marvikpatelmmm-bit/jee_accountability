import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve Static Files (Vite Build)
app.use(express.static(join(__dirname, 'dist')));

// --- API ROUTES ---

// Login / Register
app.post('/api/login', async (req, res) => {
  try {
    const { username } = req.body;
    let user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      const id = `u_${Date.now()}`;
      const name = username; // Default name
      const avatar = `https://picsum.photos/200?random=${Date.now()}`;
      await db.run(
        'INSERT INTO users (id, username, name, avatar) VALUES (?, ?, ?, ?)',
        [id, username, name, avatar]
      );
      user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    }
    
    // Format stats for frontend
    const formattedUser = {
      ...user,
      stats: {
        totalTasks: user.total_tasks,
        successRate: user.success_rate,
        studyHours: user.study_hours,
        streak: user.streak
      },
      currentTaskId: user.current_task_id
    };
    
    res.json(formattedUser);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get User
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json({
      ...user,
      stats: {
        totalTasks: user.total_tasks,
        successRate: user.success_rate,
        studyHours: user.study_hours,
        streak: user.streak
      },
      currentTaskId: user.current_task_id
    });
  } catch (e) {
    res.status(500).json({ error: 'Error fetching user' });
  }
});

// Get All Users (for Leaderboard)
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.query('SELECT * FROM users');
    const formatted = users.map(user => ({
      ...user,
      stats: {
        totalTasks: user.total_tasks,
        successRate: user.success_rate,
        studyHours: user.study_hours,
        streak: user.streak
      },
      currentTaskId: user.current_task_id
    }));
    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Get Tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const userId = req.query.userId;
    const tasks = await db.query('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    
    // Map snake_case DB to camelCase frontend
    const formatted = tasks.map(t => ({
      id: t.id,
      userId: t.user_id,
      title: t.title,
      subject: t.subject,
      estimatedMinutes: t.estimated_minutes,
      actualMinutes: t.actual_minutes,
      status: t.status,
      createdAt: t.created_at,
      completedAt: t.completed_at
    }));
    
    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: 'Error fetching tasks' });
  }
});

// Add Task
app.post('/api/tasks', async (req, res) => {
  try {
    const task = req.body;
    const id = `t_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = Date.now();
    
    await db.run(
      `INSERT INTO tasks (id, user_id, title, subject, estimated_minutes, actual_minutes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, task.userId, task.title, task.subject, task.estimatedMinutes, 0, 'PENDING', createdAt]
    );

    res.json({ id, ...task, status: 'PENDING', createdAt, actualMinutes: 0 });
  } catch (e) {
    res.status(500).json({ error: 'Error adding task' });
  }
});

// Start Task
app.post('/api/tasks/:id/start', async (req, res) => {
  try {
    const taskId = req.params.id;
    // Get task to find user_id
    const task = await db.get('SELECT user_id FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await db.run('UPDATE tasks SET status = ? WHERE id = ?', ['IN_PROGRESS', taskId]);
    await db.run('UPDATE users SET current_task_id = ?, last_active = CURRENT_TIMESTAMP WHERE id = ?', [taskId, task.user_id]);
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error starting task' });
  }
});

// Complete Task
app.post('/api/tasks/:id/complete', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { actualMinutes } = req.body;
    
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const isOntime = actualMinutes <= task.estimated_minutes;
    const status = isOntime ? 'COMPLETED_ON_TIME' : 'COMPLETED_DELAYED';
    
    await db.run(
      'UPDATE tasks SET status = ?, actual_minutes = ?, completed_at = ? WHERE id = ?',
      [status, actualMinutes, Date.now(), taskId]
    );
    
    // Update User Stats
    // 1. Get current stats
    const user = await db.get('SELECT * FROM users WHERE id = ?', [task.user_id]);
    
    // 2. Calculate new stats
    const newTotalTasks = user.total_tasks + 1;
    const newStudyHours = user.study_hours + (actualMinutes / 60);
    
    // Recalculate success rate roughly (better to count all tasks, but simple update here)
    const allTasks = await db.query('SELECT status FROM tasks WHERE user_id = ?', [task.user_id]);
    const successCount = allTasks.filter(t => t.status === 'COMPLETED_ON_TIME').length;
    const successRate = Math.round((successCount / newTotalTasks) * 100);

    await db.run(
      'UPDATE users SET current_task_id = NULL, total_tasks = ?, study_hours = ?, success_rate = ?, last_active = CURRENT_TIMESTAMP WHERE id = ?',
      [newTotalTasks, parseFloat(newStudyHours.toFixed(1)), successRate, task.user_id]
    );

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error completing task' });
  }
});

// Save Summary
app.post('/api/summary', async (req, res) => {
  try {
    const summary = req.body;
    const id = `s_${Date.now()}`;
    
    await db.run(
      `INSERT INTO summaries (id, user_id, date, maths_problems, physics_problems, chemistry_problems, topics_covered, rating, total_hours, notes, tasks_completed, total_tasks, success_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
       [id, summary.userId, summary.date, summary.mathsProblems, summary.physicsProblems, summary.chemistryProblems, summary.topicsCovered, summary.rating, summary.totalHours, summary.notes, summary.tasksCompleted, summary.totalTasks, summary.successRate]
    );
    
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error saving summary' });
  }
});

// Live Feed Activity
app.get('/api/activity', async (req, res) => {
  try {
    const currentUserId = req.query.currentUserId;
    // Get all other users
    const users = await db.query('SELECT * FROM users WHERE id != ?', [currentUserId]);
    
    const activity = await Promise.all(users.map(async (u) => {
        let activeTask = undefined;
        if (u.current_task_id) {
            const t = await db.get('SELECT * FROM tasks WHERE id = ?', [u.current_task_id]);
            if (t) {
                 activeTask = {
                    id: t.id,
                    userId: t.user_id,
                    title: t.title,
                    subject: t.subject,
                    estimatedMinutes: t.estimated_minutes,
                    actualMinutes: t.actual_minutes,
                    status: t.status,
                    createdAt: t.created_at
                 };
            }
        }
        
        // Format user
        const formattedUser = {
            ...u,
            stats: {
                totalTasks: u.total_tasks,
                successRate: u.success_rate,
                studyHours: u.study_hours,
                streak: u.streak
            },
            currentTaskId: u.current_task_id
        };

        // Determine "last active" text
        const lastActiveDate = new Date(u.last_active);
        const diffMins = Math.floor((Date.now() - lastActiveDate.getTime()) / 60000);
        let lastActiveText = 'Just now';
        if (diffMins > 0) lastActiveText = `${diffMins}m ago`;
        if (diffMins > 60) lastActiveText = `${Math.floor(diffMins/60)}h ago`;

        return {
            user: formattedUser,
            activeTask,
            lastActive: lastActiveText
        };
    }));
    
    res.json(activity);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error fetching activity' });
  }
});

// Catch-all to serve React App
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
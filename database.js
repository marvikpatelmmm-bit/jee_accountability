import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize DB in the root directory
const dbPath = join(__dirname, 'jee.db');
const db = new sqlite3.Database(dbPath);

// Initialize Tables
db.serialize(() => {
  // Users
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    name TEXT,
    avatar TEXT,
    total_tasks INTEGER DEFAULT 0,
    success_rate INTEGER DEFAULT 0,
    study_hours REAL DEFAULT 0,
    streak INTEGER DEFAULT 0,
    current_task_id TEXT,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tasks
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    subject TEXT,
    estimated_minutes INTEGER,
    actual_minutes INTEGER DEFAULT 0,
    status TEXT,
    created_at INTEGER,
    completed_at INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Summaries
  db.run(`CREATE TABLE IF NOT EXISTS summaries (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    date TEXT,
    maths_problems INTEGER,
    physics_problems INTEGER,
    chemistry_problems INTEGER,
    topics_covered TEXT,
    rating INTEGER,
    total_hours REAL,
    notes TEXT,
    tasks_completed INTEGER,
    total_tasks INTEGER,
    success_rate INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};
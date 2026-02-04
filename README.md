# JEE Study Accountability App

A competitive study tracking app for JEE students with complete transparency between friends.

## Features

- **Daily Task Planning**: Plan your entire day's tasks in the morning with time estimates
- **Real-time Tracking**: Track task progress with live timers
- **Complete Transparency**: See everything your friends are working on in real-time
- **Competitive Leaderboards**: Weekly, monthly, and all-time rankings
- **Daily Summaries**: End-of-day reflections with problems solved and topics covered
- **Study Streaks**: Track and maintain your study streaks
- **Performance Analytics**: View detailed stats and history

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js + Express
- **Database**: SQLite (file-based)
- **Real-time**: Server-Sent Events with polling fallback
- **Authentication**: Express sessions with bcrypt password hashing

## Deployment on Railway

1. Create a Railway account at [railway.app](https://railway.app)
2. Create a new project
3. Upload this project (either via GitHub or direct upload)
4. Railway will auto-detect Node.js and deploy
5. Your app will be live at: `yourapp.railway.app`

### Railway Configuration

The app is already configured for Railway with:
- `PORT` using `process.env.PORT || 3000`
- Listening on `0.0.0.0`
- SQLite database persists on Railway's filesystem

## Local Development

### Prerequisites

- Node.js 18+ installed

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser:
```
http://localhost:3000
```

## Usage

### First Time Setup

1. Register a new account on the login page
2. Once registered, you'll be redirected to the dashboard
3. Click "Plan Your Day" to add your tasks
4. Start tasks and track your progress

### Daily Workflow

1. **Morning**: Click "Plan Your Day" and add all tasks you plan to complete
2. **Throughout the day**: Start tasks to begin the timer, mark them complete when done
3. **Evening**: Click "End My Day" to record your summary and problems solved

### Viewing Friends' Progress

- The dashboard shows a live feed of what your friends are currently studying
- Click "View Profile" on any user card to see their complete history
- Check the Leaderboard page to see rankings

## Database Schema

### Users Table
- `id`, `username`, `password`, `name`, `profile_picture`
- `current_streak`, `best_streak`, `last_active_date`

### Tasks Table
- `id`, `user_id`, `task_name`, `subject`, `estimated_minutes`, `actual_minutes`
- `status` (pending, in_progress, completed_ontime, completed_delayed)
- `started_at`, `completed_at`, `task_date`

### Daily Summaries Table
- `id`, `user_id`, `summary_date`
- `maths_problems`, `physics_problems`, `chemistry_problems`
- `topics_covered`, `total_study_hours`, `notes`, `self_rating`
- `tasks_completed`, `tasks_total`, `success_rate`

### Active Sessions Table
- `user_id`, `active_task_id`, `last_seen`

## API Endpoints

### Authentication
- `POST /api/register` - Create new user
- `POST /api/login` - Login user
- `GET /api/logout` - Logout user
- `GET /api/current-user` - Get current user info

### Tasks
- `POST /api/tasks/batch-add` - Add multiple tasks
- `POST /api/tasks/:id/start` - Start a task
- `POST /api/tasks/:id/complete` - Complete a task
- `GET /api/tasks/today` - Get today's tasks
- `GET /api/tasks/user/:userId` - Get tasks for a user

### Users
- `GET /api/users` - Get all users with stats
- `GET /api/users/:userId/profile` - Get user profile

### Daily Summaries
- `POST /api/summary/end-day` - End day and save summary
- `GET /api/summary/user/:userId/date/:date` - Get summary for date

### Leaderboard
- `GET /api/leaderboard/weekly` - Weekly rankings
- `GET /api/leaderboard/monthly` - Monthly rankings
- `GET /api/leaderboard/alltime` - All-time rankings

### Live Feed
- `GET /api/feed/active` - Get active users feed
- `GET /api/stream` - Server-Sent Events stream

## Folder Structure

```
jee-study-app/
├── server.js              # Main server file
├── package.json           # Dependencies
├── jee_study.db          # SQLite database (auto-created)
├── README.md             # This file
└── public/               # Static files
    ├── index.html        # Login/Register page
    ├── dashboard.html    # Main dashboard
    ├── profile.html      # User profile
    ├── leaderboard.html  # Rankings
    ├── css/
    │   ├── styles.css    # Global styles
    │   ├── dashboard.css # Dashboard styles
    │   ├── profile.css   # Profile styles
    │   └── leaderboard.css
    └── js/
        ├── utils.js      # Utility functions
        ├── auth.js       # Authentication
        ├── tasks.js      # Task management
        ├── realtime.js   # Live feed
        ├── dashboard.js  # Dashboard logic
        ├── profile.js    # Profile logic
        └── leaderboard.js
```

## Environment Variables

No environment variables are required for basic operation. The app uses:
- `PORT` - Server port (default: 3000)

## Security Notes

- Passwords are hashed with bcrypt
- Sessions are managed with express-session
- All API endpoints (except auth) require authentication
- Input is sanitized to prevent XSS attacks

## License

MIT License - Feel free to use and modify as needed!

## Support

For issues or questions, please open an issue on GitHub.

---

**Happy Studying! 📚🔥**

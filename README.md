# JEE Study Tracker

A comprehensive study accountability app for JEE aspirants with complete transparency between users.

## Features

### Core Features
- **User Authentication** - Secure registration and login with bcrypt password hashing
- **Task Management** - Plan daily tasks with time estimates, track actual time spent
- **Real-time Tracking** - Live feed showing who's studying what right now
- **Timer System** - Animated progress ring with on-time/delayed tracking
- **Daily Summaries** - End-of-day reports with problems solved, topics covered, and self-rating
- **Complete Transparency** - Everyone can view everyone's tasks, progress, and history

### Dashboard
- Welcome section with personalized greeting
- Quick stats bar (study time, tasks done, success rate, streak)
- Hero section with active task and animated timer
- Live feed of all users' current activities
- Task list with filtering (all/pending/completed)
- Group activity stats

### Profile Page (Full Transparency)
- View any user's complete profile
- Overall stats (total hours, problems solved, tasks completed, success rate)
- Weekly performance chart
- Subject-wise breakdown (Maths, Physics, Chemistry)
- **Today's Todo List** - See what tasks anyone has planned
- **Recent Daily Summaries** - View anyone's end-of-day reports
- **Complete Task History** - Filter by date and subject

### Leaderboard
- Rankings by: Study Hours, Problems Solved, Success Rate, Tasks Completed
- Time periods: Weekly, Monthly, All Time
- Podium display for top 3

### Timeline
- Hour-by-hour view of study sessions
- Visual task blocks with subject colors
- Current time indicator
- Summary stats (total time, sessions, most productive hour)
- Side-by-side comparison of all users

## Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite3 (file-based)
- **Authentication**: express-session with bcrypt
- **Frontend**: Plain HTML5, CSS3, Vanilla JavaScript
- **Real-time**: Server-Sent Events (SSE) with polling fallback

## Database Schema

### Tables
- `users` - User accounts with streak tracking
- `tasks` - Task management with status tracking
- `task_sessions` - Timeline tracking for each study session
- `daily_summaries` - End-of-day reports
- `active_sessions` - Real-time activity tracking

## Installation

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd jee-study-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open browser:
```
http://localhost:3000
```

### Railway Deployment

1. Create a Railway account at [railway.app](https://railway.app)

2. Create a new project and deploy from GitHub

3. Railway will auto-detect Node.js and deploy

4. Your app will be live at: `yourapp.railway.app`

## Environment Variables

The app uses default settings suitable for deployment:
- `PORT` - Automatically set by Railway (defaults to 3000 locally)
- Session secret is hardcoded for simplicity (change in production)

## Usage

### First Time Setup
1. Register as a new user
2. Plan your day by adding tasks
3. Start a task to begin tracking
4. Mark tasks complete or stop them
5. End your day with a summary

### Task Management
- **Plan Day**: Add multiple tasks with estimated times
- **Start Task**: Click play button (auto-stops any running task)
- **Complete**: Mark done when finished
- **Stop**: Pause without completing

### Viewing Friends' Data
- Go to Profile page
- Use the dropdown to switch between users
- View their todo list, summaries, and history
- Everything is visible to everyone!

## API Endpoints

### Authentication
- `POST /api/register` - Create new account
- `POST /api/login` - Login
- `GET /api/logout` - Logout
- `GET /api/current-user` - Get current user info

### Tasks
- `POST /api/tasks/batch-add` - Add multiple tasks
- `GET /api/tasks/today` - Get today's tasks
- `POST /api/tasks/:id/start` - Start a task
- `POST /api/tasks/:id/complete` - Complete a task
- `POST /api/tasks/:id/stop` - Stop a task
- `DELETE /api/tasks/:id` - Delete a task

### User Data (Full Transparency)
- `GET /api/users` - Get all users with stats
- `GET /api/users/:id/profile` - Get complete profile
- `GET /api/users/:id/tasks/today` - Get user's today's tasks
- `GET /api/users/:id/tasks/active` - Get user's active task
- `GET /api/users/:id/tasks/history` - Get task history
- `GET /api/users/:id/summaries` - Get daily summaries

### Timeline
- `GET /api/timeline/:userId/today` - Get today's timeline
- `GET /api/timeline/:userId/date/:date` - Get timeline for date
- `GET /api/timeline/all/today` - Get all users' timelines

### Leaderboard
- `GET /api/leaderboard/:period/:category` - Get rankings

### Live Feed
- `GET /api/feed/active` - Get current activity
- `GET /api/stream` - SSE stream for real-time updates

## Design

### Color Palette
- **Background**: Pure black (#000000)
- **Cards**: Dark glass-morphism with blur
- **Accents**: Purple (#a855f7), Blue (#3b82f6), Orange (#f97316), Green (#10b981)
- **Subjects**: Maths (orange), Physics (purple), Chemistry (green)

### Key UI Elements
- Glass-morphism cards with backdrop blur
- Animated progress ring for active tasks
- Live pulse indicators for online users
- Smooth transitions and hover effects

## File Structure

```
jee-study-app/
├── server.js                 # Main Express server
├── package.json              # Dependencies
├── jee_study.db             # SQLite database (auto-created)
├── README.md                # This file
└── public/                  # Static files
    ├── index.html           # Login/Register
    ├── dashboard.html       # Main dashboard
    ├── profile.html         # User profiles
    ├── leaderboard.html     # Rankings
    ├── timeline.html        # Hour-by-hour view
    └── css/
    │   └── styles.css       # Global styles
    └── js/
        ├── utils.js         # Helper functions
        ├── auth.js          # Authentication
        ├── dashboard.js     # Dashboard logic
        ├── profile.js       # Profile logic
        ├── leaderboard.js   # Leaderboard logic
        └── timeline.js      # Timeline logic
```

## Contributing

This app is designed for small study groups (3 users). Feel free to customize for your needs!

## License

MIT License

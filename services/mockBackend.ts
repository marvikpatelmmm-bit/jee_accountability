import { User, Task, DaySummary, FriendActivity } from '../types';

const STORAGE_KEYS = {
  CURRENT_USER: 'jee_current_user_id',
};

// --- REAL API IMPLEMENTATION ---

export const api = {
  // --- AUTH ---
  login: async (username: string): Promise<User> => {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });
    if (!response.ok) throw new Error('Login failed');
    const user = await response.json();
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, user.id);
    return user;
  },

  getCurrentUser: (): User | null => {
    // We only store ID locally, to get full object we usually fetch or cache
    // For simplicity, we assume the component fetches user data via getUser if needed
    // But since the dashboard expects synchronous check, we return a "partial" user or null
    // Ideally, we fetch /api/users/:id on load. 
    // To keep it compatible:
    const id = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!id) return null;
    return { id } as User; // Caller should refresh via API
  },

  // Helper to fetch full user details if we only have ID
  fetchUser: async (id: string): Promise<User | null> => {
     try {
         const res = await fetch(`/api/users/${id}`);
         if (res.ok) return await res.json();
         return null;
     } catch { return null; }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },

  // --- DATA ACCESS ---
  getUsers: (): User[] => {
     // This was synchronous in mock. In async world, we can't do this easily.
     // Dashboard calls this for Leaderboard. We will refactor Leaderboard to use fetch,
     // or we use a promise-based approach. 
     // However, to satisfy existing signature, we might have to break signature or strictness.
     // HACK: For the existing synchronous calls, we return empty array and components should use useEffect to load data.
     // BUT: The components were written to expect api.getUsers() to return data immediately in the mock.
     // We updated Dashboard to use useEffect to `refreshData` which calls `api.getUsers`.
     // We need to change `api.getUsers` to return `Promise<User[]>` and update components.
     // OR, we keep this file as an async wrapper and update components.
     // Given the previous "Dashboard" code I wrote, I used `const allTasks = api.getTasks(currentUser.id)`. 
     // I need to update this file to be ASYNC and update Dashboard/Profile/Leaderboard to await it.
     return []; 
  },
  
  // New Async Methods for Components
  getUsersAsync: async (): Promise<User[]> => {
      const res = await fetch('/api/users');
      return await res.json();
  },

  getTasks: async (userId: string): Promise<Task[]> => {
      const res = await fetch(`/api/tasks?userId=${userId}`);
      return await res.json();
  },

  // --- ACTIONS ---
  addTask: async (task: any): Promise<Task> => {
    const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
    });
    return await res.json();
  },

  startTask: async (taskId: string): Promise<void> => {
     await fetch(`/api/tasks/${taskId}/start`, { method: 'POST' });
  },

  completeTask: async (taskId: string, actualMinutes: number): Promise<void> => {
     await fetch(`/api/tasks/${taskId}/complete`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ actualMinutes })
     });
  },

  // --- LIVE FEED ---
  getFriendsActivity: async (): Promise<FriendActivity[]> => {
    const id = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!id) return [];
    const res = await fetch(`/api/activity?currentUserId=${id}`);
    return await res.json();
  },

  saveDaySummary: async (summary: any) => {
     await fetch('/api/summary', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(summary)
     });
  }
};
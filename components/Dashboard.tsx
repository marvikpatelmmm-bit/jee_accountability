import React, { useState, useEffect } from 'react';
import { api } from '../services/mockBackend';
import { User, Task, FriendActivity, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { ActiveTimer } from './ActiveTimer';
import { PlanDayModal } from './PlanDayModal';
import { EndDayModal } from './EndDayModal';
import { Plus, Zap, Users, TrendingUp } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [friends, setFriends] = useState<FriendActivity[]>([]);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isEndDayModalOpen, setIsEndDayModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | undefined>(undefined);

  // Load Data
  const refreshData = async () => {
    const currentUserStub = api.getCurrentUser();
    if (currentUserStub) {
      // Fetch full user details
      const fullUser = await api.fetchUser(currentUserStub.id);
      if (fullUser) {
          setUser(fullUser);
          // Fetch tasks
          const allTasks = await api.getTasks(fullUser.id);
          setTasks(allTasks);
          
          const current = allTasks.find(t => t.id === fullUser.currentTaskId);
          setActiveTask(current);
      }
    }
    const friendsData = await api.getFriendsActivity();
    setFriends(friendsData);
  };

  useEffect(() => {
    refreshData();
    // Poll for friend updates
    const interval = setInterval(() => {
       // Only refresh friends to avoid full UI flicker, but here we refresh all for sync
       refreshData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStartTask = async (id: string) => {
    await api.startTask(id);
    refreshData();
  };

  const handleCompleteTask = async (actualMinutes: number) => {
    if (activeTask) {
        await api.completeTask(activeTask.id, actualMinutes);
        refreshData();
    }
  };

  const handleCancelTask = () => {
      refreshData(); 
  };

  const handleAddTasks = async (newTasks: any[]) => {
    for (const t of newTasks) {
       await api.addTask({ ...t, userId: user?.id || '' });
    }
    refreshData();
  };

  const handleEndDay = async (summaryData: any) => {
      if (user) {
          await api.saveDaySummary({
              userId: user.id,
              date: new Date().toISOString().split('T')[0],
              ...summaryData
          });
          setIsEndDayModalOpen(false);
          alert("Day Summary Saved! Great job today.");
          refreshData();
      }
  };

  if (!user) return <div className="text-white p-10 text-center">Loading Study Space...</div>;

  const pendingTasks = tasks.filter(t => t.status === TaskStatus.PENDING);
  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED_ON_TIME || t.status === TaskStatus.COMPLETED_DELAYED);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* LEFT COLUMN: Todo List */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-surface/50 rounded-2xl p-6 border border-white/5">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white">Today's Plan</h2>
                <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-gray-400">{pendingTasks.length} left</span>
            </div>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {pendingTasks.length === 0 && !activeTask ? (
                     <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-xl">
                        <p className="text-sm text-gray-500 mb-3">No tasks planned</p>
                        <button onClick={() => setIsPlanModalOpen(true)} className="text-primary text-sm font-medium hover:underline">Plan now</button>
                     </div>
                ) : (
                    pendingTasks.map(task => (
                        <TaskCard key={task.id} task={task} onStart={handleStartTask} />
                    ))
                )}
            </div>

            <button 
                onClick={() => setIsPlanModalOpen(true)}
                className="w-full mt-4 py-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
                <Plus size={18} /> Add Tasks
            </button>
            
            <button 
                onClick={() => setIsEndDayModalOpen(true)}
                className="w-full mt-3 py-3 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 rounded-xl flex items-center justify-center gap-2 transition-all font-medium"
            >
                End My Day
            </button>
        </div>
      </div>

      {/* MIDDLE COLUMN: Active Task & Feed */}
      <div className="lg:col-span-6 space-y-8">
        {activeTask ? (
            <ActiveTimer task={activeTask} onComplete={handleCompleteTask} onCancel={handleCancelTask} />
        ) : (
            <div className="bg-gradient-to-br from-surface to-[#0f1225] border border-white/5 rounded-2xl p-10 text-center shadow-2xl">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <Zap size={32} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Ready to grind?</h2>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">Select a task from your list or add a new one to start your session. Your friends will be notified.</p>
                <button 
                    onClick={() => setIsPlanModalOpen(true)}
                    className="bg-white text-black font-bold py-3 px-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-white/10"
                >
                    Start a Session
                </button>
            </div>
        )}

        {/* Live Feed */}
        <div>
            <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-primary" />
                <h3 className="text-lg font-bold text-white">Live Friends Feed</h3>
                <span className="flex h-2 w-2 rounded-full bg-success animate-pulse ml-2"></span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friends.length === 0 ? <div className="text-gray-500 text-sm">No friends active yet. Invite them!</div> : friends.map((f, i) => (
                    <div key={i} className="bg-surface border border-white/5 p-4 rounded-xl flex items-center gap-4 hover:bg-white/5 transition-colors">
                        <div className="relative">
                            <img src={f.user.avatar} alt={f.user.username} className="w-12 h-12 rounded-full border-2 border-surface" />
                            {f.activeTask && <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-surface rounded-full"></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline">
                                <h4 className="text-white font-medium truncate">{f.user.name}</h4>
                                <span className="text-[10px] text-gray-500">{f.activeTask ? 'Active now' : f.lastActive}</span>
                            </div>
                            {f.activeTask ? (
                                <div className="text-xs text-primary mt-0.5 truncate flex items-center gap-1">
                                    <Zap size={10} /> {f.activeTask.title}
                                </div>
                            ) : (
                                <div className="text-xs text-gray-500 mt-0.5">Taking a break</div>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                                <span>Tasks: {f.user.stats.totalTasks}</span>
                                <span>Rate: {f.user.stats.successRate}%</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Quick Stats */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-surface/50 backdrop-blur-md border border-white/5 rounded-2xl p-6">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">Your Performance</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 p-4 rounded-xl">
                    <div className="text-2xl font-bold text-white">{completedTasks.length}</div>
                    <div className="text-xs text-gray-500">Tasks Done</div>
                </div>
                <div className="bg-black/20 p-4 rounded-xl">
                    <div className="text-2xl font-bold text-success">{user.stats.successRate}%</div>
                    <div className="text-xs text-gray-500">Success Rate</div>
                </div>
                <div className="bg-black/20 p-4 rounded-xl">
                    <div className="text-2xl font-bold text-purpleAccent">{user.stats.studyHours}h</div>
                    <div className="text-xs text-gray-500">Study Time</div>
                </div>
                <div className="bg-black/20 p-4 rounded-xl">
                    <div className="text-2xl font-bold text-warning">{user.stats.streak}🔥</div>
                    <div className="text-xs text-gray-500">Day Streak</div>
                </div>
            </div>
        </div>

        <div className="bg-gradient-to-b from-primary/10 to-transparent border border-primary/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4 text-primary">
                <TrendingUp size={18} />
                <h3 className="font-bold">Leaderboard Top 3</h3>
            </div>
            <div className="space-y-3">
                {/* Real Leaderboard Preview */}
                {[...friends, {user: user}].sort((a,b) => (b.user?.stats?.successRate || 0) - (a.user?.stats?.successRate || 0)).slice(0,3).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                        <span className={`font-bold w-4 text-center ${idx === 0 ? 'text-yellow-400' : 'text-gray-500'}`}>{idx+1}</span>
                        <img src={item.user.avatar || user.avatar} className="w-6 h-6 rounded-full" />
                        <span className="text-gray-300 flex-1 truncate">{item.user.name}</span>
                        <span className="font-mono text-success">{item.user.stats.successRate}%</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      <PlanDayModal 
        isOpen={isPlanModalOpen} 
        onClose={() => setIsPlanModalOpen(false)} 
        onSave={handleAddTasks} 
      />

      <EndDayModal 
        isOpen={isEndDayModalOpen}
        onClose={() => setIsEndDayModalOpen(false)}
        onSave={handleEndDay}
        tasks={tasks}
      />
    </div>
  );
};
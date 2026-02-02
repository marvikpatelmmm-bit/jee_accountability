import React, { useEffect, useState } from 'react';
import { api } from '../services/mockBackend';
import { User } from '../types';
import { Trophy, TrendingUp, Clock } from 'lucide-react';

export const Leaderboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const load = async () => {
        const allUsers = await api.getUsersAsync();
        // Sort by success rate descending
        setUsers(allUsers.sort((a, b) => b.stats.successRate - a.stats.successRate));
    }
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">Weekly Leaderboard</h1>
        <p className="text-gray-400">Compete with friends to maintain the highest accountability.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Top 3 Cards */}
        {users.slice(0, 3).map((user, index) => (
           <div key={user.id} className={`relative bg-surface border rounded-2xl p-6 text-center transform hover:-translate-y-2 transition-transform duration-300 ${index === 0 ? 'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)] scale-105 z-10' : 'border-white/5'}`}>
              {index === 0 && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-400"><Trophy size={48} fill="currentColor" fillOpacity={0.2} /></div>}
              <div className="w-20 h-20 mx-auto rounded-full border-4 border-surface mb-4 relative z-10">
                  <img src={user.avatar} className="w-full h-full rounded-full" />
                  <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 border-surface ${index === 0 ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white'}`}>
                      #{index + 1}
                  </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{user.name}</h3>
              <div className="text-3xl font-bold text-primary mb-2">{user.stats.successRate}%</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest">Success Rate</div>
           </div>
        ))}
      </div>

      <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-4 grid grid-cols-12 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5">
              <div className="col-span-1 text-center">Rank</div>
              <div className="col-span-5">Student</div>
              <div className="col-span-2 text-center">Tasks</div>
              <div className="col-span-2 text-center">Hours</div>
              <div className="col-span-2 text-center">Rate</div>
          </div>
          {users.map((user, index) => (
             <div key={user.id} className="p-4 grid grid-cols-12 items-center text-sm hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                <div className="col-span-1 text-center font-bold text-gray-500">#{index + 1}</div>
                <div className="col-span-5 flex items-center gap-3">
                    <img src={user.avatar} className="w-8 h-8 rounded-full" />
                    <span className="text-white font-medium">{user.name}</span>
                </div>
                <div className="col-span-2 text-center text-gray-300">{user.stats.totalTasks}</div>
                <div className="col-span-2 text-center text-gray-300">{user.stats.studyHours}h</div>
                <div className="col-span-2 text-center font-bold text-success">{user.stats.successRate}%</div>
             </div>
          ))}
      </div>
    </div>
  );
};
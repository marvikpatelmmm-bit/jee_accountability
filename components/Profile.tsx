import React, { useEffect, useState } from 'react';
import { api } from '../services/mockBackend';
import { User, Task, TaskStatus } from '../types';
import { Calendar, Award, Clock, Activity } from 'lucide-react';

export const Profile: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [history, setHistory] = useState<Task[]>([]);

    useEffect(() => {
        const load = async () => {
            const uStub = api.getCurrentUser();
            if (uStub) {
                const u = await api.fetchUser(uStub.id);
                if (u) {
                    setUser(u);
                    const tasks = await api.getTasks(u.id);
                    setHistory(tasks.filter(t => t.status !== TaskStatus.PENDING));
                }
            }
        }
        load();
    }, []);

    if (!user) return <div className="text-white p-10 text-center">Loading Profile...</div>;

    const StatCard = ({ icon: Icon, label, value, color }: any) => (
        <div className="bg-surface border border-white/5 p-6 rounded-2xl flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-${color}/10 text-${color}`}>
                <Icon size={24} />
            </div>
            <div>
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-sm text-gray-500">{label}</div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center gap-6 bg-surface/30 backdrop-blur-xl border border-white/5 p-8 rounded-3xl">
                <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-full border-4 border-surface shadow-xl" />
                <div className="text-center md:text-left flex-1">
                    <h1 className="text-3xl font-bold text-white">{user.name}</h1>
                    <p className="text-gray-400">@{user.username} &bull; Joined Sept 2023</p>
                </div>
                <div className="flex gap-4">
                   <div className="text-center px-4">
                       <div className="text-xl font-bold text-success">{user.stats.successRate}%</div>
                       <div className="text-xs text-gray-500">Success</div>
                   </div>
                   <div className="text-center px-4 border-l border-white/10">
                       <div className="text-xl font-bold text-white">{user.stats.streak}</div>
                       <div className="text-xs text-gray-500">Streak</div>
                   </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Activity} label="Total Tasks" value={user.stats.totalTasks} color="primary" />
                <StatCard icon={Clock} label="Study Hours" value={user.stats.studyHours} color="purpleAccent" />
                <StatCard icon={Award} label="Best Streak" value="14 Days" color="warning" />
                <StatCard icon={Calendar} label="Active Days" value="45" color="success" />
            </div>

            {/* History List */}
            <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-lg font-bold text-white">Recent Activity History</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-black/20 text-xs text-gray-400 uppercase">
                            <tr>
                                <th className="p-4">Task</th>
                                <th className="p-4">Subject</th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Duration</th>
                                <th className="p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                            {history.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No history available yet.</td></tr>
                            ) : (
                                history.map(task => (
                                    <tr key={task.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-medium text-white">{task.title}</td>
                                        <td className="p-4 text-gray-400">{task.subject}</td>
                                        <td className="p-4 text-gray-400">{new Date(task.createdAt).toLocaleDateString()}</td>
                                        <td className="p-4 text-gray-400">{task.actualMinutes}m / {task.estimatedMinutes}m</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                                task.status === TaskStatus.COMPLETED_ON_TIME ? 'bg-success/10 text-success' :
                                                task.status === TaskStatus.COMPLETED_DELAYED ? 'bg-warning/10 text-warning' : 'bg-gray-700 text-gray-300'
                                            }`}>
                                                {task.status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
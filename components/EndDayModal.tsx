import React, { useState, useEffect } from 'react';
import { X, Star, Calculator, Brain, FlaskConical, PenTool, CheckCircle, Clock } from 'lucide-react';
import { Task, TaskStatus, DaySummary } from '../types';

interface EndDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (summary: Omit<DaySummary, 'id' | 'userId' | 'date'>) => void;
  tasks: Task[];
}

export const EndDayModal: React.FC<EndDayModalProps> = ({ isOpen, onClose, onSave, tasks }) => {
  const [mathsProblems, setMathsProblems] = useState(0);
  const [physicsProblems, setPhysicsProblems] = useState(0);
  const [chemistryProblems, setChemistryProblems] = useState(0);
  const [topicsCovered, setTopicsCovered] = useState('');
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [totalHours, setTotalHours] = useState(0);

  // Stats derived from tasks
  const completedTasks = tasks.filter(t => 
    t.status === TaskStatus.COMPLETED_ON_TIME || 
    t.status === TaskStatus.COMPLETED_DELAYED
  );
  
  const onTimeTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED_ON_TIME);
  
  // Success rate: On-time / Total Completed (as per requirements)
  // Guard against divide by zero
  const successRate = completedTasks.length > 0 
    ? Math.round((onTimeTasks.length / completedTasks.length) * 100) 
    : 0;

  useEffect(() => {
    if (isOpen) {
      // Auto-calculate hours from actual minutes of completed tasks
      const minutes = completedTasks.reduce((acc, t) => acc + (t.actualMinutes || 0), 0);
      setTotalHours(parseFloat((minutes / 60).toFixed(1)));
    }
  }, [isOpen, tasks]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (rating === 0) {
        alert("Please rate your productivity before ending the day.");
        return;
    }

    onSave({
      mathsProblems,
      physicsProblems,
      chemistryProblems,
      topicsCovered,
      notes,
      rating,
      totalHours,
      tasksCompleted: completedTasks.length,
      totalTasks: tasks.length,
      successRate
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-[#1a1f3a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0f1225]">
            <div>
                <h2 className="text-xl font-bold text-white">End Day Summary</h2>
                <p className="text-sm text-gray-400">Lock in your progress and reflect.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
            
            {/* Quick Stats Summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 border border-white/5 p-4 rounded-xl text-center">
                    <div className="text-2xl font-bold text-white">{completedTasks.length}/{tasks.length}</div>
                    <div className="text-xs text-gray-400 uppercase">Tasks Done</div>
                </div>
                <div className="bg-white/5 border border-white/5 p-4 rounded-xl text-center">
                    <div className="text-2xl font-bold text-success">{successRate}%</div>
                    <div className="text-xs text-gray-400 uppercase">Success Rate</div>
                </div>
                 <div className="bg-white/5 border border-white/5 p-4 rounded-xl text-center relative">
                    <input 
                        type="number" 
                        step="0.1"
                        value={totalHours}
                        onChange={(e) => setTotalHours(parseFloat(e.target.value))}
                        className="text-2xl font-bold text-primary bg-transparent text-center w-full focus:outline-none"
                    />
                    <div className="text-xs text-gray-400 uppercase flex items-center justify-center gap-1">
                        Study Hours <PenTool size={10} />
                    </div>
                </div>
            </div>

            {/* Problem Solving Stats */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Problems Solved</label>
                <div className="grid grid-cols-3 gap-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-blue-400">
                            <Calculator size={16} />
                        </div>
                        <input 
                            type="number"
                            value={mathsProblems || ''}
                            onChange={(e) => setMathsProblems(parseInt(e.target.value) || 0)}
                            placeholder="Maths"
                            className="w-full bg-black/20 border border-blue-500/30 rounded-xl py-3 pl-10 pr-4 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
                        />
                         <span className="absolute top-1 right-2 text-[10px] text-blue-400 font-bold">MATH</span>
                    </div>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-purpleAccent">
                            <Brain size={16} />
                        </div>
                        <input 
                            type="number"
                            value={physicsProblems || ''}
                            onChange={(e) => setPhysicsProblems(parseInt(e.target.value) || 0)}
                            placeholder="Physics"
                            className="w-full bg-black/20 border border-purpleAccent/30 rounded-xl py-3 pl-10 pr-4 text-white focus:border-purpleAccent focus:outline-none focus:ring-1 focus:ring-purpleAccent placeholder-gray-600"
                        />
                         <span className="absolute top-1 right-2 text-[10px] text-purpleAccent font-bold">PHY</span>
                    </div>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-success">
                            <FlaskConical size={16} />
                        </div>
                        <input 
                            type="number"
                            value={chemistryProblems || ''}
                            onChange={(e) => setChemistryProblems(parseInt(e.target.value) || 0)}
                            placeholder="Chem"
                            className="w-full bg-black/20 border border-success/30 rounded-xl py-3 pl-10 pr-4 text-white focus:border-success focus:outline-none focus:ring-1 focus:ring-success placeholder-gray-600"
                        />
                         <span className="absolute top-1 right-2 text-[10px] text-success font-bold">CHEM</span>
                    </div>
                </div>
            </div>

            {/* Topics Covered */}
            <div>
                 <label className="block text-sm font-medium text-gray-300 mb-2">Topics & Chapters Covered</label>
                 <textarea 
                    value={topicsCovered}
                    onChange={(e) => setTopicsCovered(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-primary/50 min-h-[80px]"
                    placeholder="e.g. Rotational Motion theory, Chemical Bonding trends..."
                 />
            </div>

            {/* Reflection */}
             <div>
                 <label className="block text-sm font-medium text-gray-300 mb-2">Notes & Reflection (Optional)</label>
                 <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-primary/50 min-h-[60px]"
                    placeholder="What went well? What distracted you today?"
                 />
            </div>

            {/* Rating */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Rate Your Productivity</label>
                <div className="flex justify-center gap-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button 
                            key={star}
                            onClick={() => setRating(star)}
                            className={`p-2 transition-all transform hover:scale-110 ${rating >= star ? 'text-yellow-400' : 'text-gray-600'}`}
                        >
                            <Star size={32} fill={rating >= star ? "currentColor" : "none"} />
                        </button>
                    ))}
                </div>
            </div>

        </div>

        <div className="p-6 border-t border-white/5 bg-[#0f1225] flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-3 rounded-xl text-gray-300 font-medium hover:bg-white/5 transition-colors">Cancel</button>
            <button 
                onClick={handleSave} 
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-purpleAccent text-white font-bold hover:opacity-90 shadow-lg shadow-primary/20 transition-all transform active:scale-95 flex items-center gap-2"
            >
                <CheckCircle size={18} /> End Day & Save
            </button>
        </div>
      </div>
    </div>
  );
};
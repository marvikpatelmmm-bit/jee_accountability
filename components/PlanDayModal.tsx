import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Subject } from '../types';

interface PlanDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tasks: any[]) => void;
}

export const PlanDayModal: React.FC<PlanDayModalProps> = ({ isOpen, onClose, onSave }) => {
  const [tasks, setTasks] = useState([
    { title: '', subject: Subject.PHYSICS, estimatedMinutes: 45 }
  ]);

  if (!isOpen) return null;

  const handleAddTask = () => {
    setTasks([...tasks, { title: '', subject: Subject.MATHS, estimatedMinutes: 30 }]);
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: string, value: any) => {
    const newTasks = [...tasks];
    (newTasks[index] as any)[field] = value;
    setTasks(newTasks);
  };

  const handleSave = () => {
    const validTasks = tasks.filter(t => t.title.trim() !== '');
    if (validTasks.length > 0) {
      onSave(validTasks);
      onClose();
      // Reset
      setTasks([{ title: '', subject: Subject.PHYSICS, estimatedMinutes: 45 }]);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="relative bg-[#1a1f3a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0f1225]">
            <div>
                <h2 className="text-xl font-bold text-white">Plan Your Day</h2>
                <p className="text-sm text-gray-400">Add tasks to track your accountability.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {tasks.map((task, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-white/5 p-4 rounded-xl border border-white/5 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <div className="flex-1 w-full">
                        <label className="text-xs text-gray-500 mb-1 block">Task Description</label>
                        <input 
                            type="text" 
                            value={task.title}
                            onChange={(e) => handleChange(index, 'title', e.target.value)}
                            placeholder="e.g., Solve HC Verma Ch 5"
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary/50"
                        />
                    </div>
                    <div className="w-full md:w-32">
                         <label className="text-xs text-gray-500 mb-1 block">Subject</label>
                        <select 
                            value={task.subject}
                            onChange={(e) => handleChange(index, 'subject', e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary/50 text-sm"
                        >
                            {Object.values(Subject).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="w-full md:w-28">
                         <label className="text-xs text-gray-500 mb-1 block">Est. Time</label>
                        <select 
                            value={task.estimatedMinutes}
                            onChange={(e) => handleChange(index, 'estimatedMinutes', parseInt(e.target.value))}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary/50 text-sm"
                        >
                            <option value="15">15 min</option>
                            <option value="30">30 min</option>
                            <option value="45">45 min</option>
                            <option value="60">1 hr</option>
                            <option value="90">1.5 hr</option>
                            <option value="120">2 hr</option>
                        </select>
                    </div>
                    <button 
                        onClick={() => handleRemoveTask(index)}
                        className="p-2 mt-4 md:mt-1 text-gray-500 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}

            <button 
                onClick={handleAddTask}
                className="w-full py-3 border border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
                <Plus size={18} /> Add Another Task
            </button>
        </div>

        <div className="p-6 border-t border-white/5 bg-[#0f1225] flex justify-end gap-3">
             <div className="flex-1 flex items-center text-sm text-gray-400">
                Total Est: <span className="text-white font-bold ml-1">{tasks.reduce((acc, t) => acc + t.estimatedMinutes, 0)} mins</span>
             </div>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-gray-300 font-medium hover:bg-white/5 transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-primary text-black font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all transform active:scale-95">
                Save & Start Day
            </button>
        </div>
      </div>
    </div>
  );
};
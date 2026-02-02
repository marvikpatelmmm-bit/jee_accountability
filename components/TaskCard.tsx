import React from 'react';
import { Play, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Task, TaskStatus, Subject } from '../types';

interface TaskCardProps {
  task: Task;
  onStart: (id: string) => void;
  isCompact?: boolean;
}

const subjectColors = {
  [Subject.MATHS]: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  [Subject.PHYSICS]: 'bg-purpleAccent/10 text-purpleAccent border-purpleAccent/20',
  [Subject.CHEMISTRY]: 'bg-success/10 text-success border-success/20',
  [Subject.OTHER]: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onStart, isCompact }) => {
  const getStatusIcon = () => {
    switch (task.status) {
      case TaskStatus.PENDING: return <Clock size={16} />;
      case TaskStatus.IN_PROGRESS: return <Play size={16} className="animate-pulse" />;
      case TaskStatus.COMPLETED_ON_TIME: return <CheckCircle size={16} className="text-success" />;
      case TaskStatus.COMPLETED_DELAYED: return <AlertTriangle size={16} className="text-warning" />;
      default: return <Clock size={16} />;
    }
  };

  return (
    <div className={`group relative bg-surface border border-white/5 rounded-xl p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 ${task.status === TaskStatus.IN_PROGRESS ? 'border-primary/40 shadow-[0_0_15px_rgba(0,212,255,0.05)]' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${subjectColors[task.subject]}`}>
          {task.subject}
        </span>
        <div className={`text-gray-400 ${task.status === TaskStatus.COMPLETED_ON_TIME ? 'text-success' : ''}`}>
            {getStatusIcon()}
        </div>
      </div>
      
      <h3 className="text-white font-medium truncate mb-1">{task.title}</h3>
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <Clock size={12} />
        <span>{task.estimatedMinutes} min est.</span>
      </div>

      {task.status === TaskStatus.PENDING && (
        <button 
            onClick={() => onStart(task.id)}
            className="w-full py-2 rounded-lg bg-white/5 hover:bg-primary hover:text-black text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
            <Play size={14} /> Start
        </button>
      )}
       
       {task.status === TaskStatus.COMPLETED_ON_TIME && (
           <div className="w-full py-1.5 text-center text-xs text-success font-medium bg-success/10 rounded">
               Completed On Time
           </div>
       )}
       {task.status === TaskStatus.COMPLETED_DELAYED && (
           <div className="w-full py-1.5 text-center text-xs text-warning font-medium bg-warning/10 rounded">
               Delayed (+{task.actualMinutes - task.estimatedMinutes}m)
           </div>
       )}
    </div>
  );
};
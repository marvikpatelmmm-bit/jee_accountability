import React, { useState, useEffect } from 'react';
import { Pause, CheckCircle, XCircle } from 'lucide-react';
import { Task } from '../types';

interface ActiveTimerProps {
  task: Task;
  onComplete: (actualMinutes: number) => void;
  onCancel: () => void; // Usually just stops without saving
}

export const ActiveTimer: React.FC<ActiveTimerProps> = ({ task, onComplete, onCancel }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let interval: any;
    if (!isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused]);

  const estimatedSeconds = task.estimatedMinutes * 60;
  const progress = Math.min((elapsedSeconds / estimatedSeconds) * 100, 100);
  const isOvertime = elapsedSeconds > estimatedSeconds;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStrokeColor = () => {
      if (isOvertime) return '#f59e0b'; // warning
      return '#00d4ff'; // primary
  };

  return (
    <div className="w-full bg-surface border border-primary/20 rounded-2xl p-6 md:p-8 relative overflow-hidden mb-8 shadow-[0_0_40px_rgba(0,0,0,0.3)]">
      {/* Background Glow */}
      <div className={`absolute top-0 right-0 w-64 h-64 rounded-full filter blur-[80px] opacity-20 -translate-y-1/2 translate-x-1/3 transition-colors duration-1000 ${isOvertime ? 'bg-warning' : 'bg-primary'}`}></div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
        
        {/* Info Side */}
        <div className="flex-1 text-center md:text-left">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-gray-300 border border-white/5 mb-3">
                CURRENTLY FOCUSING ON
            </span>
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-2">{task.title}</h2>
            <p className="text-gray-400 flex items-center justify-center md:justify-start gap-2">
                <span className={`w-2 h-2 rounded-full ${isOvertime ? 'bg-warning animate-pulse' : 'bg-success animate-pulse'}`}></span>
                {isOvertime ? 'Overtime' : 'On Track'} &bull; {task.subject}
            </p>
        </div>

        {/* Timer Visualization */}
        <div className="relative w-48 h-48 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#252b4a" strokeWidth="6" />
                <circle 
                    cx="50" cy="50" r="45" 
                    fill="none" 
                    stroke={getStrokeColor()}
                    strokeWidth="6" 
                    strokeDasharray="283"
                    strokeDashoffset={283 - (283 * progress) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-mono font-bold ${isOvertime ? 'text-warning' : 'text-white'}`}>
                    {formatTime(elapsedSeconds)}
                </span>
                <span className="text-xs text-gray-500 font-medium uppercase mt-1">
                    / {task.estimatedMinutes} MIN
                </span>
            </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 w-full md:w-auto">
             <button 
                onClick={() => onComplete(Math.ceil(elapsedSeconds / 60))}
                className="flex items-center justify-center gap-2 bg-success hover:bg-success/90 text-white font-bold py-3 px-6 rounded-xl transition-transform active:scale-95 shadow-lg shadow-success/20"
            >
                <CheckCircle size={20} /> Mark Complete
            </button>
            <div className="flex gap-3">
                <button 
                    onClick={() => setIsPaused(!isPaused)}
                    className="flex-1 flex items-center justify-center gap-2 bg-surfaceHover hover:bg-white/10 text-white font-medium py-3 px-4 rounded-xl border border-white/5 transition-colors"
                >
                    <Pause size={18} /> {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button 
                    onClick={onCancel}
                    className="flex-1 flex items-center justify-center gap-2 bg-surfaceHover hover:bg-danger/20 hover:text-danger text-gray-400 font-medium py-3 px-4 rounded-xl border border-white/5 transition-colors"
                >
                    <XCircle size={18} /> Cancel
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};
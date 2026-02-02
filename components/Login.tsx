import React, { useState } from 'react';
import { Layers, ArrowRight } from 'lucide-react';
import { api } from '../services/mockBackend';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setLoading(true);
    await api.login(username);
    setLoading(false);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purpleAccent/20 rounded-full blur-[100px]"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-purpleAccent mb-6 shadow-lg shadow-primary/30">
                <Layers size={32} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight mb-2">SyncStudy JEE</h1>
            <p className="text-gray-400">Competitive accountability for serious aspirants.</p>
        </div>

        <div className="bg-surface/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                placeholder="Enter your username"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {loading ? 'Entering...' : 'Start Studying'}
              {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>
          
          <div className="mt-6 text-center text-xs text-gray-500">
            By joining, you agree that your study data will be fully visible to your group.
          </div>
        </div>
      </div>
    </div>
  );
};
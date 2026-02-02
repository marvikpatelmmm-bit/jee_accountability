import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart2, User, LogOut, Layers } from 'lucide-react';
import { api } from '../services/mockBackend';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    api.logout();
    navigate('/');
  };

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: BarChart2, label: 'Leaderboard', path: '/leaderboard' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="min-h-screen bg-background text-gray-100 font-sans selection:bg-primary selection:text-black">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface/50 backdrop-blur-xl border-r border-white/5 hidden md:flex flex-col z-50">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-tr from-primary to-purpleAccent flex items-center justify-center font-bold text-white">
            <Layers size={18} />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">SyncStudy</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(0,212,255,0.1)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-gray-400 hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 w-full bg-surface/90 backdrop-blur-md z-50 border-b border-white/5 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-primary to-purpleAccent flex items-center justify-center font-bold text-white">
                <Layers size={18} />
            </div>
            <span className="text-lg font-bold">SyncStudy</span>
        </div>
        <button onClick={handleLogout} className="text-gray-400 hover:text-white">
            <LogOut size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="md:ml-64 min-h-screen pt-20 md:pt-0 pb-24 md:pb-0 px-4 md:px-8 py-8 max-w-7xl mx-auto">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface/90 backdrop-blur-xl border-t border-white/5 pb-safe z-50">
        <div className="flex justify-around items-center p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${
                  isActive ? 'text-primary' : 'text-gray-500'
                }`
              }
            >
              <item.icon size={24} />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
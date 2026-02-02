import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Layout } from './components/Layout';
import { Profile } from './components/Profile';
import { Leaderboard } from './components/Leaderboard';
import { api } from './services/mockBackend';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = api.getCurrentUser();
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<Login />} />
            <Route 
                path="/dashboard" 
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } 
            />
             <Route 
                path="/profile" 
                element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                } 
            />
             <Route 
                path="/leaderboard" 
                element={
                    <ProtectedRoute>
                        <Leaderboard />
                    </ProtectedRoute>
                } 
            />
        </Routes>
    )
}

const App: React.FC = () => {
  return (
    <HashRouter>
        <AppRoutes />
    </HashRouter>
  );
};

export default App;
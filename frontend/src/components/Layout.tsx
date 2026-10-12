import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Settings, LogOut, Shield } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

export default function Layout() {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen w-full min-w-0 flex flex-col relative text-gray-100 font-sans selection:bg-purple-500/30 selection:text-white overflow-x-hidden">
      <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#030008] pointer-events-none">
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen">
          <source src="https://v1.pinimg.com/videos/mc/720p/a3/13/f3/a313f34c9e93bb3e860dbbf966c6230e.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-[#030008]/80 via-[#0a0518]/60 to-[#030008]/90 mix-blend-multiply" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15)_0%,rgba(0,0,0,0.8)_80%)]" />
      </div>

      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#080410]/60 border-b border-[var(--color-border)] px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap gap-3 justify-between items-center shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
        <Link to="/" className="text-lg sm:text-xl font-bold tracking-wider flex items-center gap-2 min-w-0">
          <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 flex-shrink-0" />
          <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-indigo-400 bg-clip-text text-transparent truncate">SECURE<span className="font-medium opacity-90">AUTHLOGIN</span></span>
        </Link>

        <div className="flex gap-1 sm:gap-4 items-center flex-shrink-0">
          {isLoading ? null : !user ? (
            <>
              <Link to="/signin" className="px-2 sm:px-4 py-2 rounded-md hover:bg-white/10 transition-colors text-xs sm:text-sm font-medium text-gray-300 hover:text-white">Sign Up</Link>
              <Link to="/login" className="px-2.5 sm:px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500 rounded-md transition-all text-xs sm:text-sm font-medium text-white border border-indigo-500/50">Log In</Link>
            </>
          ) : (
            <>
              <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} className={`text-xs sm:text-sm font-medium rounded-md px-1.5 sm:px-2 py-1 ${location.pathname === '/dashboard' || location.pathname === '/admin' ? 'text-indigo-300' : 'text-gray-300 hover:text-white'}`}>
                Dashboard
              </Link>
              <Link to="/settings" className={`p-2 rounded-full ${location.pathname === '/settings' ? 'bg-white/10 text-indigo-300' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`} aria-label="Settings">
                <Settings className="w-5 h-5" />
              </Link>
              <button onClick={handleLogout} className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-red-400" aria-label="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </nav>

      <main className="flex-1 flex flex-col relative z-10 w-full min-w-0 max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <AnimatePresence mode="wait">
          <Outlet />
        </AnimatePresence>
      </main>

      <footer className="border-t border-[var(--color-border)] backdrop-blur-md bg-[#080410]/60 py-5 sm:py-6 px-4 sm:px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 text-center sm:text-left">
          <div>© {new Date().getFullYear()} SECUREAUTHLOGIN. All rights reserved.</div>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-indigo-300 transition-colors">Login</Link>
            <Link to="/signin" className="hover:text-indigo-300 transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
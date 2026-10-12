import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { User } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'rate-limited' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'rate-limited' || status === 'loading') return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setStatus('error');
      setErrorMessage('Please provide both email and password.');
      return;
    }

    setStatus('loading');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: normalizedEmail, password })
      });

      if (!res.ok) {
        if (res.status === 429) {
          setStatus('rate-limited');
          setErrorMessage('Too many failed attempts. Try again later.');
          return;
        }

        const data = await res.json().catch(() => ({}));
        setStatus('error');
        setErrorMessage(data.message || 'Invalid credentials or server error.');
        return;
      }

      const data = await res.json();
      const user: User = data.user;

      if (!user || !user.role) throw new Error('Invalid backend response');

      setStatus('success');
      setUser(user);

      setTimeout(() => {
        navigate(user.role === 'admin' ? '/admin' : '/dashboard');
      }, 500);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage('Backend endpoint unavailable. Please ensure the API is running.');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] py-6 sm:py-10">
      <div className="w-full max-w-lg relative">
        <Link to="/" className="absolute -top-10 sm:-top-12 left-0 flex items-center gap-2 text-gray-400 hover:text-indigo-300 transition-colors text-sm font-medium rounded-md px-2 py-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="backdrop-blur-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 sm:p-8 md:p-12 rounded-2xl sm:rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="mb-6 sm:mb-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">Secure Login</h2>
            <p className="text-gray-400 text-sm">Access your protected dashboard.</p>
          </div>

          <AnimatePresence mode="wait">
            {status === 'error' && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-5 p-3 sm:p-4 bg-red-900/30 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed break-words">{errorMessage}</span>
              </motion.div>
            )}

            {status === 'rate-limited' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-5 p-4 sm:p-5 bg-orange-900/30 border border-orange-500/40 rounded-xl flex flex-col items-center gap-3 text-orange-400 text-center">
                <AlertCircle className="w-8 h-8" />
                <span className="font-semibold text-base">Too many failed attempts.</span>
                <span className="text-sm text-orange-300/80">Try again later.</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={status === 'rate-limited' || status === 'loading' || status === 'success'} className="w-full min-w-0 bg-black/40 border border-[var(--color-border)] rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600 disabled:opacity-50 text-base sm:text-lg" placeholder="name@example.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required disabled={status === 'rate-limited' || status === 'loading' || status === 'success'} className="w-full min-w-0 bg-black/40 border border-[var(--color-border)] rounded-xl py-3 pl-12 pr-12 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600 disabled:opacity-50 text-base sm:text-lg" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={status === 'rate-limited' || status === 'loading' || status === 'success'} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none disabled:opacity-50 transition-colors" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button disabled={status === 'rate-limited' || status === 'loading' || status === 'success'} type="submit" className={`w-full mt-3 sm:mt-4 font-medium py-3.5 rounded-xl transition-all flex items-center justify-center disabled:opacity-70 border text-base sm:text-lg ${status === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/30'}`}>
              {status === 'loading' ? <Loader2 className="w-6 h-6 animate-spin" /> : status === 'success' ? 'Authenticated Successfully' : 'Authenticate'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 mt-5 sm:mt-6 text-sm">
          Don't have an account? <Link to="/signin" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
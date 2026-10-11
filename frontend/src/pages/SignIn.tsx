import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ShieldAlert, CheckCircle, ArrowLeft, Loader2, User, AlertCircle, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';
export default function SignIn() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to create account.');
      } else {
        setStep(2);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Backend endpoint unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        setErrorMessage(data.message || 'Verification failed.');
      } else {
        setStep(3);
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Backend endpoint unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (isLoading) return;
    setErrorMessage('');
    setIsLoading(true);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        setErrorMessage(data.message || 'Failed to resend code.');
      } else {
        // Just show a subtle message or clear error
        setErrorMessage('');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Backend endpoint unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-lg relative">
        <Link 
          to="/" 
          className="absolute -top-12 left-0 flex items-center gap-2 text-gray-400 hover:text-indigo-300 transition-colors text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-md px-2 py-1 -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        
        <div className="backdrop-blur-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-10 sm:p-12 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-8 text-center">
                  <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Create Account</h2>
                  <p className="text-gray-400 text-sm">Join the secure platform today.</p>
                </div>
                
                {errorMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="mb-6 p-4 bg-red-900/30 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-400 text-sm"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{errorMessage}</span>
                  </motion.div>
                )}

                <form onSubmit={handleInitialSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Email Address</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                      <input 
                        type="email" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required 
                        className="w-full bg-black/40 border border-[var(--color-border)] rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600 text-lg"
                        placeholder="name@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Username</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                      <input 
                        type="text" 
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required 
                        minLength={2}
                        maxLength={32}
                        className="w-full bg-black/40 border border-[var(--color-border)] rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600 text-lg"
                        placeholder="johndoe"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Create Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                      <input 
                        type="password" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required 
                        minLength={12}
                        className="w-full bg-black/40 border border-[var(--color-border)] rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600 text-lg"
                        placeholder="Min 12 characters"
                      />
                    </div>
                  </div>
                  <button 
                    disabled={isLoading}
                    type="submit" 
                    className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3.5 rounded-xl transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] border border-indigo-400/30 text-lg outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
                  >
                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Continue'}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-indigo-900/30 border border-indigo-500/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(79,70,229,0.2)]">
                    <ShieldAlert className="w-10 h-10 text-indigo-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">Verify Email</h2>
                  <p className="text-gray-400">We've sent a 6-digit one-time password to <span className="font-medium text-white">{email}</span>.</p>
                </div>
                
                {errorMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="mb-6 p-4 bg-red-900/30 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-400 text-sm"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{errorMessage}</span>
                  </motion.div>
                )}

                <form onSubmit={handleOTPSubmit} className="space-y-6">
                  <div>
                    <input 
                      type="text" 
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                      required 
                      maxLength={6}
                      className="w-full bg-black/40 border border-[var(--color-border)] rounded-xl py-4 text-center text-3xl tracking-[0.5em] font-mono text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all uppercase placeholder:text-gray-700"
                      placeholder="------"
                    />
                  </div>
                  <button 
                    disabled={isLoading || code.length !== 6}
                    type="submit" 
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3.5 rounded-xl transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(79,70,229,0.3)] border border-indigo-400/30 text-lg outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
                  >
                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Verify Account'}
                  </button>
                  <div className="text-center mt-4">
                    <button 
                      type="button" 
                      onClick={handleResend}
                      disabled={isLoading}
                      className="text-indigo-400 hover:text-indigo-300 text-sm font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      Resend Code
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                >
                  <CheckCircle className="w-24 h-24 text-emerald-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]" />
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-3">Verified Successfully</h2>
                <p className="text-gray-400">Redirecting to login...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {step === 1 && (
          <p className="text-center text-gray-500 mt-6 text-sm">
            Already have an account? <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium outline-none focus-visible:underline">Log in</Link>
          </p>
        )}
      </div>
    </div>
  );
}

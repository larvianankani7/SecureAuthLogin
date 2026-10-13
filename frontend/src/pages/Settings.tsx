import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Hash, Shield, Calendar, LogOut, Loader2, Save, AlertCircle, CheckCircle, Trash2, AlertTriangle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../lib/api';
type FetchedUser = {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
};

export default function Settings() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  
  // Real profile data from the backend
  const [profileData, setProfileData] = useState<any>(null);

  // Admin user management state
  const [users, setUsers] = useState<FetchedUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Reset username input if user context changes
  useEffect(() => {
    if (user?.username) {
      setUsername(user.username);
    }
  }, [user]);

  // Fetch actual profile data
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/me`, { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          setProfileData(data.user);
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
    };
    fetchProfile();
  }, [user]);

  // Fetch admin users if user is admin
  useEffect(() => {
    if (user?.role === 'admin') {
      const fetchUsers = async () => {
        setIsLoadingUsers(true);
        try {
          const res = await fetch(`${API_BASE_URL}/api/admin/users`, { credentials: "include" });
          if (!res.ok) throw new Error('Failed to fetch');
          const data = await res.json();
          setUsers(data.users || []);
        } catch (err) {
          console.error("Failed to fetch admin users:", err);
          setUsers([]);
        } finally {
          setIsLoadingUsers(false);
        }
      };
      fetchUsers();
    }
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSave = async () => {
    if (username === user?.username) return;
    if (!username.trim()) {
      setStatus('error');
      setMessage('Username cannot be empty.');
      return;
    }

    setStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          username
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update username.");
      }
      
      // Update local context safely
      if (user) {
        setUser({ ...user, username: data.user?.username || username });
      }
      
      setStatus('success');
      setMessage('Profile updated successfully.');
      setTimeout(() => setStatus('idle'), 3000);
      
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('Backend endpoint unavailable. Changes not saved.');
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userToDelete}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(data.message || 'Deletion rejected by backend');
      }
      
      setUsers(users.filter(u => u.id !== userToDelete));
      setUserToDelete(null);
      
      setStatus('success');
      setMessage(data.message || 'Account deleted successfully.');
      setTimeout(() => setStatus('idle'), 5000);
      
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Backend endpoint unavailable. Account deletion failed.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  const displayCreatedAt = profileData?.createdAt 
    ? new Date(profileData.createdAt).toLocaleString() 
    : user.createdAt;

  return (
    <div className="max-w-4xl mx-auto w-full py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Account Settings</h1>
        <p className="text-gray-400">Manage your profile and security preferences.</p>
      </div>
      
      <div className="grid grid-cols-1 gap-8">
        
        {/* Profile Section */}
        <motion.section 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-xl"
        >
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" /> Public Profile
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-gray-300 block mb-2">Username</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input 
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-black/40 border border-[var(--color-border)] rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                  />
                </div>
                <button 
                  onClick={handleSave}
                  disabled={status === 'saving' || username === user.username}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(79,70,229,0.2)] whitespace-nowrap"
                >
                  {status === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {status === 'error' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{message}</span>
                  </div>
                </motion.div>
              )}
              {status === 'success' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div className="p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{message}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* Account Details Section */}
        <motion.section 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="backdrop-blur-xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-xl"
        >
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" /> Account Security
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">User ID (Immutable)</label>
              <div className="flex items-start gap-3 bg-black/30 border border-white/5 p-3.5 rounded-xl text-gray-300 min-w-0">
                <Hash className="w-5 h-5 text-gray-500" />
                <span className="font-mono text-sm break-all min-w-0">{user.id}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Email Address (Immutable)</label>
              <div className="flex items-start gap-3 bg-black/30 border border-white/5 p-3.5 rounded-xl text-gray-300 min-w-0">
                <Mail className="w-5 h-5 text-gray-500" />
                <span className="text-sm truncate min-w-0">{user.email}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Assigned Role</label>
              <div className="flex items-center gap-3 bg-purple-900/10 border border-purple-500/20 p-3.5 rounded-xl text-purple-300">
                <Shield className="w-5 h-5 text-purple-400" />
                <span className="capitalize text-sm font-semibold">{user.role}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Account Created At</label>
              <div className="flex items-start gap-3 bg-black/30 border border-white/5 p-3.5 rounded-xl text-gray-300 min-w-0">
                <Calendar className="w-5 h-5 text-gray-500" />
                <span className="text-sm">{displayCreatedAt}</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* User Management Section for Admin */}
        {user.role === 'admin' && (
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="backdrop-blur-xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" /> User Directory
              </h2>
            </div>
            
            <div className="border border-[var(--color-border)] rounded-2xl overflow-x-auto bg-black/20">
              <table className="w-full min-w-[720px] text-left text-sm whitespace-nowrap">
                <thead className="bg-black/40 text-gray-400 border-b border-[var(--color-border)]">
                  <tr>
                    <th className="px-6 py-5 font-semibold tracking-wider">User ID</th>
                    <th className="px-6 py-5 font-semibold tracking-wider">Email Address</th>
                    <th className="px-6 py-5 font-semibold tracking-wider">Username</th>
                    <th className="px-6 py-5 font-semibold tracking-wider">Created</th>
                    <th className="px-6 py-5 font-semibold tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  <AnimatePresence>
                    {isLoadingUsers ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                          Loading user directory...
                        </td>
                      </tr>
                    ) : users.length > 0 ? (
                      users.map(u => (
                        <motion.tr 
                          key={u.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                          className="hover:bg-white/5 transition-colors group"
                        >
                          <td className="px-6 py-5 font-mono text-gray-400 text-xs">{u.id}</td>
                          <td className="px-6 py-5 text-gray-200 font-medium">{u.email}</td>
                          <td className="px-6 py-5 text-gray-400">{u.username}</td>
                          <td className="px-6 py-5 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleString()}</td>
                          <td className="px-6 py-5 text-right">
                            <button 
                              onClick={() => {
                                setUserToDelete(u.id);
                                setErrorMsg('');
                              }}
                              className="text-gray-500 hover:text-red-400 p-2 rounded-xl hover:bg-red-900/20 transition-all inline-flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-red-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                              aria-label={`Delete ${u.email}`}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="font-medium text-xs">Revoke</span>
                            </button>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          No normal users found in the system.
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </motion.section>
        )}

        {/* Danger Zone */}
        <motion.section 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="backdrop-blur-xl bg-red-950/10 border border-red-900/30 rounded-3xl p-6 md:p-8 shadow-xl mt-4"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold text-red-400 mb-2">Session Management</h2>
              <p className="text-gray-400 text-sm">Securely invalidate your current session and clear local state.</p>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full sm:w-auto px-6 py-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-500/30 rounded-xl transition-all font-medium flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-red-400 whitespace-nowrap"
            >
              <LogOut className="w-5 h-5" />
              Logout Securely
            </button>
          </div>
        </motion.section>

      </div>

      {/* Deletion Modal */}
      <AnimatePresence>
        {userToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#0a0518] border border-red-500/30 p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.15)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
              
              <div className="flex items-center gap-4 text-red-400 mb-6">
                <div className="p-3 bg-red-900/20 rounded-full border border-red-500/20">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-white">Revoke Access</h3>
              </div>
              
              <div className="space-y-5 text-gray-300 text-sm mb-8">
                <p>Are you sure you want to permanently delete the user account <span className="font-mono text-red-400 bg-red-900/20 px-1 py-0.5 rounded">{userToDelete}</span>?</p>
                
                <div className="bg-red-900/10 border border-red-500/20 p-5 rounded-xl text-xs leading-relaxed">
                  <p className="font-bold text-red-400 mb-2 uppercase tracking-wider">System Consequences</p>
                  <ul className="list-disc pl-4 space-y-1.5 text-gray-400">
                    <li>Account will be completely wiped from the PostgreSQL database.</li>
                    <li>The associated email will be added to the <span className="text-gray-300 font-medium">Redis blocklist</span>.</li>
                    <li>An automated warning email will be dispatched via Nodemailer.</li>
                  </ul>
                </div>

                {errorMsg && (
                  <div className="text-red-400 text-xs font-medium bg-red-900/20 p-3 rounded-lg border border-red-500/20">
                    {errorMsg}
                  </div>
                )}
              </div>
              
              <div className="flex gap-4 justify-end">
                <button 
                  onClick={() => setUserToDelete(null)}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-sm font-medium text-gray-400 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all text-sm font-medium flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.4)] disabled:opacity-70"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Confirm Deletion
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

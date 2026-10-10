import { motion } from 'framer-motion';
import { Shield, Key, Lock, Code, Database, Crosshair, Search, Clock, Route, User, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CONCEPTS = [
  {
    title: "OAuth",
    icon: <Key className="w-6 h-6 text-indigo-400" />,
    definition: "An open standard for access delegation.",
    usage: "Used to grant websites or applications access to user information on other websites without giving them the passwords.",
    example: "Clicking 'Log in with Google' on a third-party website."
  },
  {
    title: "RBAC (Role-Based Access Control)",
    icon: <Shield className="w-6 h-6 text-purple-400" />,
    definition: "A method of restricting network access based on the roles of individual users within an enterprise.",
    usage: "Used to ensure users only access information strictly necessary to perform their jobs.",
    example: "An 'admin' can delete users, while a 'user' can only view their own profile."
  },
  {
    title: "Cipher Text",
    icon: <Lock className="w-6 h-6 text-emerald-400" />,
    definition: "Text that has been encrypted and is unreadable to humans or computers without the proper cipher to decrypt it.",
    usage: "Used to protect sensitive data at rest or in transit.",
    example: "Plain text 'hello' becomes cipher text 'x$7b#9!' after encryption."
  },
  {
    title: "Cryptography",
    icon: <Code className="w-6 h-6 text-indigo-300" />,
    definition: "The practice and study of techniques for secure communication in the presence of adversarial behavior.",
    usage: "Used for confidentiality, data integrity, authentication, and non-repudiation.",
    example: "Hashing a password with Argon2 before storing it in a database."
  },
  {
    title: "SQL Queries",
    icon: <Database className="w-6 h-6 text-red-400" />,
    definition: "Commands used to communicate with a relational database.",
    usage: "Used to create, read, update, or delete data (CRUD operations).",
    example: "SELECT * FROM users WHERE email = 'admin@example.com';"
  },
  {
    title: "Sniper Attack",
    icon: <Crosshair className="w-6 h-6 text-orange-400" />,
    definition: "A targeted brute-force or credential stuffing attack testing a specific payload against a specific target.",
    usage: "Used by attackers to compromise a high-value account without making too much noise.",
    example: "An attacker using automated tools to test known passwords exclusively on the admin account."
  },
  {
    title: "Burp Suite",
    icon: <Search className="w-6 h-6 text-pink-400" />,
    definition: "An integrated platform and graphical tool for performing security testing of web applications.",
    usage: "Used by penetration testers to intercept, modify, and analyze web traffic.",
    example: "Intercepting a login request to manipulate the JWT token before it reaches the server."
  },
  {
    title: "Sliding Window",
    icon: <Clock className="w-6 h-6 text-cyan-400" />,
    definition: "A rate-limiting algorithm that tracks requests across rolling time intervals.",
    usage: "Used to prevent API abuse, brute-force attacks, and DDoS attacks smoothly without hard boundary resets.",
    example: "Allowing a maximum of 5 login attempts in any 60-second window, dropping subsequent requests."
  },
  {
    title: "A* / Greedy Algorithm",
    icon: <Route className="w-6 h-6 text-yellow-400" />,
    definition: "Pathfinding algorithms. Greedy makes the optimal choice at each step; A* combines this with the exact cost to reach the goal.",
    usage: "Used in network routing, game AI, and solving complex pathing problems efficiently.",
    example: "Finding the shortest route between two nodes in a distributed network while avoiding congested paths."
  }
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-12 py-8 max-w-6xl mx-auto w-full">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white drop-shadow-lg">
          Welcome back, <span className="text-indigo-400">{user?.username || 'User'}</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          You are currently accessing the protected dashboard through a verified session.
        </p>
      </div>

      {/* Account Overview */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="backdrop-blur-xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <User className="w-6 h-6 text-indigo-400" /> Account Overview
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-black/30 p-4 rounded-xl border border-white/5">
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">User ID</span>
            <span className="font-mono text-indigo-300 text-sm truncate block">{user?.id || '—'}</span>
          </div>
          <div className="bg-black/30 p-4 rounded-xl border border-white/5">
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email</span>
            <span className="text-gray-200 text-sm truncate block" title={user?.email}>{user?.email || '—'}</span>
          </div>
          <div className="bg-black/30 p-4 rounded-xl border border-white/5">
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Role</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider border border-purple-500/30">
              <Shield className="w-3.5 h-3.5" />
              {user?.role || '—'}
            </span>
          </div>
          <div className="bg-black/30 p-4 rounded-xl border border-white/5">
            <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Member Since</span>
            <span className="text-gray-200 text-sm block flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              {user?.createdAt || '—'}
            </span>
          </div>
        </div>
      </motion.div>

      <div className="pt-8">
        <h2 className="text-2xl font-bold text-white mb-8 px-2">Security Concepts Library</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CONCEPTS.map((concept, idx) => (
            <motion.div
              key={concept.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 hover:bg-[var(--color-surface-hover)] hover:-translate-y-1 transition-all shadow-lg hover:shadow-xl hover:shadow-indigo-500/10 group"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-3 bg-black/40 rounded-xl border border-[var(--color-border)] group-hover:scale-110 transition-transform">
                  {concept.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-100">{concept.title}</h3>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <span className="font-bold text-gray-300 block mb-1 text-xs uppercase tracking-wider">Definition</span>
                  <p className="text-gray-400 leading-relaxed">{concept.definition}</p>
                </div>
                <div>
                  <span className="font-bold text-gray-300 block mb-1 text-xs uppercase tracking-wider">Usage</span>
                  <p className="text-gray-400 leading-relaxed">{concept.usage}</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-[var(--color-border)]">
                  <span className="font-bold text-gray-500 block mb-2 text-[10px] uppercase tracking-widest">Example</span>
                  <p className="text-indigo-300 font-mono text-xs leading-relaxed">{concept.example}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

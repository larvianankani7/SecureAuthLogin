import { motion } from 'framer-motion';
import { ArrowRight, ArrowDown, Database, Server, ShieldCheck, Mail, Key, LayoutTemplate, Zap, Lock, Users, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.15 } } };
  const itemVariants = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } } };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col items-center justify-center space-y-20 sm:space-y-32 py-8 sm:py-12 pb-16 sm:pb-24 w-full min-w-0">
      <div className="text-center space-y-6 sm:space-y-8 w-full max-w-4xl px-2 sm:px-4">
        <motion.h1 variants={itemVariants} className="text-4xl xs:text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight cursor-default relative inline-block max-w-full break-words">
          <motion.div whileHover={{ y: [-2, 2, -2], filter: ['hue-rotate(0deg)', 'hue-rotate(15deg)', 'hue-rotate(0deg)'], transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }} className="bg-gradient-to-r from-indigo-300 via-purple-200 to-indigo-400 bg-clip-text text-transparent drop-shadow-2xl break-words">
            SECUREAUTHLOGIN
          </motion.div>
        </motion.h1>

        <motion.div variants={itemVariants}>
          <p className="text-xl sm:text-2xl md:text-3xl font-medium bg-gradient-to-r from-purple-400 via-indigo-300 to-purple-400 bg-[length:200%_auto] animate-gradient bg-clip-text text-transparent">
            Uncompromising Security. Elegant Experience.
          </p>
        </motion.div>

        <motion.p variants={itemVariants} className="text-base sm:text-lg md:text-xl text-gray-400 font-light leading-relaxed max-w-3xl mx-auto">
          A premium authentication product demonstrating secure session management, account protection, and administrative controls in a defense-in-depth architecture.
        </motion.p>

        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-4 sm:pt-8 w-full">
          <Link to="/signin" className="w-full sm:w-auto px-8 py-4 bg-indigo-600/90 hover:bg-indigo-500 rounded-xl transition-all text-white font-semibold text-lg border border-indigo-500/50 flex items-center justify-center gap-2 group">
            Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link to="/login" className="w-full sm:w-auto px-8 py-4 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-all text-gray-200 font-medium text-lg border border-[var(--color-border)] text-center">
            Sign In
          </Link>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="w-full max-w-5xl px-0 sm:px-4">
        <div className="backdrop-blur-xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-50" />
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-center flex items-center justify-center gap-2 sm:gap-3 text-white">
            <Server className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-400" />
            Architecture Flow
          </h2>
          <p className="text-center text-gray-400 mb-8 sm:mb-12 text-sm sm:text-base">A modular, strictly typed, and security-focused request pipeline.</p>

          <div className="hidden md:flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col items-center gap-3 w-40">
              <div className="w-24 h-24 rounded-2xl bg-blue-900/30 border border-blue-500/40 flex flex-col items-center justify-center"><LayoutTemplate className="w-8 h-8 text-blue-400 mb-1" /></div>
              <div className="text-center"><span className="font-semibold text-blue-300 block text-sm">React + Vite</span><span className="text-xs text-gray-400">Frontend Client</span></div>
            </div>
            <div className="flex flex-col items-center"><ArrowRight className="w-8 h-8 text-indigo-500/50" /><span className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-semibold">HTTPS</span></div>
            <div className="flex flex-col items-center gap-3 w-48 relative">
              <div className="w-32 h-32 rounded-2xl bg-purple-900/40 border border-purple-500/50 flex flex-col items-center justify-center p-2"><ShieldCheck className="w-10 h-10 text-purple-400 mb-2" /><span className="font-bold text-purple-200 block text-base">Fastify API</span></div>
              <div className="text-center"><span className="text-xs text-gray-400">Auth & Validation</span></div>
            </div>
            <div className="flex flex-col items-center"><ArrowRight className="w-8 h-8 text-indigo-500/50" /></div>
            <div className="grid grid-cols-2 gap-4 w-64">
              <div className="flex flex-col items-center gap-2 p-3 bg-red-900/20 border border-red-500/20 rounded-xl"><Zap className="w-5 h-5 text-red-400" /><span className="text-[11px] font-medium text-gray-300 text-center">Redis<br /><span className="text-gray-500">Rate Limit</span></span></div>
              <div className="flex flex-col items-center gap-2 p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-xl"><Database className="w-5 h-5 text-emerald-400" /><span className="text-[11px] font-medium text-gray-300 text-center">PostgreSQL<br /><span className="text-gray-500">Drizzle ORM</span></span></div>
              <div className="flex flex-col items-center gap-2 p-3 bg-yellow-900/20 border border-yellow-500/20 rounded-xl"><Mail className="w-5 h-5 text-yellow-400" /><span className="text-[11px] font-medium text-gray-300 text-center">Nodemailer<br /><span className="text-gray-500">OTP / Alerts</span></span></div>
              <div className="flex flex-col items-center gap-2 p-3 bg-cyan-900/20 border border-cyan-500/20 rounded-xl"><Key className="w-5 h-5 text-cyan-400" /><span className="text-[11px] font-medium text-gray-300 text-center">JWT / Argon2id<br /><span className="text-gray-500">Tokens & Hash</span></span></div>
            </div>
          </div>

          <div className="flex md:hidden flex-col items-center gap-5">
            <div className="flex items-center gap-4 w-full bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)]"><div className="w-12 h-12 rounded-lg bg-blue-900/30 border border-blue-500/40 flex items-center justify-center shrink-0"><LayoutTemplate className="w-6 h-6 text-blue-400" /></div><div><span className="font-semibold text-blue-300 block">React + Vite</span><span className="text-sm text-gray-400">Frontend Client</span></div></div>
            <ArrowDown className="w-6 h-6 text-indigo-500/50" />
            <div className="flex items-center gap-4 w-full bg-purple-900/20 p-4 rounded-xl border border-purple-500/30"><div className="w-14 h-14 rounded-lg bg-purple-900/40 border border-purple-500/50 flex items-center justify-center shrink-0"><ShieldCheck className="w-7 h-7 text-purple-400" /></div><div><span className="font-bold text-purple-200 block text-lg">Fastify API</span><span className="text-sm text-gray-400">Auth & Validation</span></div></div>
            <ArrowDown className="w-6 h-6 text-indigo-500/50" />
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-xl text-center"><Database className="w-5 h-5 text-emerald-400 mx-auto mb-1" /><span className="text-xs text-gray-300">PostgreSQL</span></div>
              <div className="p-3 bg-red-900/20 border border-red-500/20 rounded-xl text-center"><Zap className="w-5 h-5 text-red-400 mx-auto mb-1" /><span className="text-xs text-gray-300">Redis</span></div>
              <div className="p-3 bg-yellow-900/20 border border-yellow-500/20 rounded-xl text-center"><Mail className="w-5 h-5 text-yellow-400 mx-auto mb-1" /><span className="text-xs text-gray-300">Nodemailer</span></div>
              <div className="p-3 bg-cyan-900/20 border border-cyan-500/20 rounded-xl text-center"><Key className="w-5 h-5 text-cyan-400 mx-auto mb-1" /><span className="text-xs text-gray-300">Auth Logic</span></div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="w-full max-w-5xl px-0 sm:px-4">
        <h2 className="text-2xl sm:text-3xl font-bold mb-8 sm:mb-10 text-center text-white">Why This Stack?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {[
            [Lock, 'Argon2id Hashing', 'We never store plaintext passwords. Argon2id provides memory-hard hashing that resists brute-force and GPU-based cracking attempts better than bcrypt.'],
            [ShieldCheck, 'HttpOnly Sessions', 'Access and refresh tokens are securely handled. Refresh tokens are stored in HttpOnly cookies, protecting against XSS, while access tokens enable fast verification.'],
            [Zap, 'Redis Rate Limiting', 'Time-sensitive state like rate limits and OTP storage is backed by Redis to instantly block abusive automated credential stuffing.'],
            [Users, 'Role-Based Access', 'Strict separation of concerns. Admins have dedicated capabilities. Roles are never inferred from client-side state, always validated centrally.'],
            [RefreshCw, 'Email OTP Verification', 'Multi-factor capability ensures account recovery and identity confirmation are tied to a verifiable external channel before granting access.']
          ].map(([Icon, title, text]) => (
            <div key={title as string} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 sm:p-6 rounded-2xl">
              <Icon className="w-8 h-8 text-indigo-400 mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-200 mb-2">{title as string}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{text as string}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
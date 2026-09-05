import React, { useState } from 'react';
import { useAuth } from '@/lib/firebase/AuthContext';
import { Loader2, Mail, Lock, LogIn, UserPlus, Cpu, Activity } from 'lucide-react';
import { FuturisticBackdrop } from '@/components/futuristic/FuturisticBackdrop';

export const LoginPage: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message?.replace('Firebase: ', '') || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message?.replace('Firebase: ', '') || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="theme-dark h-screen w-screen flex bg-deep-navy overflow-hidden">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 fx-grid-bg flex-col items-center justify-center p-12 relative overflow-hidden fx-scanlines fx-scanner">
        {/* animated "video" crosshair ambience */}
        <FuturisticBackdrop dense className="absolute inset-0 w-full h-full opacity-70" />

        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-secondary-brand rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-400 rounded-full blur-3xl animate-pulse" />
        </div>
        <div className="relative z-10 text-center max-w-md fx-frame px-6 py-8">
          <span className="fx-tag absolute top-4 right-4 flex items-center gap-1">
            <Cpu className="w-3 h-3" /> AI CORE
          </span>
          <span className="fx-tag absolute bottom-4 left-4 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 fx-dot" /> ONLINE
          </span>
          <div className="w-20 h-20 mx-auto mb-6 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-cyan-300/40 shadow-[0_0_30px_-5px_rgba(6,182,212,0.6)]">
            <svg className="w-10 h-10 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white font-mono tracking-tight mb-3 fx-neon-soft">
            STRUCTURE AI DESIGNER
          </h1>
          <p className="text-cyan-100/80 text-sm leading-relaxed">
            IS Code compliant structural analysis & design. Parse STAAD .ANL files, design beams, columns, foundations, and generate professional reports.
          </p>
          <div className="mt-8 flex items-center justify-center gap-6 text-cyan-300/70 text-xs font-mono">
            <span>IS 456</span>
            <span className="w-1 h-1 rounded-full bg-cyan-400/40" />
            <span>IS 13920</span>
            <span className="w-1 h-1 rounded-full bg-cyan-400/40" />
            <span>IS 2911</span>
            <span className="w-1 h-1 rounded-full bg-cyan-400/40" />
            <span>IS 1893</span>
          </div>
          <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] font-mono text-cyan-200/50">
            <Activity className="w-3 h-3" />
            <span>LIVE FEM KERNEL • STAAD PARITY v2.4</span>
          </div>
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-8 fx-grid-bg overflow-hidden">
        {/* animated crosshair video behind the form */}
        <FuturisticBackdrop className="absolute inset-0 w-full h-full opacity-30" />
        <div className="w-full max-w-sm relative z-10 fx-glass-dark fx-scanlines rounded-2xl p-8 fx-frame">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-secondary-brand to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-deep-navy font-mono">STRUCTURE AI</h1>
          </div>

          <h2 className="text-xl font-bold text-deep-navy font-mono mb-1">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {isSignUp ? 'Sign up to save projects to the cloud' : 'Sign in to access your projects'}
          </p>

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-semibold text-slate-700 transition-colors disabled:opacity-50 mb-4 shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-mono text-slate-400 uppercase">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-mono font-semibold text-slate-500 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-secondary-brand/40 focus:border-secondary-brand/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-semibold text-slate-500 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-secondary-brand/40 focus:border-secondary-brand/60"
                />
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-mono text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="fx-glow-btn w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold font-mono disabled:opacity-50 mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSignUp ? (
                <><UserPlus className="w-4 h-4" /> Create Account</>
              ) : (
                <><LogIn className="w-4 h-4" /> Sign In</>
              )}
            </button>
          </form>

          {/* Toggle */}
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-xs font-mono text-secondary-brand hover:text-secondary-container underline"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

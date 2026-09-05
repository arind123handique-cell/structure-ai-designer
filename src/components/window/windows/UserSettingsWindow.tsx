import React, { useState } from 'react';
import { WindowContentProps } from '../Window';
import { useAuth } from '@/lib/firebase/AuthContext';
import { useUserProfileStore } from '@/features/auth/userProfileStore';
import { useProjectStore } from '@/features/projects/projectStore';
import { useThemeStore } from '@/features/theme/themeStore';
import { useVideoStore } from '@/features/video/videoStore';
import {
  User,
  Shield,
  KeyRound,
  Mail,
  Building,
  Briefcase,
  Award,
  FileText,
  Phone,
  MapPin,
  Check,
  AlertCircle,
  Loader2,
  LogOut,
  RefreshCw,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Sliders,
  CloudCheck,
} from 'lucide-react';

type SettingsTab = 'profile' | 'security' | 'defaults' | 'system';

export const UserSettingsWindow: React.FC<WindowContentProps> = ({ close }) => {
  const { user, signOut, changePassword, sendResetPasswordEmail } = useAuth();
  const profile = useUserProfileStore();
  const updateProfile = useUserProfileStore((s) => s.updateProfile);
  const activeProject = useProjectStore((s) => s.activeProject);
  const updateProjectMetadata = useProjectStore((s) => s.updateProjectMetadata);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isSoundMuted = useVideoStore((s) => s.isSoundMuted);
  const toggleMute = useVideoStore((s) => s.toggleMute);

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Profile fields state
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [designation, setDesignation] = useState(profile.designation);
  const [firmName, setFirmName] = useState(profile.firmName);
  const [licenseNumber, setLicenseNumber] = useState(profile.licenseNumber);
  const [bio, setBio] = useState(profile.bio);
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber);
  const [location, setLocation] = useState(profile.location);

  // Security fields state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  // Reset Email state
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Defaults state
  const [defaultConcreteGrade, setDefaultConcreteGrade] = useState(profile.defaultConcreteGrade);
  const [defaultSteelGrade, setDefaultSteelGrade] = useState(profile.defaultSteelGrade);
  const [defaultSeismicZone, setDefaultSeismicZone] = useState(profile.defaultSeismicZone);

  // Save profile state
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveProfile = async () => {
    updateProfile({
      displayName,
      designation,
      firmName,
      licenseNumber,
      bio,
      phoneNumber,
      location,
      defaultConcreteGrade,
      defaultSteelGrade,
      defaultSeismicZone,
    });

    // Also sync active project engineer metadata if present
    if (activeProject) {
      await updateProjectMetadata({
        engineer: displayName,
      });
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }

    setPwLoading(true);
    try {
      await changePassword(newPassword);
      setPwSuccess('Password updated successfully! Please keep it secure.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password. Please re-authenticate.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    setResetLoading(true);
    setResetMessage(null);
    try {
      await sendResetPasswordEmail(user.email);
      setResetMessage(`Password reset link sent to ${user.email}`);
    } catch (err: any) {
      setResetMessage(err.message || 'Failed to send reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-card text-on-surface font-sans select-none text-xs">
      {/* Top Banner / User Header */}
      <div className="p-4 bg-slate-900/40 border-b border-ui-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-secondary-brand to-cyan-500 flex items-center justify-center text-white font-mono text-base font-bold shadow-md">
            {displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm font-mono text-on-surface">{displayName || 'Structural Engineer'}</h3>
              <span className="px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-mono font-bold">
                {user ? 'CLOUD SYNC' : 'OFFLINE'}
              </span>
            </div>
            <p className="text-[11px] font-mono text-on-surface-variant">{user?.email || 'offline.engineer@structure.ai'}</p>
          </div>
        </div>

        {/* Quick Close / Sign Out */}
        <div className="flex items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={async () => {
                await signOut();
                close();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-red-500/30 rounded font-mono text-[11px] transition-colors"
              title="Sign Out of Session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-ui-border bg-slate-900/20 px-3">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-1.5 px-3 py-2 font-mono text-xs border-b-2 font-semibold transition-all ${
            activeTab === 'profile'
              ? 'border-secondary-brand text-secondary-brand bg-secondary-brand/10'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Profile & About</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-1.5 px-3 py-2 font-mono text-xs border-b-2 font-semibold transition-all ${
            activeTab === 'security'
              ? 'border-secondary-brand text-secondary-brand bg-secondary-brand/10'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Security & Password</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('defaults')}
          className={`flex items-center gap-1.5 px-3 py-2 font-mono text-xs border-b-2 font-semibold transition-all ${
            activeTab === 'defaults'
              ? 'border-secondary-brand text-secondary-brand bg-secondary-brand/10'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Design Defaults</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-1.5 px-3 py-2 font-mono text-xs border-b-2 font-semibold transition-all ${
            activeTab === 'system'
              ? 'border-secondary-brand text-secondary-brand bg-secondary-brand/10'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>System & Theme</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: PROFILE & ABOUT ME */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-on-surface-variant mb-1 font-semibold">
                  Engineer Full Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Er. Arindam Handique"
                    className="w-full pl-8 pr-3 py-1.5 bg-ui-surface-high border border-ui-border rounded font-mono text-xs text-on-surface focus:outline-none focus:border-secondary-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-on-surface-variant mb-1 font-semibold">
                  Professional Designation
                </label>
                <div className="relative">
                  <Briefcase className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Lead Structural Engineer"
                    className="w-full pl-8 pr-3 py-1.5 bg-ui-surface-high border border-ui-border rounded font-mono text-xs text-on-surface focus:outline-none focus:border-secondary-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-on-surface-variant mb-1 font-semibold">
                  Organization / Firm Name
                </label>
                <div className="relative">
                  <Building className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    placeholder="e.g. StructureAI Global Engineering"
                    className="w-full pl-8 pr-3 py-1.5 bg-ui-surface-high border border-ui-border rounded font-mono text-xs text-on-surface focus:outline-none focus:border-secondary-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-on-surface-variant mb-1 font-semibold">
                  License / Registration Number
                </label>
                <div className="relative">
                  <Award className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="e.g. ST-2026-IND-8941"
                    className="w-full pl-8 pr-3 py-1.5 bg-ui-surface-high border border-ui-border rounded font-mono text-xs text-on-surface focus:outline-none focus:border-secondary-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-on-surface-variant mb-1 font-semibold">
                  Phone / Contact
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-8 pr-3 py-1.5 bg-ui-surface-high border border-ui-border rounded font-mono text-xs text-on-surface focus:outline-none focus:border-secondary-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-on-surface-variant mb-1 font-semibold">
                  Site / Office Location
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Guwahati Site Office, Phase II"
                    className="w-full pl-8 pr-3 py-1.5 bg-ui-surface-high border border-ui-border rounded font-mono text-xs text-on-surface focus:outline-none focus:border-secondary-brand"
                  />
                </div>
              </div>
            </div>

            {/* About Me / Engineering Bio */}
            <div>
              <label className="block text-[11px] font-mono text-on-surface-variant mb-1 font-semibold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>About the Engineer (Bio & Structural Specializations)</span>
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your design focus, chartered credentials, seismic analysis expertise, or STAAD experience..."
                className="w-full p-2.5 bg-ui-surface-high border border-ui-border rounded font-mono text-xs text-on-surface focus:outline-none focus:border-secondary-brand"
              />
            </div>

            {saveSuccess && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-mono">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>User profile & engineer credentials saved successfully!</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveProfile}
                className="flex items-center gap-1.5 px-4 py-2 bg-secondary-brand hover:bg-blue-600 text-white rounded font-mono text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Save Profile Information</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY & PASSWORD */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <div className="p-3 bg-ui-surface-high border border-ui-border rounded-lg space-y-2">
              <h4 className="font-mono font-bold text-xs flex items-center gap-1.5 text-on-surface">
                <Mail className="w-3.5 h-3.5 text-secondary-brand" />
                <span>Account Credentials</span>
              </h4>
              <p className="text-on-surface-variant text-[11px] font-mono">
                Active Email: <strong className="text-on-surface">{user?.email || 'offline.engineer@structure.ai'}</strong>
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendResetEmail}
                  disabled={resetLoading || !user?.email}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded font-mono text-[11px] text-on-surface transition-colors"
                >
                  {resetLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3 text-sky-500" />}
                  <span>Send Password Reset Email</span>
                </button>
              </div>
              {resetMessage && (
                <p className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 mt-1">{resetMessage}</p>
              )}
            </div>

            {/* Change Password Form */}
            <form onSubmit={handleChangePassword} className="p-3 bg-ui-surface-high border border-ui-border rounded-lg space-y-3">
              <h4 className="font-mono font-bold text-xs flex items-center gap-1.5 text-on-surface">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                <span>Change Account Password</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-on-surface-variant mb-1 font-semibold">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full px-3 py-1.5 bg-ui-background border border-ui-border rounded font-mono text-xs text-on-surface focus:outline-none focus:border-secondary-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-on-surface-variant mb-1 font-semibold">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full px-3 py-1.5 bg-ui-background border border-ui-border rounded font-mono text-xs text-on-surface focus:outline-none focus:border-secondary-brand"
                  />
                </div>
              </div>

              {pwError && (
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pwError}</span>
                </div>
              )}

              {pwSuccess && (
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-mono">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{pwSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={pwLoading || !newPassword}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded font-mono text-xs font-bold transition-all shadow-sm"
              >
                {pwLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                <span>Update Password</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: DESIGN DEFAULTS */}
        {activeTab === 'defaults' && (
          <div className="space-y-4">
            <div className="p-3 bg-ui-surface-high border border-ui-border rounded-lg space-y-3">
              <h4 className="font-mono font-bold text-xs flex items-center gap-1.5 text-on-surface">
                <Sliders className="w-3.5 h-3.5 text-secondary-brand" />
                <span>Default Concrete & Steel Grades</span>
              </h4>
              <p className="text-[11px] font-mono text-on-surface-variant">
                These defaults will pre-populate new projects and auto-design iterations according to IS 456 & IS 13920.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-mono text-on-surface-variant mb-1 font-semibold">
                    Concrete Grade
                  </label>
                  <select
                    value={defaultConcreteGrade}
                    onChange={(e) => setDefaultConcreteGrade(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-ui-background border border-ui-border rounded font-mono text-xs text-on-surface"
                  >
                    <option value="M20">M20 (fck = 20 MPa)</option>
                    <option value="M25">M25 (fck = 25 MPa)</option>
                    <option value="M30">M30 (fck = 30 MPa)</option>
                    <option value="M35">M35 (fck = 35 MPa)</option>
                    <option value="M40">M40 (fck = 40 MPa)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-on-surface-variant mb-1 font-semibold">
                    Steel Grade (Rebar)
                  </label>
                  <select
                    value={defaultSteelGrade}
                    onChange={(e) => setDefaultSteelGrade(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-ui-background border border-ui-border rounded font-mono text-xs text-on-surface"
                  >
                    <option value="Fe415">Fe415 (fy = 415 MPa)</option>
                    <option value="Fe500">Fe500 (fy = 500 MPa)</option>
                    <option value="Fe500D">Fe500D (Ductile, IS 13920)</option>
                    <option value="Fe550D">Fe550D (High Strength)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-on-surface-variant mb-1 font-semibold">
                    Seismic Zone
                  </label>
                  <select
                    value={defaultSeismicZone}
                    onChange={(e) => setDefaultSeismicZone(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-ui-background border border-ui-border rounded font-mono text-xs text-on-surface"
                  >
                    <option value="Zone II">Zone II (Z = 0.10)</option>
                    <option value="Zone III">Zone III (Z = 0.16)</option>
                    <option value="Zone IV">Zone IV (Z = 0.24)</option>
                    <option value="Zone V">Zone V (Z = 0.36 - Severe)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary-brand hover:bg-blue-600 text-white rounded font-mono text-xs font-bold transition-all shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Design Defaults</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM & THEME */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            <div className="p-3 bg-ui-surface-high border border-ui-border rounded-lg space-y-3">
              <h4 className="font-mono font-bold text-xs flex items-center gap-1.5 text-on-surface">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Interface Theme & Audio</span>
              </h4>

              <div className="flex items-center justify-between p-2.5 bg-ui-background border border-ui-border rounded">
                <div>
                  <span className="font-mono font-bold text-xs block text-on-surface">Application Theme</span>
                  <span className="text-[11px] font-mono text-on-surface-variant">
                    {theme === 'light' ? 'Active: Clean Architectural Light Theme' : 'Active: Cyberpunk 2099 Dark HUD'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono text-xs font-bold transition-all ${
                    theme === 'light'
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                      : 'bg-cyber-surface hover:bg-slate-800 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                  <span>Switch to {theme === 'light' ? 'Dark' : 'Light'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-ui-background border border-ui-border rounded">
                <div>
                  <span className="font-mono font-bold text-xs block text-on-surface">Procedural Audio Telemetry</span>
                  <span className="text-[11px] font-mono text-on-surface-variant">
                    Web Audio API real-time engineering SFX
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 border border-ui-border rounded font-mono text-xs font-bold transition-colors"
                >
                  {!isSoundMuted ? <Volume2 className="w-3.5 h-3.5 text-cyber-cyan" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{!isSoundMuted ? 'Audio Enabled' : 'Audio Muted'}</span>
                </button>
              </div>
            </div>

            {/* Cloud Sync details */}
            <div className="p-3 bg-ui-surface-high border border-ui-border rounded-lg space-y-2">
              <h4 className="font-mono font-bold text-xs flex items-center gap-1.5 text-on-surface">
                <CloudCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Cloud Synchronization</span>
              </h4>
              <p className="text-[11px] font-mono text-on-surface-variant">
                Firebase Firestore auto-syncs project models, load cases, beam designs, and calculation sheets across devices.
              </p>
              <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Status: Connected to StructureAI Cloud Core</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-900/40 border-t border-ui-border flex items-center justify-between">
        <span className="text-[11px] font-mono text-on-surface-variant">
          StructureAI Studio • v2099.4 IS Code Compliant
        </span>
        <button
          type="button"
          onClick={close}
          className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-on-surface rounded font-mono text-xs font-semibold transition-colors"
        >
          Close Window
        </button>
      </div>
    </div>
  );
};

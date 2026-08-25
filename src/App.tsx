import React, { useEffect } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { AppLayout } from '@/app/layout/AppLayout';
import { AuthProvider, useAuth } from '@/lib/firebase/AuthContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProjectStorage } from '@/features/projects/projectStorage';
import { Loader2 } from 'lucide-react';

const AppInner: React.FC = () => {
  const { initializeStore, activeProject, importANL, isLoading } = useProjectStore();
  const { user, loading: authLoading } = useAuth();

  // Sync auth user to ProjectStorage for cloud sync
  useEffect(() => {
    ProjectStorage.setCloudUser(user?.uid || null);
    if (user) {
      ProjectStorage.syncFromCloud().then((count) => {
        if (count > 0) {
          useProjectStore.getState().reloadProjects();
        }
      });
    }
  }, [user]);

  // Show login page while checking auth state
  if (authLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-deep-navy text-slate-200 font-mono space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-secondary-brand" />
        <span className="text-sm font-semibold tracking-wider">LOADING...</span>
      </div>
    );
  }

  // Not logged in → show login page
  if (!user) {
    return <LoginPage />;
  }

  // Logged in → load the app
  useEffect(() => {
    const bootstrap = async () => {
      await initializeStore();
      const current = useProjectStore.getState().activeProject;
      if (!current) {
        try {
          const { SAMPLE_STAAD_ANL } = await import('@/features/anl/sampleData');
          if (SAMPLE_STAAD_ANL) {
            await importANL('STD 6MILES.ANL', SAMPLE_STAAD_ANL, {
              name: 'G+4 RCC Residential Building (6 MILES)',
              code: 'PRJ-2026-6MILE',
              engineer: 'Er. E. Rogers (Lead Structural Engineer)',
              location: '6 Miles Site, Phase II',
            });
          }
        } catch (e) {
          console.warn('Failed to load sample ANL', e);
        }
      }
    };
    bootstrap();
  }, [initializeStore, importANL]);

  if (isLoading && !activeProject) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-deep-navy text-slate-200 font-mono space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-secondary-brand" />
        <span className="text-sm font-semibold tracking-wider">LOADING STRUCTURE AI DESIGNER...</span>
      </div>
    );
  }

  return <AppLayout />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
};

export default App;

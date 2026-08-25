import React, { useEffect } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { AppLayout } from '@/app/layout/AppLayout';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { initializeStore, activeProject, importANL, isLoading } = useProjectStore();

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

export default App;

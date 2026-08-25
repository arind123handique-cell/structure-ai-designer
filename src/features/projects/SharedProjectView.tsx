import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import {
  ExternalLink,
  Loader2,
  AlertTriangle,
  Download,
  Building2,
  MapPin,
  User,
  Calendar,
  Hash,
  Box,
  Layers,
  Columns3,
  Triangle,
  Shield,
} from 'lucide-react';
import { FirestoreProjectStorage } from '@/lib/firebase/firestore';
import { StoredProject, SerializedStructuralModel } from '@/features/projects/types';

const Structural3DViewer = lazy(() =>
  import('@/components/model-viewer/Structural3DViewer').then((m) => ({ default: m.Structural3DViewer }))
);

function deserializeModel(serialized: SerializedStructuralModel) {
  return {
    nodes: new Map(serialized.nodes),
    members: new Map(serialized.members),
    plates: new Map(serialized.plates),
    supports: new Map(serialized.supports),
    loadCases: new Map(serialized.loadCases),
    loadCombinations: new Map(serialized.loadCombinations),
    reactions: serialized.reactions,
    memberForces: serialized.memberForces,
    designSummaries: serialized.designSummaries
      ? new Map(serialized.designSummaries)
      : new Map(),
    storyDrifts: serialized.storyDrifts,
    boundingBox: serialized.boundingBox,
    statistics: serialized.statistics,
  };
}

export default function SharedProjectView({ token }: { token: string }) {
  const [project, setProject] = useState<StoredProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await FirestoreProjectStorage.getSharedProject(token);
        if (cancelled) return;
        if (!p) {
          setError('This share link is invalid or has been revoked.');
        } else {
          setProject(p);
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load shared project.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const model = useMemo(() => {
    if (!project?.model) return null;
    try {
      return deserializeModel(project.model);
    } catch {
      return null;
    }
  }, [project]);

  const stats = model?.statistics;

  if (loading) {
    return (
      <div className="min-h-screen bg-ui-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-sm font-mono text-slate-500">Loading shared project...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-ui-background flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl border border-red-200 shadow-lg p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Share Link Unavailable</h2>
          <p className="text-sm text-slate-600 mb-6">{error || 'Project not found.'}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-mono hover:bg-indigo-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open Structure AI Designer
          </a>
        </div>
      </div>
    );
  }

  const meta = project.metadata;
  const ds = meta.designSettings;

  return (
    <div className="min-h-screen bg-ui-background">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-600 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-indigo-200" />
          <span className="font-mono text-sm font-bold tracking-wide">
            STRUCTURE AI DESIGNER
          </span>
          <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-mono font-bold">
            SHARED PROJECT — VIEW ONLY
          </span>
        </div>
        <a
          href="/"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-mono transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open App
        </a>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Project Info Card */}
        <div className="bg-white rounded-xl border border-ui-border shadow-sm p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{meta.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                {meta.code && (
                  <span className="flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" />
                    {meta.code}
                  </span>
                )}
                {meta.engineer && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {meta.engineer}
                  </span>
                )}
                {meta.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {meta.location}
                  </span>
                )}
                {meta.date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {meta.date}
                  </span>
                )}
              </div>
              {meta.description && (
                <p className="text-xs text-slate-500 mt-2 max-w-2xl">{meta.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <span>Concrete: {ds.concreteGrade}</span>
              <span>•</span>
              <span>Steel: {ds.steelGrade}</span>
              <span>•</span>
              <span>Wind: {ds.windSpeed} m/s</span>
              <span>•</span>
              <span>Seismic Zone: {ds.seismicZone}</span>
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        {stats && (
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Nodes', value: stats.totalNodes, icon: Triangle, color: 'sky' },
              { label: 'Members', value: stats.totalMembers, icon: Layers, color: 'indigo' },
              { label: 'Beams', value: stats.totalBeams, icon: Box, color: 'emerald' },
              { label: 'Columns', value: stats.totalColumns, icon: Columns3, color: 'amber' },
              { label: 'Supports', value: stats.totalSupports, icon: Shield, color: 'rose' },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="bg-white rounded-xl border border-ui-border shadow-sm p-4 flex items-center gap-3"
              >
                <div className={`p-2.5 rounded-lg bg-${kpi.color}-50`}>
                  <kpi.icon className={`w-5 h-5 text-${kpi.color}-600`} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900 font-mono">{kpi.value}</div>
                  <div className="text-[10px] text-slate-500 font-mono uppercase">{kpi.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3D Model Viewer (read-only) */}
        {model && (
          <div className="bg-white rounded-xl border border-ui-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-ui-border bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-mono font-bold text-slate-700">3D STRUCTURAL MODEL</span>
                <span className="text-[9px] font-mono text-slate-400">— Read Only</span>
              </div>
            </div>
            <div className="h-[500px]">
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center bg-slate-50">
                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                  </div>
                }
              >
                <Structural3DViewer />
              </Suspense>
            </div>
          </div>
        )}

        {/* Import CTA */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6 text-center">
          <p className="text-sm text-slate-700 mb-3">
            Want to edit this project? Sign in and import it to your workspace.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-mono font-bold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Sign In & Import
          </a>
        </div>
      </div>
    </div>
  );
}

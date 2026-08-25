import React, { useState } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { X, UploadCloud, FileText, CheckCircle2, AlertTriangle, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export const ANLImportModal: React.FC = () => {
  const { isImportModalOpen, setImportModalOpen, importANL, activeProject } = useProjectStore();

  const [dragOver, setDragOver] = useState(false);
  const [parsingStep, setParsingStep] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null);
  const [projectName, setProjectName] = useState('');
  const [engineerName, setEngineerName] = useState('');

  if (!isImportModalOpen) return null;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    setParsingStep('Reading analysis file...');

    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setSelectedFile({ name: file.name, content });
      setProjectName(file.name.replace(/\.(anl|std)$/i, ''));
      setParsingStep(null);
    };

    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setParsingStep('Tokenizing and parsing STAAD sections...');
    try {
      await importANL(selectedFile.name, selectedFile.content, {
        name: projectName || selectedFile.name,
        engineer: engineerName || 'Lead Structural Engineer',
      });
      setSelectedFile(null);
      setParsingStep(null);
    } catch (err) {
      console.error('Import error:', err);
      setParsingStep(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-secondary-brand/10 text-secondary-brand rounded">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-deep-navy uppercase">Import STAAD Analysis File</h3>
              <p className="text-xs text-slate-500">Supports STAAD.Pro .ANL and .STD input/output files</p>
            </div>
          </div>
          <button
            onClick={() => setImportModalOpen(false)}
            className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {!selectedFile ? (
            <>
              {/* Drag and drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                  dragOver
                    ? 'border-secondary-brand bg-blue-50/50 scale-[0.99]'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.anl,.std,.txt';
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (f) handleFile(f);
                  };
                  input.click();
                }}
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 text-secondary-brand flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800 font-mono">
                  Drag and drop .ANL or .STD file here
                </h4>
                <p className="text-xs text-slate-500 mt-1">or click to browse from your computer</p>
                <span className="mt-4 px-3 py-1 bg-white border border-ui-border rounded text-[11px] font-mono text-slate-600 shadow-sm">
                  Accepts .ANL, .STD files up to 50MB
                </span>
              </div>
            </>
          ) : (
            /* File Info & Configuration Form */
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-secondary-brand" />
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-800 block">{selectedFile.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {(selectedFile.content.length / 1024).toFixed(1)} KB • Ready to parse
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-xs font-mono text-red-600 hover:underline"
                >
                  Change
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">
                    PROJECT NAME
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. G+4 RCC Residential Building"
                    className="w-full px-3 py-2 text-xs font-sans border border-ui-border rounded focus:outline-none focus:border-secondary-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold text-slate-700 mb-1">
                    LEAD ENGINEER
                  </label>
                  <input
                    type="text"
                    value={engineerName}
                    onChange={(e) => setEngineerName(e.target.value)}
                    placeholder="e.g. Er. E. Rogers (Lead Structural Engineer)"
                    className="w-full px-3 py-2 text-xs font-sans border border-ui-border rounded focus:outline-none focus:border-secondary-brand"
                  />
                </div>
              </div>
            </div>
          )}

          {parsingStep && (
            <div className="p-3 bg-slate-100 border border-ui-border rounded text-xs font-mono text-slate-700 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-secondary-brand" />
              <span>{parsingStep}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-ui-border flex items-center justify-between">
          <button
            onClick={() => setImportModalOpen(false)}
            className="px-3.5 py-1.5 text-xs font-mono text-slate-600 hover:bg-slate-200 rounded transition-colors"
          >
            Cancel
          </button>

          {selectedFile && (
            <button
              onClick={handleConfirmImport}
              disabled={!!parsingStep}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-secondary-brand text-white hover:bg-blue-700 font-mono text-xs font-semibold rounded shadow transition-all disabled:opacity-50"
            >
              <span>Parse & Load Model</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

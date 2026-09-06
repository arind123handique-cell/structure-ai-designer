import React, { useState } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { X, UploadCloud, FolderOpen, CheckCircle2, ArrowRight, Loader2, Database } from 'lucide-react';

export const RCDXImportModal: React.FC = () => {
  const { isRcdxImportModalOpen, setRcdxImportModalOpen, importRCDX, activeProject } = useProjectStore();

  const [dragOver, setDragOver] = useState(false);
  const [parsingStep, setParsingStep] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  if (!isRcdxImportModalOpen) return null;

  const readFile = async (file: File) => {
    setImportError(null);
    if (!/\.rcdx$/i.test(file.name)) {
      setImportError('Only STAAD RCDC .rcdx design files are supported.');
      return;
    }
    setParsingStep('Reading .rcdx database file...');
    try {
      const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 200 * 1024 * 1024)).arrayBuffer());
      const { readRCDC } = await import('@/features/rcdx/rcdxParser');
      await readRCDC(bytes, file.name);
      setSelectedFile(file);
      setParsingStep(null);
    } catch (err) {
      console.error('RCDX validation error:', err);
      setImportError(err instanceof Error ? err.message : 'The file could not be read as a valid RCDC design database.');
      setParsingStep(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      readFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;
    setParsingStep('Parsing RCDC sections - beams, columns, slabs and load envelopes...');
    setImportError(null);
    try {
      await importRCDX(selectedFile);
      setSelectedFile(null);
      setParsingStep(null);
    } catch (err) {
      console.error('RCDX import error:', err);
      setImportError(err instanceof Error ? err.message : 'Import failed.');
      setParsingStep(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/10 text-emerald-700 rounded">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-deep-navy uppercase">Import STAAD RCDC Design</h3>
              <p className="text-xs text-slate-500">Reads actual RCC design output from STAAD RCDC .rcdx database files</p>
            </div>
          </div>
          <button
            onClick={() => setRcdxImportModalOpen(false)}
            className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {!selectedFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                dragOver
                  ? 'border-emerald-600 bg-emerald-50/50 scale-[0.99]'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.rcdx';
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) readFile(f);
                };
                input.click();
              }}
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <FolderOpen className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800 font-mono">Drag and drop an .rcdx file here</h4>
              <p className="text-xs text-slate-500 mt-1">or click to browse from your computer</p>
              <span className="mt-4 px-3 py-1 bg-white border border-ui-border rounded text-[11px] font-mono text-slate-600 shadow-sm">
                Supports RCDC Beam, Column and Slab design files
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Database className="w-5 h-5 text-emerald-700" />
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-800 block">{selectedFile.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Valid RCDC database
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedFile(null)} className="text-xs font-mono text-red-600 hover:underline">
                  Change
                </button>
              </div>
              <div className="p-3 bg-slate-50 border border-ui-border rounded text-[11px] leading-5 text-slate-600">
                <span className="font-semibold text-slate-700 block mb-1">This import provides:</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Actual RCDC beam / column reinforcement zones</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Load envelopes, combos and design summaries</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Slab panel detailing with bar schedules</span>
              </div>
            </div>
          )}

          {importError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs font-mono text-red-700">{importError}</div>
          )}

          {parsingStep && (
            <div className="p-3 bg-slate-100 border border-ui-border rounded text-xs font-mono text-slate-700 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>{parsingStep}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-ui-border flex items-center justify-between">
          <button
            onClick={() => setRcdxImportModalOpen(false)}
            className="px-3.5 py-1.5 text-xs font-mono text-slate-600 hover:bg-slate-200 rounded transition-colors"
          >
            Cancel
          </button>

          {selectedFile && !parsingStep && (
            <button
              onClick={handleConfirmImport}
              disabled={!!parsingStep}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 font-mono text-xs font-semibold rounded shadow transition-all disabled:opacity-50"
            >
              <span>Import RCDC Design</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
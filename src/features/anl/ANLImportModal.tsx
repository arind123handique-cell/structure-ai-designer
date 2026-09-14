import React, { useState, useRef } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { X, UploadCloud, FileText, CheckCircle2, AlertTriangle, ArrowRight, Loader2, Sparkles, AlertCircle } from 'lucide-react';

export const ANLImportModal: React.FC = () => {
  const { isImportModalOpen, setImportModalOpen, importANL, activeProject } = useProjectStore();

  const [dragOver, setDragOver] = useState(false);
  const [parsingStep, setParsingStep] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null);
  const [projectName, setProjectName] = useState('');
  const [engineerName, setEngineerName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isImportModalOpen) return null;

  const processFileContent = (name: string, content: string) => {
    if (!content || !content.trim()) {
      setImportError('Selected file appears to be empty or could not be read. Please check file content.');
      setParsingStep(null);
      return;
    }
    setSelectedFile({ name, content });
    setProjectName(name.replace(/\.(anl|std|ifc|txt)$/i, ''));
    setImportError(null);
    setParsingStep(null);
  };

  const handleFile = async (file: File) => {
    setParsingStep('Reading analysis file...');
    setImportError(null);
    try {
      if ((file as any).path && (window as any).__STRUCTURE_AI_DESKTOP__?.readFile) {
        const res = await (window as any).__STRUCTURE_AI_DESKTOP__.readFile((file as any).path);
        const content = res.content || (res.data ? new TextDecoder('utf-8').decode(res.data) : '');
        processFileContent(file.name, content);
      } else {
        const content = await file.text();
        processFileContent(file.name, content);
      }
    } catch (err: any) {
      console.error('File read error:', err);
      setImportError(`Failed to read file: ${err.message || 'Unknown error'}`);
      setParsingStep(null);
    }
  };

  const triggerFilePicker = async () => {
    setImportError(null);
    // 1. If running in native desktop, open the native OS file picker
    if (typeof window !== 'undefined' && (window as any).__STRUCTURE_AI_DESKTOP__?.openFileDialog) {
      try {
        const result = await (window as any).__STRUCTURE_AI_DESKTOP__.openFileDialog({
          filters: [
            { name: 'STAAD & BIM Models (*.std, *.anl, *.ifc, *.txt)', extensions: ['std', 'anl', 'ifc', 'txt'] },
            { name: 'STAAD Analysis (*.anl)', extensions: ['anl'] },
            { name: 'STAAD Input (*.std)', extensions: ['std'] },
            { name: 'IFC BIM Models (*.ifc)', extensions: ['ifc'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });
        if (result && result.fileName) {
          const content = result.content || (result.data ? new TextDecoder('utf-8').decode(result.data) : '');
          processFileContent(result.fileName, content);
          return;
        }
      } catch (err: any) {
        console.warn('Native dialog failed, falling back to web file input:', err);
      }
    }

    // 2. Web fallback: click DOM input element
    fileInputRef.current?.click();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    setImportError(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setParsingStep('Tokenizing and parsing STAAD sections...');
    setImportError(null);
    try {
      await importANL(selectedFile.name, selectedFile.content, {
        name: projectName || selectedFile.name,
        engineer: engineerName || 'Lead Structural Engineer',
      });
      setSelectedFile(null);
      setParsingStep(null);
      setImportModalOpen(false);
    } catch (err: any) {
      console.error('Import error:', err);
      setImportError(`Import failed: ${err.message || 'Error parsing STAAD / BIM file. Please verify file format.'}`);
      setParsingStep(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col">
        {/* Hidden fallback DOM file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".anl,.std,.ifc,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />

        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-secondary-brand/10 text-secondary-brand rounded">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-deep-navy uppercase">Import STAAD / IFC BIM Model</h3>
              <p className="text-xs text-slate-500">Supports STAAD.Pro .ANL, .STD and IFC 2x3 / IFC4 BIM models</p>
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
          {importError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs font-mono text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <span className="font-bold block text-red-800">File Upload / Parsing Issue</span>
                <span>{importError}</span>
              </div>
            </div>
          )}

          {!selectedFile ? (
            <>
              {/* Drag and drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                }}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                  dragOver
                    ? 'border-secondary-brand bg-blue-50/50 scale-[0.99]'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
                onClick={triggerFilePicker}
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 text-secondary-brand flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800 font-mono">
                  Drag and drop .ANL or .STD file here
                </h4>
                <p className="text-xs text-slate-500 mt-1">or click to browse from your computer</p>
                <span className="mt-4 px-3 py-1 bg-white border border-ui-border rounded text-[11px] font-mono text-slate-600 shadow-sm">
                  Accepts .ANL, .STD, .IFC files up to 100MB
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
                  onClick={() => { setSelectedFile(null); setImportError(null); }}
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

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={!!parsingStep}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 px-4 bg-secondary-brand hover:bg-blue-700 text-white font-mono text-xs font-bold rounded shadow transition-all disabled:opacity-50"
                >
                  {parsingStep ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{parsingStep}</span>
                    </>
                  ) : (
                    <>
                      <span>Parse & Load Model Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
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

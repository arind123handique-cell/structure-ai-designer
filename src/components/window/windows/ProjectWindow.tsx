import React, { useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  TxtField,
  SelField,
  WindowBtn,
  WindowFooterBar,
} from '../WindowUI';

/**
 * PROJECT INFORMATION
 *
 * Edits the active project's catalog metadata (name, number, client, location,
 * engineer, designer, checker, description) and the design codes.
 */
export const ProjectWindow: React.FC<WindowContentProps> = ({ close, setDirty }) => {
  const activeProject = useProjectStore((s) => s.activeProject);
  const updateProjectMetadata = useProjectStore((s) => s.updateProjectMetadata);

  const meta = activeProject?.metadata;
  const [name, setName] = useState(meta?.name || '');
  const [code, setCode] = useState(meta?.code || '');
  const [client, setClient] = useState(meta?.client || '');
  const [location, setLocation] = useState(meta?.location || '');
  const [engineer, setEngineer] = useState(meta?.engineer || '');
  const [description, setDescription] = useState(meta?.description || '');
  const [concreteCode, setConcreteCode] = useState(meta?.designSettings.code === 'IS13920_2016' ? 'IS13920_2016' : 'IS456_2000');
  const [unitSystem] = useState('kN-m');

  const mark = () => setDirty(true);

  const apply = async (doClose: boolean) => {
    await updateProjectMetadata({
      name,
      code,
      client,
      location,
      engineer,
      description,
      designSettings: {
        ...meta?.designSettings,
        code: concreteCode === 'IS13920_2016' ? 'IS13920_2016' : ('IS456_2000' as any),
      } as any,
    });
    setDirty(false);
    if (doClose) close();
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Project">
          <TxtField label="Project Name" value={name} onChange={(v) => { setName(v); mark(); }} />
          <TxtField label="Project Number" value={code} onChange={(v) => { setCode(v); mark(); }} />
          <TxtField label="Client" value={client} onChange={(v) => { setClient(v); mark(); }} />
          <TxtField label="Location" value={location} onChange={(v) => { setLocation(v); mark(); }} />
          <TxtField label="Engineer" value={engineer} onChange={(v) => { setEngineer(v); mark(); }} />
          <div className="mb-2">
            <span className="text-[10px] font-semibold uppercase text-slate-400">Description</span>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); mark(); }}
              className="w-full h-16 px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs outline-none focus:border-sky-500"
            />
          </div>
        </WindowSection>

        <WindowSection title="Design Codes">
          <SelField
            label="Concrete Code"
            value={concreteCode}
            onChange={(v) => { setConcreteCode(v); mark(); }}
            options={[
              { value: 'IS456_2000', label: 'IS 456:2000' },
              { value: 'IS13920_2016', label: 'IS 456 + IS 13920:2016 (ductile)' },
            ]}
          />
          <div className="text-[10px] text-slate-500">
            Seismic: IS 1893:2016 · Loads: IS 875 · Steel: IS 800 · Foundation: IS 2911 / IS 6403
          </div>
        </WindowSection>

        <WindowSection title="Unit System">
          <SelField
            label="Units"
            value={unitSystem}
            onChange={() => {}}
            options={[{ value: 'kN-m', label: 'kN-m (Force/Moment)' }]}
          />
        </WindowSection>
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Cancel
        </WindowBtn>
        <WindowBtn variant="primary" onClick={() => apply(false)}>
          Apply
        </WindowBtn>
        <WindowBtn variant="success" onClick={() => apply(true)}>
          OK
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};
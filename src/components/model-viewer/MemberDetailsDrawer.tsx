// @ts-nocheck
/**
 * MemberDetailsDrawer — right-side overlay panel when a structural member is selected.
 * Shows: member info, BMD, SFD, design status, rebar callout, and 3D rebar cross-section.
 */
import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { X, CheckCircle2, AlertTriangle, XCircle, Ruler, Weight, Cpu } from 'lucide-react';

interface MemberForceRecord {
  memberId: number;
  loadCaseId: number;
  sectionLocation: number;
  axial: number;
  vy: number;
  vz: number;
  torsion: number;
  my: number;
  mz: number;
}

interface MemberDetailsDrawerProps {
  memberId: number;
  isColumn: boolean;
  b_mm: number;
  D_mm: number;
  length_m: number;
  node1Id: number;
  node2Id: number;
  colDesign?: any;
  beamDesign?: any;
  memberForces: MemberForceRecord[];
  onClose: () => void;
}

/* ── SVG BMD / SFD Diagram ──────────────────────────────────────────────── */

interface DiagramProps {
  values: { x: number; y: number }[];
  label: string;
  unit: string;
  color: string;
  fillColor: string;
  width: number;
  height: number;
}

function DiagramSVG({ values, label, unit, color, fillColor, width, height }: DiagramProps) {
  if (!values || values.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-500 italic" style={{ width, height }}>
        No data available
      </div>
    );
  }

  const padL = 48;
  const padR = 8;
  const padT = 16;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xMin = values[0].x;
  const xMax = values[values.length - 1].x;
  const xRange = Math.max(xMax - xMin, 0.001);
  const yAbsMax = Math.max(...values.map((v) => Math.abs(v.y)), 0.001);
  const yMin = -yAbsMax * 1.15;
  const yMax = yAbsMax * 1.15;
  const yRange = yMax - yMin;

  const sx = (x: number) => padL + ((x - xMin) / xRange) * plotW;
  const sy = (y: number) => padT + ((yMax - y) / yRange) * plotH;

  const baselineY = sy(0);
  const linePts = values.map((v) => `${sx(v.x).toFixed(1)},${sy(v.y).toFixed(1)}`).join(' ');
  const fillPts = `${sx(xMin).toFixed(1)},${baselineY.toFixed(1)} ${linePts} ${sx(xMax).toFixed(1)},${baselineY.toFixed(1)}`;

  const tickCount = 5;
  const xTicks = Array.from({ length: tickCount + 1 }, (_, i) => xMin + (xRange * i) / tickCount);
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (yRange * i) / 4);

  return (
    <svg width={width} height={height} className="block">
      {/* Grid */}
      {xTicks.map((t, i) => (
        <line key={`xg${i}`} x1={sx(t)} y1={padT} x2={sx(t)} y2={padT + plotH} stroke="#1e293b" strokeWidth={0.5} />
      ))}
      {yTicks.map((t, i) => (
        <line key={`yg${i}`} x1={padL} y1={sy(t)} x2={padL + plotW} y2={sy(t)} stroke="#1e293b" strokeWidth={0.5} />
      ))}

      {/* Fill */}
      <polygon points={fillPts} fill={fillColor} opacity={0.25} />

      {/* Diagram line */}
      <polyline points={linePts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />

      {/* Baseline */}
      <line x1={padL} y1={baselineY} x2={padL + plotW} y2={baselineY} stroke="#475569" strokeWidth={0.8} strokeDasharray="4 2" />

      {/* Y-axis labels */}
      {yTicks.map((t, i) => (
        <text key={`yl${i}`} x={padL - 4} y={sy(t) + 3} textAnchor="end" fill="#64748b" fontSize={8}>
          {t.toFixed(1)}
        </text>
      ))}

      {/* X-axis labels */}
      {xTicks.map((t, i) => (
        <text key={`xl${i}`} x={sx(t)} y={padT + plotH + 12} textAnchor="middle" fill="#64748b" fontSize={8}>
          {t.toFixed(1)}
        </text>
      ))}

      {/* Max / Min annotations */}
      {(() => {
        const maxPt = values.reduce((a, b) => (b.y > a.y ? b : a), values[0]);
        const minPt = values.reduce((a, b) => (b.y < a.y ? b : a), values[0]);
        return (
          <>
            <circle cx={sx(maxPt.x)} cy={sy(maxPt.y)} r={3} fill={color} />
            <text x={sx(maxPt.x)} y={sy(maxPt.y) - 6} textAnchor="middle" fill={color} fontSize={8} fontWeight="bold">
              {maxPt.y.toFixed(1)}
            </text>
            {Math.abs(minPt.y) > 0.01 && (
              <>
                <circle cx={sx(minPt.x)} cy={sy(minPt.y)} r={3} fill={color} />
                <text x={sx(minPt.x)} y={sy(minPt.y) + 12} textAnchor="middle" fill={color} fontSize={8} fontWeight="bold">
                  {minPt.y.toFixed(1)}
                </text>
              </>
            )}
          </>
        );
      })()}

      {/* Label */}
      <text x={padL + 2} y={12} fill={color} fontSize={9} fontWeight="bold">
        {label}
      </text>
      <text x={width - padR} y={12} textAnchor="end" fill="#64748b" fontSize={7}>
        {unit}
      </text>
    </svg>
  );
}

/* ── 3D Rebar Cross-Section Canvas ──────────────────────────────────────── */

function RebarCrossSection({ b_mm, D_mm, colDesign, beamDesign, isColumn }: { b_mm: number; D_mm: number; colDesign?: any; beamDesign?: any; isColumn: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const w = el.clientWidth || 240;
    const h = el.clientHeight || 160;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(30, w / h, 0.001, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    el.replaceChildren(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8);
    dl.position.set(2, 3, 2);
    scene.add(dl);

    const b = b_mm / 1000;
    const D = D_mm / 1000;
    const cover = (isColumn ? 40 : 30) / 1000;
    const maxDim = Math.max(b, D, 0.2);
    camera.position.set(0, 0, maxDim * 2.2);
    camera.lookAt(0, 0, 0);

    // Concrete outline (top-down view: XY plane, looking down Z)
    const outline = new THREE.Shape();
    outline.moveTo(-b / 2, -D / 2);
    outline.lineTo(b / 2, -D / 2);
    outline.lineTo(b / 2, D / 2);
    outline.lineTo(-b / 2, D / 2);
    outline.closePath();
    const outlineMat = new THREE.MeshStandardMaterial({ color: 0x334155, transparent: true, opacity: 0.6 });
    const outlineMesh = new THREE.Mesh(new THREE.ShapeGeometry(outline), outlineMat);
    scene.add(outlineMesh);

    // Outline edges
    const edgePts = [
      new THREE.Vector3(-b / 2, -D / 2, 0),
      new THREE.Vector3(b / 2, -D / 2, 0),
      new THREE.Vector3(b / 2, D / 2, 0),
      new THREE.Vector3(-b / 2, D / 2, 0),
      new THREE.Vector3(-b / 2, -D / 2, 0),
    ];
    const edgeGeom = new THREE.BufferGeometry().setFromPoints(edgePts);
    const edgeLine = new THREE.Line(edgeGeom, new THREE.LineBasicMaterial({ color: 0x64748b }));
    scene.add(edgeLine);

    // Rebar bars
    const mainBarMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x78350f, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.8 });
    const barRadius = 0.006;
    let barGeom = new THREE.CylinderGeometry(barRadius, barRadius, 0.02, 8);
    barGeom.rotateX(Math.PI / 2);

    const hw = b / 2 - cover;
    const hd = D / 2 - cover;

    const addBar = (x: number, y: number, geom: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(geom, mainBarMat);
      m.position.set(x, y, 0);
      scene.add(m);
    };

    if (isColumn && colDesign?.rebar) {
      const rebar = colDesign.rebar;
      const cornerDia = rebar.cornerBars?.diameter || 20;
      const rScaled = ((cornerDia / 1000) / 2) * 1.2 + 0.004;
      const bg = new THREE.CylinderGeometry(rScaled, rScaled, 0.02, 8);
      bg.rotateX(Math.PI / 2);
      barGeom.dispose();
      barGeom = bg;
      // Corners
      addBar(-hw, -hd, barGeom);
      addBar(hw, -hd, barGeom);
      addBar(hw, hd, barGeom);
      addBar(-hw, hd, barGeom);
      // Face bars
      const nx = rebar.faceBars?.countX || 0;
      const ny = rebar.faceBars?.countY || 0;
      for (let i = 1; i <= nx; i++) {
        const z = -hd + (i * 2 * hd) / (nx + 1);
        addBar(-hw, z, barGeom);
        addBar(hw, z, barGeom);
      }
      for (let i = 1; i <= ny; i++) {
        const x = -hw + (i * 2 * hw) / (ny + 1);
        addBar(x, -hd, barGeom);
        addBar(x, hd, barGeom);
      }
    } else {
      // Default: 4 corner bars
      addBar(-hw, -hd, barGeom);
      addBar(hw, -hd, barGeom);
      addBar(hw, hd, barGeom);
      addBar(-hw, hd, barGeom);
    }

    // Stirrup / tie outline
    const tieInset = 0.002;
    const tiePts = [
      new THREE.Vector3(-hw - tieInset, -hd - tieInset, 0),
      new THREE.Vector3(hw + tieInset, -hd - tieInset, 0),
      new THREE.Vector3(hw + tieInset, hd + tieInset, 0),
      new THREE.Vector3(-hw - tieInset, hd + tieInset, 0),
      new THREE.Vector3(-hw - tieInset, -hd - tieInset, 0),
    ];
    const tieGeom = new THREE.BufferGeometry().setFromPoints(tiePts);
    scene.add(new THREE.Line(tieGeom, new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })));

    // Cover dimension lines
    const dimMat = new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 1 });

    // Render loop
    const animate = () => {
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    // Resize
    const ro = new ResizeObserver((entries) => {
      const { width: nw, height: nh } = entries[0].contentRect;
      if (nw > 0 && nh > 0) {
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      }
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      renderer.dispose();
      barGeom.dispose();
    };
  }, [b_mm, D_mm, colDesign, beamDesign, isColumn]);

  return <div ref={mountRef} className="w-full h-40 rounded border border-slate-700/50 overflow-hidden" />;
}

/* ── Status badge helper ────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  if (status === 'PASS') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
        <CheckCircle2 className="w-3 h-3" /> PASS
      </span>
    );
  }
  if (status === 'WARNING') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
        <AlertTriangle className="w-3 h-3" /> WARNING
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40">
      <XCircle className="w-3 h-3" /> FAIL
    </span>
  );
}

/* ── Main Drawer ────────────────────────────────────────────────────────── */

export function MemberDetailsDrawer({
  memberId,
  isColumn,
  b_mm,
  D_mm,
  length_m,
  node1Id,
  node2Id,
  colDesign,
  beamDesign,
  memberForces,
  onClose,
}: MemberDetailsDrawerProps) {
  // Envelope: max/min moment and shear across all load cases, at each section location
  const { bmd, sfd } = useMemo(() => {
    const forces = memberForces.filter((f) => f.memberId === memberId);
    if (forces.length === 0) return { bmd: [], sfd: [] };

    // Group by section location, take envelope
    const locMap = new Map<number, { maxMz: number; minMz: number; maxVy: number; minVy: number }>();
    for (const f of forces) {
      const loc = f.sectionLocation;
      const entry = locMap.get(loc) || { maxMz: -Infinity, minMz: Infinity, maxVy: -Infinity, minVy: Infinity };
      entry.maxMz = Math.max(entry.maxMz, f.mz);
      entry.minMz = Math.min(entry.minMz, f.mz);
      entry.maxVy = Math.max(entry.maxVy, f.vy);
      entry.minVy = Math.min(entry.minVy, f.vy);
      locMap.set(loc, entry);
    }

    const sortedLocs = Array.from(locMap.keys()).sort((a, b) => a - b);

    // BMD: use governing envelope (max absolute at each section)
    const bmdPoints = sortedLocs.map((loc) => {
      const e = locMap.get(loc)!;
      const y = Math.abs(e.maxMz) >= Math.abs(e.minMz) ? e.maxMz : e.minMz;
      return { x: loc, y };
    });

    // SFD: same
    const sfdPoints = sortedLocs.map((loc) => {
      const e = locMap.get(loc)!;
      const y = Math.abs(e.maxVy) >= Math.abs(e.minVy) ? e.maxVy : e.minVy;
      return { x: loc, y };
    });

    return { bmd: bmdPoints, sfd: sfdPoints };
  }, [memberId, memberForces]);

  // Design data
  const design = isColumn ? colDesign : beamDesign;
  const rebarCallout = isColumn
    ? (colDesign?.rebar?.callout || '4-T20 (default)')
    : (beamDesign?.topRebar?.callout ? `${beamDesign.topRebar.callout} / ${beamDesign.bottomRebar?.callout || '-'}` : '2-T20 / 2-T20 (default)');
  const designStatus = design?.status || null;
  const sectionLabel = `${b_mm} × ${D_mm} mm`;

  return (
    <div
      className="absolute inset-y-0 right-0 w-[420px] max-w-[90vw] bg-[#0b1120]/95 backdrop-blur-md border-l border-slate-700/60 shadow-2xl z-30 flex flex-col font-mono overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-slate-100">
            {isColumn ? 'Column' : 'Beam'} #{memberId}
          </span>
          {designStatus && <StatusBadge status={designStatus} />}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs text-slate-300">
        {/* Member info */}
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Member Information</h3>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5"><Ruler className="w-3 h-3 text-sky-400" /><span className="text-slate-500">Section:</span> <span className="text-slate-200 font-semibold">{sectionLabel}</span></div>
            <div className="flex items-center gap-1.5"><Ruler className="w-3 h-3 text-sky-400" /><span className="text-slate-500">Length:</span> <span className="text-slate-200 font-semibold">{length_m.toFixed(2)} m</span></div>
            <div className="flex items-center gap-1.5"><Weight className="w-3 h-3 text-sky-400" /><span className="text-slate-500">Node 1:</span> <span className="text-slate-200">{node1Id}</span></div>
            <div className="flex items-center gap-1.5"><Weight className="w-3 h-3 text-sky-400" /><span className="text-slate-500">Node 2:</span> <span className="text-slate-200">{node2Id}</span></div>
          </div>
        </section>

        {/* BMD */}
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Bending Moment Diagram (BMD)</h3>
          <div className="rounded border border-slate-700/50 bg-[#080e1a] p-1">
            <DiagramSVG
              values={bmd}
              label="Mz"
              unit="kNm"
              color="#f59e0b"
              fillColor="#f59e0b"
              width={380}
              height={140}
            />
          </div>
          {bmd.length > 0 && (
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
              <span>Max: {Math.max(...bmd.map((v) => v.y)).toFixed(2)} kNm</span>
              <span>Min: {Math.min(...bmd.map((v) => v.y)).toFixed(2)} kNm</span>
            </div>
          )}
        </section>

        {/* SFD */}
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Shear Force Diagram (SFD)</h3>
          <div className="rounded border border-slate-700/50 bg-[#080e1a] p-1">
            <DiagramSVG
              values={sfd}
              label="Vy"
              unit="kN"
              color="#3b82f6"
              fillColor="#3b82f6"
              width={380}
              height={140}
            />
          </div>
          {sfd.length > 0 && (
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
              <span>Max: {Math.max(...sfd.map((v) => v.y)).toFixed(2)} kN</span>
              <span>Min: {Math.min(...sfd.map((v) => v.y)).toFixed(2)} kN</span>
            </div>
          )}
        </section>

        {/* Design / Rebar */}
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Design &amp; Reinforcement</h3>
          <div className="rounded border border-slate-700/50 bg-[#080e1a] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Rebar:</span>
              <span className="text-amber-400 font-bold text-[11px]">{rebarCallout}</span>
            </div>
            {design && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status:</span>
                  <StatusBadge status={design.status} />
                </div>
                {isColumn && colDesign?.rebar && (
                  <div className="text-[10px] text-slate-500 space-y-1">
                    <div>Corners: {colDesign.rebar.cornerBars?.callout || '4-T20'} (Ø{colDesign.rebar.cornerBars?.diameter || 20})</div>
                    {colDesign.rebar.faceBars && <div>Face: {colDesign.rebar.faceBars.callout}</div>}
                    <div>pt = {colDesign.rebar.pt_prov || '-'}%</div>
                  </div>
                )}
                {!isColumn && beamDesign && (
                  <div className="text-[10px] text-slate-500 space-y-1">
                    <div>Top: {beamDesign.topRebar?.callout || '-'}</div>
                    <div>Bottom: {beamDesign.bottomRebar?.callout || '-'}</div>
                    <div>Stirrups: {beamDesign.shear?.callout || '-'}</div>
                    <div>Span: {beamDesign.spanLength?.toFixed(2)} m</div>
                  </div>
                )}
              </>
            )}
            {!design && (
              <div className="text-[10px] text-slate-600 italic">No design saved — showing default rebar layout.</div>
            )}
          </div>
        </section>

        {/* 3D Rebar Cross-Section */}
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Rebar Cross-Section (3D View)</h3>
          <RebarCrossSection
            b_mm={b_mm}
            D_mm={D_mm}
            colDesign={colDesign}
            beamDesign={beamDesign}
            isColumn={isColumn}
          />
        </section>

        {/* Member forces summary table */}
        {memberForces.length > 0 && (
          <section>
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Force Summary (Envelope)</h3>
            <div className="rounded border border-slate-700/50 bg-[#080e1a] overflow-hidden">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-slate-700/40 text-slate-500">
                    <th className="px-2 py-1 text-left">Location</th>
                    <th className="px-2 py-1 text-right">Mz (kNm)</th>
                    <th className="px-2 py-1 text-right">Vy (kN)</th>
                    <th className="px-2 py-1 text-right">Axial (kN)</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Show envelope rows at key section locations
                    const forces = memberForces.filter((f) => f.memberId === memberId);
                    const locMap = new Map<number, { maxMz: number; maxVy: number; maxAx: number }>();
                    for (const f of forces) {
                      const e = locMap.get(f.sectionLocation) || { maxMz: 0, maxVy: 0, maxAx: 0 };
                      e.maxMz = Math.max(e.maxMz, Math.abs(f.mz));
                      e.maxVy = Math.max(e.maxVy, Math.abs(f.vy));
                      e.maxAx = Math.max(e.maxAx, Math.abs(f.axial));
                      locMap.set(f.sectionLocation, e);
                    }
                    return Array.from(locMap.entries())
                      .sort((a, b) => a[0] - b[0])
                      .slice(0, 10)
                      .map(([loc, e], i) => (
                        <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/30">
                          <td className="px-2 py-1 text-slate-400">{loc.toFixed(2)} m</td>
                          <td className="px-2 py-1 text-right text-amber-400 font-mono">{e.maxMz.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right text-sky-400 font-mono">{e.maxVy.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right text-slate-300 font-mono">{e.maxAx.toFixed(2)}</td>
                        </tr>
                      ));
                  })()}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

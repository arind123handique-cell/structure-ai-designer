import React from 'react';

interface GeneralNotesSvgProps {
  width?: number;
  height?: number;
  projectName?: string;
  engineerName?: string;
}

export const GeneralNotesSvg: React.FC<GeneralNotesSvgProps> = ({
  width = 900,
  height = 540,
  projectName = 'G+4 RCC Residential Building',
  engineerName = 'Er. E. Rogers (Lead Structural Engineer)',
}) => {
  return (
    <div className="flex flex-col items-center bg-slate-950 p-6 rounded-lg border border-slate-800 shadow-2xl overflow-x-auto font-mono">
      <svg width={width} height={height} viewBox="0 0 900 540" className="select-none text-xs">
        {/* Drawing Border */}
        <rect x="15" y="15" width="870" height="510" fill="#090d16" stroke="#475569" strokeWidth="2.5" />
        <rect x="20" y="20" width="860" height="500" fill="#020617" stroke="#334155" strokeWidth="1" />

        {/* ----------------- TITLE BLOCK (BOTTOM RIGHT) ----------------- */}
        <g transform="translate(560, 410)">
          <rect x="0" y="0" width="310" height="100" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <line x1="0" y1="30" x2="310" y2="30" stroke="#334155" strokeWidth="1" />
          <line x1="0" y1="65" x2="310" y2="65" stroke="#334155" strokeWidth="1" />
          <line x1="160" y1="65" x2="160" y2="100" stroke="#334155" strokeWidth="1" />

          <text x="15" y="20" fill="#38bdf8" fontSize="12" fontWeight="bold">
            STRUCTURE AI DESIGNER
          </text>
          <text x="295" y="20" fill="#64748b" fontSize="9" textAnchor="end">
            DWG NO: STR-001
          </text>

          <text x="15" y="45" fill="#e2e8f0" fontSize="10" fontWeight="bold">
            PROJECT: {projectName}
          </text>
          <text x="15" y="58" fill="#94a3b8" fontSize="9">
            SHEET TITLE: GENERAL STRUCTURAL NOTES & IS DETAILING
          </text>

          <text x="15" y="80" fill="#cbd5e1" fontSize="9">
            ENGINEER: {engineerName}
          </text>
          <text x="15" y="93" fill="#64748b" fontSize="8">
            DATE: {new Date().toLocaleDateString()}
          </text>

          <text x="175" y="80" fill="#34d399" fontSize="9" fontWeight="bold">
            CODE: IS 456 / IS 13920
          </text>
          <text x="175" y="93" fill="#94a3b8" fontSize="8">
            STATUS: APPROVED
          </text>
        </g>

        {/* ----------------- SECTION 1: GENERAL & MATERIALS ----------------- */}
        <g transform="translate(40, 45)">
          <rect x="0" y="0" width="400" height="150" fill="#0f172a" stroke="#1e293b" rx="4" />
          <rect x="0" y="0" width="400" height="24" fill="#1e293b" rx="4" />
          <text x="15" y="16" fill="#38bdf8" fontSize="10" fontWeight="bold">
            1. GENERAL DESIGN SPECIFICATIONS & MATERIALS
          </text>

          <text x="15" y="45" fill="#cbd5e1" fontSize="9">
            1.1 ALL RCC WORK SHALL CONFORM TO IS 456:2000 & IS 13920:2016.
          </text>
          <text x="15" y="65" fill="#cbd5e1" fontSize="9">
            1.2 CONCRETE GRADES:
          </text>
          <text x="35" y="82" fill="#94a3b8" fontSize="9">
            • COLUMNS & SHEAR WALLS: M25 / M30 (fck = 25 - 30 N/mm²)
          </text>
          <text x="35" y="97" fill="#94a3b8" fontSize="9">
            • BEAMS, SLABS & FOOTINGS: M25 (fck = 25 N/mm²)
          </text>
          <text x="15" y="118" fill="#cbd5e1" fontSize="9">
            1.3 REINFORCING STEEL: HIGH YIELD TMT Fe500D (IS 1786).
          </text>
          <text x="15" y="135" fill="#cbd5e1" fontSize="9">
            1.4 CLEAR COVER TABLE:
          </text>
        </g>

        {/* ----------------- SECTION 2: CLEAR COVERS & LAP LENGTH TABLE ----------------- */}
        <g transform="translate(460, 45)">
          <rect x="0" y="0" width="400" height="150" fill="#0f172a" stroke="#1e293b" rx="4" />
          <rect x="0" y="0" width="400" height="24" fill="#1e293b" rx="4" />
          <text x="15" y="16" fill="#34d399" fontSize="10" fontWeight="bold">
            2. NOMINAL CLEAR COVER & LAP LENGTH TABLE
          </text>

          <text x="20" y="45" fill="#94a3b8" fontSize="9" fontWeight="bold">
            ELEMENT
          </text>
          <text x="160" y="45" fill="#94a3b8" fontSize="9" fontWeight="bold">
            NOMINAL COVER
          </text>
          <text x="290" y="45" fill="#94a3b8" fontSize="9" fontWeight="bold">
            TENSION LAP (Ld)
          </text>
          <line x1="15" y1="52" x2="385" y2="52" stroke="#334155" strokeWidth="1" />

          <text x="20" y="70" fill="#cbd5e1" fontSize="9">
            FOOTINGS / PILE CAPS
          </text>
          <text x="160" y="70" fill="#f97316" fontSize="9" fontWeight="bold">
            50 - 60 mm
          </text>
          <text x="290" y="70" fill="#38bdf8" fontSize="9">
            47 × dia
          </text>

          <text x="20" y="90" fill="#cbd5e1" fontSize="9">
            COLUMNS / PILES
          </text>
          <text x="160" y="90" fill="#f97316" fontSize="9" fontWeight="bold">
            40 mm
          </text>
          <text x="290" y="90" fill="#38bdf8" fontSize="9">
            47 × dia
          </text>

          <text x="20" y="110" fill="#cbd5e1" fontSize="9">
            BEAMS (SPANDREL/MAIN)
          </text>
          <text x="160" y="110" fill="#f97316" fontSize="9" fontWeight="bold">
            30 mm
          </text>
          <text x="290" y="110" fill="#38bdf8" fontSize="9">
            47 × dia
          </text>

          <text x="20" y="130" fill="#cbd5e1" fontSize="9">
            SLABS & SHEAR WALLS
          </text>
          <text x="160" y="130" fill="#f97316" fontSize="9" fontWeight="bold">
            20 - 25 mm
          </text>
          <text x="290" y="130" fill="#38bdf8" fontSize="9">
            47 × dia
          </text>
        </g>

        {/* ----------------- SECTION 3: DUCTILE SEISMIC DETAILING (IS 13920) ----------------- */}
        <g transform="translate(40, 215)">
          <rect x="0" y="0" width="820" height="175" fill="#0f172a" stroke="#1e293b" rx="4" />
          <rect x="0" y="0" width="820" height="24" fill="#1e293b" rx="4" />
          <text x="15" y="16" fill="#f43f5e" fontSize="10" fontWeight="bold">
            3. SEISMIC DUCTILE DETAILING REQUIREMENTS (IS 13920:2016)
          </text>

          <g transform="translate(15, 38)">
            <text x="0" y="10" fill="#cbd5e1" fontSize="9">
              3.1 BEAM CONFINEMENT: HOOP SPACING IN 2d ZONE FROM COLUMN FACE SHALL NOT EXCEED min(d/4, 8*db, 100 mm).
            </text>
            <text x="0" y="28" fill="#cbd5e1" fontSize="9">
              3.2 FIRST HOOP SHALL BE LOCATED AT NOT MORE THAN 50 mm FROM FACE OF SUPPORT.
            </text>
            <text x="0" y="46" fill="#cbd5e1" fontSize="9">
              3.3 POSITIVE STEEL AT JOINT FACE SHALL NOT BE LESS THAN 50% OF NEGATIVE STEEL AS PER CL. 6.2.3.
            </text>
            <text x="0" y="64" fill="#cbd5e1" fontSize="9">
              3.4 COLUMN CONFINEMENT: SPECIAL CONFINING ZONE lo = max(D, b, H/6, 450 mm) WITH TIES AT s &lt;= 100 mm c/c.
            </text>
            <text x="0" y="82" fill="#cbd5e1" fontSize="9">
              3.5 ALL STIRRUP HOOKS SHALL BE 135° BENDS WITH AN EXTENSION OF 10 × TIE DIAMETER (MIN 75 mm).
            </text>
            <text x="0" y="100" fill="#cbd5e1" fontSize="9">
              3.6 NO LAPS SHALL BE PROVIDED WITHIN PLASTIC HINGE CONFINEMENT ZONES OR WITHIN BEAM-COLUMN JOINTS.
            </text>
            <text x="0" y="118" fill="#cbd5e1" fontSize="9">
              3.7 SHEAR WALL BOUNDARY ELEMENTS SHALL BE PROVIDED WHEREVER EXTREME FIBER STRESS EXCEEDS 0.2 fck.
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
};

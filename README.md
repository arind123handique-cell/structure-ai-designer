# Structure AI Designer

AI-assisted STAAD-style structural design and analysis viewer — built with React + Vite + TypeScript + Three.js.

## Features
- STAAD .ANL import and parsing
- 3D structure visualization (Three.js)
- Project management with IndexedDB persistence (idb + zustand)
- PDF report generation (jspdf)

## Tech Stack
- React 19, Vite 6, TypeScript 5.7
- Tailwind CSS 3.4
- Zustand, idb, Three.js, lucide-react

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests (vitest) |

## Project Structure
```
src/
  app/          # App layout
  components/   # Shared components
  features/     # Projects, ANL parsing, viewer
  utils/
  types/
```

## License
Private — all rights reserved.

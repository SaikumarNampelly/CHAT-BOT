import { useMemo } from 'react';
import { useThemeStore } from '../store/themeStore';

// Curated paired glyph transitions (smooth start -> resolved symbol)
const GLYPH_PAIRS = [
  ['░', '◇'],
  ['▒', '•'],
  ['01', '◇'],
  ['10', '•'],
  ['>', '◌'],
  ['/', '▓'],
  ['+', '×'],
  ['•', '01'],
  ['◌', '◇'],
  ['×', '░'],
  ['░', '▒'],
  ['•', '◌'],
];

export default function TokenCascadeOverlay() {
  const isTransitioning = useThemeStore((s) => s.isTransitioning);
  const targetTheme = useThemeStore((s) => s.targetTheme);

  // Responsive grid & particle calculation computed only once per transition
  const cascadeData = useMemo(() => {
    if (!isTransitioning || typeof window === 'undefined') return null;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width < 768;
    const isToDark = targetTheme === 'dark';

    // Decreased box size: ~26 compact columns on desktop, ~14 on mobile
    const cols = isMobile ? 14 : 26;
    const cellWidth = width / cols;
    // Calculate rows to ensure small, petite square tiles across the viewport
    const rows = Math.min(
      Math.max(6, Math.ceil(height / cellWidth)),
      isMobile ? 24 : 16
    );

    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const normR = rows > 1 ? r / (rows - 1) : 0;
        const normC = cols > 1 ? c / (cols - 1) : 0;

        // Controlled diagonal cascade trajectory
        let spatialProgress = isToDark
          ? normC * 0.55 + normR * 0.45
          : (1 - normC) * 0.55 + (1 - normR) * 0.45;

        // Conversation area smooth lead
        let areaOffset = 0;
        if (!isMobile && normC >= 0.22) {
          areaOffset = -20;
        }

        // Fast & smooth 500ms timeline: delays staggered over 0-170ms
        const baseDelay = spatialProgress * 170 + areaOffset;
        const jitter = (Math.random() - 0.5) * 16;
        const finalDelay = Math.max(0, Math.min(180, Math.round(baseDelay + jitter)));

        const pair = GLYPH_PAIRS[Math.floor(Math.random() * GLYPH_PAIRS.length)];

        cells.push({
          id: `${r}-${c}`,
          delay: finalDelay,
          startGlyph: pair[0],
          endGlyph: pair[1],
        });
      }
    }

    // Floating Bokeh Sparks
    const particleCount = isMobile ? 14 : 22;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * 96 + 2; // % across viewport
      const y = Math.random() * 92 + 4; // % down viewport
      const normX = x / 100;
      const normY = y / 100;

      const progress = isToDark
        ? normX * 0.55 + normY * 0.45
        : (1 - normX) * 0.55 + (1 - normY) * 0.45;

      const delay = Math.round(progress * 160 + Math.random() * 25);
      const size = Math.random() > 0.6 ? 4 : (Math.random() > 0.3 ? 3 : 2);
      const driftX = Math.round((Math.random() - 0.5) * 28);
      const driftY = -Math.round(Math.random() * 24 + 10);

      particles.push({
        id: i,
        x,
        y,
        delay,
        size,
        driftX,
        driftY,
      });
    }

    return { cols, rows, cells, particles, isToDark };
  }, [isTransitioning, targetTheme]);

  if (!isTransitioning || !cascadeData) return null;

  const { cols, rows, cells, particles, isToDark } = cascadeData;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-50 overflow-hidden select-none token-cascade-backdrop ${
        isToDark
          ? 'bg-[#060a0a]/75 text-teal-300'
          : 'bg-slate-50/78 text-teal-800'
      }`}
      style={{
        backgroundImage: isToDark
          ? 'radial-gradient(circle at 55% 45%, rgba(20, 184, 166, 0.20) 0%, rgba(6, 10, 10, 0.88) 85%)'
          : 'radial-gradient(circle at 55% 45%, rgba(13, 148, 136, 0.14) 0%, rgba(248, 250, 252, 0.88) 85%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* 1. Luminous Floating Bokeh Sparks */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {particles.map((p) => (
          <div
            key={p.id}
            className={`token-particle ${
              isToDark
                ? 'bg-teal-300 shadow-[0_0_10px_rgba(45,212,191,0.95)]'
                : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]'
            }`}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}ms`,
              '--drift-x': `${p.driftX}px`,
              '--drift-y': `${p.driftY}px`,
            }}
          />
        ))}
      </div>

      {/* 2. Structured Compact Micro-Token Grid */}
      <div
        className="w-full h-full grid p-1.5 gap-1 relative z-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((cell) => (
          <div
            key={cell.id}
            className={`relative flex items-center justify-center rounded-md font-mono text-[9px] sm:text-[10px] tracking-tight token-cell ${
              isToDark
                ? 'bg-teal-950/25 border border-teal-500/10 text-teal-300'
                : 'bg-white/60 border border-slate-300/30 text-slate-700'
            }`}
            style={{
              animationDelay: `${cell.delay}ms`,
            }}
          >
            {/* Smooth in-flight optical blur-dissolve */}
            <span
              className="token-glyph-start"
              style={{ animationDelay: `${cell.delay}ms` }}
            >
              {cell.startGlyph}
            </span>
            <span
              className="token-glyph-end"
              style={{ animationDelay: `${cell.delay}ms` }}
            >
              {cell.endGlyph}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

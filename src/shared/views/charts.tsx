//
// Graphiques rendus en SVG CÔTÉ SERVEUR (renderToStaticMarkup), zéro JS
// client — cohérent avec la règle no-hydratation du projet. Statiques :
// pas de tooltip ni d'animation. Réutilisables par n'importe quelle vue.
//

function trunc(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/**
 * Anneau (donut) : segments dessinés via stroke-dasharray sur des cercles
 * empilés. Le trou central peut afficher un libellé.
 */
export function Donut({
  segments,
  size = 160,
  thickness = 28,
  centerLabel,
  centerSub,
}: {
  segments: Segment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;
  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Répartition"
    >
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke="#eef2f4"
        strokeWidth={thickness}
      />
      {total > 0 &&
        segments.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * circumference;
          const node = (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${center} ${center})`}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return node;
        })}
      {centerLabel && (
        <text
          x={center}
          y={centerSub ? center - 2 : center}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="22"
          fontWeight="700"
          fill="#1f2d3d"
        >
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text
          x={center}
          y={center + 18}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fill="#64748b"
        >
          {centerSub}
        </text>
      )}
    </svg>
  );
}

/** Barres horizontales (classement). Libellés tronqués, valeurs alignées à droite. */
export function HBars({
  items,
  width = 340,
  barColor = "#5b8aa6",
  format,
}: {
  items: { label: string; value: number }[];
  width?: number;
  barColor?: string;
  format?: (n: number) => string;
}) {
  const rowH = 22;
  const gap = 10;
  const labelW = 130;
  const valueW = 58;
  const barMax = Math.max(20, width - labelW - valueW - 10);
  const max = Math.max(1, ...items.map((i) => i.value));
  const height = Math.max(rowH, items.length * (rowH + gap) - gap);

  return (
    <svg width={width} height={height} role="img" aria-label="Classement">
      {items.map((it, i) => {
        const y = i * (rowH + gap);
        const w = Math.max(2, (it.value / max) * barMax);
        return (
          <g key={i}>
            <text
              x={0}
              y={y + rowH / 2}
              dominantBaseline="middle"
              fontSize="12"
              fill="#475569"
            >
              {trunc(it.label, 17)}
            </text>
            <rect
              x={labelW}
              y={y + 3}
              width={w}
              height={rowH - 6}
              rx={4}
              fill={barColor}
            />
            <text
              x={width}
              y={y + rowH / 2}
              dominantBaseline="middle"
              textAnchor="end"
              fontSize="11"
              fontWeight="600"
              fill="#1f2d3d"
            >
              {format ? format(it.value) : String(it.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Courbe + aire de tendance (série temporelle courte). */
export function AreaTrend({
  points,
  width = 560,
  height = 190,
  color = "#5b8aa6",
  format,
}: {
  points: { label: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
  format?: (n: number) => string;
}) {
  const padL = 46;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const gid = "areaTrendGrad";

  const xAt = (i: number) => padL + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const yAt = (v: number) => padT + h - (v / max) * h;

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`)
    .join(" ");
  const area =
    n > 0
      ? `${line} L ${xAt(n - 1).toFixed(1)} ${padT + h} L ${xAt(0).toFixed(1)} ${padT + h} Z`
      : "";

  // 3 lignes de grille horizontales (0, 50%, 100% du max).
  const grid = [0, 0.5, 1];

  return (
    <svg width={width} height={height} role="img" aria-label="Tendance">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {grid.map((g, i) => {
        const y = padT + h - g * h;
        return (
          <g key={i}>
            <line
              x1={padL}
              y1={y}
              x2={width - padR}
              y2={y}
              stroke="#eef2f4"
              strokeWidth={1}
            />
            <text x={padL - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#94a3b8">
              {format ? format(max * g) : String(Math.round(max * g))}
            </text>
          </g>
        );
      })}

      {area && <path d={area} fill={`url(#${gid})`} />}
      {n > 1 && <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}

      {points.map((p, i) => (
        <g key={i}>
          {n > 0 && <circle cx={xAt(i)} cy={yAt(p.value)} r={3} fill={color} />}
          <text x={xAt(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="#64748b">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

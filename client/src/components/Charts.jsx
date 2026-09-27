import { useState } from 'react';

const niceMax = (v) => {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) if (s * pow >= v) return s * pow;
  return 10 * pow;
};

// Bar with a 4px rounded data-end, square at the baseline
const barPath = (x, y, w, h) => {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
};

/** Single-series vertical bar chart. data: [{ label, value, detail? }] */
export function BarChart({ data, unit = 'days', height = 220 }) {
  const [hover, setHover] = useState(null);
  const W = 640;
  const pad = { l: 36, r: 8, t: 12, b: 26 };
  const innerW = W - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f * 10) / 10);
  const slot = innerW / data.length;
  const bw = Math.min(28, slot * 0.6);
  const y = (v) => pad.t + innerH - (v / max) * innerH;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`Bar chart: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'baseline' : 'gridline'} x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text className="tick" x={pad.l - 6} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + slot * i + slot / 2;
          const h = Math.max(0, innerH - (y(d.value) - pad.t));
          return (
            <g key={d.label}>
              {h > 0 && <path className={`bar ${hover === i ? 'hover' : ''}`} d={barPath(cx - bw / 2, y(d.value), bw, h)} />}
              <text className="tick" x={cx} y={height - 8} textAnchor="middle">{d.label}</text>
              <rect
                className="bar-hit"
                x={pad.l + slot * i}
                y={pad.t}
                width={slot}
                height={innerH}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="tooltip"
          style={{ left: `${((pad.l + slot * hover + slot / 2) / W) * 100}%`, top: `${(y(data[hover].value) / height) * 100}%` }}
        >
          <strong>{data[hover].label}</strong>: {data[hover].value} {unit}
          {data[hover].detail ? ` · ${data[hover].detail}` : ''}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars, each coloured by its own entity (e.g. leave type). items: [{ name, value, color }] */
export function HBars({ items, unit = 'd' }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div>
      {items.map((it) => (
        <div key={it.name} className="hbar" title={`${it.name}: ${it.value} ${unit}`}>
          <div className="name">
            {it.color && <span className="swatch" style={{ background: it.color }} />}
            {it.name}
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${(it.value / max) * 100}%`, background: it.color || 'var(--primary)' }} />
          </div>
          <div className="val">{it.value} {unit}</div>
        </div>
      ))}
    </div>
  );
}

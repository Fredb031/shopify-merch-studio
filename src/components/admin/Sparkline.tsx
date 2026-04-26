// Tiny inline-SVG sparkline used by admin tables/cards to give a sense
// of motion alongside a scalar value (inventory, orders, etc.). Keeps
// zero runtime deps — just SVG + a bit of math. If the series is empty
// or flat-zero we render a dashed muted placeholder so the column
// doesn't look broken when telemetry is missing.

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  ariaLabel?: string;
}

// Layout constants — lifted out of the render body so the geometry is
// auditable in one place and the placeholder/area branches don't drift
// out of sync when someone tweaks padding or stroke math.
const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 24;
const DEFAULT_STROKE = '#E8A838';
const DEFAULT_STROKE_WIDTH = 1.5;
// Horizontal inset so the polyline never butts into the SVG edge — the
// stroke would otherwise be clipped at half-width on the first/last
// point. Y-padding plays the same role vertically for min/max points.
const X_INSET = 1;
const X_EDGE_MARGIN = 2;
const Y_PADDING = 2;
// Half-pixel nudge keeps the baseline crisp at 1px stroke widths
// (otherwise it lands between rows and antialiases to a blurry band).
const BASELINE_OFFSET = 0.5;
// Muted zinc-300 for the "no data" dashed line — matches the rest of
// the admin shell's empty-state palette.
const PLACEHOLDER_STROKE = '#d4d4d8';
const SINGLE_POINT_RADIUS = 1.5;

export function Sparkline({
  data,
  width: rawWidth = DEFAULT_WIDTH,
  height: rawHeight = DEFAULT_HEIGHT,
  stroke = DEFAULT_STROKE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  ariaLabel,
}: SparklineProps) {
  // Defensive dimension validation — a caller passing 0, NaN, or a
  // negative width/height (e.g. from a CSS-derived measurement before
  // layout settles) would otherwise produce an invalid viewBox and a
  // blank SVG. Fall back to the defaults rather than rendering broken.
  const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : DEFAULT_WIDTH;
  const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : DEFAULT_HEIGHT;
  // Drop non-finite values (NaN / ±Infinity) up front. Stat sources
  // sometimes divide-by-zero when a comparison period has no data,
  // and a single NaN slipping into Math.min/max poisons the entire
  // computed range — every point becomes "NaN,NaN" and the polyline
  // silently disappears, leaving the cell looking broken instead of
  // showing the muted dashed placeholder we render for empty input.
  // Filtering here normalises the bad-data case to the same "no data"
  // path so the column always reads as either a real trend or an
  // explicit absence, never a phantom-empty SVG.
  const safeData = Array.isArray(data) ? data.filter(v => Number.isFinite(v)) : [];
  const isEmpty = safeData.length === 0;
  const isAllZero = !isEmpty && safeData.every(v => v === 0);

  if (isEmpty || isAllZero) {
    // Muted dashed placeholder — communicates "no data" without
    // pretending a flat line is a real trend.
    const midY = height / 2;
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel ?? 'Aucune donnée de tendance'}
        className="overflow-visible"
      >
        <line
          x1={X_EDGE_MARGIN}
          y1={midY}
          x2={width - X_EDGE_MARGIN}
          y2={midY}
          stroke={PLACEHOLDER_STROKE}
          strokeWidth={1}
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Single-point series: draw a centered dot so the column isn't empty.
  if (safeData.length === 1) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel ?? 'Tendance (1 point)'}
      >
        <circle cx={width / 2} cy={height / 2} r={SINGLE_POINT_RADIUS} fill={stroke} />
      </svg>
    );
  }

  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  // Guard against a flat non-zero series — without this, (max-min)=0
  // divides to NaN and the polyline disappears. Render it centered.
  const range = max - min || 1;
  const stepX = (width - X_EDGE_MARGIN) / (safeData.length - 1);
  const innerH = height - Y_PADDING * 2;

  const points = safeData.map((v, i) => {
    const x = X_INSET + i * stepX;
    // Invert Y (SVG grows downward) so higher values sit higher.
    const y = Y_PADDING + innerH - ((v - min) / range) * innerH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const linePath = points.join(' ');
  // Area path: close the polyline down to the baseline so we can
  // fill a translucent band beneath the stroke.
  const firstX = X_INSET;
  const lastX = X_INSET + (safeData.length - 1) * stepX;
  const baselineY = height - BASELINE_OFFSET;
  const areaPath = `M ${firstX},${baselineY} L ${points.join(' L ')} L ${lastX.toFixed(2)},${baselineY} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? `Tendance ${safeData.length} points, min ${min}, max ${max}`}
      className="overflow-visible"
    >
      <path d={areaPath} fill={stroke} fillOpacity={0.12} stroke="none" />
      <polyline
        points={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default Sparkline;

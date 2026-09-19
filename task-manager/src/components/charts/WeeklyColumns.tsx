import type { WeekPoint } from '@/lib/analytics';

/**
 * Столбцы по неделям: часть-к-целому внутри недели (в срок / с опозданием).
 * Цвета — первые два слота категориальной палитры, проверенные на различимость
 * при дальтонизме; идентичность дублируется легендой, а не только цветом.
 */
const ON_TIME = '#2a78d6';
const LATE = '#eb6834';

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 24, right: 12, bottom: 28, left: 34 };

export default function WeeklyColumns({ weeks }: { weeks: WeekPoint[] }) {
  const max = Math.max(1, ...weeks.map((week) => week.onTime + week.late));
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const band = plotWidth / Math.max(1, weeks.length);
  const barWidth = Math.min(24, band * 0.6);
  const scale = (value: number) => (value / max) * plotHeight;

  // Шаг сетки: три линии достаточно, чтобы читать порядок величины
  const ticks = [0, Math.round(max / 2), max].filter((value, index, all) => all.indexOf(value) === index);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="Выполненные задачи по неделям: в срок и с опозданием"
      >
        {ticks.map((tick) => {
          const y = PADDING.top + plotHeight - scale(tick);
          return (
            <g key={tick}>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={PADDING.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#94a3b8">
                {tick}
              </text>
            </g>
          );
        })}

        {weeks.map((week, index) => {
          const total = week.onTime + week.late;
          const x = PADDING.left + band * index + (band - barWidth) / 2;
          const baseline = PADDING.top + plotHeight;
          const lateHeight = scale(week.late);
          const onTimeHeight = scale(week.onTime);
          // 2px зазор поверхности между сегментами — разделяет без обводки
          const gap = week.late > 0 && week.onTime > 0 ? 2 : 0;

          return (
            <g key={week.label}>
              {week.onTime > 0 ? (
                <rect
                  x={x}
                  y={baseline - onTimeHeight}
                  width={barWidth}
                  height={onTimeHeight}
                  fill={ON_TIME}
                  rx={week.late > 0 ? 0 : 4}
                >
                  <title>{`${week.label}: в срок ${week.onTime}`}</title>
                </rect>
              ) : null}
              {week.late > 0 ? (
                <rect
                  x={x}
                  y={baseline - onTimeHeight - lateHeight - gap}
                  width={barWidth}
                  height={Math.max(0, lateHeight - gap)}
                  fill={LATE}
                  rx={4}
                >
                  <title>{`${week.label}: с опозданием ${week.late}`}</title>
                </rect>
              ) : null}

              {/* Подписываем только итог недели: число над каждым сегментом превратилось бы в шум */}
              {total > 0 ? (
                <text
                  x={x + barWidth / 2}
                  y={baseline - onTimeHeight - lateHeight - gap - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#475569"
                >
                  {total}
                </text>
              ) : null}

              <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="#94a3b8">
                {week.label}
              </text>
            </g>
          );
        })}

        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={PADDING.top + plotHeight}
          y2={PADDING.top + plotHeight}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
      </svg>

      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ON_TIME }} />
          в срок
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: LATE }} />
          с опозданием
        </span>
      </figcaption>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-slate-400">Показать таблицей</summary>
        <table className="mt-2 w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1">Неделя с</th>
              <th className="py-1 text-right">В срок</th>
              <th className="py-1 text-right">С опозданием</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {weeks.map((week) => (
              <tr key={week.label}>
                <td className="py-1">{week.label}</td>
                <td className="py-1 text-right tabular-nums">{week.onTime}</td>
                <td className="py-1 text-right tabular-nums">{week.late}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

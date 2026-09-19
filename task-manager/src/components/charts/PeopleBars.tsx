import type { PersonRow } from '@/lib/analytics';

const ON_TIME = '#2a78d6';
const LATE = '#eb6834';

/**
 * Сотрудники — таблица с полосой вместо отдельного графика:
 * длинные имена и точные числа читаются рядом, а не через легенду и подписи.
 */
export default function PeopleBars({ people }: { people: PersonRow[] }) {
  const max = Math.max(1, ...people.map((person) => person.onTime + person.late));

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-4 pb-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ON_TIME }} />
          в срок
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: LATE }} />
          с опозданием
        </span>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="py-1 font-medium">Сотрудник</th>
            <th className="w-1/2 py-1 font-medium">Выполнено за период</th>
            <th className="py-1 text-right font-medium">В срок</th>
            <th className="py-1 text-right font-medium">Просрочено сейчас</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {people.map((person) => {
            const total = person.onTime + person.late;
            const share = total === 0 ? 0 : Math.round((person.onTime / total) * 100);
            return (
              <tr key={person.userId}>
                <td className="py-2 pr-2 text-slate-700">{person.name}</td>
                <td className="py-2 pr-3">
                  <div className="flex h-3 items-center gap-0.5" title={`в срок ${person.onTime}, с опозданием ${person.late}`}>
                    {person.onTime > 0 ? (
                      <span
                        className="h-3 rounded-sm"
                        style={{ background: ON_TIME, width: `${(person.onTime / max) * 100}%` }}
                      />
                    ) : null}
                    {person.late > 0 ? (
                      <span
                        className="h-3 rounded-sm"
                        style={{ background: LATE, width: `${(person.late / max) * 100}%` }}
                      />
                    ) : null}
                    {total === 0 ? <span className="text-xs text-slate-300">—</span> : null}
                  </div>
                </td>
                <td className="py-2 text-right tabular-nums text-slate-600">
                  {total === 0 ? '—' : `${person.onTime} из ${total} · ${share}%`}
                </td>
                <td
                  className={`py-2 text-right tabular-nums ${
                    person.openOverdue > 0 ? 'font-medium text-red-600' : 'text-slate-400'
                  }`}
                >
                  {person.openOverdue}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { cx } from '../../../design/index.ts';

export interface ComparisonRow {
  readonly id: string;
  readonly title: string;
  readonly values: readonly [string, string];
  /** Bold, e.g. the "Total to repay" line. */
  readonly isEmphasized?: boolean;
}

interface ComparisonTableProps {
  /** Read by screen readers as the table's name. */
  caption: string;
  columns: readonly [string, string];
  rows: readonly ComparisonRow[];
  /** What-if style: the first column muted, the second highlighted (lavender header, bold where it differs). */
  highlightsSecond?: boolean;
}

/** Two figures side by side under each label, e.g. current loan vs. offer, or now vs. proposed. */
export function ComparisonTable({ caption, columns, rows, highlightsSecond = false }: ComparisonTableProps) {
  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="type-caption font-bold text-inkSoft">
          <td className="pb-2" />
          <th scope="col" className="w-24 pb-2 text-center font-bold">
            {columns[0]}
          </th>
          <th scope="col" className={cx('w-24 pb-2 text-center font-bold', highlightsSecond && 'text-lavender')}>
            {columns[1]}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const [first, second] = row.values;
          const isChanged = first !== second;
          return (
            <tr key={row.id} className={cx('type-footnote border-t border-line text-ink', row.isEmphasized && 'font-bold')}>
              <th scope="row" className={cx('py-2 pr-2 text-left', row.isEmphasized ? 'font-bold' : 'font-normal')}>
                {row.title}
              </th>
              <td className={cx('px-1 py-2 text-center', highlightsSecond && 'text-inkSoft')}>{first}</td>
              <td
                className={cx(
                  'px-1 py-2 text-center',
                  highlightsSecond && (isChanged ? 'font-bold text-ink' : 'text-inkSoft'),
                )}
              >
                {second}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

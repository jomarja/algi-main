import type { ReactNode } from 'react';

/**
 * Two columns from the wide breakpoint (1200px): a narrower leading one (inputs, summary) beside a wider trailing one
 * (results, charts). Below it they stack, leading first, so phones keep the iOS order.
 */
export function SplitColumns({ leading, trailing }: { leading: ReactNode; trailing: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:items-start">
      <div className="flex min-w-0 flex-col gap-5">{leading}</div>
      <div className="flex min-w-0 flex-col gap-5">{trailing}</div>
    </div>
  );
}

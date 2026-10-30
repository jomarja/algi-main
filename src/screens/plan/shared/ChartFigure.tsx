import { useId } from 'react';
import type { ReactNode } from 'react';

export interface ChartDatum {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

interface ChartFigureProps {
  /** What the chart shows, read as the figure's name. */
  label: string;
  /** The plotted values for screen readers, when the surrounding text doesn't already list them. */
  data?: readonly ChartDatum[];
  children: ReactNode;
}

/** Wraps a chart so assistive technology gets its name and values instead of the drawing. */
export function ChartFigure({ label, data, children }: ChartFigureProps) {
  const captionId = useId();
  return (
    <figure aria-labelledby={captionId} className="m-0 w-full">
      <figcaption id={captionId} className="sr-only">
        {label}
      </figcaption>
      <div aria-hidden>{children}</div>
      {data && data.length > 0 && (
        <ul className="sr-only">
          {data.map((datum) => (
            <li key={datum.id}>{`${datum.label}: ${datum.value}`}</li>
          ))}
        </ul>
      )}
    </figure>
  );
}

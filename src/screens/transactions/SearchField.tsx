import { useRef } from 'react';
import { Icon } from '../../design/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Also the field's accessible name. */
  placeholder: string;
}

/** The iOS search bar: a magnifying glass, the query, and a clear button once something is typed. */
export function SearchField({ value, onChange, placeholder }: SearchFieldProps) {
  const display = useDisplay();
  const input = useRef<HTMLInputElement>(null);

  const clear = () => {
    onChange('');
    input.current?.focus();
  };

  return (
    <div role="search" className="flex min-h-[44px] items-center gap-2 rounded-sm bg-cream px-3 text-inkSoft focus-within:ring-2 focus-within:ring-mint">
      <Icon name="magnifyingglass" size={17} />
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        className="type-body min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-inkMuted [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label={display.t('Clear search', 'ძიების გასუფთავება')}
          className="pressable-dim -mr-2 flex h-11 w-11 items-center justify-center text-inkMuted"
        >
          <Icon name="xmark.circle.fill" size={17} />
        </button>
      )}
    </div>
  );
}

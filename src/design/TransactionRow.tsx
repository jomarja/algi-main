import { useDisplay } from '../state/AppStateProvider.tsx';
import { cx } from './cx.ts';
import { Icon } from './Icon.tsx';
import { Pressable } from './Pressable.tsx';
import type { PressableTarget } from './Pressable.tsx';
import { palette } from './tokens.ts';
import type { PaletteToken } from './tokens.ts';

/** How a spending category looks; `CATEGORY_META[category]` from the engine fits as is. */
export interface CategoryAppearance {
  /** SF Symbol name. */
  icon: string;
  tint: PaletteToken;
  background: PaletteToken;
}

interface CategoryIconProps extends CategoryAppearance {
  size?: number;
}

export function CategoryIcon({ icon, tint, background, size = 44 }: CategoryIconProps) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.32, color: palette[tint], backgroundColor: palette[background] }}
    >
      <Icon name={icon} size={Math.round(size * 0.42)} />
    </span>
  );
}

export interface TransactionRowProps extends PressableTarget {
  merchant: string;
  /** Relative day and category, e.g. "Today · Groceries". */
  detail: string;
  /** Signed amount in the currency it was charged in, e.g. "−12.40 ₾" or "+1,800.00 ₾". */
  amount: string;
  /** The amount in the display currency, when it differs from the original; shown as "≈ …". */
  convertedAmount?: string;
  isIncome?: boolean;
  hasReceipt?: boolean;
  category: CategoryAppearance;
}

/** One transaction: merchant, when and what, and the amount in its original currency. */
export function TransactionRow({
  merchant,
  detail,
  amount,
  convertedAmount,
  isIncome = false,
  hasReceipt = false,
  category,
  to,
  onClick,
}: TransactionRowProps) {
  const display = useDisplay();
  const isPressable = to !== undefined || onClick !== undefined;

  return (
    <Pressable
      to={to}
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 py-2 text-left',
        isPressable && '-mx-2 rounded-md px-2 transition-colors hover:bg-cream/60',
      )}
    >
      <CategoryIcon icon={category.icon} tint={category.tint} background={category.background} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1">
          <span className="type-body truncate font-semibold text-ink">{merchant}</span>
          {hasReceipt && (
            <span className="text-inkMuted">
              <Icon name="doc.text" size={13} label={display.t('Receipt attached', 'ქვითარი მიმაგრებულია')} />
            </span>
          )}
        </span>
        <span className="type-footnote truncate text-inkSoft">{detail}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className={cx('type-body whitespace-nowrap font-semibold', isIncome ? 'text-mintDark' : 'text-ink')}>{amount}</span>
        {convertedAmount && <span className="type-caption whitespace-nowrap text-inkMuted">≈ {convertedAmount}</span>}
      </span>
    </Pressable>
  );
}

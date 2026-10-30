import { CategoryIcon, Icon, Sheet } from '../../design/index.ts';
import { CATEGORY_META, SPENDING_CATEGORIES, type SpendingCategoryId } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { categoryAppearance } from './transactionPresentation.ts';

interface RecategorizeSheetProps {
  isOpen: boolean;
  current: SpendingCategoryId;
  onClose: () => void;
  onSelect: (category: SpendingCategoryId) => void;
}

/** Pick a transaction's category; the change applies at once (RecategorizeSheet). */
export function RecategorizeSheet({ isOpen, current, onClose, onSelect }: RecategorizeSheetProps) {
  const display = useDisplay();

  const select = (category: SpendingCategoryId) => {
    onSelect(category);
    onClose();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={display.t('Choose a category', 'აირჩიე კატეგორია')}
      detent="large"
      leadingAction={{ title: display.t('Cancel', 'გაუქმება'), onClick: onClose }}
    >
      <div className="flex flex-col gap-2 pt-2">
        <ul className="list-rows overflow-hidden rounded-sm bg-surface">
          {SPENDING_CATEGORIES.map((category) => {
            const isCurrent = category === current;
            return (
              <li key={category} className="relative">
                <button
                  type="button"
                  aria-current={isCurrent || undefined}
                  onClick={() => select(category)}
                  className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-cream/50 active:bg-cream"
                >
                  <CategoryIcon {...categoryAppearance(category)} size={36} />
                  <span className="type-body min-w-0 flex-1 text-ink">{display.text(CATEGORY_META[category].title)}</span>
                  {isCurrent && (
                    <span className="text-mint">
                      <Icon name="checkmark" size={17} label={display.t('Current category', 'მიმდინარე კატეგორია')} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="type-footnote px-4 text-inkSoft">
          {display.t(
            'Your change is applied right away and improves future insights.',
            'ცვლილება მაშინვე აისახება და მომავალ ანალიზს გააუმჯობესებს.',
          )}
        </p>
      </div>
    </Sheet>
  );
}

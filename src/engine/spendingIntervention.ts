import { lt, type LocalizedText } from './localization.ts';
import { gel, majorUnits, maxMoney, subtract, sum, type Money } from './money.ts';
import { round } from './rounding.ts';

/** The illustrative "small change" used in the delivery-budget scenario copy. */
export const ILLUSTRATIVE_MONTHLY_REDUCTION = gel(40);
/** A revised delivery budget never goes below this. */
export const MINIMUM_DELIVERY_BUDGET = gel(60);

/** A practical swap with a transparent, estimated monthly saving. */
export interface DeliveryAlternative {
  readonly id: number;
  /** SF Symbol name; the design system maps it to an icon. */
  readonly icon: string;
  readonly title: LocalizedText;
  readonly detail: LocalizedText;
  readonly monthlySaving: Money;
}

export const DELIVERY_ALTERNATIVES: readonly DeliveryAlternative[] = [
  {
    id: 1,
    icon: 'calendar.badge.clock',
    title: lt('Pick one delivery night a week', 'კვირაში ერთი საღამო მიტანისთვის'),
    detail: lt('About one fewer order a month', 'თვეში დაახლოებით ერთი შეკვეთით ნაკლები'),
    monthlySaving: gel(37),
  },
  {
    id: 2,
    icon: 'frying.pan',
    title: lt('Cook a double batch on Sunday', 'კვირას ორმაგი ულუფა მოამზადე'),
    detail: lt('Replaces about two weekday orders', 'ჩაანაცვლებს დაახლოებით ორ შეკვეთას'),
    monthlySaving: gel(74),
  },
  {
    id: 3,
    icon: 'figure.walk',
    title: lt('Pick up instead of delivery', 'წაიღე თავად, მიტანის ნაცვლად'),
    detail: lt('Skips the delivery fee on each order', 'ყოველ შეკვეთაზე მიტანის საფასურს დაზოგავ'),
    monthlySaving: gel(20),
  },
];

/** Selected when the alternatives open. */
export const DEFAULT_SELECTED_ALTERNATIVES: readonly number[] = [1];

export function alternativesSaving(selectedIds: readonly number[]): Money {
  const selected = DELIVERY_ALTERNATIVES.filter((alternative) => selectedIds.includes(alternative.id));
  return sum(selected.map((alternative) => alternative.monthlySaving), 'GEL');
}

/** The delivery budget after the chosen swaps, never below the minimum, in 5 ₾ steps. */
export function revisedDeliveryBudget(currentBudget: Money, selectedIds: readonly number[]): Money {
  const raw = maxMoney(subtract(currentBudget, alternativesSaving(selectedIds)), MINIMUM_DELIVERY_BUDGET);
  return gel(round(majorUnits(raw) / 5) * 5);
}

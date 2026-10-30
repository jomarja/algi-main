import type { SpendingCategoryId } from '../../shared/bank.ts';
import { lt, type LocalizedText } from './localization.ts';
import type { PaletteToken } from './palette.ts';

export type { SpendingCategoryId };

/** Essential spending is protected: never cut to make a goal look achievable. */
export type SpendingPriority = 'essential' | 'flexible';

export const SPENDING_PRIORITIES: readonly SpendingPriority[] = ['essential', 'flexible'];

export const SPENDING_PRIORITY_TITLES: Readonly<Record<SpendingPriority, LocalizedText>> = {
  essential: lt('Essential', 'აუცილებელი'),
  flexible: lt('Flexible', 'მოქნილი'),
};

export interface CategoryMeta {
  readonly title: LocalizedText;
  /** SF Symbol name; the design system maps it to an icon. */
  readonly icon: string;
  readonly tint: PaletteToken;
  readonly background: PaletteToken;
  /** Fixed costs are planned for up front, so they are kept out of the weekly "safe to spend" amount. */
  readonly isFixedCost: boolean;
  /** Food, housing, health, and contractual debt are never offered as cuts, whatever the settings. */
  readonly isAlwaysProtected: boolean;
  /** Default protection level. Users can move the remaining categories between essential and flexible. */
  readonly defaultPriority: SpendingPriority;
}

export const SPENDING_CATEGORIES: readonly SpendingCategoryId[] = [
  'foodDelivery',
  'foodAndDrink',
  'groceries',
  'transport',
  'subscriptions',
  'shopping',
  'utilities',
  'health',
  'housing',
  'debt',
  'income',
];

export const CATEGORY_META: Readonly<Record<SpendingCategoryId, CategoryMeta>> = {
  foodDelivery: {
    title: lt('Food delivery', 'საკვების მიტანა'),
    icon: 'takeoutbag.and.cup.and.straw.fill',
    tint: 'coral',
    background: 'coralPale',
    isFixedCost: false,
    isAlwaysProtected: false,
    defaultPriority: 'flexible',
  },
  foodAndDrink: {
    title: lt('Food & drink', 'კაფე და რესტორანი'),
    icon: 'fork.knife',
    tint: 'coral',
    background: 'coralPale',
    isFixedCost: false,
    isAlwaysProtected: false,
    defaultPriority: 'flexible',
  },
  groceries: {
    title: lt('Groceries', 'სურსათი'),
    icon: 'cart.fill',
    tint: 'mint',
    background: 'mintPale',
    isFixedCost: false,
    isAlwaysProtected: true,
    defaultPriority: 'essential',
  },
  transport: {
    title: lt('Transport', 'ტრანსპორტი'),
    icon: 'tram.fill',
    tint: 'lavender',
    background: 'lavenderPale',
    isFixedCost: false,
    isAlwaysProtected: false,
    defaultPriority: 'essential',
  },
  subscriptions: {
    title: lt('Subscriptions', 'გამოწერები'),
    icon: 'repeat',
    tint: 'amberDeep',
    background: 'amberPale',
    isFixedCost: false,
    isAlwaysProtected: false,
    defaultPriority: 'flexible',
  },
  shopping: {
    title: lt('Shopping', 'შოპინგი'),
    icon: 'bag.fill',
    tint: 'ink',
    background: 'cream',
    isFixedCost: false,
    isAlwaysProtected: false,
    defaultPriority: 'flexible',
  },
  utilities: {
    title: lt('Bills', 'კომუნალურები'),
    icon: 'bolt.fill',
    tint: 'amberDeep',
    background: 'amberPale',
    isFixedCost: true,
    isAlwaysProtected: false,
    defaultPriority: 'essential',
  },
  health: {
    title: lt('Health', 'ჯანმრთელობა'),
    icon: 'cross.case.fill',
    tint: 'ink',
    background: 'cream',
    isFixedCost: false,
    isAlwaysProtected: true,
    defaultPriority: 'essential',
  },
  housing: {
    title: lt('Rent', 'ქირა'),
    icon: 'house.fill',
    tint: 'lavender',
    background: 'lavenderPale',
    isFixedCost: true,
    isAlwaysProtected: true,
    defaultPriority: 'essential',
  },
  debt: {
    title: lt('Loan payments', 'სესხის გადასახადი'),
    icon: 'creditcard.fill',
    tint: 'lavender',
    background: 'lavenderPale',
    isFixedCost: true,
    isAlwaysProtected: true,
    defaultPriority: 'essential',
  },
  income: {
    title: lt('Income', 'შემოსავალი'),
    icon: 'arrow.down.left',
    tint: 'mint',
    background: 'mintPale',
    isFixedCost: false,
    isAlwaysProtected: false,
    defaultPriority: 'essential',
  },
};

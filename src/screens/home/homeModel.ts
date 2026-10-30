import { compare, isZero, subtract, type Account, type Display, type Money } from '../../engine/index.ts';

/** The balance card's decorative month-to-date shape (HomeCards.swift); not plotted to scale. */
export const BALANCE_TREND: readonly number[] = [14.2, 14.0, 13.5, 13.9, 15.0, 14.6, 15.4, 16.1, 15.7, 16.6, 17.3];

/** How long "You're all caught up" stays after a refresh that found nothing new, in ms. */
export const SYNC_NOTE_DURATION_MS = 2500;

/** How much the balance grew, or null when it didn't: Luka only throws money into a rising balance. */
export function balanceIncrease(before: Money, after: Money): Money | null {
  return compare(after, before) > 0 ? subtract(after, before) : null;
}

/**
 * The accounts the balance card lists. TBC shares a multi-currency account as one entry per currency, so empty
 * currency pockets are left out; if every account is empty, they all show.
 */
export function accountsWithMoney(accounts: readonly Account[]): readonly Account[] {
  const funded = accounts.filter((account) => !isZero(account.balance));
  return funded.length > 0 ? funded : accounts;
}

/** "Total balance · 2 accounts" above the balance figure. */
export function balanceScopeText(accountCount: number, display: Display): string {
  return display.t(
    `Total balance · ${accountCount} ${accountCount === 1 ? 'account' : 'accounts'}`,
    `ჯამური ბალანსი · ${accountCount} ანგარიში`,
  );
}

/** Each account and its balance on one line under the trend, e.g. "Everyday 1,240 ₾  ·  Savings 3,000 ₾". */
export function accountsLine(accounts: readonly Account[], display: Display): string {
  return accounts
    .map((account) => `${display.text(account.name)} ${display.money(account.balance, { precision: 'whole' })}`)
    .join('  ·  ');
}

/** The account everyday spending comes from: the first current account, or else the first account. */
export function everydayAccount(accounts: readonly Account[]): Account | null {
  return accounts.find((account) => account.kind === 'current') ?? accounts[0] ?? null;
}

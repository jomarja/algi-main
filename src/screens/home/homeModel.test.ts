import { describe, expect, it } from 'vitest';
import { createDisplay, gel, lt, NON_BREAKING_SPACE as nbsp, type Account } from '../../engine/index.ts';
import { accountsLine, accountsWithMoney, balanceIncrease, balanceScopeText, everydayAccount } from './homeModel.ts';

const english = createDisplay('en', 'GEL');
const georgian = createDisplay('ka', 'GEL');

function account(id: string, kind: Account['kind'], balance: number, name = id): Account {
  return { id, name: lt(name, name), kind, balance: gel(balance) };
}

describe('balanceIncrease', () => {
  it('returns how much the balance grew', () => {
    expect(balanceIncrease(gel(100), gel(350.5))).toEqual(gel(250.5));
  });

  it('returns null when the balance stayed the same or fell', () => {
    expect(balanceIncrease(gel(100), gel(100))).toBeNull();
    expect(balanceIncrease(gel(100), gel(40))).toBeNull();
  });
});

describe('accountsWithMoney', () => {
  it('leaves out empty currency pockets of a multi-currency account', () => {
    const accounts = [account('gel', 'current', 2486.4), account('usd', 'current', 0), account('savings', 'savings', 14850)];
    expect(accountsWithMoney(accounts).map((each) => each.id)).toEqual(['gel', 'savings']);
  });

  it('shows every account when all of them are empty', () => {
    const accounts = [account('gel', 'current', 0), account('usd', 'current', 0)];
    expect(accountsWithMoney(accounts)).toEqual(accounts);
  });
});

describe('balanceScopeText', () => {
  it('counts accounts in both languages', () => {
    expect(balanceScopeText(1, english)).toBe('Total balance · 1 account');
    expect(balanceScopeText(3, english)).toBe('Total balance · 3 accounts');
    expect(balanceScopeText(3, georgian)).toBe('ჯამური ბალანსი · 3 ანგარიში');
  });
});

describe('accountsLine', () => {
  it('lists each account with its whole balance', () => {
    const accounts = [account('a', 'current', 1240.4, 'Everyday'), account('b', 'savings', 3000, 'Savings')];
    expect(accountsLine(accounts, english)).toBe(`Everyday 1,240${nbsp}₾  ·  Savings 3,000${nbsp}₾`);
  });

  it('is empty without accounts', () => {
    expect(accountsLine([], english)).toBe('');
  });
});

describe('everydayAccount', () => {
  it('prefers the first current account', () => {
    const accounts = [account('savings', 'savings', 10), account('main', 'current', 5), account('other', 'current', 7)];
    expect(everydayAccount(accounts)?.id).toBe('main');
  });

  it('falls back to the first account, or null without any', () => {
    expect(everydayAccount([account('card', 'card', 1), account('savings', 'savings', 2)])?.id).toBe('card');
    expect(everydayAccount([])).toBeNull();
  });
});

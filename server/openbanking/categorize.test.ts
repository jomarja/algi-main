import { describe, expect, it } from 'vitest';
import type { SpendingCategoryId } from '../../shared/bank.ts';
import { categorize, looksLikeOwnTransfer } from './categorize.ts';

const expenses: Array<[string, SpendingCategoryId]> = [
  // Food delivery
  ['Wolt', 'foodDelivery'],
  ['WOLT*TBILISI GE', 'foodDelivery'],
  ['გადახდა - ვოლტი', 'foodDelivery'],
  ['Glovo order 1234', 'foodDelivery'],
  ['Bolt Food Tbilisi', 'foodDelivery'],
  // Food and drink
  ['Coffee Lab', 'foodAndDrink'],
  ['Café Littera', 'foodAndDrink'],
  ['კაფე ლიტერა', 'foodAndDrink'],
  ['Khinkali House', 'foodAndDrink'],
  ["McDonald's Rustaveli", 'foodAndDrink'],
  ['Entrée', 'foodAndDrink'],
  ['Barbarestan restaurant', 'foodAndDrink'],
  ['რესტორანი ფუნიკულიორი', 'foodAndDrink'],
  // Groceries
  ['Carrefour', 'groceries'],
  ['NIKORA 0123 TBILISI', 'groceries'],
  ['ნიკორა', 'groceries'],
  ['Goodwill', 'groceries'],
  ['Spar', 'groceries'],
  ['Ori Nabiji', 'groceries'],
  ['ორი ნაბიჯი', 'groceries'],
  ['Agrohub', 'groceries'],
  ['Spar Galleria', 'groceries'],
  // Transport
  ['Bolt', 'transport'],
  ['BOLT.EU/O/2210', 'transport'],
  ['Yandex Go', 'transport'],
  ['Tbilisi Metro', 'transport'],
  ['მეტროს ბარათის შევსება', 'transport'],
  ['TTC', 'transport'],
  ['Wissol', 'transport'],
  ['Gulf petrol station', 'transport'],
  ['Rompetrol', 'transport'],
  ['Rent a car Tbilisi', 'transport'],
  // Subscriptions
  ['Netflix', 'subscriptions'],
  ['NETFLIX.COM', 'subscriptions'],
  ['Spotify P2A1C3', 'subscriptions'],
  ['iCloud+', 'subscriptions'],
  ['APPLE.COM/BILL', 'subscriptions'],
  ['Google One', 'subscriptions'],
  ['YouTube Premium', 'subscriptions'],
  // Shopping
  ['Zara', 'shopping'],
  ['H&M', 'shopping'],
  ['LC Waikiki', 'shopping'],
  ['Galleria Tbilisi', 'shopping'],
  // Utilities
  ['Telasi', 'utilities'],
  ['ელექტროენერგია - თელასი', 'utilities'],
  ['GWP water', 'utilities'],
  ['Te-Ge Energo', 'utilities'],
  ['Silknet', 'utilities'],
  ['Magti', 'utilities'],
  ['MagtiCom', 'utilities'],
  ['მობილური კავშირი - მაგთი', 'utilities'],
  ['Cellfie', 'utilities'],
  ['Beeline', 'utilities'],
  // Health
  ['PSP', 'health'],
  ['Aversi Pharma', 'health'],
  ['ავერსი', 'health'],
  ['GPC', 'health'],
  // Housing
  ['Rent', 'housing'],
  ['ბინის ქირა', 'housing'],
  ['ქირის გადახდა', 'housing'],
  // Debt
  ['Loan payment', 'debt'],
  ['სესხის დაფარვა', 'debt'],
  ['TBC Bank სესხის დაფარვა / Loan repayment', 'debt'],
];

describe('categorize', () => {
  it.each(expenses)('files the expense "%s" under %s', (text, category) => {
    expect(categorize('expense', text)).toBe(category);
  });

  it('files all money in as income: salary, refunds, transfers', () => {
    expect(categorize('income', 'ხელფასი')).toBe('income');
    expect(categorize('income', 'Salary October')).toBe('income');
    expect(categorize('income', 'Zara Refund - ZARA')).toBe('income');
    expect(categorize('income', 'Wolt refund')).toBe('income');
  });

  it('files unrecognised spending under shopping', () => {
    expect(categorize('expense', 'Creditor Name პირადი გადარიცხვა თიბისიში')).toBe('shopping');
    expect(categorize('expense', '')).toBe('shopping');
  });

  it('matches whole words, so a keyword inside another word does not count', () => {
    expect(categorize('expense', 'Barbershop')).toBe('shopping');
    expect(categorize('expense', 'Rentals Inc')).toBe('shopping');
    expect(categorize('expense', 'Spark Studio')).toBe('shopping');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(categorize('expense', 'lc   WAIKIKI')).toBe('shopping');
    expect(categorize('expense', 'cOfFeE lab')).toBe('foodAndDrink');
  });
});

describe('looksLikeOwnTransfer', () => {
  it('recognises transfers between own accounts, Georgian and English', () => {
    expect(looksLikeOwnTransfer('საკუთარ ანგარიშზე გადარიცხვა')).toBe(true);
    expect(looksLikeOwnTransfer('Transfer between own accounts')).toBe(true);
    expect(looksLikeOwnTransfer('Transfer to own account')).toBe(true);
    expect(looksLikeOwnTransfer('კონვერტაცია USD/GEL')).toBe(true);
  });

  it('does not flag payments to other people', () => {
    expect(looksLikeOwnTransfer('პირადი გადარიცხვა თიბისიში')).toBe(false);
    expect(looksLikeOwnTransfer('ბინის ქირა / Rent')).toBe(false);
  });
});

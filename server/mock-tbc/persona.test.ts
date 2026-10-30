import { describe, expect, it } from 'vitest';
import type { TbcTransaction } from '../openbanking/tbc-types.ts';
import { Persona, mockAccountIds } from './persona.ts';

const referenceDate = new Date('2026-10-29T09:00:00Z'); // SampleData.referenceDate

/** SampleData.transactions: the iOS app's October, as (merchant, amount, currency, day). */
const sampleOctober = [
  ['Bolt', 7.4, 'GEL', 29], ['Coffee Lab', 9.5, 'GEL', 29], ['Wolt', 34.8, 'GEL', 28], ["McDonald's", 26.5, 'GEL', 28],
  ['Tbilisi Metro', 1, 'GEL', 28], ['Wolt', 29.9, 'GEL', 26], ['Nikora', 48.2, 'GEL', 26], ['Glovo', 41.6, 'GEL', 25],
  ['Carrefour', 112.35, 'GEL', 25], ['Khinkali House', 86, 'GEL', 24], ['Spotify', 5.99, 'EUR', 23], ['Netflix', 9.99, 'USD', 22],
  ['Magti', 25, 'GEL', 21], ['Wolt', 38.4, 'GEL', 20], ['Wissol', 80, 'GEL', 19], ['Zara', 159.9, 'GEL', 18],
  ['Entrée', 54, 'GEL', 17], ['Telasi', 64.3, 'GEL', 15], ['iCloud+', 0.99, 'USD', 15], ['Wolt', 40.3, 'GEL', 12],
  ['Aversi', 23.75, 'GEL', 10], ['Spar', 62.4, 'GEL', 8], ['TBC Bank', 243.44, 'GEL', 5], ['Nikora', 73.1, 'GEL', 3],
  ['Levan Kapanadze', 850, 'GEL', 1],
] as const;

function everydayBooked(persona: Persona): TbcTransaction[] {
  return [mockAccountIds.everydayGel, mockAccountIds.everydayUsd, mockAccountIds.everydayEur].flatMap(
    (id) => persona.accountReport(id)?.booked ?? [],
  );
}

function asRow(tx: TbcTransaction): string {
  return `${tx.creditorName ?? tx.debtorName} ${tx.transactionAmount?.amount} ${tx.transactionAmount?.currency} ${tx.bookingDate}`;
}

describe('Persona', () => {
  it("replays SampleData's October day by day", () => {
    const october = everydayBooked(new Persona(referenceDate)).filter(
      (tx) => tx.bookingDate?.startsWith('2026-10') && tx.creditorName && tx.creditorName !== 'Nino Nadiradze',
    );

    const expected = sampleOctober.map(
      ([merchant, amount, currency, day]) => `${merchant} ${(-amount).toFixed(2)} ${currency} 2026-10-${String(day).padStart(2, '0')}`,
    );
    expect(october.map(asRow).sort()).toEqual([...expected].sort());
  });

  it('pays the salary on the 28th and saves part of it on the same day', () => {
    const october28 = everydayBooked(new Persona(referenceDate)).filter((tx) => tx.bookingDate === '2026-10-28');

    expect(october28.find((tx) => tx.debtorName)).toMatchObject({
      debtorName: 'Kavkasia Digital LLC',
      transactionAmount: { currency: 'GEL', amount: '3400.00' },
      remittanceInformationUnstructured: 'ხელფასი / Salary',
    });
    expect(october28.find((tx) => tx.creditorName === 'Nino Nadiradze')).toMatchObject({
      creditorAccount: { iban: 'GE02TB7724936615100002', currency: 'GEL' },
      transactionAmount: { amount: '-450.00' },
      remittanceInformationUnstructured: 'საკუთარ ანგარიშზე გადარიცხვა',
    });
  });

  it("has today's freelance payment and Zara refund pending, dated by value date only", () => {
    const pending = new Persona(referenceDate).accountReport(mockAccountIds.everydayGel)?.pending ?? [];

    expect(pending.map(({ debtorName, transactionAmount, bookingDate, valueDate }) => ({ debtorName, transactionAmount, bookingDate, valueDate }))).toEqual([
      { debtorName: 'Studio Lumen LLC', transactionAmount: { currency: 'GEL', amount: '250.00' }, bookingDate: undefined, valueDate: '2026-10-29' },
      { debtorName: 'Zara', transactionAmount: { currency: 'GEL', amount: '59.90' }, bookingDate: undefined, valueDate: '2026-10-29' },
    ]);
  });

  it('never books a transaction after today', () => {
    const early = new Persona(new Date('2026-11-03T08:00:00Z'));

    const november = everydayBooked(early).filter((tx) => tx.bookingDate?.startsWith('2026-11'));

    expect(november.map((tx) => `${tx.creditorName} ${tx.bookingDate}`).sort()).toEqual(['Levan Kapanadze 2026-11-01', 'Nikora 2026-11-03']);
  });

  it('keeps transaction IDs from one day to the next', () => {
    const idsOn29th = new Set(everydayBooked(new Persona(referenceDate)).map((tx) => tx.transactionId));
    const idsOn30th = new Set(everydayBooked(new Persona(new Date('2026-10-30T09:00:00Z'))).map((tx) => tx.transactionId));

    expect([...idsOn29th].every((id) => idsOn30th.has(id))).toBe(true);
    expect(idsOn29th.size).toBe(everydayBooked(new Persona(referenceDate)).length);
  });

  it('moves days past the end of a short month to its last day', () => {
    const february = everydayBooked(new Persona(new Date('2027-02-28T20:00:00Z')));

    expect(february.filter((tx) => tx.creditorName === 'Bolt' && tx.bookingDate === '2027-02-28')).toHaveLength(1);
  });

  it('holds 2,486.40 GEL on Everyday, with empty USD and EUR sub-accounts', () => {
    const accounts = new Persona(referenceDate).accounts();

    const booked = (id: string) => accounts.find((account) => account.resourceId === id)?.balances?.find((b) => b.balanceType === 'interimBooked');
    expect(booked(mockAccountIds.everydayGel)?.balanceAmount).toEqual({ currency: 'GEL', amount: '2486.40' });
    expect(booked(mockAccountIds.everydayUsd)?.balanceAmount).toEqual({ currency: 'USD', amount: '0.00' });
    expect(booked(mockAccountIds.everydayEur)?.balanceAmount).toEqual({ currency: 'EUR', amount: '0.00' });
  });

  it('reports only card payments on the debit card', () => {
    const persona = new Persona(referenceDate);
    const cardPayments = persona.cardReport(mockAccountIds.card)?.booked ?? [];

    expect(cardPayments.length).toBeGreaterThan(0);
    expect(cardPayments.every((tx) => (tx.transactionAmount?.amount ?? '').startsWith('-'))).toBe(true);
    expect(cardPayments.map((tx) => tx.transactionDetails)).not.toContain('ბინის ქირა / Rent');
  });

  it('owes 4,944.20 GEL on the loan after 23 of 48 payments', () => {
    const [loan] = new Persona(referenceDate).loans();

    expect(loan.balances?.[0].balanceAmount).toEqual({ currency: 'GEL', amount: 4944.2 });
    expect(loan.relatedDates).toEqual({ contractStartDate: '2024-11-05T00:00:00', contractEndDate: '2028-11-05T00:00:00' });
  });

  it('keeps 23 payments made whatever the day of the month', () => {
    const beforePaymentDay = new Persona(new Date('2026-11-03T09:00:00Z')).loans()[0];
    const onPaymentDay = new Persona(new Date('2026-11-05T09:00:00Z')).loans()[0];

    expect(beforePaymentDay.relatedDates?.contractStartDate).toBe('2024-11-05T00:00:00');
    expect(onPaymentDay.relatedDates?.contractStartDate).toBe('2024-12-05T00:00:00');
  });

  it('keeps 14,850 GEL in savings', () => {
    const [savings] = new Persona(referenceDate).savings();

    expect(savings.balances?.[0].balanceAmount).toEqual({ currency: 'GEL', amount: '14850.00' });
  });

  it('knows nothing of accounts that are not hers', () => {
    const persona = new Persona(referenceDate);

    expect(persona.accountReport('other')).toBeNull();
    expect(persona.balances('other')).toBeNull();
    expect(persona.cardReport('other')).toBeNull();
    expect(persona.loanBalances('other')).toBeNull();
  });
});

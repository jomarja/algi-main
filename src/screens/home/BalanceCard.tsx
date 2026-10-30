import type { RefObject } from 'react';
import { cx, Icon, TrendWave } from '../../design/index.ts';
import { CURRENCIES, CURRENCY_SYMBOLS, negate, type Money } from '../../engine/index.ts';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { MenuSelect } from '../transactions/MenuSelect.tsx';
import { accountsLine, accountsWithMoney, BALANCE_TREND, balanceScopeText } from './homeModel.ts';

/** Literal classes so Tailwind keeps them. */
const dotClasses = { mint: 'bg-mint', coral: 'bg-coral', amber: 'bg-amber' } as const;

interface BalanceCardProps {
  /** The figure shown, which briefly lags the real total while Luka's money toss plays. */
  balance: Money;
  /** The balance figure, where the tossed money lands. */
  balanceRef: RefObject<HTMLParagraphElement>;
}

/** Total balance with its scope, plus this month's income, spending and what's left in the plan (HomeCards.swift). */
export function BalanceCard({ balance, balanceRef }: BalanceCardProps) {
  const store = useAppStore();
  const display = useDisplay();
  const finance = store.finance;
  const accounts = accountsWithMoney(finance.accounts);

  return (
    <section
      aria-label={display.t('Total balance', 'ჯამური ბალანსი')}
      className="relative flex flex-col gap-4 overflow-hidden rounded-xl bg-ink p-5 shadow-[0_8px_16px_rgba(22,60,53,0.18)]"
    >
      <span aria-hidden className="pointer-events-none absolute -right-[50px] -top-[50px] h-[150px] w-[150px] rounded-full border-[28px] border-white/[0.06]" />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="type-footnote font-medium text-white/75">{balanceScopeText(accounts.length, display)}</p>
          <p ref={balanceRef} key={balance.minorUnits} className="type-display animate-page-fade truncate text-white">
            {display.money(balance)}
          </p>
        </div>
        <CurrencyMenu />
      </div>

      <TrendWave values={BALANCE_TREND} />

      {accounts.length > 0 && <p className="type-caption text-white/70">{accountsLine(accounts, display)}</p>}

      <span aria-hidden className="h-px bg-white/15" />

      <dl className="grid grid-cols-3 gap-2">
        <Stat title={display.t('Income', 'შემოსავალი')} value={display.money(finance.monthlyIncome, { precision: 'whole', sign: 'always' })} dot="mint" />
        <Stat title={display.t('Spent', 'დახარჯული')} value={display.money(negate(finance.monthlySpending), { precision: 'whole' })} dot="coral" />
        <Stat
          title={display.t('Left in plan', 'გეგმაში დარჩა')}
          value={display.money(finance.monthlyPlanProgress.remaining, { precision: 'whole' })}
          dot="amber"
        />
      </dl>

      {display.currency !== 'GEL' && (
        <p className="type-caption text-white/60">
          {display.t('Converted from GEL at an illustrative sample rate — not live.', 'გადაყვანილია ლარიდან სანიმუშო კურსით — არა რეალური.')}
        </p>
      )}
    </section>
  );
}

function CurrencyMenu() {
  const store = useAppStore();
  const display = useDisplay();

  return (
    <MenuSelect
      value={display.currency}
      options={CURRENCIES}
      onChange={(currency) => store.setDisplayCurrency(currency)}
      title={(currency) => `${CURRENCY_SYMBOLS[currency]}  ${currency}`}
      label={display.t('Display currency', 'საჩვენებელი ვალუტა')}
      className="type-footnote inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-white/[0.12] px-3 font-bold text-white"
    >
      {display.currency}
      <Icon name="chevron.down" size={11} />
    </MenuSelect>
  );
}

function Stat({ title, value, dot }: { title: string; value: string; dot: keyof typeof dotClasses }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="type-caption flex items-center gap-1 truncate text-white/75">
        <span aria-hidden className={cx('h-[7px] w-[7px] shrink-0 rounded-full', dotClasses[dot])} />
        {title}
      </dt>
      <dd className="type-subheadline truncate font-bold text-white">{value}</dd>
    </div>
  );
}

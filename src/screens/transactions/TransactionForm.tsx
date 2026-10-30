import { useState } from 'react';
import type { FormEvent } from 'react';
import { CategoryIcon, SegmentedPicker, StatusBanner, TextField } from '../../design/index.ts';
import {
  CATEGORY_META,
  CURRENCIES,
  CURRENCY_SYMBOLS,
  SPENDING_CATEGORIES,
  type TransactionDirection,
} from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';
import { SelectField } from './SelectField.tsx';
import { categoryAppearance } from './transactionPresentation.ts';
import { hasAmountProblem, withDirection } from './transactionDraft.ts';
import type { EntryMode, TransactionDraft } from './transactionDraft.ts';

const DIRECTIONS: readonly TransactionDirection[] = ['expense', 'income'];

interface TransactionFormProps {
  mode: EntryMode;
  draft: TransactionDraft;
  onChange: (draft: TransactionDraft) => void;
  /** The latest day the date field accepts. */
  today: string;
  /** Enter in a field. */
  onSubmit: () => void;
}

/**
 * Manual entry, also the fallback for receipt import until scanning exists (AddTransactionSheet.swift):
 * type, merchant, amount and currency, then category and date.
 */
export function TransactionForm({ mode, draft, onChange, today, onSubmit }: TransactionFormProps) {
  const display = useDisplay();
  const [hasLeftAmount, setLeftAmount] = useState(false);
  const change = (changes: Partial<TransactionDraft>) => onChange({ ...draft, ...changes });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      {mode === 'receipt' && (
        <StatusBanner
          kind="info"
          title={display.t('Receipt scanning is coming soon', 'ქვითრის სკანირება მალე დაემატება')}
          message={display.t(
            'For now, enter the merchant, date, and total from your receipt.',
            'ჯერჯერობით შეიყვანე მერჩანტი, თარიღი და ჯამი ქვითრიდან.',
          )}
        />
      )}

      <div className="flex flex-col gap-4">
        <SegmentedPicker
          options={DIRECTIONS}
          value={draft.direction}
          onChange={(direction) => onChange(withDirection(draft, direction))}
          title={(direction) => (direction === 'income' ? display.t('Income', 'შემოსავალი') : display.t('Expense', 'ხარჯი'))}
          label={display.t('Type', 'ტიპი')}
        />
        <TextField
          label={display.t('Merchant or source', 'მერჩანტი ან წყარო')}
          value={draft.merchant}
          onChange={(event) => change({ merchant: event.target.value })}
          autoComplete="off"
          enterKeyHint="next"
        />
        <div className="grid grid-cols-[minmax(0,1fr)_128px] items-start gap-3">
          <TextField
            label={display.t('Amount', 'თანხა')}
            value={draft.amountText}
            onChange={(event) => change({ amountText: event.target.value })}
            onBlur={() => setLeftAmount(true)}
            placeholder="0.00"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            error={
              hasLeftAmount && hasAmountProblem(draft)
                ? display.t('Enter an amount above zero, like 12.50.', 'შეიყვანე ნულზე მეტი თანხა, მაგალითად 12.50.')
                : undefined
            }
          />
          <SelectField
            label={display.t('Currency', 'ვალუტა')}
            value={draft.currency}
            options={CURRENCIES}
            onChange={(currency) => change({ currency })}
            title={(currency) => `${CURRENCY_SYMBOLS[currency]} ${currency}`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SelectField
          label={display.t('Category', 'კატეგორია')}
          value={draft.category}
          options={SPENDING_CATEGORIES}
          onChange={(category) => change({ category })}
          title={(category) => display.text(CATEGORY_META[category].title)}
          leading={<CategoryIcon {...categoryAppearance(draft.category)} size={28} />}
        />
        <TextField
          label={display.t('Date', 'თარიღი')}
          type="date"
          value={draft.day}
          max={today}
          required
          onChange={(event) => change({ day: event.target.value })}
        />
      </div>

      {/* Lets Enter in a field submit the form; the visible Save lives in the bar. */}
      <button type="submit" tabIndex={-1} aria-hidden className="sr-only">
        {display.t('Save', 'შენახვა')}
      </button>
    </form>
  );
}

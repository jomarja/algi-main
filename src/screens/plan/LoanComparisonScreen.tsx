import { useEffect, useState } from 'react';
import { Icon, StatusBanner } from '../../design/index.ts';
import { LoanCalculator } from '../../engine/index.ts';
import type { LoanTerms } from '../../engine/index.ts';
import { DashboardColumns, ScreenLayout } from '../../layout/ScreenLayout.tsx';
import { useAppStore, useDisplay } from '../../state/AppStateProvider.tsx';
import { LoanEditor } from './loans/LoanEditor.tsx';
import { blankCurrentLoan, blankOffer, hasBankAnswered } from './loans/loanModel.ts';
import { LoanResults } from './loans/LoanResults.tsx';
import { LoanVerdict } from './loans/LoanVerdict.tsx';
import { Intro } from './shared/Intro.tsx';
import { MethodDisclosure } from './shared/MethodDisclosure.tsx';

interface LoanPair {
  readonly current: LoanTerms;
  readonly offer: LoanTerms;
}

/**
 * Compares the full cost of two loans (LoanComparisonView.swift): rate, term, fees, insurance and switching costs,
 * with a plain verdict and the calculation behind it. The current loan comes from TBC and the offer refinances its
 * balance; every field stays editable, and without a bank loan the user enters their own terms.
 */
export default function LoanComparisonScreen() {
  const store = useAppStore();
  const display = useDisplay();
  const bankLoan = store.currentLoan;
  // Until the user edits a field, the terms follow the bank data, which may still be arriving.
  const [edited, setEdited] = useState<LoanPair | null>(null);
  const { current, offer } = edited ?? { current: bankLoan ?? blankCurrentLoan(), offer: store.loanOffer ?? blankOffer() };
  const comparison = LoanCalculator.compare(current, offer);

  useEffect(() => {
    store.markLoanCompared();
  }, [store]);

  return (
    <ScreenLayout title={display.t('Compare loans', 'სესხების შედარება')} width="wide">
      <Intro>
        {display.t(
          "A lower rate isn't automatically cheaper. Term, fees, and insurance change the total.",
          'დაბალი განაკვეთი ავტომატურად იაფი არ არის. ვადა, საკომისიო და დაზღვევა ჯამს ცვლის.',
        )}
      </Intro>
      {!bankLoan && hasBankAnswered(store.getState().bank) && (
        <StatusBanner
          kind="info"
          title={display.t('No loan reported by your bank', 'ბანკს სესხი არ უჩვენებია')}
          message={display.t(
            'Enter the terms of a loan you have or are considering to compare it with an offer.',
            'შეიყვანე სესხის პირობები, რომელიც გაქვს ან განიხილავ, და შეადარე შეთავაზებას.',
          )}
        />
      )}
      <DashboardColumns
        main={
          <>
            <LoanVerdict comparison={comparison} hasVariableRate={current.isVariableRate || offer.isVariableRate} />
            <LoanResults comparison={comparison} />
          </>
        }
        aside={
          <>
            <LoanEditor
              title={display.t('Current loan', 'მიმდინარე სესხი')}
              terms={current}
              onChange={(terms) => setEdited({ current: terms, offer })}
              showsPenalty
              isFromBank={bankLoan !== null}
            />
            <LoanEditor
              title={display.t('New offer', 'ახალი შეთავაზება')}
              terms={offer}
              onChange={(terms) => setEdited({ current, offer: terms })}
              showsPenalty={false}
            />
            <MethodDisclosure icon="function">
              <MethodPoints />
            </MethodDisclosure>
            <p className="type-caption text-inkMuted">
              {display.t(
                "Estimates for comparison only. Check the lender's official schedule before deciding.",
                'შეფასება მხოლოდ შედარებისთვისაა. გადაწყვეტილებამდე გადაამოწმე ბანკის ოფიციალური გრაფიკი.',
              )}
            </p>
          </>
        }
      />
    </ScreenLayout>
  );
}

function MethodPoints() {
  const display = useDisplay();
  const points = [
    display.t(
      'Monthly installment = P × r ÷ (1 − (1 + r)^−n), with r = annual rate ÷ 12 and n = months.',
      'თვიური შენატანი = P × r ÷ (1 − (1 + r)^−n), სადაც r = წლიური განაკვეთი ÷ 12, n = თვეები.',
    ),
    display.t('Total interest = installment × months − amount owed.', 'სულ პროცენტი = შენატანი × თვეები − დარჩენილი თანხა.'),
    display.t(
      'Fees = upfront fee + (monthly fee + insurance) × months.',
      'საკომისიო = ერთჯერადი + (თვიური საკომისიო + დაზღვევა) × თვეები.',
    ),
    display.t(
      'Switching adds the early repayment fee on the current loan.',
      'გადასვლას ემატება მიმდინარე სესხის წინსწრებით დაფარვის საკომისიო.',
    ),
    display.t(
      'Assumes fixed rates, payments on time, and no other early repayment.',
      'ითვალისწინებს ფიქსირებულ განაკვეთს, დროულ გადახდას და სხვა წინსწრებით დაფარვის არარსებობას.',
    ),
  ];

  return (
    <ul className="flex flex-col gap-2">
      {points.map((point) => (
        <li key={point} className="type-footnote flex items-start gap-2 text-ink">
          <span className="pt-0.5 text-inkSoft">
            <Icon name="checkmark" size={13} />
          </span>
          {point}
        </li>
      ))}
    </ul>
  );
}

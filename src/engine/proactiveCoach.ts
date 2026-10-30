import { addDays, AVERAGE_DAYS_PER_MONTH } from './calendar.ts';
import { CATEGORY_META } from './categories.ts';
import type { Display } from './display.ts';
import type { FinanceSummary } from './financeSummary.ts';
import { replanningRequest, type GoalRequest } from './goalPlanner.ts';
import type { SpendingHistory } from './history.ts';
import { InsightBuilder, type InsightKind } from './insights.ts';
import { Journey } from './journey.ts';
import type { LoanComparison } from './loan.ts';
import { add, compare, gel, multiply, subtract, sum, zero, type Money } from './money.ts';
import { MINUS_SIGN } from './moneyFormatter.ts';
import type { MonthlyBudget, UpcomingPayment } from './monthlyBudget.ts';
import type { MascotPose, RecommendationTone } from './presentation.ts';
import { round } from './rounding.ts';
import { GoalProjection, goalPrioritySortOrder, type SavingsGoal } from './savingsGoal.ts';
import { everydayAccount, type FinanceTransaction } from './transactions.ts';

export interface CoachFigure {
  readonly label: string;
  readonly value: string;
}

/** Where a recommendation's next step leads; screens map each case to a route. */
export type CoachDestination =
  | { readonly kind: 'goalPlanner'; readonly request: GoalRequest | null }
  | { readonly kind: 'journey'; readonly goalId: string }
  | { readonly kind: 'budget' }
  | { readonly kind: 'loanComparison' }
  | { readonly kind: 'insight'; readonly insight: InsightKind };

/**
 * One proactive suggestion: what Luka noticed, why it matters, the supporting figures,
 * a clear next step, and the data or assumptions behind it.
 */
export interface ProactiveRecommendation {
  readonly id: string;
  readonly pose: MascotPose;
  readonly tone: RecommendationTone;
  readonly title: string;
  readonly explanation: string;
  readonly figures: readonly CoachFigure[];
  readonly nextStep: string;
  readonly destination: CoachDestination;
  readonly transactions: readonly FinanceTransaction[];
  readonly assumptions: readonly string[];
}

export interface ProactiveCoachInput {
  readonly finance: FinanceSummary;
  readonly budget: MonthlyBudget;
  readonly goals: readonly SavingsGoal[];
  readonly upcomingPayments: readonly UpcomingPayment[];
  /** Null when the bank reports no loan to compare. */
  readonly loanComparison: LoanComparison | null;
  readonly display: Display;
  readonly history: SpendingHistory;
}

/** Payments due within this many days get a heads-up. */
export const UPCOMING_WINDOW_DAYS = 7;
/** Only payments at least this large get their own suggestion. */
export const LARGE_PAYMENT = gel(300);
export const AHEAD_THRESHOLD_DAYS = 28;

/**
 * The intelligence behind the whole app: spots what changed and ranks the most useful next actions.
 * Every figure is computed from the user's data; nothing is invented, and nothing assumes the
 * whole balance is free to spend.
 */
export class ProactiveCoach {
  readonly input: ProactiveCoachInput;

  constructor(input: ProactiveCoachInput) {
    this.input = input;
  }

  get recommendations(): ProactiveRecommendation[] {
    return [
      this.goalAtRisk(),
      this.flexibleAdjustment(),
      this.upcomingPayment(),
      this.loanOffer(),
      this.goalAhead(),
      this.deliveryTrend(),
    ].filter((recommendation): recommendation is ProactiveRecommendation => recommendation !== null);
  }

  recommendation(id: string): ProactiveRecommendation | null {
    return this.recommendations.find((recommendation) => recommendation.id === id) ?? null;
  }

  private get now(): Date {
    return this.input.finance.now;
  }

  private get display(): Display {
    return this.input.display;
  }

  private money(value: Money): string {
    return this.display.money(value, { precision: 'whole' });
  }

  private contributionStays(goal: SavingsGoal): string {
    const contribution = this.money(goal.monthlyContribution);
    return this.display.t(`Your contribution stays at ${contribution} a month.`, `შენატანი თვეში ${contribution} რჩება.`);
  }

  private savedSoFar(goal: SavingsGoal): CoachFigure {
    return {
      label: this.display.t('Saved so far', 'დაზოგილია'),
      value: `${this.money(goal.saved)} / ${this.money(goal.target)}`,
    };
  }

  // Goals

  private goalAtRisk(): ProactiveRecommendation | null {
    const { display, now } = this;
    const goal = [...this.input.goals]
      .sort((lhs, rhs) => goalPrioritySortOrder(lhs.priority) - goalPrioritySortOrder(rhs.priority))
      .find((candidate) => {
        const status = new GoalProjection(candidate, now).status;
        return status === 'slightlyBehind' || status === 'unlikely';
      });
    if (!goal) return null;

    const projection = new GoalProjection(goal, now);
    const projected = this.money(projection.projectedSaved(goal.monthlyContribution));
    const required = this.money(projection.requiredMonthly);
    const contribution = this.money(goal.monthlyContribution);
    const target = this.money(goal.target);
    const dueDate = display.date(goal.targetDate, 'dayMonth');
    const name = display.text(goal.name);

    return {
      id: `goal-at-risk-${goal.id}`,
      pose: 'overspending',
      tone: 'nextStep',
      title: display.t(
        `Your current pace makes ${dueDate} unlikely for ${name}. Here are three alternatives.`,
        `ახლანდელი ტემპით „${name}“ ${dueDate}-მდე ნაკლებად სავარაუდოა. აი, სამი ალტერნატივა.`,
      ),
      explanation: display.t(
        `At ${contribution} a month you'd have about ${projected} by ${dueDate}. Getting to ${target} on time needs about ${required} a month.`,
        `თვეში ${contribution}-ით ${dueDate}-მდე დაახლოებით ${projected} გექნება. ${target}-ის დროულად მისაღწევად თვეში დაახლოებით ${required} გჭირდება.`,
      ),
      figures: [
        this.savedSoFar(goal),
        { label: display.t('Needed per month', 'საჭიროა თვეში'), value: required },
        { label: display.t('Your contribution', 'შენი შენატანი'), value: contribution },
        { label: display.t('Projected by the date', 'პროგნოზი ვადისთვის'), value: projected },
      ],
      nextStep: display.t('See 3 ways to get there', 'ნახე 3 გზა'),
      destination: { kind: 'goalPlanner', request: replanningRequest(goal, now) },
      transactions: [],
      assumptions: [
        this.contributionStays(goal),
        display.t('No extra deposits are counted.', 'დამატებითი შენატანები არ ითვლება.'),
      ],
    };
  }

  private goalAhead(): ProactiveRecommendation | null {
    const { display, now } = this;
    const match = this.input.goals
      .map((goal) => ({ goal, schedule: new Journey(goal, now).schedule }))
      .find(({ schedule }) => schedule.kind === 'ahead' && schedule.days >= AHEAD_THRESHOLD_DAYS);
    if (!match || match.schedule.kind !== 'ahead') return null;
    const { goal } = match;
    const arrival = new GoalProjection(goal, now).completionDate(goal.monthlyContribution);
    if (!arrival) return null;

    const months = Math.max(round(match.schedule.days / AVERAGE_DAYS_PER_MONTH), 1);
    const name = display.text(goal.name);
    const contribution = this.money(goal.monthlyContribution);
    const arrivalText = display.date(arrival, 'monthYear');
    const targetText = display.date(goal.targetDate, 'dayMonthYear');
    const early =
      months === 1
        ? display.t('about a month early', 'დაახლოებით ერთი თვით ადრე')
        : display.t(`about ${months} months early`, `დაახლოებით ${months} თვით ადრე`);

    return {
      id: `goal-ahead-${goal.id}`,
      pose: 'savings',
      tone: 'positive',
      title: display.t(`You're on track to reach ${name} ${early}.`, `„${name}“-ს ${early} მიაღწევ.`),
      explanation: display.t(
        `At ${contribution} a month you'd arrive around ${arrivalText}, ahead of your ${targetText} target.`,
        `თვეში ${contribution}-ით დაახლოებით ${arrivalText}-ში მიხვალ, ${targetText}-მდე.`,
      ),
      figures: [
        this.savedSoFar(goal),
        { label: display.t('Arrival (estimate)', 'მისვლა (შეფასება)'), value: arrivalText },
        { label: display.t('Target date', 'ვადა'), value: targetText },
      ],
      nextStep: display.t('Open the journey', 'გზის გახსნა'),
      destination: { kind: 'journey', goalId: goal.id },
      transactions: [],
      assumptions: [this.contributionStays(goal)],
    };
  }

  // Spending

  private flexibleAdjustment(): ProactiveRecommendation | null {
    const { display } = this;
    const { budget, finance } = this.input;
    const cuts = budget.gentleAdjustment;
    if (cuts.length < 2) return null;
    const total = sum(cuts.map((cut) => cut.monthlySaving), 'GEL');
    const categories = new Set(cuts.map((cut) => cut.category));

    return {
      id: 'flexible-adjustment',
      pose: 'insight',
      tone: 'positive',
      title: display.t(
        `You could save an additional ${this.money(total)} this month by adjusting two flexible categories.`,
        `ამ თვეში დამატებით ${this.money(total)}-ის დაზოგვა შეგიძლია ორი მოქნილი კატეგორიის შეცვლით.`,
      ),
      explanation: display.t(
        `Your essentials stay exactly as they are. These are small changes to flexible spending only — about ${this.money(multiply(total, 12))} over a year.`,
        `აუცილებელი ხარჯები უცვლელი რჩება. ეს მხოლოდ მოქნილი ხარჯების მცირე ცვლილებებია — წელიწადში დაახლოებით ${this.money(multiply(total, 12))}.`,
      ),
      figures: cuts.map((cut) => ({
        label: display.text(CATEGORY_META[cut.category].title),
        value: `${MINUS_SIGN}${this.money(cut.monthlySaving)} · ${display.text(cut.lifestyleNote)}`,
      })),
      nextStep: display.t('See where it comes from', 'ნახე, საიდან'),
      destination: { kind: 'budget' },
      transactions: finance.expenses(finance.currentMonth).filter((transaction) => categories.has(transaction.category)),
      assumptions: budget.flexibleLines.slice(0, 2).map((line) => {
        const title = display.text(CATEGORY_META[line.category].title);
        const amount = this.money(line.monthlyAmount);
        return display.t(`Typical month: ${title} ${amount}`, `ტიპური თვე: ${title} ${amount}`);
      }),
    };
  }

  private upcomingPayment(): ProactiveRecommendation | null {
    const { display, now } = this;
    const { finance, upcomingPayments } = this.input;
    const toGel = (value: Money) => display.converter.convert(value, 'GEL');
    const windowEnd = addDays(now, UPCOMING_WINDOW_DAYS).getTime();
    const payment = upcomingPayments.find(
      (candidate) => candidate.dueDate.getTime() <= windowEnd && compare(toGel(candidate.amount), LARGE_PAYMENT) >= 0,
    );
    if (!payment) return null;

    const everydayBalance = everydayAccount(finance.accounts)?.balance;
    const everyday = everydayBalance ? toGel(everydayBalance) : zero('GEL');
    const billsBeforePayday = sum(upcomingPayments.map((upcoming) => toGel(upcoming.amount)), 'GEL');
    const left = this.money(subtract(everyday, billsBeforePayday));
    const bills = this.money(billsBeforePayday);
    const balance = this.money(everyday);
    const due = display.date(payment.dueDate, 'weekdayDayMonth');
    const title = display.text(payment.title);
    const amount = this.money(payment.amount);

    return {
      id: `upcoming-${payment.id}`,
      pose: 'overview',
      tone: 'nextStep',
      title: display.t(
        `${title} of ${amount} is due ${due}. Keep it available before adding extra to savings.`,
        `${title} — ${amount}, გადასახდელია ${due}. სანამ დანაზოგს დაამატებ, ეს თანხა ხელმისაწვდომი დატოვე.`,
      ),
      explanation: display.t(
        `Your everyday account has ${balance}. After this and the other bills before payday (${bills} in total), about ${left} remains.`,
        `ყოველდღიურ ანგარიშზე ${balance} გაქვს. ამ და ხელფასამდე სხვა გადასახადების შემდეგ (ჯამში ${bills}) დაახლოებით ${left} დარჩება.`,
      ),
      figures: [
        { label: display.t('Due', 'ვადა'), value: due },
        { label: display.t('Everyday balance', 'ყოველდღიური ბალანსი'), value: balance },
        { label: display.t('Bills before payday', 'გადასახადები ხელფასამდე'), value: bills },
        { label: display.t('Left after bills', 'გადასახადების შემდეგ'), value: left },
      ],
      nextStep: display.t('See upcoming payments', 'მომავალი გადასახადები'),
      destination: { kind: 'budget' },
      transactions: [],
      assumptions: upcomingPayments
        .filter((upcoming) => upcoming.isEstimate)
        .map((upcoming) => {
          const name = display.text(upcoming.title);
          return display.t(`${name} is estimated from last month.`, `${name} შეფასებულია გასული თვის მიხედვით.`);
        }),
    };
  }

  private deliveryTrend(): ProactiveRecommendation | null {
    const { display } = this;
    const { finance, history } = this.input;
    if (finance.deliveryBudget.status === 'comfortable') return null;
    const content = new InsightBuilder(finance, display, history).content('deliveryIncrease');
    return {
      id: 'delivery-trend',
      pose: content.pose,
      tone: 'nextStep',
      title: content.title,
      explanation: content.summary,
      figures: content.bars.map((bar) => ({ label: bar.label, value: this.money(bar.value) })),
      nextStep: display.t('See the details', 'დეტალები'),
      destination: { kind: 'insight', insight: 'deliveryIncrease' },
      transactions: content.relatedTransactions,
      assumptions: [content.dataBasis],
    };
  }

  // Debt

  private loanOffer(): ProactiveRecommendation | null {
    const { display } = this;
    const comparison = this.input.loanComparison;
    if (!comparison) return null;
    const { current, offer, verdict } = comparison;
    const totalDifference = comparison.totalDifference;
    const extraMonths = comparison.extraMonths;
    const isTradeOff = verdict === 'lowerPaymentLongerCommitment' || verdict === 'moreExpensiveOverall';
    if (!isTradeOff || !current || !offer || !totalDifference || extraMonths === null) return null;

    const savedMonthly = this.money(subtract(current.monthlyPayment, offer.monthlyPayment));
    const costsMore = this.money(totalDifference);

    return {
      id: 'loan-offer',
      pose: 'insight',
      tone: 'attention',
      title: display.t(
        'Your new loan offer lowers the monthly payment but may increase your total repayment.',
        'ახალი სესხის შეთავაზება თვიურ გადასახადს ამცირებს, მაგრამ სრულ დასაბრუნებელ თანხას შეიძლება ზრდიდეს.',
      ),
      explanation: display.t(
        `It would cut your payment by ${savedMonthly} a month, but runs ${extraMonths} months longer and costs about ${costsMore} more overall, fees included.`,
        `თვიური გადასახადი ${savedMonthly}-ით შემცირდება, მაგრამ ვადა ${extraMonths} თვით გაიზრდება და ჯამში დაახლოებით ${costsMore}-ით მეტი დაჯდება, საკომისიოების ჩათვლით.`,
      ),
      figures: [
        {
          label: display.t('Monthly payment', 'თვიური გადასახადი'),
          value: `${this.money(current.monthlyPayment)} → ${this.money(offer.monthlyPayment)}`,
        },
        {
          label: display.t('Total to repay', 'სულ დასაბრუნებელი'),
          value: `${this.money(current.totalRepayable)} → ${this.money(add(offer.totalRepayable, comparison.switchingCost))}`,
        },
        { label: display.t('Extra months', 'დამატებითი თვეები'), value: `+${extraMonths}` },
      ],
      nextStep: display.t('Compare the offers', 'შეადარე შეთავაზებები'),
      destination: { kind: 'loanComparison' },
      transactions: [],
      assumptions: [
        display.t('Fixed rates and fees as entered.', 'ფიქსირებული განაკვეთი და შეყვანილი საკომისიოები.'),
        display.t(
          'Switching includes the early repayment fee on your current loan.',
          'გადასვლა მოიცავს მიმდინარე სესხის წინსწრებით დაფარვის საკომისიოს.',
        ),
      ],
    };
  }
}

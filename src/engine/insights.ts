import { dateParts, isWeekend, WEEKS_PER_MONTH } from './calendar.ts';
import { CATEGORY_META } from './categories.ts';
import type { Display } from './display.ts';
import type { FinanceSummary } from './financeSummary.ts';
import type { SpendingHistory } from './history.ts';
import {
  compare,
  divide,
  fraction,
  gel,
  majorUnits,
  multiply,
  subtract,
  sum,
  zero,
  type Money,
} from './money.ts';
import { monthsDative } from './monthPhrases.ts';
import type { PaletteToken } from './palette.ts';
import type { MascotPose } from './presentation.ts';
import { round } from './rounding.ts';
import type { FinanceTransaction } from './transactions.ts';

export type InsightKind =
  | 'deliveryIncrease'
  | 'weekendPattern'
  | 'subscriptions'
  | 'unusualExpense'
  | 'recurringMerchant'
  | 'planProgress';

export const INSIGHT_KINDS: readonly InsightKind[] = [
  'deliveryIncrease',
  'weekendPattern',
  'subscriptions',
  'unusualExpense',
  'recurringMerchant',
  'planProgress',
];

export interface InsightBar {
  /** Labels can repeat (e.g. two orders on the same day), so identity is independent of the label. */
  readonly id: string;
  readonly label: string;
  readonly value: Money;
  readonly isHighlighted: boolean;
}

/** Everything an insight screen shows, already resolved into the user's language and currency. */
export interface InsightContent {
  readonly kind: InsightKind;
  /** SF Symbol name; the design system maps it to an icon. */
  readonly icon: string;
  readonly tint: PaletteToken;
  readonly background: PaletteToken;
  readonly pose: MascotPose;
  readonly title: string;
  readonly summary: string;
  readonly recommendation: string;
  readonly method: string;
  readonly dataBasis: string;
  readonly bars: readonly InsightBar[];
  readonly relatedTransactions: readonly FinanceTransaction[];
}

/** Hour from which an order counts as an evening one. */
const EVENING_HOUR = 18;

/**
 * Builds insight copy from the user's numbers. Every figure in the text is derived from the data,
 * so changing a transaction or the display currency keeps the explanation truthful.
 */
export class InsightBuilder {
  readonly finance: FinanceSummary;
  readonly display: Display;
  readonly history: SpendingHistory;

  constructor(finance: FinanceSummary, display: Display, history: SpendingHistory) {
    this.finance = finance;
    this.display = display;
    this.history = history;
  }

  content(kind: InsightKind): InsightContent {
    switch (kind) {
      case 'deliveryIncrease':
        return this.deliveryIncrease();
      case 'weekendPattern':
        return this.weekendPattern();
      case 'subscriptions':
        return this.subscriptions();
      case 'unusualExpense':
        return this.unusualExpense();
      case 'recurringMerchant':
        return this.recurringMerchant();
      case 'planProgress':
        return this.planProgress();
    }
  }

  // Shared figures

  get deliveryThisMonth(): Money {
    return this.finance.spending(this.finance.currentMonth, { category: 'foodDelivery' });
  }

  get deliveryRecentAverage(): Money {
    const totals = this.history.deliveryByMonth.map((month) => month.total);
    if (totals.length === 0) return zero('GEL');
    return divide(sum(totals, 'GEL'), totals.length);
  }

  /** A weekly delivery budget that returns spending to the recent average, rounded to 5 ₾. */
  get suggestedWeeklyDeliveryBudget(): Money {
    const weekly = majorUnits(this.deliveryRecentAverage) / WEEKS_PER_MONTH;
    return gel(round(weekly / 5) * 5);
  }

  get weekendFoodPremiumPercent(): number {
    const { weekdayFoodDailyAverage: weekday, weekendFoodDailyAverage: weekend } = this.history;
    return round(fraction(subtract(weekend, weekday), weekday) * 100);
  }

  /**
   * The merchant ordered from most often this month. Delivery merchants come first because the advice
   * is about delivery nights; fixed costs and subscriptions never count, they recur by contract.
   */
  get mostFrequentMerchant(): string | null {
    const expenses = this.finance.expenses(this.finance.currentMonth);
    const delivery = expenses.filter((transaction) => transaction.category === 'foodDelivery');
    const habitual = expenses.filter(
      (transaction) => !CATEGORY_META[transaction.category].isFixedCost && transaction.category !== 'subscriptions',
    );
    return mostFrequent(delivery.length > 0 ? delivery : habitual);
  }

  private get monthBasis(): string {
    const start = this.display.date(this.finance.currentMonth.start, 'dayMonth');
    const today = this.display.date(this.finance.now, 'dayMonth');
    return this.display.t(`Based on your transactions, ${start} – ${today}.`, `ეფუძნება შენს ტრანზაქციებს, ${start} – ${today}.`);
  }

  /** Covers every complete month in the bank data plus this one, e.g. "(Aug – Oct)". */
  private get historyBasis(): string {
    const first = this.history.completeMonths.at(0);
    if (!first) return this.monthBasis;
    const count = this.history.completeMonths.length + 1;
    const start = this.display.date(first, 'monthShort');
    const end = this.display.date(this.finance.now, 'monthShort');
    return this.display.t(
      `Based on ${count} months of your transactions (${start} – ${end}).`,
      `ეფუძნება ${count} თვის ტრანზაქციებს (${start} – ${end}).`,
    );
  }

  private money(value: Money): string {
    return this.display.money(value, { precision: 'whole' });
  }

  // Insights

  private deliveryIncrease(): InsightContent {
    const { display } = this;
    const thisMonth = this.deliveryThisMonth;
    const average = this.deliveryRecentAverage;
    const difference = subtract(thisMonth, average);
    const weekly = this.suggestedWeeklyDeliveryBudget;
    const history = this.history.deliveryByMonth;
    const comparedMonths = monthsDative(history.map((month) => month.month), display);

    return {
      kind: 'deliveryIncrease',
      icon: CATEGORY_META.foodDelivery.icon,
      tint: 'coral',
      background: 'coralPale',
      pose: 'insight',
      title: display.t('Food delivery is up this month', 'მიტანაზე ხარჯი ამ თვეში გაიზარდა'),
      summary: display.t(
        `You've spent ${this.money(thisMonth)} on delivery so far — ${this.money(difference)} more than your recent monthly average of ${this.money(average)}.`,
        `ამ თვეში მიტანაზე უკვე ${this.money(thisMonth)} დახარჯე — ${this.money(difference)}-ით მეტი, ვიდრე ბოლო თვეების საშუალო (${this.money(average)}).`,
      ),
      recommendation: display.t(
        `Try a weekly delivery budget of ${this.money(weekly)}. That would bring you back to your usual level.`,
        `სცადე მიტანის კვირის ბიუჯეტი — ${this.money(weekly)}. ასე ჩვეულ დონეს დაუბრუნდები.`,
      ),
      method: display.t(
        `We added up your Food delivery transactions this month and compared them with ${comparedMonths}. The weekly budget is your average month spread across its weeks, rounded to 5 ₾.`,
        `შევაჯამეთ ამ თვის „საკვების მიტანის“ ტრანზაქციები და შევადარეთ ${comparedMonths}. კვირის ბიუჯეტი საშუალო თვის კვირებზე გადანაწილებით გამოითვალა, 5 ₾-მდე დამრგვალებით.`,
      ),
      dataBasis: this.historyBasis,
      bars: bars([
        ...history.map((month) => ({ label: display.date(month.month, 'monthShort'), value: month.total })),
        { label: display.date(this.finance.now, 'monthShort'), value: thisMonth, isHighlighted: true },
      ]),
      relatedTransactions: this.finance.expenses(this.finance.currentMonth, 'foodDelivery'),
    };
  }

  private weekendPattern(): InsightContent {
    const { display } = this;
    const { weekdayFoodDailyAverage: weekday, weekendFoodDailyAverage: weekend } = this.history;
    const weekendExtra = multiply(subtract(weekend, weekday), 2);
    const premium = this.weekendFoodPremiumPercent;
    const weekendFood = this.finance
      .expenses(this.finance.currentMonth)
      .filter(
        (transaction) =>
          (transaction.category === 'foodDelivery' || transaction.category === 'foodAndDrink') && isWeekend(transaction.date),
      );

    return {
      kind: 'weekendPattern',
      icon: 'calendar',
      tint: 'lavender',
      background: 'lavenderPale',
      pose: 'overview',
      title: display.t('Weekends cost more for food', 'შაბათ-კვირას კვებაზე მეტს ხარჯავ'),
      summary: display.t(
        `Your weekend food spending is ${premium}% higher than your weekday average — about ${this.money(weekend)} a day versus ${this.money(weekday)}.`,
        `შაბათ-კვირას კვებაზე ხარჯი ${premium}%-ით მეტია სამუშაო დღეების საშუალოზე — დღეში დაახლოებით ${this.money(weekend)}, ნაცვლად ${this.money(weekday)}-ისა.`,
      ),
      recommendation: display.t(
        `Plan one home-cooked weekend meal. Bringing weekends closer to weekdays would keep about ${this.money(weekendExtra)} a weekend in your plan.`,
        `დაგეგმე ერთი სახლში მომზადებული კერძი შაბათ-კვირას. სამუშაო დღეებთან მიახლოება კვირაში დაახლოებით ${this.money(weekendExtra)}-ს დაგიზოგავს.`,
      ),
      method: display.t(
        'Average daily spending on delivery, restaurants, and cafés on Saturdays and Sundays, compared with Monday to Friday.',
        'მიტანაზე, რესტორნებსა და კაფეებზე დღიური საშუალო ხარჯი შაბათ-კვირას, შედარებული ორშაბათიდან პარასკევამდე.',
      ),
      dataBasis: this.historyBasis,
      bars: bars([
        { label: display.t('Weekdays', 'სამუშაო დღეები'), value: weekday },
        { label: display.t('Weekend', 'შაბათ-კვირა'), value: weekend, isHighlighted: true },
      ]),
      relatedTransactions: weekendFood,
    };
  }

  private subscriptions(): InsightContent {
    const { display, finance } = this;
    const subscriptions = finance.expenses(finance.currentMonth, 'subscriptions');
    const total = finance.total(subscriptions);
    const names = display.list(subscriptions.map((transaction) => transaction.merchant));
    const count = subscriptions.length;

    return {
      kind: 'subscriptions',
      icon: CATEGORY_META.subscriptions.icon,
      tint: 'amberDeep',
      background: 'amberPale',
      pose: 'overview',
      title: display.t(`${count} subscriptions renew monthly`, `${count} გამოწერა ყოველთვიურად განახლდება`),
      summary: display.t(
        `${names} cost ${display.money(total)} a month together. Some are charged in foreign currency, so the lari amount can change.`,
        `${names} ერთად თვეში ${display.money(total)} ჯდება. ზოგი უცხოურ ვალუტაში ირიცხება, ამიტომ ლარში თანხა შეიძლება შეიცვალოს.`,
      ),
      recommendation: display.t(
        'Check whether you still use each one. Pausing one you rarely open frees that amount every month.',
        'გადაამოწმე, ყველას თუ იყენებ. იშვიათად გამოყენებულის შეჩერება ამ თანხას ყოველთვიურად გაათავისუფლებს.',
      ),
      method: display.t(
        'We look for payments to the same merchant at a similar amount about a month apart. Foreign amounts use an illustrative sample rate, not a live rate.',
        'ვეძებთ ერთსა და იმავე მერჩანტთან მსგავს გადახდებს დაახლოებით თვის ინტერვალით. უცხოური თანხები ითვლება სანიმუშო და არა რეალური კურსით.',
      ),
      dataBasis: this.monthBasis,
      bars: bars(subscriptions.map((transaction) => ({ label: transaction.merchant, value: finance.gelAmount(transaction) }))),
      relatedTransactions: subscriptions,
    };
  }

  private unusualExpense(): InsightContent {
    const { display, finance } = this;
    const typical = this.history.typicalShoppingPurchase ?? zero('GEL');
    const largest = finance
      .expenses(finance.currentMonth, 'shopping')
      .reduce<FinanceTransaction | null>(
        (best, transaction) =>
          best === null || compare(finance.gelAmount(transaction), finance.gelAmount(best)) > 0 ? transaction : best,
        null,
      );
    const amount = largest ? finance.gelAmount(largest) : zero('GEL');
    const multiple = round(fraction(amount, typical));
    const merchant = largest?.merchant ?? '';
    const day = largest ? display.date(largest.date, 'dayMonth') : '';

    return {
      kind: 'unusualExpense',
      icon: CATEGORY_META.shopping.icon,
      tint: 'ink',
      background: 'cream',
      pose: 'overspending',
      title: display.t('One purchase stood out', 'ერთი შენაძენი გამოირჩევა'),
      summary: display.t(
        `${merchant} for ${this.money(amount)} on ${day} is about ${multiple}× your typical shopping purchase of ${this.money(typical)}.`,
        `${merchant} — ${this.money(amount)}, ${day}. ეს შენს ჩვეულ შენაძენზე (${this.money(typical)}) დაახლოებით ${multiple}-ჯერ მეტია.`,
      ),
      recommendation: display.t(
        "If it was planned, there's nothing to change. If not, mark it as a one-off so it doesn't skew next month's plan.",
        'თუ დაგეგმილი იყო, არაფრის შეცვლა არ გჭირდება. თუ არა, მონიშნე ერთჯერადად, რომ მომავალი თვის გეგმა არ დაამახინჯოს.',
      ),
      method: display.t(
        'We compare each purchase with your typical amount in the same category over the last three months.',
        'თითოეულ შენაძენს ვადარებთ იმავე კატეგორიის ჩვეულ თანხას ბოლო სამი თვის განმავლობაში.',
      ),
      dataBasis: this.historyBasis,
      bars: bars([
        { label: display.t('Typical', 'ჩვეული'), value: typical },
        { label: merchant, value: amount, isHighlighted: true },
      ]),
      relatedTransactions: largest ? [largest] : [],
    };
  }

  private recurringMerchant(): InsightContent {
    const { display, finance } = this;
    const merchant = this.mostFrequentMerchant ?? '';
    const orders = finance
      .transactionsFrom(merchant, finance.currentMonth)
      .sort((lhs, rhs) => lhs.date.getTime() - rhs.date.getTime());
    const total = finance.total(orders);
    const eveningOrders = orders.filter((transaction) => dateParts(transaction.date).hour >= EVENING_HOUR);
    const eveningNote = eveningOrders.length * 2 > orders.length ? display.t(', mostly in the evening', ', ძირითადად საღამოს') : '';

    return {
      kind: 'recurringMerchant',
      icon: 'arrow.triangle.2.circlepath',
      tint: 'mintDark',
      background: 'mintPale',
      pose: 'insight',
      title: display.t(`${merchant} is a regular`, `${merchant} ხშირი არჩევანია`),
      summary: display.t(
        `You ordered from ${merchant} ${orders.length} times this month${eveningNote} — ${this.money(total)} in total.`,
        `ამ თვეში ${merchant}-დან ${orders.length}-ჯერ შეუკვეთე${eveningNote} — ჯამში ${this.money(total)}.`,
      ),
      recommendation: display.t(
        "Choose one or two delivery nights a week in advance. It's easier than deciding when you're already hungry.",
        'წინასწარ აირჩიე კვირაში ერთი-ორი საღამო მიტანისთვის. ეს უფრო ადვილია, ვიდრე მშიერმა გადაწყვიტო.',
      ),
      method: display.t(
        'We group transactions by merchant and count how often each appears this month.',
        'ტრანზაქციებს ვაჯგუფებთ მერჩანტის მიხედვით და ვითვლით, ამ თვეში რამდენჯერ გვხვდება თითოეული.',
      ),
      dataBasis: this.monthBasis,
      bars: bars(
        orders.map((transaction) => ({ label: display.date(transaction.date, 'dayMonth'), value: finance.gelAmount(transaction) })),
      ),
      relatedTransactions: orders,
    };
  }

  private planProgress(): InsightContent {
    const { display, finance } = this;
    const progress = finance.monthlyPlanProgress;
    const percent = round(progress.fractionUsed * 100);
    const isOver = progress.status === 'over';
    const largest = finance
      .expenses(finance.currentMonth)
      .sort((lhs, rhs) => compare(finance.gelAmount(rhs), finance.gelAmount(lhs)))
      .slice(0, 5);

    return {
      kind: 'planProgress',
      icon: 'chart.pie.fill',
      tint: 'mintDark',
      background: 'mintPale',
      pose: 'savings',
      title: isOver
        ? display.t("You've gone past this month's plan", 'ამ თვის გეგმას გადააჭარბე')
        : display.t("You're within this month's plan", 'ამ თვის გეგმაში ჯდები'),
      summary: display.t(
        `You've used ${percent}% of your ${this.money(progress.limit)} plan with ${finance.daysLeftInMonth} days to go. ${this.money(progress.remaining)} is left.`,
        `${this.money(progress.limit)}-იანი გეგმის ${percent}% უკვე გამოყენებულია, თვის ბოლომდე ${finance.daysLeftInMonth} დღეა. დარჩა ${this.money(progress.remaining)}.`,
      ),
      recommendation: isOver
        ? display.t(
            "Keep the next days light, and we'll adjust next month's plan together.",
            'მომდევნო დღეები მსუბუქად გაატარე, მომავალი თვის გეგმას კი ერთად შევცვლით.',
          )
        : display.t(
            "Keep the last days light and you'll close the month under plan.",
            'ბოლო დღეები მსუბუქად გაატარე და თვეს გეგმაზე ნაკლებით დახურავ.',
          ),
      method: display.t(
        "Everything you've spent since the 1st, including rent and bills, compared with your monthly plan.",
        'თვის დასაწყისიდან დახარჯული ყველა თანხა, ქირისა და კომუნალურების ჩათვლით, შედარებული თვის გეგმასთან.',
      ),
      dataBasis: this.monthBasis,
      bars: bars([
        { label: display.t('Plan', 'გეგმა'), value: progress.limit },
        { label: display.t('Spent', 'დახარჯული'), value: progress.spent, isHighlighted: true },
      ]),
      relatedTransactions: largest,
    };
  }
}

/** How this month's spending so far compares with last month's total; null without last month's data. */
export function monthSpendingChange(current: Money, previous: Money | null): { percent: number; isLower: boolean } | null {
  if (!previous) return null;
  const change = fraction(subtract(current, previous), previous);
  return { percent: round(Math.abs(change) * 100), isLower: change <= 0 };
}

function bars(items: readonly { label: string; value: Money; isHighlighted?: boolean }[]): InsightBar[] {
  return items.map((item, index) => ({
    id: `bar-${index}`,
    label: item.label,
    value: item.value,
    isHighlighted: item.isHighlighted ?? false,
  }));
}

/** The merchant appearing most often; on a tie, the one seen first. */
function mostFrequent(transactions: readonly FinanceTransaction[]): string | null {
  const counts = new Map<string, number>();
  for (const transaction of transactions) {
    counts.set(transaction.merchant, (counts.get(transaction.merchant) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [merchant, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) best = merchant;
  }
  return best;
}

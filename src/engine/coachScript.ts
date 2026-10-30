import { addDays } from './calendar.ts';
import { CATEGORY_META } from './categories.ts';
import type { Display } from './display.ts';
import type { FinanceSummary } from './financeSummary.ts';
import type { SpendingHistory } from './history.ts';
import { InsightBuilder } from './insights.ts';
import { compare, divide, fraction, gel, maxMoney, multiply, negate, subtract, zero, type Money } from './money.ts';
import { monthRangeGenitive, monthsGenitive } from './monthPhrases.ts';
import { round } from './rounding.ts';
import { GoalProjection, type SavingsGoal } from './savingsGoal.ts';
import { FREE_MONTHLY_AI_RECOMMENDATIONS } from './settings.ts';
import type { FinanceTransaction } from './transactions.ts';

/** The suggested questions Luka can answer without the AI. */
export type CoachQuestion = 'weeklyAllowance' | 'whySpendMore' | 'saveForGoal' | 'changeNextWeek' | 'compareLastMonth';

export const COACH_QUESTIONS: readonly CoachQuestion[] = [
  'weeklyAllowance',
  'whySpendMore',
  'saveForGoal',
  'changeNextWeek',
  'compareLastMonth',
];

export interface CoachReply {
  readonly text: string;
  readonly reasoning: string;
  readonly supportingTransactions: readonly FinanceTransaction[];
  readonly followUps: readonly CoachQuestion[];
  readonly isEstimate: boolean;
}

/**
 * Luka's scripted, data-grounded replies, used when the AI coach is offline. Every number comes from
 * `FinanceSummary`, the bank history, or the goal projection, so Luka never states a figure the data
 * doesn't support.
 */
export class CoachScript {
  readonly finance: FinanceSummary;
  readonly goal: SavingsGoal | null;
  readonly display: Display;
  readonly history: SpendingHistory;

  constructor(finance: FinanceSummary, goal: SavingsGoal | null, display: Display, history: SpendingHistory) {
    this.finance = finance;
    this.goal = goal;
    this.display = display;
    this.history = history;
  }

  greeting(name: string): string {
    const left = this.money(this.finance.safeToSpendThisWeek);
    return this.display.t(
      `Hi ${name}. I've looked over your week. You have ${left} left in your plan. What would you like to figure out?`,
      `გამარჯობა, ${name}. შენი კვირა გადავხედე. გეგმაში ${left} დაგრჩა. რისი გარკვევა გინდა?`,
    );
  }

  prompt(question: CoachQuestion): string {
    const { display } = this;
    switch (question) {
      case 'weeklyAllowance':
        return display.t('How much can I spend this week?', 'რამდენი შემიძლია დავხარჯო ამ კვირაში?');
      case 'whySpendMore':
        return display.t('Why did I spend more this month?', 'რატომ დავხარჯე ამ თვეში მეტი?');
      case 'saveForGoal': {
        const target = this.money(this.goal?.target ?? gel(4000));
        return display.t(`How can I save ${target}?`, `როგორ დავზოგო ${target}?`);
      }
      case 'changeNextWeek':
        return display.t('What should I change next week?', 'რა შევცვალო მომავალ კვირაში?');
      case 'compareLastMonth':
        return display.t('Compare my spending with last month.', 'შეადარე ჩემი ხარჯი გასულ თვეს.');
    }
  }

  reply(question: CoachQuestion): CoachReply {
    switch (question) {
      case 'weeklyAllowance':
        return this.weeklyAllowance();
      case 'whySpendMore':
        return this.whySpendMore();
      case 'saveForGoal':
        return this.saveForGoal();
      case 'changeNextWeek':
        return this.changeNextWeek();
      case 'compareLastMonth':
        return this.compareLastMonth();
    }
  }

  get unsupportedQuestion(): string {
    return this.display.t(
      "I can't answer free-form questions right now. Try one of the suggested questions — they use your own data.",
      'თავისუფალ კითხვებზე პასუხი ახლა არ შემიძლია. სცადე შემოთავაზებული კითხვები — ისინი შენს მონაცემებს იყენებს.',
    );
  }

  get coachingDataOff(): string {
    return this.display.t(
      "You've turned off using your transactions for coaching, so I can't give personalized answers. You can change this in Profile → Data-sharing permissions.",
      'რჩევებისთვის ტრანზაქციების გამოყენება გათიშული გაქვს, ამიტომ პერსონალურ პასუხს ვერ გაგცემ. ამის შეცვლა შეგიძლია: პროფილი → მონაცემების გაზიარების ნებართვები.',
    );
  }

  get limitReached(): string {
    const limit = FREE_MONTHLY_AI_RECOMMENDATIONS;
    return this.display.t(
      `You've used your ${limit} personalized answers for this month. Premium includes more coaching — or keep using the free basics.`,
      `ამ თვის ${limit} პერსონალური პასუხი გამოყენებულია. Premium-ში მეტი რჩევაა — ან განაგრძე უფასო ფუნქციებით.`,
    );
  }

  private money(value: Money): string {
    return this.display.money(value, { precision: 'whole' });
  }

  private get insights(): InsightBuilder {
    return new InsightBuilder(this.finance, this.display, this.history);
  }

  private get deliveryMonths(): Date[] {
    return this.history.deliveryByMonth.map((month) => month.month);
  }

  // Replies

  private weeklyAllowance(): CoachReply {
    const { display, finance } = this;
    const progress = finance.weeklyPlanProgress;
    const lastDay = display.date(addDays(finance.currentWeek.end, -1), 'weekdayDayMonth');
    const left = this.money(finance.safeToSpendThisWeek);
    const daily = this.money(finance.dailyAllowance);

    return {
      text: display.t(
        `You have ${left} left in this week's plan, through ${lastDay}. That's about ${daily} a day. Rent and bills are already covered, so this is for food, transport, and fun.`,
        `ამ კვირის გეგმაში ${left} დაგრჩა, ${lastDay}-ის ჩათვლით. ეს დღეში დაახლოებით ${daily}-ია. ქირა და კომუნალურები უკვე გათვალისწინებულია, ასე რომ ეს თანხა საკვებისთვის, ტრანსპორტისა და გართობისთვისაა.`,
      ),
      reasoning: display.t(
        `Weekly plan ${this.money(progress.limit)} − spent since Monday ${this.money(progress.spent)} = ${this.money(progress.remaining)}, spread over ${finance.daysLeftInWeek} days including today.`,
        `კვირის გეგმა ${this.money(progress.limit)} − ორშაბათიდან დახარჯული ${this.money(progress.spent)} = ${this.money(progress.remaining)}, გადანაწილებული ${finance.daysLeftInWeek} დღეზე, დღევანდელის ჩათვლით.`,
      ),
      supportingTransactions: finance
        .expenses(finance.currentWeek)
        .filter((transaction) => !CATEGORY_META[transaction.category].isFixedCost),
      followUps: ['changeNextWeek', 'compareLastMonth'],
      isEstimate: false,
    };
  }

  private whySpendMore(): CoachReply {
    const { display, finance } = this;
    const insights = this.insights;
    const previous = this.history.previousMonthSpending;
    const delivery = insights.deliveryThisMonth;
    const deliveryOrders = finance.expenses(finance.currentMonth, 'foodDelivery');
    const averageOrder = divide(delivery, Math.max(deliveryOrders.length, 1));
    const twoOrders = multiply(averageOrder, 2);
    const difference = subtract(delivery, insights.deliveryRecentAverage);
    const goalName = this.goal ? display.text(this.goal.name) : display.t('your goal', 'შენი მიზანი');
    const months = monthsGenitive(this.deliveryMonths, display);

    const deliverySentence = display.t(
      `The category that went up is food delivery: ${this.money(delivery)} so far, about ${this.money(difference)} more than your recent monthly average. Cutting two delivery orders next month could redirect about ${this.money(twoOrders)} toward ${goalName}.`,
      `გაიზარდა საკვების მიტანა: ჯერჯერობით ${this.money(delivery)}, ბოლო თვეების საშუალოზე დაახლოებით ${this.money(difference)}-ით მეტი. მომავალ თვეში ორი შეკვეთით ნაკლები „${goalName}“-ს დაახლოებით ${this.money(twoOrders)}-ს მოუტანს.`,
    );

    return {
      text: `${this.overallChange(previous)} ${deliverySentence}`,
      reasoning: previous
        ? display.t(
            `I compared this month's transactions with last month's total (${this.money(previous)}) and your delivery totals for ${months}. Two orders are valued at your average order of ${this.money(averageOrder)}.`,
            `ამ თვის ტრანზაქციები შევადარე გასული თვის ჯამს (${this.money(previous)}) და ${months} მიტანის ხარჯს. ორი შეკვეთა შეფასებულია საშუალო შეკვეთით — ${this.money(averageOrder)}.`,
          )
        : display.t(
            `I looked at this month's transactions and your delivery totals for ${months}. Two orders are valued at your average order of ${this.money(averageOrder)}.`,
            `ამ თვის ტრანზაქციებს და ${months} მიტანის ხარჯს გადავხედე. ორი შეკვეთა შეფასებულია საშუალო შეკვეთით — ${this.money(averageOrder)}.`,
          ),
      supportingTransactions: deliveryOrders,
      followUps: ['changeNextWeek', 'saveForGoal'],
      isEstimate: false,
    };
  }

  private overallChange(previous: Money | null): string {
    const { display } = this;
    if (!previous) {
      return display.t(
        "Your bank data doesn't reach back to last month yet, so I can't compare overall spending.",
        'შენი საბანკო მონაცემები გასულ თვემდე ჯერ არ აღწევს, ამიტომ საერთო ხარჯს ვერ შევადარებ.',
      );
    }
    const change = fraction(subtract(this.finance.monthlySpending, previous), previous);
    const percent = round(Math.abs(change) * 100);
    return change <= 0
      ? display.t(
          `Overall, you're actually spending ${percent}% less than last month.`,
          `ზოგადად, გასულ თვესთან შედარებით ${percent}%-ით ნაკლებს ხარჯავ.`,
        )
      : display.t(`Overall, you're spending ${percent}% more than last month.`, `ზოგადად, გასულ თვესთან შედარებით ${percent}%-ით მეტს ხარჯავ.`);
  }

  private saveForGoal(): CoachReply {
    const { display, goal } = this;
    if (!goal) {
      return {
        text: display.t("Create a goal first and I'll work out a weekly amount for you.", 'ჯერ შექმენი მიზანი და კვირის თანხას მე დაგითვლი.'),
        reasoning: display.t("There's no savings goal to plan for yet.", 'დასაგეგმი მიზანი ჯერ არ არის.'),
        supportingTransactions: [],
        followUps: ['weeklyAllowance'],
        isEstimate: false,
      };
    }

    const projection = new GoalProjection(goal, this.finance.now);
    const dueDate = display.date(goal.targetDate, 'dayMonthYear');
    const completion = projection.completionDate(goal.monthlyContribution);
    const completionText = completion ? display.date(completion, 'monthYear') : display.t('later', 'მოგვიანებით');
    const extra = maxMoney(subtract(projection.requiredMonthly, goal.monthlyContribution), zero('GEL'));
    const name = display.text(goal.name);
    const contribution = this.money(goal.monthlyContribution);

    const plan =
      projection.status === 'onTrack' || projection.status === 'reached'
        ? display.t(
            `At ${contribution} a month you're on track to reach it around ${completionText}.`,
            `თვეში ${contribution}-ით სწორ გზაზე ხარ და მიზანს დაახლოებით ${completionText}-ში მიაღწევ.`,
          )
        : display.t(
            `At your current ${contribution} a month, you'd get there around ${completionText}. Two options: move the date to ${completionText}, or add about ${this.money(extra)} a month — trimming delivery and restaurants could cover part of it.`,
            `ახლანდელი ტემპით, თვეში ${contribution}, მიზანს დაახლოებით ${completionText}-ში მიაღწევ. ორი ვარიანტია: თარიღი გადაწიე ${completionText}-მდე, ან თვეში დაახლოებით ${this.money(extra)} დაამატე — ნაწილს მიტანისა და რესტორნების შემცირება დაფარავს.`,
          );

    const intro = display.t(
      `Your ${name} has ${this.money(goal.saved)} of ${this.money(goal.target)}, so ${this.money(projection.remaining)} is left. To get there by ${dueDate}, you'd need about ${this.money(projection.requiredWeekly)} a week. `,
      `„${name}“-ში ${this.money(goal.target)}-დან ${this.money(goal.saved)} გაქვს, დარჩა ${this.money(projection.remaining)}. ${dueDate}-მდე მისაღწევად კვირაში დაახლოებით ${this.money(projection.requiredWeekly)} დაგჭირდება. `,
    );

    return {
      text: intro + plan,
      reasoning: display.t(
        `Remaining amount spread over the ${projection.daysRemaining} days until ${dueDate}. The projection assumes your monthly contribution stays the same.`,
        `დარჩენილი თანხა გადანაწილებულია ${dueDate}-მდე დარჩენილ ${projection.daysRemaining} დღეზე. პროგნოზი ითვალისწინებს, რომ თვის შენატანი არ შეიცვლება.`,
      ),
      supportingTransactions: [],
      followUps: ['changeNextWeek'],
      isEstimate: true,
    };
  }

  private changeNextWeek(): CoachReply {
    const { display, finance } = this;
    const recentDelivery = finance.expenses(finance.lastSevenDays, 'foodDelivery');
    const recentTotal = finance.spending(finance.lastSevenDays, { category: 'foodDelivery' });
    const budget = this.money(this.insights.suggestedWeeklyDeliveryBudget);
    const range = monthRangeGenitive(this.deliveryMonths, display);

    return {
      text: display.t(
        `Just one thing: try a weekly delivery budget of ${budget}. In the last 7 days you had ${recentDelivery.length} delivery orders for ${this.money(recentTotal)}. Cooking twice at the weekend would cover most of the gap.`,
        `მხოლოდ ერთი რამ: სცადე მიტანის კვირის ბიუჯეტი — ${budget}. ბოლო 7 დღეში ${recentDelivery.length} შეკვეთა გქონდა, ჯამში ${this.money(recentTotal)}. შაბათ-კვირას ორჯერ სახლში მომზადება სხვაობის უმეტესს დაფარავს.`,
      ),
      reasoning: display.t(
        `Based on your last 7 days of food delivery. The budget brings delivery back to your ${range} average.`,
        `ეფუძნება ბოლო 7 დღის მიტანის ხარჯს. ბიუჯეტი მიტანას ${range} საშუალოს უბრუნებს.`,
      ),
      supportingTransactions: recentDelivery,
      followUps: ['weeklyAllowance', 'saveForGoal'],
      isEstimate: false,
    };
  }

  private compareLastMonth(): CoachReply {
    const { display, finance } = this;
    const previous = this.history.previousMonthSpending;
    const spent = this.money(finance.monthlySpending);
    const largest = finance
      .expenses(finance.currentMonth)
      .sort((lhs, rhs) => compare(finance.gelAmount(rhs), finance.gelAmount(lhs)))
      .slice(0, 5);

    if (!previous) {
      return {
        text: display.t(
          `So far this month: ${spent}, with ${finance.daysLeftInMonth} days left. Your bank data doesn't cover last month yet, so there's nothing to compare with.`,
          `ამ თვეში ჯერჯერობით: ${spent}, თვის ბოლომდე ${finance.daysLeftInMonth} დღეა. გასული თვე შენს საბანკო მონაცემებში ჯერ არ ჩანს, ამიტომ შესადარებელი არაფერია.`,
        ),
        reasoning: display.t("This month's transactions to date.", 'ამ თვის ტრანზაქციები დღემდე.'),
        supportingTransactions: largest,
        followUps: ['whySpendMore'],
        isEstimate: false,
      };
    }

    const difference = subtract(previous, finance.monthlySpending);
    const lastMonthDelivery = this.history.deliveryByMonth.at(-1)?.total ?? zero('GEL');
    const lowerOrHigher =
      difference.minorUnits >= 0
        ? display.t(`about ${this.money(difference)} lower`, `დაახლოებით ${this.money(difference)}-ით ნაკლები`)
        : display.t(`about ${this.money(negate(difference))} higher`, `დაახლოებით ${this.money(negate(difference))}-ით მეტი`);
    const deliveryThisMonth = this.money(this.insights.deliveryThisMonth);

    return {
      text: display.t(
        `So far this month: ${spent}. Last month: ${this.money(previous)}. You're ${lowerOrHigher}, with ${finance.daysLeftInMonth} days left. Delivery is the main category that went up: ${deliveryThisMonth} versus ${this.money(lastMonthDelivery)}.`,
        `ამ თვეში ჯერჯერობით: ${spent}. გასულ თვეს: ${this.money(previous)}. ${lowerOrHigher} გაქვს, თვის ბოლომდე ${finance.daysLeftInMonth} დღეა. მთავარი ზრდა მიტანაზეა: ${deliveryThisMonth}, ნაცვლად ${this.money(lastMonthDelivery)}-ისა.`,
      ),
      reasoning: display.t(
        "This month's transactions to date compared with last month's total from your transaction history.",
        'ამ თვის ტრანზაქციები შედარებულია გასული თვის ჯამთან, ტრანზაქციების ისტორიიდან.',
      ),
      supportingTransactions: largest,
      followUps: ['whySpendMore'],
      isEstimate: false,
    };
  }
}

/** The questions to suggest next: follow-ups to the last answer, or every question to start with. */
export function coachSuggestions(lastAnswered: CoachQuestion | null, script: CoachScript): readonly CoachQuestion[] {
  return lastAnswered ? script.reply(lastAnswered).followUps : COACH_QUESTIONS;
}

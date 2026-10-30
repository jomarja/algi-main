import { lt, type LocalizedText } from './localization.ts';
import { fraction, majorUnits, type Money } from './money.ts';
import type { PaletteToken } from './palette.ts';
import type { SavingsGoal } from './savingsGoal.ts';

/** A recommendation the user followed, and what it saved. */
export interface CompletedRecommendation {
  readonly id: string;
  readonly title: LocalizedText;
  readonly saved: Money;
  readonly date: Date;
}

export interface Achievement {
  readonly id: string;
  readonly title: LocalizedText;
  readonly detail: LocalizedText;
  /** SF Symbol name; the design system maps it to an icon. */
  readonly icon: string;
  readonly tint: PaletteToken;
  /** 0...1; 1 means earned. */
  readonly progress: number;
}

export function isEarned(achievement: Achievement): boolean {
  return achievement.progress >= 1;
}

/** Short lessons that count toward the "Money basics" achievement. */
export type Lesson = 'needsVersusWants' | 'emergencyFund' | 'totalCostOfCredit';

export const LESSONS: readonly Lesson[] = ['needsVersusWants', 'emergencyFund', 'totalCostOfCredit'];

export const LESSON_CONTENT: Readonly<Record<Lesson, { readonly title: LocalizedText; readonly points: readonly LocalizedText[] }>> = {
  needsVersusWants: {
    title: lt('Needs vs. wants', 'საჭიროება თუ სურვილი'),
    points: [
      lt(
        'Needs keep life running: food, home, health, getting to work.',
        'საჭიროებები ცხოვრებას ამოძრავებს: საკვები, სახლი, ჯანმრთელობა, სამსახურამდე მისვლა.',
      ),
      lt(
        'Wants make life nicer, and they deserve a place in your plan too.',
        'სურვილები ცხოვრებას ალამაზებს და გეგმაში ადგილი მათაც ეკუთვნით.',
      ),
      lt('Algi never trims needs to make a goal fit.', 'Algi მიზნის გამო საჭიროებებს არასდროს ამცირებს.'),
    ],
  },
  emergencyFund: {
    title: lt('Why an emergency fund?', 'რატომ სარეზერვო ფონდი?'),
    points: [
      lt('Aim for three months of essentials.', 'მიზანი — სამი თვის აუცილებელი ხარჯი.'),
      lt(
        'It turns surprises into inconveniences, not debt.',
        'ის მოულოდნელობას პრობლემად არ, უბრალო უხერხულობად აქცევს.',
      ),
      lt('Keep it separate from everyday money.', 'შეინახე ყოველდღიური ფულისგან ცალკე.'),
    ],
  },
  totalCostOfCredit: {
    title: lt("Rate isn't the whole cost", 'განაკვეთი სრული ფასი არ არის'),
    points: [
      lt(
        'Compare the total repayable, not just the rate.',
        'შეადარე სრული დასაბრუნებელი თანხა და არა მხოლოდ განაკვეთი.',
      ),
      lt(
        'Longer terms lower the payment but usually raise the total.',
        'გრძელი ვადა გადასახადს ამცირებს, მაგრამ ჯამს ზრდის.',
      ),
      lt('Fees and compulsory insurance count too.', 'საკომისიოც და სავალდებულო დაზღვევაც ითვლება.'),
    ],
  },
};

export interface RewardsInput {
  readonly goals: readonly SavingsGoal[];
  /**
   * What was originally borrowed. TBC's loan data has no original amount, so the store passes null
   * and the "loan half repaid" achievement stays at zero until the bank reports it.
   */
  readonly originalLoanPrincipal: Money | null;
  readonly loanRemaining: Money | null;
  readonly savingStreakMonths: number;
  readonly hasReviewedBudget: boolean;
  readonly hasComparedLoan: boolean;
  readonly completedLessons: readonly Lesson[];
}

/**
 * Rewards good decisions, not just low spending. Streaks count months you saved anything,
 * and a hard week never resets your progress.
 */
export class RewardsBuilder {
  readonly input: RewardsInput;

  constructor(input: RewardsInput) {
    this.input = input;
  }

  get loanRepaidShare(): number {
    const { originalLoanPrincipal, loanRemaining } = this.input;
    if (!originalLoanPrincipal || !loanRemaining || originalLoanPrincipal.minorUnits <= 0) return 0;
    return 1 - fraction(loanRemaining, originalLoanPrincipal);
  }

  get achievements(): Achievement[] {
    const { goals, savingStreakMonths, hasReviewedBudget, hasComparedLoan, completedLessons } = this.input;
    const bestGoalShare = Math.max(0, ...goals.map((goal) => fraction(goal.saved, goal.target)));
    const largestSaved = Math.max(0, ...goals.map((goal) => majorUnits(goal.saved)));
    const lessonsDone = new Set(completedLessons).size;
    return [
      {
        id: 'first-thousand',
        title: lt('First 1,000 ₾', 'პირველი 1 000 ₾'),
        detail: lt('Saved 1,000 ₾ toward one goal', 'ერთ მიზანზე 1 000 ₾ დაზოგე'),
        icon: 'banknote.fill',
        tint: 'mint',
        progress: Math.min(largestSaved / 1000, 1),
      },
      {
        id: 'streak',
        title: lt(`${savingStreakMonths}-month streak`, `${savingStreakMonths}-თვიანი სერია`),
        detail: lt('Saved something every month — any amount counts', 'ყოველთვე რაღაც დაზოგე — ნებისმიერი თანხა ითვლება'),
        icon: 'flame.fill',
        tint: 'amberDeep',
        progress: Math.min(savingStreakMonths / 3, 1),
      },
      {
        id: 'halfway',
        title: lt('Halfway there', 'გზის ნახევარი'),
        detail: lt('Reached 50% of a goal', 'მიზნის 50% მიაღწიე'),
        icon: 'flag.fill',
        tint: 'coral',
        progress: Math.min(bestGoalShare / 0.5, 1),
      },
      {
        id: 'loan-half',
        title: lt('Loan half repaid', 'სესხის ნახევარი დაფარულია'),
        detail: lt('Paid back 50% of a loan', 'სესხის 50% დაფარე'),
        icon: 'creditcard.fill',
        tint: 'lavender',
        progress: Math.min(this.loanRepaidShare / 0.5, 1),
      },
      {
        id: 'essentials',
        title: lt('Needs protected', 'საჭიროებები დაცულია'),
        detail: lt('Chose which spending is essential', 'აირჩიე, რომელი ხარჯია აუცილებელი'),
        icon: 'lock.shield.fill',
        tint: 'mintDark',
        progress: hasReviewedBudget ? 1 : 0,
      },
      {
        id: 'loan-detective',
        title: lt('Loan detective', 'სესხის დეტექტივი'),
        detail: lt('Compared the full cost of a loan offer', 'სესხის შეთავაზების სრული ფასი შეადარე'),
        icon: 'magnifyingglass',
        tint: 'ink',
        progress: hasComparedLoan ? 1 : 0,
      },
      {
        id: 'money-basics',
        title: lt('Money basics', 'ფინანსური საფუძვლები'),
        detail: lt(`Finished ${LESSONS.length} short lessons`, `${LESSONS.length} მოკლე გაკვეთილი გაიარე`),
        icon: 'book.fill',
        tint: 'amberDeep',
        progress: lessonsDone / LESSONS.length,
      },
    ];
  }
}

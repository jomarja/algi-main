import type { BankTransaction, SpendingCategoryId } from '../../shared/bank.ts';

/**
 * Keyword tables that classify TBC transactions, matched case-insensitively against the merchant and the
 * bank's description together. A keyword matches a whole word; a trailing `*` matches a word prefix, which
 * also covers Georgian case endings (სესხ* matches სესხი, სესხის, სესხზე).
 *
 * Rules are tried in order and the first match wins, so specific names come before generic words:
 * Bolt Food before Bolt, "rent a car" before rent, a café or a supermarket in a mall before the mall.
 */

type ExpenseCategory = Exclude<SpendingCategoryId, 'income'>;

interface CategoryRule {
  category: ExpenseCategory;
  keywords: readonly string[];
}

const expenseRules: readonly CategoryRule[] = [
  {
    category: 'debt',
    keywords: ['loan*', 'სესხ*', 'mortgage', 'იპოთეკ*', 'installment*', 'განვადებ*'],
  },
  {
    category: 'foodDelivery',
    keywords: ['wolt', 'ვოლტ*', 'glovo', 'გლოვო*', 'bolt food', 'yandex eats', 'yandex food'],
  },
  {
    category: 'subscriptions',
    keywords: ['netflix', 'spotify', 'icloud', 'apple', 'google', 'youtube', 'disney*', 'hbo*', 'adobe', 'microsoft'],
  },
  {
    category: 'utilities',
    keywords: [
      'telasi', 'თელას*', 'gwp', 'ჯი-დაბლიუ-პი', 'te-ge energo', 'tege energo', 'თე-გე ენერგო', 'energo-pro', 'ენერგო-პრო*',
      'tbilisi energy', 'თბილისი ენერჯი', 'silknet', 'სილქნეტ*', 'magti*', 'მაგთი*', 'cellfie', 'სელფი', 'beeline', 'ბილაინ*',
      'electricity', 'ელექტროენერგი*', 'კომუნალ*',
    ],
  },
  {
    category: 'health',
    keywords: [
      'psp', 'ფსპ', 'aversi', 'ავერს*', 'gpc', 'ჯიპისი', 'pharmacy', 'აფთიაქ*', 'clinic*', 'კლინიკ*', 'hospital', 'საავადმყოფ*',
      'dental', 'სტომატოლოგ*',
    ],
  },
  {
    category: 'groceries',
    keywords: [
      'carrefour', 'კარფურ*', 'nikora', 'ნიკორა*', 'goodwill', 'გუდვილ*', 'spar', 'სპარ*', 'ori nabiji', '2 nabiji', 'ორი ნაბიჯი',
      'agrohub', 'აგროჰაბ*', 'fresco', 'ფრესკო', 'europroduct', 'ევროპროდუქტ*', 'supermarket*', 'სუპერმარკეტ*',
    ],
  },
  {
    category: 'transport',
    keywords: [
      'bolt', 'yandex*', 'uber', 'taxi', 'ტაქსი*', 'metro', 'მეტრო*', 'metromoney', 'ttc', 'tbilisi transport company', 'parking',
      'პარკინგ*', 'rent a car', 'wissol', 'ვისოლ*', 'gulf', 'გალფ*', 'rompetrol', 'რომპეტროლ*', 'socar', 'სოკარ*', 'lukoil',
      'ლუკოილ*', 'petrol*', 'fuel', 'საწვავ*',
    ],
  },
  {
    category: 'housing',
    keywords: ['rent', 'ქირა', 'ქირის', 'ქირას', 'ქირით', 'იჯარ*'],
  },
  {
    category: 'foodAndDrink',
    keywords: [
      'cafe*', 'café*', 'კაფე*', 'coffee*', 'ყავა', 'ყავის', 'restaurant*', 'რესტორან*', 'bar', 'ბარი', 'pub', 'bistro', 'pizza*',
      'პიცა*', 'burger*', 'mcdonald*', 'მაკდონალდს*', 'kfc', 'wendy*', 'dunkin*', 'starbucks', 'khinkali*', 'ხინკალ*', 'entrée',
      'entree', 'bakery', 'საცხობ*',
    ],
  },
  {
    category: 'shopping',
    keywords: [
      'zara', 'h&m', 'lc waikiki', 'galleria', 'გალერეა*', 'east point', 'tbilisi mall', 'city mall', 'mango', 'bershka', 'pull&bear',
      'decathlon', 'ikea', 'amazon', 'aliexpress', 'temu',
    ],
  },
];

/** Spending nothing above recognises still needs a category: shopping is the flexible, non-essential default. */
const fallbackExpenseCategory: ExpenseCategory = 'shopping';

/** Wording of transfers and currency conversions between the customer's own accounts. */
const ownTransferKeywords = ['საკუთარ ანგარიშ*', 'own account*', 'between own accounts', 'კონვერტაცი*', 'currency conversion'];

const wordCharacter = '[\\p{L}\\p{N}]';

const compiledRules = expenseRules.map(({ category, keywords }) => ({ category, patterns: keywords.map(keywordPattern) }));
const ownTransferPatterns = ownTransferKeywords.map(keywordPattern);

/** Money in is always income; money out is classified by the first rule whose keyword appears in `text`. */
export function categorize(direction: BankTransaction['direction'], text: string): SpendingCategoryId {
  if (direction === 'income') return 'income';
  const subject = normalizeText(text);
  return compiledRules.find((rule) => matchesAny(subject, rule.patterns))?.category ?? fallbackExpenseCategory;
}

export function looksLikeOwnTransfer(text: string): boolean {
  return matchesAny(normalizeText(text), ownTransferPatterns);
}

function keywordPattern(keyword: string): RegExp {
  const isPrefix = keyword.endsWith('*');
  const word = escapeRegExp(normalizeText(isPrefix ? keyword.slice(0, -1) : keyword));
  return new RegExp(`(?<!${wordCharacter})${word}${isPrefix ? '' : `(?!${wordCharacter})`}`, 'u');
}

function normalizeText(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

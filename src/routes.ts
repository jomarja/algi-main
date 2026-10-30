import { lt } from './engine/localization.ts';
import type { RouteConfig } from './layout/router/routeTable.ts';

/**
 * Every screen of the app. Paths nest: a child's path is relative to its parent, and it inherits the parent's
 * `tab`, `chrome` and `access` unless it sets its own. The parent is also where Back goes on a deep link.
 * Each screen is a lazily imported module whose default export takes `ScreenProps` ({ params, route }).
 */

export const routes: readonly RouteConfig[] = [
  // Onboarding: welcome → personalization → personal information → bank connection.
  {
    path: 'welcome',
    title: lt('Welcome', 'მისალმება'),
    screen: () => import('./screens/onboarding/WelcomeScreen.tsx'),
    chrome: 'bare',
    access: 'onboarding',
  },
  {
    path: 'onboarding',
    title: lt('Get started', 'დაწყება'),
    chrome: 'bare',
    access: 'onboarding',
    children: [
      {
        path: 'personalization',
        title: lt('Make Algi yours', 'მოირგე Algi'),
        screen: () => import('./screens/onboarding/PersonalizationScreen.tsx'),
      },
      { path: 'personal-info', title: lt('About you', 'შენ შესახებ'), screen: () => import('./screens/onboarding/PersonalInfoScreen.tsx') },
      {
        path: 'bank',
        title: lt('Optional connection', 'არასავალდებულო კავშირი'),
        screen: () => import('./screens/onboarding/BankConnectionScreen.tsx'),
      },
    ],
  },

  // Home tab, with the screens reachable from it.
  {
    path: '',
    title: lt('Home', 'მთავარი'),
    screen: () => import('./screens/home/HomeScreen.tsx'),
    tab: 'home',
    children: [
      {
        path: 'transactions',
        title: lt('Transactions', 'ტრანზაქციები'),
        screen: () => import('./screens/transactions/TransactionsScreen.tsx'),
        children: [
          // `?mode=receipt` opens the receipt import variant.
          {
            path: 'new',
            title: lt('Add transaction', 'ტრანზაქციის დამატება'),
            screen: () => import('./screens/transactions/AddTransactionScreen.tsx'),
            chrome: 'stack',
          },
          {
            path: ':transactionId',
            title: lt('Transaction', 'ტრანზაქცია'),
            screen: () => import('./screens/transactions/TransactionDetailScreen.tsx'),
          },
        ],
      },
    ],
  },

  // Journey tab. Goals belong here too, whichever screen opens them.
  {
    path: 'journey',
    title: lt('Journey', 'გზა'),
    screen: () => import('./screens/journey/JourneyScreen.tsx'),
    tab: 'journey',
    children: [
      { path: ':goalId', title: lt('Journey', 'გზა'), screen: () => import('./screens/journey/JourneyDetailScreen.tsx') },
      {
        path: '/goals/new',
        title: lt('New goal', 'ახალი მიზანი'),
        screen: () => import('./screens/goals/CreateGoalScreen.tsx'),
        chrome: 'stack',
      },
      { path: '/goals/:goalId', title: lt('Goal', 'მიზანი'), screen: () => import('./screens/goals/GoalDetailScreen.tsx') },
    ],
  },

  // AI Coach tab.
  {
    path: 'coach',
    title: lt('AI Coach', 'AI ქოუჩი'),
    screen: () => import('./screens/coach/CoachScreen.tsx'),
    tab: 'coach',
    children: [
      {
        path: 'recommendations',
        title: lt("Luka's suggestions", 'ლუკას რჩევები'),
        screen: () => import('./screens/coach/RecommendationsScreen.tsx'),
        children: [
          {
            path: ':recommendationId',
            title: lt('Suggestion', 'რჩევა'),
            screen: () => import('./screens/coach/RecommendationDetailScreen.tsx'),
          },
        ],
      },
    ],
  },

  // Plan tab: decision tools.
  {
    path: 'plan',
    title: lt('Plan', 'გეგმა'),
    screen: () => import('./screens/plan/PlanScreen.tsx'),
    tab: 'plan',
    children: [
      // `?goal=<id>` re-plans a goal; `?target=…&kind=…&months=…&name=…` prefills a new one (iOS GoalRequest).
      { path: 'goal-planner', title: lt('Plan a goal', 'მიზნის დაგეგმვა'), screen: () => import('./screens/plan/GoalPlannerScreen.tsx') },
      { path: 'what-if', title: lt('What if…', 'რა მოხდება, თუ…'), screen: () => import('./screens/plan/WhatIfScreen.tsx') },
      { path: 'saved-plans', title: lt('Saved plans', 'შენახული გეგმები'), screen: () => import('./screens/plan/SavedPlansScreen.tsx') },
      { path: 'loans', title: lt('Compare loans', 'სესხების შედარება'), screen: () => import('./screens/plan/LoanComparisonScreen.tsx') },
      {
        path: 'budget',
        title: lt('Essentials & flexible', 'აუცილებელი და მოქნილი'),
        screen: () => import('./screens/plan/BudgetPrioritiesScreen.tsx'),
      },
    ],
  },

  // Insights tab. `:insightId` is an InsightKind, e.g. 'deliveryIncrease'.
  {
    path: 'insights',
    title: lt('Insights', 'ანალიზი'),
    screen: () => import('./screens/insights/InsightsScreen.tsx'),
    tab: 'insights',
    children: [{ path: ':insightId', title: lt('Insight', 'ანალიზი'), screen: () => import('./screens/insights/InsightDetailScreen.tsx') }],
  },

  // Profile and settings: presented over the tabs, like the iOS sheet.
  {
    path: 'settings',
    title: lt('Profile', 'პროფილი'),
    screen: () => import('./screens/settings/SettingsScreen.tsx'),
    tab: null,
    chrome: 'stack',
    children: [
      {
        path: 'personal-info',
        title: lt('Personal information', 'პირადი ინფორმაცია'),
        screen: () => import('./screens/settings/PersonalInfoEditorScreen.tsx'),
      },
      { path: 'permissions', title: lt('Permissions', 'ნებართვები'), screen: () => import('./screens/settings/DataPermissionsScreen.tsx') },
      {
        path: 'design-system',
        title: lt('Design system', 'დიზაინ სისტემა'),
        screen: () => import('./design/Gallery.tsx'),
        access: 'any',
      },
    ],
  },
  {
    path: 'paywall',
    title: lt('Premium', 'პრემიუმი'),
    screen: () => import('./screens/paywall/PaywallScreen.tsx'),
    tab: null,
    chrome: 'stack',
  },
];

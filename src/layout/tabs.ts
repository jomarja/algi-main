import type { LocalizedText } from '../engine/localization.ts';

export interface TabDefinition {
  id: TabId;
  /** The tab's root screen. */
  path: string;
  /** iOS tab bars draw the filled variant of each symbol (MainTabView.swift). */
  icon: string;
  title: LocalizedText;
}

export type TabId = 'home' | 'journey' | 'coach' | 'plan' | 'insights';

/** The five tabs of MainTabView.swift, in order. */
export const tabs: readonly TabDefinition[] = [
  { id: 'home', path: '/', icon: 'house.fill', title: { en: 'Home', ka: 'მთავარი' } },
  { id: 'journey', path: '/journey', icon: 'map.fill', title: { en: 'Journey', ka: 'გზა' } },
  {
    id: 'coach',
    path: '/coach',
    icon: 'bubble.left.and.text.bubble.right.fill',
    title: { en: 'AI Coach', ka: 'AI ქოუჩი' },
  },
  { id: 'plan', path: '/plan', icon: 'slider.horizontal.3', title: { en: 'Plan', ka: 'გეგმა' } },
  { id: 'insights', path: '/insights', icon: 'chart.bar.xaxis', title: { en: 'Insights', ka: 'ანალიზი' } },
];

import type { PaletteToken } from '../engine/palette.ts';

/**
 * Design tokens ported from the iOS app (DesignSystem/Tokens.swift).
 * tailwind.config.js builds its theme from this file, so it must stay erasable TypeScript with type-only imports.
 */

export type { PaletteToken };

/** Colour tokens from the Algi Figma design. Model code names colours by these keys, e.g. a category tint 'coral'. */
export const palette = {
  ink: '#163C35',
  inkSoft: '#5F736D',
  inkMuted: '#84928E',
  paper: '#FFFDFA',
  cream: '#F6F2E8',
  surface: '#FFFFFF',
  line: '#E6E9E4',

  mint: '#28A67E',
  mintDark: '#1E755F',
  mintPale: '#DFF3E9',

  amber: '#F6C65B',
  amberDeep: '#A2650D',
  amberPale: '#FBF0D2',

  coral: '#ED6C60',
  coralDeep: '#B4473C',
  coralPale: '#FCE7E3',

  lavender: '#5D63AE',
  lavenderPale: '#E8E9F7',
} as const satisfies Record<PaletteToken, string>;

/** Tailwind's default 4px scale matches these: xxs=1, xs=2, s=3, m=4, l=5, xl=6, xxl=8 (e.g. `p-4` is Spacing.m). */
export const spacing = {
  xxs: 4,
  xs: 8,
  s: 12,
  m: 16,
  l: 20,
  xl: 24,
  xxl: 32,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Corner radii; Tailwind exposes them as `rounded-sm` (s), `rounded-md` (m), `rounded-lg` (l) and `rounded-xl` (xl). */
export const radius = {
  s: 12,
  m: 16,
  l: 22,
  xl: 28,
} as const;

/**
 * SF Rounded covers Latin on Apple devices (Nunito elsewhere); Georgian glyphs fall through to Noto Sans Georgian,
 * matching iOS where SF Rounded falls back to the system Georgian face.
 */
export const fontStacks = {
  rounded: ['ui-rounded', '"SF Pro Rounded"', 'Nunito', '"Noto Sans Georgian"', 'system-ui', 'sans-serif'],
  text: ['system-ui', '-apple-system', '"SF Pro Text"', '"Segoe UI"', 'Roboto', '"Noto Sans Georgian"', 'sans-serif'],
} as const;

export type FontStack = keyof typeof fontStacks;

interface TypeStyle {
  family: FontStack;
  size: number;
  lineHeight: number;
  weight: number;
  /** Letter spacing in px; only the uppercase overline uses it. */
  tracking?: number;
  uppercase?: boolean;
}

/** iOS Dynamic Type sizes at the default setting. Tailwind exposes each as a `type-<name>` class. */
export const typography = {
  display: { family: 'rounded', size: 34, lineHeight: 41, weight: 800 },
  title: { family: 'rounded', size: 28, lineHeight: 34, weight: 700 },
  title2: { family: 'rounded', size: 22, lineHeight: 28, weight: 700 },
  title3: { family: 'rounded', size: 20, lineHeight: 25, weight: 700 },
  headline: { family: 'rounded', size: 17, lineHeight: 22, weight: 700 },
  body: { family: 'text', size: 17, lineHeight: 22, weight: 400 },
  callout: { family: 'text', size: 16, lineHeight: 21, weight: 400 },
  subheadline: { family: 'text', size: 15, lineHeight: 20, weight: 400 },
  footnote: { family: 'text', size: 13, lineHeight: 18, weight: 400 },
  caption: { family: 'text', size: 12, lineHeight: 16, weight: 500 },
  overline: { family: 'rounded', size: 11, lineHeight: 13, weight: 800, tracking: 1.1, uppercase: true },
} as const satisfies Record<string, TypeStyle>;

export type TypeStyleName = keyof typeof typography;

/** SwiftUI's springs approximated as CSS easings, plus the durations the iOS app uses. */
export const motion = {
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    /** `.smooth` spring: fast start, long settle, no overshoot. */
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    /** `.snappy` spring: a touch of overshoot. */
    snappy: 'cubic-bezier(0.25, 1.15, 0.4, 1)',
    /** `.bouncy` spring. */
    bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  duration: {
    press: 150,
    fast: 200,
    base: 250,
    slow: 350,
  },
} as const;

/** `md` (laptop shell: sidebar instead of tab bar) and `xl` (wide dashboards may use two columns). */
export const breakpoints = {
  laptop: 768,
  wide: 1200,
} as const;

export const layout = {
  /** iOS tab bar height, before the home-indicator inset. */
  tabBarHeight: 49,
  sidebarWidth: 264,
  /** Reading width of a screen's content column on laptops. */
  contentMaxWidth: 720,
  /** Dashboards on wide screens. */
  wideMaxWidth: 1120,
} as const;

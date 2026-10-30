import { breakpoints, fontStacks, motion, palette, radius, typography } from './src/design/tokens.ts';

/** `.type-<name>` classes mirroring iOS Typography. They sit in the components layer, so `font-semibold` etc. override. */
const typeClasses = Object.fromEntries(
  Object.entries(typography).map(([name, style]) => [
    `.type-${name}`,
    {
      fontFamily: fontStacks[style.family].join(', '),
      fontSize: `${style.size}px`,
      lineHeight: `${style.lineHeight}px`,
      fontWeight: String(style.weight),
      ...('uppercase' in style ? { textTransform: 'uppercase', letterSpacing: `${style.tracking}px` } : {}),
    },
  ]),
);

const px = (value) => `${value}px`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: '640px',
      md: px(breakpoints.laptop),
      lg: '1024px',
      xl: px(breakpoints.wide),
      '2xl': '1536px',
    },
    extend: {
      colors: palette,
      fontFamily: {
        rounded: fontStacks.rounded,
        sans: fontStacks.text,
      },
      // iOS Radius s/m/l/xl. Named sm/md/lg/xl because `rounded-s` and `rounded-l` are Tailwind's side utilities.
      borderRadius: {
        sm: px(radius.s),
        md: px(radius.m),
        lg: px(radius.l),
        xl: px(radius.xl),
      },
      transitionTimingFunction: {
        standard: motion.easing.standard,
        out: motion.easing.out,
        snappy: motion.easing.snappy,
        bouncy: motion.easing.bouncy,
      },
      keyframes: {
        'page-push': {
          from: { opacity: '0', transform: 'translateX(28px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'page-pop': {
          from: { opacity: '0', transform: 'translateX(-28px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'page-fade': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'typing-dot': {
          '0%, 43%, 100%': { opacity: '0.35' },
          '10%, 33%': { opacity: '1' },
        },
        shimmer: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(100%)' },
        },
        'spinner-turn': {
          to: { transform: 'rotate(360deg)' },
        },
        /* Luka glances left, holds, glances right, holds, then returns with a curious hop (PeekingLuka.swift). */
        'peek-look-around': {
          '0%': { transform: 'translate(0, 0) rotate(0deg)', animationTimingFunction: motion.easing.snappy },
          '14.3%, 32.1%': { transform: 'translate(-5px, 0) rotate(-8deg)', animationTimingFunction: motion.easing.snappy },
          '48.2%, 69.6%': { transform: 'translate(5px, 0) rotate(7deg)', animationTimingFunction: motion.easing.bouncy },
          '83.9%': { transform: 'translate(0, 0) rotate(0deg)', animationTimingFunction: 'ease-in' },
          '88.2%': { transform: 'translate(0, -5px) rotate(0deg)', animationTimingFunction: motion.easing.bouncy },
          '100%': { transform: 'translate(0, 0) rotate(0deg)' },
        },
        /* FloatingOnCoins bob: lift and tilt run as separate properties so their keyframes can drift apart. */
        'coin-bob-lift': {
          '0%, 100%': { translate: '0 0' },
          '25%': { translate: '0 -3px' },
          '75%': { translate: '0 3px' },
        },
        'coin-bob-tilt': {
          '0%, 100%': { rotate: '0deg' },
          '30%': { rotate: '0.7deg' },
          '70%': { rotate: '-0.7deg' },
        },
      },
      animation: {
        'page-push': `page-push 300ms ${motion.easing.out} both`,
        'page-pop': `page-pop 300ms ${motion.easing.out} both`,
        'page-fade': `page-fade 220ms ${motion.easing.standard} both`,
        'typing-dot': 'typing-dot 960ms ease-in-out infinite',
        shimmer: 'shimmer 1.4s ease-in-out infinite',
        'spinner-turn': 'spinner-turn 0.8s steps(8) infinite',
        'peek-look-around': 'peek-look-around 2.8s infinite',
        /* FloatingOnCoins sets each card's own period through animation-duration. */
        'coin-bob': 'coin-bob-lift 3s ease-in-out infinite, coin-bob-tilt 3s ease-in-out infinite',
      },
    },
  },
  plugins: [({ addComponents }) => addComponents(typeClasses)],
};

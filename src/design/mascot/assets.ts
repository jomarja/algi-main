import type { LocalizedText } from '../../engine/localization.ts';
import type { JourneyDestination, MascotPose } from '../../engine/presentation.ts';

export type { JourneyDestination, MascotPose };

interface PoseInfo {
  title: LocalizedText;
  description: LocalizedText;
  /** Width ÷ height of the artwork, so images reserve their space before loading. */
  aspectRatio: number;
}

/** Luka's poses, drawn from one master image so he stays on-model (Mascot.swift). Files: public/luka/mascot-<pose>.png. */
export const mascotPoseInfo: Record<MascotPose, PoseInfo> = {
  welcome: {
    title: { en: 'Welcome', ka: 'მისალმება' },
    description: { en: 'Luka, your money coach, waving hello', ka: 'ლუკა, შენი ფინანსური ქოუჩი, გესალმება' },
    aspectRatio: 336 / 640,
  },
  overview: {
    title: { en: 'Financial overview', ka: 'ფინანსური მიმოხილვა' },
    description: { en: 'Luka reviewing a financial report', ka: 'ლუკა ფინანსურ ანგარიშს ათვალიერებს' },
    aspectRatio: 293 / 640,
  },
  insight: {
    title: { en: 'Spending insight', ka: 'ხარჯების ანალიზი' },
    description: { en: 'Luka pointing at a spending chart', ka: 'ლუკა ხარჯების დიაგრამაზე მიუთითებს' },
    aspectRatio: 434 / 640,
  },
  overspending: {
    title: { en: 'Over budget', ka: 'ბიუჯეტს გადაცდა' },
    description: { en: 'Luka calmly reviewing a receipt', ka: 'ლუკა მშვიდად ათვალიერებს ქვითარს' },
    aspectRatio: 275 / 640,
  },
  savings: {
    title: { en: 'Savings goal', ka: 'დანაზოგის მიზანი' },
    description: { en: 'Luka holding a savings jar', ka: 'ლუკას დანაზოგის ქილა უჭირავს' },
    aspectRatio: 278 / 640,
  },
  achievement: {
    title: { en: 'Achievement', ka: 'მიღწევა' },
    description: { en: 'Luka celebrating', ka: 'ლუკა ზეიმობს' },
    aspectRatio: 476 / 640,
  },
  assistant: {
    title: { en: 'AI assistant', ka: 'AI ასისტენტი' },
    description: { en: 'Luka sitting in an armchair, ready to help', ka: 'ლუკა სავარძელში ზის, დასახმარებლად მზადაა' },
    aspectRatio: 456 / 640,
  },
  empty: {
    title: { en: 'Empty state', ka: 'ცარიელი მდგომარეობა' },
    description: { en: 'Luka holding a bank card', ka: 'ლუკას საბანკო ბარათი უჭირავს' },
    aspectRatio: 433 / 640,
  },
  avatar: {
    title: { en: 'Avatar', ka: 'ავატარი' },
    description: { en: 'Luka', ka: 'ლუკა' },
    aspectRatio: 1,
  },
  toss: {
    title: { en: 'Balance update', ka: 'ბალანსის განახლება' },
    description: { en: 'Luka tossing money into your balance', ka: 'ლუკა ბალანსში ფულს ისვრის' },
    aspectRatio: 1,
  },
  peek: {
    title: { en: 'Pull to refresh', ka: 'განახლება ჩამოწევით' },
    description: { en: 'Luka peeking over the page', ka: 'ლუკა გვერდის უკნიდან იჭყიტება' },
    aspectRatio: 623 / 640,
  },
};

export const mascotPoses = Object.keys(mascotPoseInfo) as MascotPose[];

export function mascotImage(pose: MascotPose): string {
  return `/luka/mascot-${pose}.png`;
}

/** Supporting artwork. Always decorative. */
export type IllustrationProp = 'coin' | 'banknote' | 'peekingHands';

export const propImages: Record<IllustrationProp, { src: string; aspectRatio: number }> = {
  coin: { src: '/luka/prop-coin.png', aspectRatio: 249 / 256 },
  banknote: { src: '/luka/prop-banknote.png', aspectRatio: 320 / 187 },
  peekingHands: { src: '/luka/mascot-peek-hands.png', aspectRatio: 640 / 82 },
};

export const illustrationProps = Object.keys(propImages) as IllustrationProp[];

/** Artwork at the end of a journey map. Files: public/luka/dest-<destination>.svg (200 × 160). */
export const journeyDestinations: readonly JourneyDestination[] = ['car', 'home', 'holiday', 'shield', 'gift', 'loan'];

export function destinationImage(destination: JourneyDestination): string {
  return `/luka/dest-${destination}.svg`;
}

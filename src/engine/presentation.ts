/**
 * Presentation choices that model code makes, named after the iOS design system. Screens map them to
 * artwork and components: a pose to `mascot-<pose>`, a destination to `dest-<destination>`.
 */
export type MascotPose =
  | 'welcome'
  | 'overview'
  | 'insight'
  | 'overspending'
  | 'savings'
  | 'achievement'
  | 'assistant'
  | 'empty'
  | 'avatar'
  | 'toss'
  | 'peek';

/** Tone of a small status tag. */
export type TagTone = 'neutral' | 'positive' | 'attention' | 'estimate';

/** Tone of a recommendation card. */
export type RecommendationTone = 'nextStep' | 'positive' | 'attention';

/** The illustrated destination at the end of a journey map. */
export type JourneyDestination = 'car' | 'home' | 'holiday' | 'shield' | 'gift' | 'loan';

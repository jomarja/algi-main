import { HttpCoachApi } from '../../../api/coach.ts';
import { AvailabilityCache } from './availability.ts';
import { AiRecommendationsCache } from '../recommendations/aiRecommendationsCache.ts';

/** The AI coach endpoints, shared by the coach screens. */
export const coachApi = new HttpCoachApi();

/** Whether Luka's AI answers right now, remembered across the coach screens for the session. */
export const aiAvailability = new AvailabilityCache(async () => (await coachApi.status()).available);

/** Luka's AI suggestions, kept in memory for the session so the list and its detail pages agree. */
export const aiRecommendations = new AiRecommendationsCache((request) => coachApi.recommendations(request));

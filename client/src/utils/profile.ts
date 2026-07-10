import { User } from '../types';

/** The "About you" profile prompts, in display/edit order. `key` maps to the
 *  User field and the /users/me PATCH body. */
export const PROFILE_QUESTIONS = [
  { key: 'whoAreYou', q: 'A little about you', placeholder: 'Your story, your vibe — what makes you you' },
  { key: 'whatCanYouDo', q: 'What you’re good at', placeholder: 'Skills, talents, things you love doing…' },
  { key: 'trust', q: 'What you bring to a friendship', placeholder: 'How you show up for people — why they can count on you' },
  { key: 'lookingFor', q: 'What you’re here for', placeholder: 'Friends, collaborators, someone to build with…' },
  { key: 'wantToMeet', q: 'Who you’d love to meet', placeholder: 'The kind of people you want in your circle' },
] as const;

export type ProfileQuestionKey = (typeof PROFILE_QUESTIONS)[number]['key'];

/** Fields that count toward a "complete" profile. */
function completionChecks(u: User): boolean[] {
  return [
    !!u.avatar,
    !!u.username,
    !!u.bio,
    !!u.dateOfBirth,
    !!u.city,
    (u.interests?.length ?? 0) > 0,
    !!u.favoriteSong,
    !!u.favoriteMovie,
    !!u.whoAreYou,
    !!u.whatCanYouDo,
    !!u.trust,
    !!u.lookingFor,
    !!u.wantToMeet,
  ];
}

/** Profile completeness as a 0–100 percentage. */
export function profileCompletion(user?: User | null): number {
  if (!user) return 0;
  const checks = completionChecks(user);
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

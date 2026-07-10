import { User } from '../types';

/** The "About you" profile prompts, in display/edit order. `key` maps to the
 *  User field and the /users/me PATCH body. */
export const PROFILE_QUESTIONS = [
  { key: 'whoAreYou', q: 'Who are you?', placeholder: 'A few words about who you are…' },
  { key: 'whatCanYouDo', q: 'What can you do?', placeholder: 'Skills, talents, things you’re good at…' },
  { key: 'trust', q: 'Can people trust you?', placeholder: 'Why people can count on you' },
  { key: 'lookingFor', q: 'What are you looking for?', placeholder: 'Friends, collaborators, something else…' },
  { key: 'wantToMeet', q: 'What kind of people do you want to meet?', placeholder: 'The people you’d love to connect with' },
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

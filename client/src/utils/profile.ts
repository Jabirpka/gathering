import { User } from '../types';

const filled = (v: any) => (Array.isArray(v) ? v.length > 0 : typeof v === 'number' ? true : !!(typeof v === 'string' ? v.trim() : v));

/** Labeled checks that count toward a "complete" profile — a mix of core
 *  columns and extended (profileExtra) sections. One check per section-ish so
 *  the percentage rewards breadth; labels power the "next step" nudge. */
function completionChecks(u: User): { done: boolean; label: string }[] {
  const x = (u.profileExtra ?? {}) as Record<string, any>;
  return [
    { done: !!u.avatar, label: 'Add a profile photo' },
    { done: !!u.username, label: 'Pick a username' },
    { done: !!u.bio, label: 'Write a short bio' },
    { done: !!u.dateOfBirth, label: 'Add your date of birth' },
    { done: !!u.city, label: 'Add your city' },
    { done: (u.interests?.length ?? 0) >= 3, label: 'Pick 3+ interests' },
    { done: filled(x.gender), label: 'Add your gender' },
    { done: filled(x.languages), label: 'Add the languages you speak' },
    { done: filled(x.nationality) || filled(x.country), label: 'Add your country' },
    { done: filled(x.school) || filled(x.college) || filled(x.degree), label: 'Add your education' },
    { done: filled(x.currentJob) || filled(x.company) || filled(x.industry), label: 'Add your work' },
    { done: filled(x.strength), label: 'Share your biggest strength' },
    { done: filled(x.threeWords), label: 'Describe yourself in three words' },
    { done: filled(x.lifeGoal) || filled(x.values), label: 'Share your life goal' },
    { done: filled(x.socialType) || filled(x.personalityType), label: 'Add your personality type' },
    { done: Array.isArray(x.skills) && x.skills.length > 0, label: 'Add a skill' },
    { done: filled(x.smoke) || filled(x.food) || filled(x.workout), label: 'Fill in your lifestyle' },
    { done: filled(x.hobbies), label: 'Add a hobby' },
    { done: filled(x.favMovie) || filled(x.favSong) || filled(x.favBook) || filled(x.favFood), label: 'Add a favorite' },
    {
      done: filled(x.instagram) || filled(x.linkedin) || filled(x.github) || filled(x.website) || filled(x.x) || filled(x.youtube) || filled(x.facebook),
      label: 'Link a social profile',
    },
  ];
}

/** Profile completeness as a 0–100 percentage. */
export function profileCompletion(user?: User | null): number {
  if (!user) return 0;
  const checks = completionChecks(user);
  const done = checks.filter((c) => c.done).length;
  return Math.round((done / checks.length) * 100);
}

/** The single next thing to fill in — powers the progressive Home nudge
 *  ("Next: add a skill →") instead of confronting users with the whole form. */
export function nextProfilePrompt(user?: User | null): string | null {
  if (!user) return null;
  return completionChecks(user).find((c) => !c.done)?.label ?? null;
}

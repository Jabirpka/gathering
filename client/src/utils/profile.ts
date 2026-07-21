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
    { done: filled(x.gender), label: 'Add your gender' },
    { done: !!u.bio, label: 'Write a short bio' },
    { done: !!u.dateOfBirth, label: 'Add your date of birth' },
    { done: !!u.city, label: 'Add your city' },
    { done: (u.interests?.length ?? 0) >= 3, label: 'Pick 3+ interests' },
    { done: Array.isArray(x.work) && x.work.length > 0, label: 'Add your work experience' },
    { done: Array.isArray(x.educations) && x.educations.length > 0, label: 'Add your education' },
    { done: Array.isArray(x.skills) && x.skills.length > 0, label: 'Add a skill' },
    { done: filled(x.smoke) || filled(x.food) || filled(x.workout) || filled(x.drink), label: 'Fill in your lifestyle' },
    { done: filled(x.favMovie) || filled(x.favSong) || filled(x.favFood), label: 'Add a favorite' },
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

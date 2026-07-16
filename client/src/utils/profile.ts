import { User } from '../types';

/** Fields that count toward a "complete" profile — a mix of core columns and
 *  extended (profileExtra) sections. Roughly one check per profile section so
 *  the percentage rewards breadth, not grinding one list. */
function completionChecks(u: User): boolean[] {
  const x = (u.profileExtra ?? {}) as Record<string, any>;
  const filled = (v: any) => (Array.isArray(v) ? v.length > 0 : typeof v === 'number' ? true : !!(typeof v === 'string' ? v.trim() : v));
  return [
    !!u.avatar,
    !!u.username,
    !!u.bio,
    !!u.dateOfBirth,
    !!u.city,
    (u.interests?.length ?? 0) >= 3,
    filled(x.gender),
    filled(x.languages),
    filled(x.nationality) || filled(x.country),
    filled(x.school) || filled(x.college) || filled(x.degree),
    filled(x.currentJob) || filled(x.company) || filled(x.industry),
    filled(x.strength),
    filled(x.threeWords),
    filled(x.lifeGoal) || filled(x.values),
    filled(x.socialType) || filled(x.personalityType),
    Array.isArray(x.skills) && x.skills.length > 0,
    filled(x.smoke) || filled(x.food) || filled(x.workout),
    filled(x.hobbies),
    filled(x.favMovie) || filled(x.favSong) || filled(x.favBook) || filled(x.favFood),
    filled(x.instagram) || filled(x.linkedin) || filled(x.github) || filled(x.website) || filled(x.x) || filled(x.youtube) || filled(x.facebook),
  ];
}

/** Profile completeness as a 0–100 percentage. */
export function profileCompletion(user?: User | null): number {
  if (!user) return 0;
  const checks = completionChecks(user);
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

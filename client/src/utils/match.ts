import { User } from '../types';
import { SkillEntry } from './profileSchema';

/**
 * Compatibility scores between the viewer and a profile, computed on-device
 * from both profiles (nothing is sent anywhere). Deterministic: the same two
 * profiles always give the same numbers. Sparse profiles fall back toward a
 * neutral band, with a per-pair seeded wobble so categories don't all collapse
 * to the same value.
 */

export interface MatchScore {
  key: string;
  emoji: string;
  label: string;
  score: number; // 0–100
}

const norm = (s: any) => String(s ?? '').trim().toLowerCase();
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Overlap of two string lists relative to the smaller list. */
function shared(a?: string[] | null, b?: string[] | null): number {
  const A = new Set((a ?? []).map(norm).filter(Boolean));
  const B = new Set((b ?? []).map(norm).filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0.4; // unknown → neutral-ish
  let hit = 0;
  A.forEach((x) => { if (B.has(x)) hit++; });
  return clamp01(hit / Math.min(A.size, B.size));
}

function ageOf(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
}

/** 1 when ages are close, fading toward 0 over ~20 years of gap. */
function ageProximity(a: User, b: User): number {
  const x = ageOf(a.dateOfBirth), y = ageOf(b.dateOfBirth);
  if (x == null || y == null) return 0.5;
  return clamp01(1 - Math.abs(x - y) / 20);
}

function locationScore(a: User, b: User): number {
  const xa = (a.profileExtra ?? {}) as any, xb = (b.profileExtra ?? {}) as any;
  if (a.city && b.city && norm(a.city) === norm(b.city)) return 1;
  if (xa.country && xb.country && norm(xa.country) === norm(xb.country)) return 0.65;
  if (a.city || b.city) return 0.25;
  return 0.4;
}

/** How many of the lifestyle answers both filled in agree. */
function lifestyleScore(a: User, b: User): number {
  const xa = (a.profileExtra ?? {}) as any, xb = (b.profileExtra ?? {}) as any;
  const keys = ['smoke', 'drink', 'workout', 'food', 'sleep'];
  let both = 0, same = 0;
  for (const k of keys) {
    if (xa[k] && xb[k]) { both++; if (norm(xa[k]) === norm(xb[k])) same++; }
  }
  return both === 0 ? 0.45 : clamp01(same / both);
}

const skillNames = (u: User) =>
  (((u.profileExtra ?? {}) as any).skills as SkillEntry[] | undefined)?.map((s) => norm(s.name)).filter(Boolean) ?? [];

const maxYears = (u: User) => {
  const skills = (((u.profileExtra ?? {}) as any).skills as SkillEntry[] | undefined) ?? [];
  const fromSkills = Math.max(0, ...skills.map((s) => Number(s.years) || 0));
  const exp = Number(((u.profileExtra ?? {}) as any).experienceYears) || 0;
  return Math.max(fromSkills, exp);
};

/** Their skills that I don't have — complementary for business/mentoring. */
function skillComplement(me: User, them: User): number {
  const mine = new Set(skillNames(me));
  const theirs = skillNames(them);
  if (theirs.length === 0) return 0.35;
  const newToMe = theirs.filter((s) => !mine.has(s)).length;
  return clamp01(newToMe / theirs.length);
}

function industryScore(me: User, them: User): number {
  const a = norm(((me.profileExtra ?? {}) as any).industry), b = norm(((them.profileExtra ?? {}) as any).industry);
  if (!a || !b) return 0.45;
  return a === b ? 1 : 0.3;
}

const has = (v: any) => (Array.isArray(v) ? v.length > 0 : !!v);

/** Small deterministic wobble (±6) per user-pair per category, so sparse
 *  profiles still show varied, stable numbers instead of five identical bars. */
function jitter(idA: string, idB: string, key: string): number {
  const s = idA < idB ? idA + idB + key : idB + idA + key;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 13) - 6);
}

function finalize(raw01: number, me: User, them: User, key: string): number {
  const score = 38 + raw01 * 60 + jitter(me.id, them.id, key);
  return Math.round(Math.max(35, Math.min(99, score)));
}

export function computeMatches(me: User, them: User): MatchScore[] {
  const xa = (me.profileExtra ?? {}) as any;
  const xb = (them.profileExtra ?? {}) as any;

  const interests = shared(me.interests, them.interests);
  const hobbies = shared(xa.hobbies, xb.hobbies);
  const languages = shared(xa.languages, xb.languages);
  const skillsOverlap = shared(skillNames(me), skillNames(them));
  const complement = skillComplement(me, them);
  const industry = industryScore(me, them);
  const age = ageProximity(me, them);
  const loc = locationScore(me, them);
  const life = lifestyleScore(me, them);
  const eduBoth = (has(xa.degree) || has(xa.college)) && (has(xb.degree) || has(xb.college)) ? 1 : 0.4;
  const achievements = has(xb.achievements) ? 1 : 0.35;
  const socialPresence = ['linkedin', 'website', 'github', 'instagram'].some((k) => has(xb[k])) ? 1 : 0.4;
  const expGap = clamp01((maxYears(them) - maxYears(me)) / 8); // mentor: they know more
  const expSim = 1 - clamp01(Math.abs(maxYears(them) - maxYears(me)) / 15);

  const relationship = 0.3 * life + 0.25 * interests + 0.2 * age + 0.15 * loc + 0.1 * languages;
  const job = 0.3 * industry + 0.3 * skillsOverlap + 0.2 * expSim + 0.2 * eduBoth;
  const business = 0.3 * complement + 0.25 * industry + 0.2 * achievements + 0.15 * socialPresence + 0.1 * (xb.availableForHire ? 1 : 0.5);
  const mentor = 0.35 * expGap + 0.3 * complement + 0.2 * achievements + 0.15 * eduBoth;
  const friendship = 0.35 * interests + 0.2 * hobbies + 0.15 * languages + 0.15 * age + 0.15 * loc;

  return [
    { key: 'relationship', emoji: '❤️', label: 'Relationship Match', score: finalize(relationship, me, them, 'rel') },
    { key: 'job', emoji: '💼', label: 'Job Match', score: finalize(job, me, them, 'job') },
    { key: 'business', emoji: '🤝', label: 'Business Match', score: finalize(business, me, them, 'biz') },
    { key: 'mentor', emoji: '🎓', label: 'Mentor Match', score: finalize(mentor, me, them, 'mentor') },
    { key: 'friendship', emoji: '👥', label: 'Friendship Match', score: finalize(friendship, me, them, 'friend') },
  ];
}

import { User } from '../types';
import { SkillEntry, WorkEntry } from './profileSchema';

/**
 * Compatibility scores between the viewer and a profile, computed on-device
 * from both profiles (nothing is sent anywhere). Deterministic: the same two
 * profiles always give the same numbers, with a small per-pair wobble so sparse
 * profiles don't collapse to five identical bars.
 */

export interface MatchScore {
  key: string;
  emoji: string;
  label: string;
  score: number; // 0–100
  reason: string;
}

const norm = (s: any) => String(s ?? '').trim().toLowerCase();
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const has = (v: any) => (Array.isArray(v) ? v.length > 0 : !!v);

function sharedNames(a?: string[] | null, b?: string[] | null): string[] {
  const A = new Set((a ?? []).map(norm).filter(Boolean));
  return (b ?? []).filter((x) => A.has(norm(x)));
}
function shared(a?: string[] | null, b?: string[] | null): number {
  const A = new Set((a ?? []).map(norm).filter(Boolean));
  const B = new Set((b ?? []).map(norm).filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0.4;
  let hit = 0;
  A.forEach((x) => { if (B.has(x)) hit++; });
  return clamp01(hit / Math.min(A.size, B.size));
}

const extra = (u: User) => (u.profileExtra ?? {}) as any;
const skillNames = (u: User) => ((extra(u).skills as SkillEntry[] | undefined) ?? []).map((s) => norm(s.name)).filter(Boolean);
const workOf = (u: User): WorkEntry[] => (Array.isArray(extra(u).work) ? extra(u).work : []);
const topWork = (u: User): WorkEntry | null => workOf(u).find((w) => w?.current) ?? workOf(u)[0] ?? null;
const hasEducation = (u: User) => Array.isArray(extra(u).educations) && extra(u).educations.length > 0;

/** Years of experience: earliest work start → now (or its end), and skill years. */
function expYears(u: User): number {
  let years = 0;
  for (const w of workOf(u)) {
    if (!w?.joinDate) continue;
    const start = new Date(w.joinDate).getTime();
    if (isNaN(start)) continue;
    const end = w.current || !w.endDate ? Date.now() : new Date(w.endDate).getTime();
    if (!isNaN(end) && end > start) years += (end - start) / (365.25 * 24 * 3600 * 1000);
  }
  const skillYears = Math.max(0, ...(((extra(u).skills as SkillEntry[] | undefined) ?? []).map((s) => Number(s.years) || 0)));
  return Math.max(years, skillYears);
}

function ageOf(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
}
function ageProximity(a: User, b: User): number {
  const x = ageOf(a.dateOfBirth), y = ageOf(b.dateOfBirth);
  if (x == null || y == null) return 0.5;
  return clamp01(1 - Math.abs(x - y) / 20);
}
function locationScore(a: User, b: User): number {
  if (a.city && b.city && norm(a.city) === norm(b.city)) return 1;
  if (a.city || b.city) return 0.3;
  return 0.4;
}
function lifestyleScore(a: User, b: User): number {
  const xa = extra(a), xb = extra(b);
  const keys = ['smoke', 'drink', 'workout', 'food'];
  let both = 0, same = 0;
  for (const k of keys) if (xa[k] && xb[k]) { both++; if (norm(xa[k]) === norm(xb[k])) same++; }
  return both === 0 ? 0.45 : clamp01(same / both);
}
/** Their skills I don't have — complementary for business/mentoring. */
function complement(me: User, them: User): { score: number; list: string[] } {
  const mine = new Set(skillNames(me));
  const theirRaw = ((extra(them).skills as SkillEntry[] | undefined) ?? []).map((s) => s.name).filter(Boolean);
  const newOnes = theirRaw.filter((s) => !mine.has(norm(s)));
  return { score: theirRaw.length === 0 ? 0.35 : clamp01(newOnes.length / theirRaw.length), list: newOnes };
}
/** Overlap of the words in the two people's job titles. */
function roleSimilarity(me: User, them: User): number {
  const wa = norm(topWork(me)?.designation).split(/\s+/).filter(Boolean);
  const wb = norm(topWork(them)?.designation).split(/\s+/).filter(Boolean);
  if (wa.length === 0 || wb.length === 0) return 0.45;
  const A = new Set(wa);
  return clamp01(wb.filter((w) => A.has(w)).length / Math.min(A.size, wb.length));
}

function jitter(idA: string, idB: string, key: string): number {
  const s = idA < idB ? idA + idB + key : idB + idA + key;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 13) - 6;
}
function finalize(raw01: number, me: User, them: User, key: string): number {
  return Math.round(Math.max(35, Math.min(99, 38 + raw01 * 60 + jitter(me.id, them.id, key))));
}

export function computeMatches(me: User, them: User): MatchScore[] {
  const interests = shared(me.interests, them.interests);
  const skillsOverlap = shared(skillNames(me), skillNames(them));
  const comp = complement(me, them);
  const role = roleSimilarity(me, them);
  const age = ageProximity(me, them);
  const loc = locationScore(me, them);
  const life = lifestyleScore(me, them);
  const eduBoth = hasEducation(me) && hasEducation(them) ? 1 : 0.4;
  const openToWork = extra(them).availableForHire ? 1 : 0.5;
  const yearsMe = expYears(me), yearsThem = expYears(them);
  const expSim = 1 - clamp01(Math.abs(yearsThem - yearsMe) / 15);
  const expGap = clamp01((yearsThem - yearsMe) / 8);

  const relationship = 0.35 * life + 0.3 * interests + 0.2 * age + 0.15 * loc;
  const job = 0.3 * skillsOverlap + 0.25 * role + 0.25 * expSim + 0.2 * eduBoth;
  const business = 0.35 * comp.score + 0.25 * role + 0.2 * openToWork + 0.2 * (workOf(them).length > 0 ? 1 : 0.4);
  const mentor = 0.4 * expGap + 0.3 * comp.score + 0.3 * eduBoth;
  const friendship = 0.4 * interests + 0.2 * skillsOverlap + 0.2 * age + 0.2 * loc;

  const commonInterests = sharedNames(me.interests, them.interests);
  const sameCity = !!(me.city && them.city && norm(me.city) === norm(them.city));
  const theirRole = topWork(them)?.designation;
  const yearsAhead = Math.round(yearsThem - yearsMe);
  const fallback = 'Complete both profiles for a sharper read';
  const pick = (parts: (string | false | null | undefined)[]) => parts.filter(Boolean).slice(0, 2).join(' · ') || fallback;

  return [
    { key: 'relationship', emoji: '❤️', label: 'Relationship Match', score: finalize(relationship, me, them, 'rel'),
      reason: pick([life > 0.6 && 'Similar lifestyle', commonInterests.length > 0 && `You both love ${commonInterests.slice(0, 2).join(' & ')}`, sameCity && `Both in ${them.city}`]) },
    { key: 'job', emoji: '💼', label: 'Job Match', score: finalize(job, me, them, 'job'),
      reason: pick([sharedNames(skillNames(me), skillNames(them)).length > 0 && 'Overlapping skills', theirRole && role > 0.4 && `Similar role: ${theirRole}`, expSim > 0.7 && yearsThem > 0 && 'Similar experience']) },
    { key: 'business', emoji: '🤝', label: 'Business Match', score: finalize(business, me, them, 'biz'),
      reason: pick([comp.list.length > 0 && `They bring ${comp.list.slice(0, 2).join(' & ')}`, extra(them).availableForHire && 'Open to work', theirRole && `Works as ${theirRole}`]) },
    { key: 'mentor', emoji: '🎓', label: 'Mentor Match', score: finalize(mentor, me, them, 'mentor'),
      reason: pick([yearsAhead >= 2 && `${yearsAhead} more years of experience`, comp.list.length > 0 && `Can teach you ${comp.list[0]}`, hasEducation(them) && 'Strong education']) },
    { key: 'friendship', emoji: '👥', label: 'Friendship Match', score: finalize(friendship, me, them, 'friend'),
      reason: pick([commonInterests.length > 0 && `Shared: ${commonInterests.slice(0, 2).join(', ')}`, sameCity && `Both in ${them.city}`, skillsOverlap > 0.5 && 'Similar skills']) },
  ];
}

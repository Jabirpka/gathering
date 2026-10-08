/**
 * A single "Match with you" percentage between two users, blended from:
 *   - profile data   (interests + all extended profile fields)
 *   - message consistency (how much / how mutually / how recently you chat)
 *   - poke engagement (how often you poke, and whether it's mutual)
 *
 * Deterministic per pair (same two people always get the same number), with a
 * tiny per-pair wobble so sparse profiles don't all collapse to one value.
 * Pure functions only; the DB gathering helper takes prisma as an argument so
 * this module has no import cycle with the routes.
 */

type Extra = Record<string, any>;

export interface MatchUser {
  id: string;
  interests?: string[] | null;
  city?: string | null;
  dateOfBirth?: Date | string | null;
  bio?: string | null;
  profileExtra?: Extra | null;
}

export interface InteractionStats {
  messages: number;       // total messages in the thread (both people)
  myMessages: number;
  theirMessages: number;
  recentMessages: number; // messages in the last 14 days
  pokesMine: number;      // pokes I sent them
  pokesTheirs: number;    // pokes they sent me
}

const EMPTY: InteractionStats = {
  messages: 0, myMessages: 0, theirMessages: 0, recentMessages: 0, pokesMine: 0, pokesTheirs: 0,
};

const norm = (s: any) => String(s ?? '').trim().toLowerCase();
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const extraOf = (u: MatchUser): Extra => (u.profileExtra ?? {}) as Extra;

function shared(a?: string[] | null, b?: string[] | null): { score: number; count: number } {
  const A = new Set((a ?? []).map(norm).filter(Boolean));
  const B = new Set((b ?? []).map(norm).filter(Boolean));
  if (A.size === 0 || B.size === 0) return { score: 0.4, count: 0 };
  let hit = 0;
  A.forEach((x) => { if (B.has(x)) hit++; });
  return { score: clamp01(hit / Math.min(A.size, B.size)), count: hit };
}

function skillNames(u: MatchUser): string[] {
  const s = extraOf(u).skills;
  return Array.isArray(s) ? s.map((x: any) => norm(x?.name)).filter(Boolean) : [];
}

function ageOf(dob?: Date | string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
}
function ageProximity(a: MatchUser, b: MatchUser): number {
  const x = ageOf(a.dateOfBirth), y = ageOf(b.dateOfBirth);
  if (x == null || y == null) return 0.5;
  return clamp01(1 - Math.abs(x - y) / 20);
}
function locationScore(a: MatchUser, b: MatchUser): number {
  if (a.city && b.city && norm(a.city) === norm(b.city)) return 1;
  if (a.city || b.city) return 0.35;
  return 0.4;
}
function lifestyleScore(a: MatchUser, b: MatchUser): number {
  const xa = extraOf(a), xb = extraOf(b);
  const keys = ['smoke', 'drink', 'workout', 'food'];
  let both = 0, same = 0;
  for (const k of keys) if (xa[k] && xb[k]) { both++; if (norm(xa[k]) === norm(xb[k])) same++; }
  return both === 0 ? 0.45 : clamp01(same / both);
}
function eduBoth(a: MatchUser, b: MatchUser): number {
  const ea = Array.isArray(extraOf(a).educations) && extraOf(a).educations.length > 0;
  const eb = Array.isArray(extraOf(b).educations) && extraOf(b).educations.length > 0;
  return ea && eb ? 1 : 0.4;
}
/** How much of a profile is filled — a richer pair reads as a stronger match. */
function completeness(u: MatchUser): number {
  const x = extraOf(u);
  let filled = 0, total = 0;
  const check = (v: any) => { total++; if (Array.isArray(v) ? v.length > 0 : !!v) filled++; };
  check(u.interests); check(u.city); check(u.dateOfBirth); check(u.bio);
  check(x.skills); check(x.work); check(x.educations); check(x.gender);
  return total === 0 ? 0.4 : clamp01(filled / total);
}

function profileScore(me: MatchUser, them: MatchUser): { score: number; sharedInterests: number } {
  const interests = shared(me.interests, them.interests);
  const skills = shared(skillNames(me), skillNames(them));
  const age = ageProximity(me, them);
  const loc = locationScore(me, them);
  const life = lifestyleScore(me, them);
  const edu = eduBoth(me, them);
  const comp = (completeness(me) + completeness(them)) / 2;
  const score =
    0.30 * interests.score +
    0.15 * life +
    0.15 * skills.score +
    0.10 * age +
    0.10 * loc +
    0.10 * edu +
    0.10 * comp;
  return { score: clamp01(score), sharedInterests: interests.count };
}

/** Message consistency: volume + how two-sided it is + recent activity. */
function messageScore(s: InteractionStats): number {
  if (s.messages <= 0) return 0.3; // neutral baseline — no chat yet
  const volume = clamp01(s.messages / 60);
  const balance = clamp01(Math.min(s.myMessages, s.theirMessages) / Math.max(1, s.myMessages, s.theirMessages));
  const recent = clamp01(s.recentMessages / 20);
  return clamp01(0.45 * volume + 0.30 * balance + 0.25 * recent);
}

/** Poke engagement: how many pokes, and whether it goes both ways. */
function pokeScore(s: InteractionStats): number {
  const total = s.pokesMine + s.pokesTheirs;
  if (total <= 0) return 0.35; // neutral baseline
  const volume = clamp01(total / 12);
  const mutual = s.pokesMine > 0 && s.pokesTheirs > 0 ? 1 : 0.5;
  return clamp01(0.6 * volume + 0.4 * mutual);
}

function jitter(idA: string, idB: string): number {
  const s = idA < idB ? idA + idB : idB + idA;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 9) - 4; // -4..+4
}

export interface MatchResult { percent: number; reason: string; }

export function computeMatchPercent(me: MatchUser, them: MatchUser, stats: InteractionStats = EMPTY): MatchResult {
  const prof = profileScore(me, them);
  const msg = messageScore(stats);
  const poke = pokeScore(stats);

  const raw = 0.55 * prof.score + 0.30 * msg + 0.15 * poke;
  const percent = Math.round(Math.max(35, Math.min(99, 40 + raw * 58 + jitter(me.id, them.id))));

  // Short human reason — surface the two strongest signals.
  const sameCity = !!(me.city && them.city && norm(me.city) === norm(them.city));
  const totalPokes = stats.pokesMine + stats.pokesTheirs;
  const parts = [
    prof.sharedInterests > 0 && `${prof.sharedInterests} shared interest${prof.sharedInterests > 1 ? 's' : ''}`,
    stats.messages >= 20 && 'You chat often',
    stats.messages > 0 && stats.messages < 20 && 'Getting the conversation going',
    totalPokes >= 4 && 'Lots of pokes',
    sameCity && `Both in ${them.city ?? me.city}`,
  ].filter(Boolean) as string[];
  const reason = parts.slice(0, 2).join(' · ') || 'Complete your profiles for a sharper match';

  return { percent, reason };
}

/**
 * Read the interaction signals for a pair from the database. `prisma` is passed
 * in to avoid an import cycle with the routes. `threadId` may be supplied when
 * the caller already has the DM thread (the DM list), skipping the lookup.
 */
export async function gatherInteractionStats(
  prisma: any,
  myId: string,
  themId: string,
  threadId?: string | null,
): Promise<InteractionStats> {
  let id = threadId ?? null;
  if (id === undefined || id === null) {
    const [a, b] = myId < themId ? [myId, themId] : [themId, myId];
    const thread = await prisma.dmThread
      .findUnique({ where: { userAId_userBId: { userAId: a, userBId: b } }, select: { id: true } })
      .catch(() => null);
    id = thread?.id ?? null;
  }

  let messages = 0, myMessages = 0, theirMessages = 0, recentMessages = 0;
  if (id) {
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const [grouped, recent] = await Promise.all([
      prisma.message.groupBy({ by: ['userId'], where: { threadId: id }, _count: true }),
      prisma.message.count({ where: { threadId: id, createdAt: { gt: since } } }),
    ]);
    for (const g of grouped as { userId: string; _count: number }[]) {
      messages += g._count;
      if (g.userId === myId) myMessages += g._count; else theirMessages += g._count;
    }
    recentMessages = recent;
  }

  const [pokesMine, pokesTheirs] = await Promise.all([
    prisma.poke.count({ where: { senderId: myId, receiverId: themId } }),
    prisma.poke.count({ where: { senderId: themId, receiverId: myId } }),
  ]);

  return { messages, myMessages, theirMessages, recentMessages, pokesMine, pokesTheirs };
}

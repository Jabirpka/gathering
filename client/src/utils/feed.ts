/** Category tags every post carries; the feed filters on these. */
export const FEED_CATEGORIES = [
  'Sports', 'Business', 'Technology', 'News', 'Entertainment', 'Education', 'Health',
  'Travel', 'Food', 'Jobs', 'Science', 'Art', 'Politics', 'Local', 'Other',
];

export type FeedKind = 'PHOTO' | 'NEWS' | 'POLL' | 'QUESTION' | 'WRITEUP' | 'EVENT' | 'JOB_HUNT' | 'JOB_FIND' | 'INFO';

export interface ExtraFieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'datetime-local';
}

/** Drives both the create-post form and the post-card header per kind. */
export interface FeedKindDef {
  kind: FeedKind;
  label: string;
  emoji: string;
  /** Headline/title input (null = none). */
  title?: { label: string; placeholder: string; required?: boolean } | null;
  content: { label: string; placeholder: string; required?: boolean; rows?: number };
  image: 'required' | 'optional' | 'none';
  /** POLL only: show the options builder. */
  poll?: boolean;
  extraFields?: ExtraFieldDef[];
}

export const FEED_KINDS: FeedKindDef[] = [
  {
    kind: 'PHOTO', label: 'Photo', emoji: '📷', image: 'required',
    content: { label: 'Caption', placeholder: 'Say something about this photo…' },
  },
  {
    kind: 'NEWS', label: 'News', emoji: '📰', image: 'optional',
    title: { label: 'Headline', placeholder: 'What happened?', required: true },
    content: { label: 'Details', placeholder: 'The story…', required: true, rows: 4 },
  },
  {
    kind: 'POLL', label: 'Poll', emoji: '📊', image: 'none', poll: true,
    content: { label: 'Question', placeholder: 'Ask the crowd…', required: true },
  },
  {
    kind: 'WRITEUP', label: 'Write-up', emoji: '✍️', image: 'optional',
    title: { label: 'Title', placeholder: 'Give it a title', required: true },
    content: { label: 'Write-up', placeholder: 'Share your thoughts…', required: true, rows: 8 },
  },
  {
    kind: 'EVENT', label: 'Event', emoji: '📅', image: 'optional',
    title: { label: 'Event name', placeholder: 'What’s happening?', required: true },
    content: { label: 'Details', placeholder: 'What, who, why…', required: true, rows: 3 },
    extraFields: [
      { key: 'when', label: 'Date & time', type: 'datetime-local' },
      { key: 'location', label: 'Location', placeholder: 'Where?' },
    ],
  },
  {
    kind: 'JOB_FIND', label: 'Hiring', emoji: '💼', image: 'none',
    title: { label: 'Role', placeholder: 'e.g. Welder, React developer', required: true },
    content: { label: 'Description', placeholder: 'What the job involves, requirements…', required: true, rows: 4 },
    extraFields: [
      { key: 'company', label: 'Company', placeholder: 'Who’s hiring?' },
      { key: 'location', label: 'Location', placeholder: 'City / remote' },
      { key: 'salary', label: 'Pay', placeholder: 'e.g. AED 4,000/month (optional)' },
    ],
  },
  {
    kind: 'JOB_HUNT', label: 'Job wanted', emoji: '🔍', image: 'none',
    title: { label: 'Looking for', placeholder: 'e.g. Driver, Designer role', required: true },
    content: { label: 'About you', placeholder: 'Experience, skills, availability…', required: true, rows: 4 },
    extraFields: [
      { key: 'experience', label: 'Experience', placeholder: 'e.g. 5 years' },
      { key: 'location', label: 'Preferred location', placeholder: 'City / remote' },
    ],
  },
  {
    kind: 'INFO', label: 'Info', emoji: 'ℹ️', image: 'optional',
    title: { label: 'Title', placeholder: 'What is this about? (optional)' },
    content: { label: 'Information', placeholder: 'Something useful people should know…', required: true, rows: 4 },
  },
];

export const kindDef = (kind: string): FeedKindDef => FEED_KINDS.find((k) => k.kind === kind) ?? FEED_KINDS[8];

/** Compact relative time for post headers. */
export function postAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

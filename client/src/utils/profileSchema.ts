/**
 * The extended profile is driven entirely by this config: both the edit page
 * (ProfilePage) and the public view (UserProfilePage) render these sections.
 * Values live in `user.profileExtra` (one JSON blob) keyed by field key —
 * except the handful of core columns handled separately (name, nickname,
 * username, bio, dateOfBirth, city, interests).
 */

export type FieldType = 'text' | 'textarea' | 'date' | 'select' | 'chips' | 'toggle' | 'number';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  optional?: boolean;
  /** For chips: how many the user can pick. */
  maxChips?: number;
  /** For chips: allow typing custom entries beyond the preset options. */
  allowCustom?: boolean;
}

export interface SectionDef {
  id: string;
  title: string;
  /** 'fields' renders FieldDefs; 'skills' and 'achievements' are list builders. */
  kind: 'fields' | 'skills' | 'achievements';
  fields: FieldDef[];
  /** Only visible to the profile owner (stripped server-side for others). */
  privateSection?: boolean;
}

export const LANGUAGES = ['English', 'Hindi', 'Malayalam', 'Tamil', 'Telugu', 'Kannada', 'Urdu', 'Arabic', 'French', 'Spanish', 'German', 'Chinese', 'Japanese', 'Russian', 'Portuguese', 'Bengali', 'Punjabi', 'Marathi', 'Gujarati'];

export const INTEREST_OPTIONS = [
  '🎵 Music', '🎬 Movies', '⚽ Sports', '📚 Reading', '✈️ Travel', '🍳 Cooking', '💪 Fitness', '💼 Business',
  '💻 Technology', '🚗 Cars', '🤖 AI', '🎮 Gaming', '📸 Photography', '🤝 Volunteering', '🐾 Pets', '🌿 Nature',
  '👗 Fashion', '💰 Finance', '🎨 Art', '🏛️ Politics', '🔬 Science', '🍕 Food', '🏏 Cricket', '🏀 Basketball',
  '🎾 Tennis', '🏊 Swimming', '🧘 Yoga', '🥾 Hiking', '🏕️ Camping', '🎣 Fishing', '🚴 Cycling', '🏃 Running',
  '⛰️ Mountains', '🏖️ Beaches', '🌌 Astronomy', '📖 History', '🧠 Psychology', '🗣️ Languages', '✍️ Writing',
  '📝 Poetry', '🎭 Theatre', '💃 Dancing', '🎤 Singing', '🎸 Guitar', '🎹 Piano', '🥁 Drums', '🎧 Podcasts',
  '📺 Anime', '📚 Comics', '♟️ Chess', '🃏 Card games', '🧩 Puzzles', '🎲 Board games', '🪴 Gardening',
  '🧵 Crafts', '🖌️ Painting', '✏️ Sketching', '🏺 Design', '🏠 Interior design', '🏗️ Architecture', '📈 Investing',
  '₿ Crypto', '📣 Marketing', '🚀 Startups', '🤳 Content creation', '📹 Vlogging', '✂️ Video editing', '🎞️ Filmmaking',
  '🍰 Baking', '☕ Coffee', '🍵 Tea', '🍫 Chocolate', '🥗 Healthy eating', '🍜 Street food', '🍷 Fine dining',
  '🧳 Backpacking', '🛣️ Road trips', '🏍️ Biking', '⛺ Adventure', '🪂 Skydiving', '🤿 Scuba diving', '🏄 Surfing',
  '⛷️ Skiing', '🧗 Climbing', '🥋 Martial arts', '🥊 Boxing', '🏋️ Gym', '⚽ Football', '🏐 Volleyball', '🏸 Badminton',
  '🏓 Table tennis', '🎱 Billiards', '🎳 Bowling', '🏌️ Golf', '🐕 Dogs', '🐈 Cats', '🐦 Birds', '🐠 Aquariums',
  '🛍️ Shopping', '💄 Makeup', '💇 Hair styling', '⌚ Watches', '👟 Sneakers', '📱 Gadgets', '🔧 DIY', '🌍 Environment',
  '❤️ Charity', '🧘 Meditation', '🙏 Spirituality',
];

export const SKILL_SUGGESTIONS = ['Welding', 'Photography', 'Programming', 'Sales', 'Marketing', 'Driving', 'Cooking', 'Design', 'Teaching', 'Writing', 'Accounting', 'Carpentry', 'Electrical', 'Plumbing', 'Video editing', 'Public speaking'];
export const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Expert', 'Professional'];
export const ACHIEVEMENT_TYPES = ['Award', 'Certificate', 'Project', 'Volunteer work', 'Patent', 'Publication'];

/**
 * Kept deliberately light: every data category survives, but overlapping
 * questions are merged (school/college/degree → one education line; job +
 * company → one line; hobbies folded into interests; nationality folded into
 * country) and fluff is cut. Legacy answers to removed fields stay stored in
 * profileExtra — they just aren't asked again.
 */
export const PROFILE_SECTIONS: SectionDef[] = [
  {
    id: 'about', title: 'About me', kind: 'fields',
    fields: [
      { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
      { key: 'languages', label: 'Languages', type: 'chips', options: LANGUAGES, allowCustom: true, maxChips: 10 },
      { key: 'country', label: 'Country', type: 'text', placeholder: 'Where you live now' },
    ],
  },
  {
    id: 'career', title: 'Work & education', kind: 'fields',
    fields: [
      { key: 'currentJob', label: 'What you do', type: 'text', placeholder: 'e.g. Welder at ABC Co' },
      { key: 'industry', label: 'Industry', type: 'text', placeholder: 'e.g. Construction, Tech' },
      { key: 'experienceYears', label: 'Years of experience', type: 'number' },
      { key: 'education', label: 'Education', type: 'text', placeholder: 'e.g. B.Tech, XYZ College' },
      { key: 'availableForHire', label: 'Available for hire', type: 'toggle' },
    ],
  },
  {
    id: 'personality', title: 'Personality', kind: 'fields',
    fields: [
      { key: 'threeWords', label: 'Three words about me', type: 'text', placeholder: 'e.g. curious, loyal, funny' },
      { key: 'lifeGoal', label: 'My life goal', type: 'textarea' },
      { key: 'socialType', label: 'Introvert / Extrovert', type: 'select', options: ['Introvert', 'Extrovert', 'Ambivert'] },
    ],
  },
  { id: 'skills', title: 'Skills', kind: 'skills', fields: [] },
  {
    id: 'lifestyle', title: 'Lifestyle', kind: 'fields',
    fields: [
      { key: 'smoke', label: 'Do you smoke?', type: 'select', options: ['No', 'Occasionally', 'Yes'] },
      { key: 'drink', label: 'Do you drink?', type: 'select', options: ['No', 'Occasionally', 'Yes'] },
      { key: 'workout', label: 'Workout frequency', type: 'select', options: ['Never', 'Sometimes', 'Weekly', 'Daily'] },
      { key: 'food', label: 'Food preference', type: 'select', options: ['Vegetarian', 'Vegan', 'Halal', 'Non-veg', 'Everything'] },
    ],
  },
  { id: 'achievements', title: 'Achievements', kind: 'achievements', fields: [] },
  {
    id: 'socials', title: 'Social links', kind: 'fields',
    fields: [
      { key: 'instagram', label: 'Instagram', type: 'text', placeholder: '@username or link' },
      { key: 'linkedin', label: 'LinkedIn', type: 'text' },
      { key: 'github', label: 'GitHub', type: 'text' },
      { key: 'website', label: 'Website', type: 'text' },
    ],
  },
  {
    id: 'favorites', title: 'Favorites', kind: 'fields',
    fields: [
      { key: 'favMovie', label: 'Movie', type: 'text' },
      { key: 'favSong', label: 'Song', type: 'text' },
      { key: 'favFood', label: 'Food', type: 'text' },
    ],
  },
  {
    id: 'emergency', title: 'Emergency (private — only you can see this)', kind: 'fields', privateSection: true,
    fields: [
      { key: 'emergencyContact', label: 'Emergency contact', type: 'text', placeholder: 'Name & phone number', optional: true },
      { key: 'bloodGroup', label: 'Blood group', type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], optional: true },
      { key: 'medicalNotes', label: 'Medical notes', type: 'textarea', placeholder: 'Allergies, conditions…', optional: true },
    ],
  },
];

export interface SkillEntry { name: string; level: string; years?: number | null }
export interface AchievementEntry { type: string; title: string }

/** Western zodiac sign derived from a date of birth (a merged "question" —
 *  nobody should have to type their own star sign). */
export function zodiacFrom(dob?: string | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const m = d.getMonth() + 1, day = d.getDate();
  const signs: [number, number, string][] = [
    [1, 20, '♑ Capricorn'], [2, 19, '♒ Aquarius'], [3, 21, '♓ Pisces'], [4, 20, '♈ Aries'],
    [5, 21, '♉ Taurus'], [6, 21, '♊ Gemini'], [7, 23, '♋ Cancer'], [8, 23, '♌ Leo'],
    [9, 23, '♍ Virgo'], [10, 23, '♎ Libra'], [11, 22, '♏ Scorpio'], [12, 22, '♐ Sagittarius'],
  ];
  return day < signs[m - 1][1] ? signs[m - 1][2] : signs[m % 12][2];
}

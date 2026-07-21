/**
 * The profile is a fixed, light set of sections. Basic info, Verification and
 * Interests are rendered directly by ProfilePage; the rest below are driven by
 * this config. Everything lives in `user.profileExtra` (one JSON blob) except
 * the core columns (name, nickname, username, bio, dateOfBirth, city, interests).
 */

export type FieldType = 'text' | 'textarea' | 'date' | 'select' | 'chips' | 'toggle' | 'number';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  optional?: boolean;
  maxChips?: number;
  allowCustom?: boolean;
}

export interface SectionDef {
  id: string;
  title: string;
  /** 'fields' = simple inputs; 'skills' / 'work' / 'education' = list builders. */
  kind: 'fields' | 'skills' | 'work' | 'education';
  fields: FieldDef[];
  privateSection?: boolean;
}

export const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export const EDUCATION_LEVELS = [
  'School', 'High school', 'Pre college', 'Graduation', 'Master degree',
  'Diploma', 'PG Diploma', 'Certification course', 'Research fellow',
];

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

export const PROFILE_SECTIONS: SectionDef[] = [
  { id: 'work', title: 'Work', kind: 'work', fields: [] },
  { id: 'education', title: 'Education', kind: 'education', fields: [] },
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
  {
    id: 'favorites', title: 'Favorites', kind: 'fields',
    fields: [
      { key: 'favMovie', label: 'Movie', type: 'text' },
      { key: 'favSong', label: 'Song', type: 'text' },
      { key: 'favFood', label: 'Food', type: 'text' },
    ],
  },
];

export interface SkillEntry { name: string; level: string; years?: number | null }
export interface WorkEntry { designation: string; company: string; joinDate?: string; endDate?: string; current?: boolean }
export interface EducationEntry { level: string; institution: string; endYear?: string; ongoing?: boolean }

/** Western zodiac sign derived from a date of birth (shown, never asked). */
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

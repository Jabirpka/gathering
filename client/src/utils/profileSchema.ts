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

export const HOBBY_OPTIONS = [
  '🪴 Gardening', '🎵 Music', '⚽ Football', '🏏 Cricket', '♟️ Chess', '🚴 Cycling', '🥾 Hiking', '🎣 Fishing',
  '🍳 Cooking', '🖌️ Painting', '📸 Photography', '📚 Reading', '✍️ Writing', '💃 Dancing', '🎤 Singing',
  '🏊 Swimming', '🧘 Yoga', '🎮 Gaming', '🧵 Knitting', '🏕️ Camping', '🐦 Bird watching', '🧩 Puzzles',
  '🍰 Baking', '🎸 Playing guitar', '🎹 Playing piano', '🏃 Running', '🛹 Skating', '🪁 Kite flying',
];

export const SKILL_SUGGESTIONS = ['Welding', 'Photography', 'Programming', 'Sales', 'Marketing', 'Driving', 'Cooking', 'Design', 'Teaching', 'Writing', 'Accounting', 'Carpentry', 'Electrical', 'Plumbing', 'Video editing', 'Public speaking'];
export const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Expert', 'Professional'];
export const ACHIEVEMENT_TYPES = ['Award', 'Certificate', 'Project', 'Volunteer work', 'Patent', 'Publication'];

export const PROFILE_SECTIONS: SectionDef[] = [
  {
    id: 'about', title: 'About me', kind: 'fields',
    fields: [
      { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
      { key: 'languages', label: 'Languages', type: 'chips', options: LANGUAGES, allowCustom: true, maxChips: 10 },
      { key: 'nationality', label: 'Nationality', type: 'text', placeholder: 'e.g. Indian' },
      { key: 'country', label: 'Current country', type: 'text', placeholder: 'Where you live now' },
      { key: 'religion', label: 'Religion', type: 'text', optional: true },
      { key: 'maritalStatus', label: 'Marital status', type: 'select', options: ['Single', 'Married', 'Engaged', 'Divorced', 'Widowed', 'Prefer not to say'] },
    ],
  },
  {
    id: 'education', title: 'Education', kind: 'fields',
    fields: [
      { key: 'school', label: 'School', type: 'text' },
      { key: 'college', label: 'College / University', type: 'text' },
      { key: 'degree', label: 'Degree', type: 'text', placeholder: 'e.g. B.Tech Computer Science' },
      { key: 'certifications', label: 'Certifications', type: 'chips', allowCustom: true, maxChips: 15 },
      { key: 'courses', label: 'Courses', type: 'chips', allowCustom: true, maxChips: 15 },
    ],
  },
  {
    id: 'career', title: 'Career', kind: 'fields',
    fields: [
      { key: 'currentJob', label: 'Current job', type: 'text', placeholder: 'e.g. Welder, Software engineer' },
      { key: 'company', label: 'Company', type: 'text' },
      { key: 'industry', label: 'Industry', type: 'text' },
      { key: 'experienceYears', label: 'Years of experience', type: 'number' },
      { key: 'resumeLink', label: 'Resume link', type: 'text', placeholder: 'Link to your CV (Drive, etc.)', optional: true },
      { key: 'portfolio', label: 'Portfolio', type: 'text', placeholder: 'Link to your work', optional: true },
      { key: 'availableForHire', label: 'Available for hire', type: 'toggle' },
    ],
  },
  {
    id: 'personality', title: 'Personality', kind: 'fields',
    fields: [
      { key: 'strength', label: 'My biggest strength', type: 'textarea' },
      { key: 'threeWords', label: 'Three words about me', type: 'text', placeholder: 'e.g. curious, loyal, funny' },
      { key: 'lifeGoal', label: 'My life goal', type: 'textarea' },
      { key: 'values', label: 'My personal values', type: 'textarea' },
      { key: 'personalityType', label: 'My personality type', type: 'text', placeholder: 'e.g. INFJ', optional: true },
      { key: 'socialType', label: 'Introvert / Extrovert', type: 'select', options: ['Introvert', 'Extrovert', 'Ambivert'] },
      { key: 'quote', label: 'Favorite quote', type: 'text' },
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
      { key: 'sleep', label: 'Sleep schedule', type: 'select', options: ['Early bird', 'Night owl', 'Flexible'] },
      { key: 'pets', label: 'Pets', type: 'text', placeholder: 'e.g. a cat named Momo', optional: true },
      { key: 'children', label: 'Children', type: 'select', options: ['No', 'Yes', 'Prefer not to say'], optional: true },
    ],
  },
  { id: 'achievements', title: 'Achievements', kind: 'achievements', fields: [] },
  {
    id: 'socials', title: 'Social links', kind: 'fields',
    fields: [
      { key: 'instagram', label: 'Instagram', type: 'text', placeholder: '@username or link' },
      { key: 'facebook', label: 'Facebook', type: 'text' },
      { key: 'linkedin', label: 'LinkedIn', type: 'text' },
      { key: 'github', label: 'GitHub', type: 'text' },
      { key: 'x', label: 'X (Twitter)', type: 'text' },
      { key: 'youtube', label: 'YouTube', type: 'text' },
      { key: 'website', label: 'Website', type: 'text' },
    ],
  },
  {
    id: 'hobbies', title: 'Hobbies', kind: 'fields',
    fields: [
      { key: 'hobbies', label: 'Your hobbies', type: 'chips', options: HOBBY_OPTIONS, allowCustom: true, maxChips: 15 },
    ],
  },
  {
    id: 'favorites', title: 'Favorites', kind: 'fields',
    fields: [
      { key: 'favMovie', label: 'Movie', type: 'text' },
      { key: 'favBook', label: 'Book', type: 'text' },
      { key: 'favSong', label: 'Song', type: 'text' },
      { key: 'favFood', label: 'Food', type: 'text' },
      { key: 'favActor', label: 'Actor', type: 'text' },
      { key: 'favSport', label: 'Sport', type: 'text' },
      { key: 'favDestination', label: 'Destination', type: 'text' },
      { key: 'favColor', label: 'Color', type: 'text' },
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

/** Categories a public group can be filed under (for Discover). */
export const GROUP_CATEGORIES = [
  'Gaming',
  'Music',
  'Study',
  'Sports',
  'Movies',
  'Tech',
  'Art',
  'Travel',
  'Food',
  'Friends',
  'Other',
] as const;

export type GroupCategory = (typeof GROUP_CATEGORIES)[number];

import { ReleaseGroup } from '@/types/music';

export const album = (overrides: Partial<ReleaseGroup> = {}): ReleaseGroup => ({
  id: 'b1392450-e666-3926-a536-22c65f834433',
  title: 'Test Album',
  artist_credit: [],
  ...overrides,
});

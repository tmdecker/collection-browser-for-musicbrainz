/**
 * @ai-file component-config
 * @ai-description Icon of each streaming service and Plex (album details links, grid listen button, Settings)
 */

import React from 'react';
import { BiLogoSpotify, BiLogoDeezer, BiLogoYoutube, BiLogoSoundcloud, BiLogoAmazon } from 'react-icons/bi';
import { SiTidal, SiApplemusic, SiAmazonmusic, SiYoutubemusic, SiPandora, SiBandcamp, SiPlex } from 'react-icons/si';
import { StreamingServiceKey } from '@/types/preferences';

export const SERVICE_ICONS: Record<StreamingServiceKey, React.ComponentType<{ className?: string }>> = {
  plex: SiPlex,
  spotify: BiLogoSpotify,
  appleMusic: SiApplemusic,
  youtube: BiLogoYoutube,
  youtubeMusic: SiYoutubemusic,
  amazon: BiLogoAmazon,
  amazonMusic: SiAmazonmusic,
  deezer: BiLogoDeezer,
  tidal: SiTidal,
  soundcloud: BiLogoSoundcloud,
  pandora: SiPandora,
  bandcamp: SiBandcamp,
};

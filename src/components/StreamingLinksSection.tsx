/**
 * @ai-file component
 * @ai-description Service links of an album (streaming platforms and Plex) as icons, in the user's order
 * @ai-dependencies serviceIcons, useServiceOpenUrls
 * @ai-features
 * - Icons left to right in the order chosen in Settings; switched-off services are already left out
 * - Desktop app links (Spotify, Tidal, Apple Music) per user setting
 * - Fade-in only when the links were not loaded from cache
 */

import React from 'react';
import { STREAMING_SERVICE_NAMES } from '@/types/preferences';
import { ServiceLink } from '@/utils/streaming-service-order';
import { linkTargetProps } from '@/utils/streaming-open-url';
import { useServiceOpenUrls } from '@/hooks/useServiceOpenUrls';
import { SERVICE_ICONS } from './serviceIcons';

export { linkTargetProps };

interface StreamingLinksSectionProps {
  /** The album's links, already ordered and filtered by the user's settings */
  links: ServiceLink[];
  fromCache?: boolean;
}

const StreamingLinksSection: React.FC<StreamingLinksSectionProps> = ({ links, fromCache = false }) => {
  const openable = useServiceOpenUrls(links);
  if (openable.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${fromCache ? '' : 'animate-fade-in'}`}>
      {openable.map(({ service, href }) => {
        const Icon = SERVICE_ICONS[service];
        const name = STREAMING_SERVICE_NAMES[service];
        return (
          <a
            key={service}
            href={href}
            {...linkTargetProps(href)}
            className="flex items-center justify-center w-[34px] h-[34px] md:w-6 md:h-6 text-text-secondary hover:text-white transition-colors duration-200"
            title={`Open in ${name}`}
            aria-label={`Open in ${name}`}
          >
            <Icon className="w-[34px] h-[34px] md:w-6 md:h-6" />
          </a>
        );
      })}
    </div>
  );
};

export default StreamingLinksSection;

/**
 * @ai-file component
 * @ai-description Round button on a grid cover that opens the album in the user's first service
 * @ai-dependencies usePreferences, usePlexAlbums, useServiceOpenUrls, streaming-links
 * @ai-features
 * - Opens the first service in the Settings order that is switched on and has the album; shows its logo
 * - Loads the album's links when first needed (the server answers from its prefetch cache), once per page load
 * - Renders nothing when no service has the album; only on devices with hover (phones use the details panel)
 */

import React, { useEffect, useState } from 'react';
import { StreamingLinks } from '@/types/music';
import { STREAMING_SERVICE_NAMES } from '@/types/preferences';
import { usePreferences } from '@/hooks/usePreferences';
import { usePlexAlbums } from '@/hooks/usePlexAlbums';
import { useServiceOpenUrls } from '@/hooks/useServiceOpenUrls';
import { orderedServiceLinks } from '@/utils/streaming-service-order';
import { fetchStreamingLinksForAlbum } from '@/utils/streaming-links';
import { linkTargetProps } from '@/utils/streaming-open-url';
import { SERVICE_ICONS } from './serviceIcons';

// One request per album and country per page load; failed lookups are asked again next time
const loadedLinks = new Map<string, Promise<StreamingLinks | null>>();
const loadLinks = (albumId: string, country: string): Promise<StreamingLinks | null> => {
  const key = `${albumId}|${country}`;
  let request = loadedLinks.get(key);
  if (!request) {
    request = fetchStreamingLinksForAlbum(albumId, country).then(({ links }) => {
      if (!links) loadedLinks.delete(key);
      return links;
    });
    loadedLinks.set(key, request);
  }
  return request;
};

interface ListenButtonProps {
  albumId: string;
  albumTitle: string;
}

const ListenButton: React.FC<ListenButtonProps> = ({ albumId, albumTitle }) => {
  const { streaming } = usePreferences().preferences;
  const plexUrl = usePlexAlbums()[albumId];
  const [links, setLinks] = useState<{ key: string; links: StreamingLinks | null } | null>(null);
  const key = `${albumId}|${streaming.country}`;

  useEffect(() => {
    let cancelled = false;
    void loadLinks(albumId, streaming.country).then(result => {
      if (!cancelled) setLinks({ key: `${albumId}|${streaming.country}`, links: result });
    });
    return () => {
      cancelled = true;
    };
  }, [albumId, streaming.country]);

  // Wait for the streaming links, so a lower-ranked Plex link never shows first and then switches
  const loaded = links?.key === key;
  const first = loaded
    ? orderedServiceLinks(streaming.serviceOrder, streaming.enabledServices, links.links, plexUrl).slice(0, 1)
    : [];
  const [target] = useServiceOpenUrls(first);
  if (!target) return null;

  const Icon = SERVICE_ICONS[target.service];
  const name = STREAMING_SERVICE_NAMES[target.service];
  return (
    <a
      href={target.href}
      {...linkTargetProps(target.href)}
      // The card opens the details panel on click and Enter; the button only opens the service
      onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
      }}
      title={`Listen in ${name}`}
      aria-label={`Listen to ${albumTitle} in ${name}`}
      className="absolute right-2 bottom-2 z-10 hidden [@media(hover:hover)]:grid place-items-center w-10 h-10 rounded-full bg-white text-background shadow-lg shadow-black/40 opacity-0 translate-y-1 transition duration-150 group-hover/card:opacity-100 group-hover/card:translate-y-0 focus-visible:opacity-100 focus-visible:translate-y-0 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-light motion-reduce:transition-none"
    >
      <Icon className="w-[22px] h-[22px]" />
    </a>
  );
};

export default ListenButton;

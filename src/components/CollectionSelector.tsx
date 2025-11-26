/**
 * @ai-file component
 * @ai-description Collection selector dropdown for authenticated users
 * @ai-dependencies React, MusicBrainzCollection type, react-icons/bi
 * @ai-features
 * - Fetch user's release-group collections from MusicBrainz API
 * - Display collection name + release count
 * - Auto-populate collection ID on selection with loading and error states
 */

'use client';

import { useState, useEffect } from 'react';
import { MusicBrainzCollection } from '@/types/auth';
import { BiLoaderAlt, BiError } from 'react-icons/bi';

interface CollectionSelectorProps {
  username: string;
  selectedCollectionId: string;
  onSelect: (collectionId: string, collectionName: string) => void;
}

export default function CollectionSelector({
  username,
  selectedCollectionId,
  onSelect,
}: CollectionSelectorProps) {
  const [collections, setCollections] = useState<MusicBrainzCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/musicbrainz/collections?username=${encodeURIComponent(username)}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch collections');
        }

        const data = await response.json();
        setCollections(data.collections);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('❌ Failed to fetch collections:', err);
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchCollections();
    }
  }, [username]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary">
        <BiLoaderAlt className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading collections...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-500">
        <BiError className="w-5 h-5" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="text-sm text-text-tertiary">
        No release-group collections found. You can still enter a collection ID manually below.
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-1">
        Select Collection
      </label>
      <select
        value={selectedCollectionId}
        onChange={(e) => {
          const collection = collections.find(c => c.id === e.target.value);
          if (collection) {
            onSelect(collection.id, collection.name);
          }
        }}
        className="block w-full p-2 bg-background-secondary text-text-primary rounded-md border border-background-tertiary focus:border-primary focus:outline-none"
      >
        <option value="">Choose a collection...</option>
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
            {collection['release-group-count'] !== undefined &&
              ` (${collection['release-group-count']} albums)`}
          </option>
        ))}
      </select>
      <p className="mt-1 text-sm text-text-tertiary">
        Select one of your MusicBrainz release-group collections
      </p>
    </div>
  );
}

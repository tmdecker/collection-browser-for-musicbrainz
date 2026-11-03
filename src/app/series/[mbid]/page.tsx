import { notFound } from 'next/navigation';
import CollectionBrowser from '@/components/CollectionBrowser';
import { isValidMbidFormat } from '@/utils/mbid-validation';

// A MusicBrainz series, e.g. /series/27a3c068-3ec5-421a-ad12-599d085fdeb1
// Opened from a series collection: /series/<mbid>?collection=<collection mbid>, for the breadcrumb
export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ mbid: string }>;
  searchParams: Promise<{ collection?: string | string[] }>;
}) {
  const { mbid } = await params;
  if (!isValidMbidFormat(mbid)) notFound();
  const { collection } = await searchParams;
  const parentCollectionId = typeof collection === 'string' && isValidMbidFormat(collection) ? collection.toLowerCase() : undefined;
  return <CollectionBrowser route={{ entityType: 'series', mbid: mbid.toLowerCase() }} parentCollectionId={parentCollectionId} />;
}

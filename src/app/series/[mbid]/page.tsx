import { notFound } from 'next/navigation';
import CollectionBrowser from '@/components/CollectionBrowser';
import { isValidMbidFormat } from '@/utils/mbid-validation';

// A MusicBrainz series, e.g. /series/27a3c068-3ec5-421a-ad12-599d085fdeb1
export default async function SeriesPage({ params }: { params: Promise<{ mbid: string }> }) {
  const { mbid } = await params;
  if (!isValidMbidFormat(mbid)) notFound();
  return <CollectionBrowser route={{ entityType: 'series', mbid: mbid.toLowerCase() }} />;
}

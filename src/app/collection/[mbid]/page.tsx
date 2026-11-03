import { notFound } from 'next/navigation';
import CollectionBrowser from '@/components/CollectionBrowser';
import { isValidMbidFormat } from '@/utils/mbid-validation';

// A MusicBrainz collection, e.g. /collection/27a3c068-3ec5-421a-ad12-599d085fdeb1
export default async function CollectionPage({ params }: { params: Promise<{ mbid: string }> }) {
  const { mbid } = await params;
  if (!isValidMbidFormat(mbid)) notFound();
  return <CollectionBrowser route={{ entityType: 'collection', mbid: mbid.toLowerCase() }} />;
}

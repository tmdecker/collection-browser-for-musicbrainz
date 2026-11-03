import { notFound } from 'next/navigation';
import CollectionRoute from '@/components/CollectionRoute';
import { isValidMbidFormat } from '@/utils/mbid-validation';

// A MusicBrainz collection, e.g. /collection/27a3c068-3ec5-421a-ad12-599d085fdeb1
export default async function CollectionPage({ params }: { params: Promise<{ mbid: string }> }) {
  const { mbid } = await params;
  if (!isValidMbidFormat(mbid)) notFound();
  return <CollectionRoute mbid={mbid.toLowerCase()} />;
}

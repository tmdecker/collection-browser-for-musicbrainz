/**
 * @ai-file component
 * @ai-description Shared pieces of the Collections page and series collection pages: section headings,
 *   cover cards and rows, plain rows for types the app can't open yet, the grid/list switch and the name filter
 * @ai-dependencies React, Next.js Link, CoverMosaic, react-icons
 * @ai-features
 * - Grid view: cover mosaic with the name and detail below; list view: one compact row with a small mosaic
 * - Series collections: a stacked edge above the mosaic, one cover per opened series, or the first series names
 * - Unsupported types: plain dimmed rows without a cover
 * - Grid/list choice remembered in this browser and shared by both pages
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BiCollection, BiGridAlt, BiListUl } from 'react-icons/bi';
import { SiMusicbrainz } from 'react-icons/si';
import CoverMosaic from './CoverMosaic';
import type { SeriesSummary } from '@/utils/collection-info';

export const sectionHeadingClass = 'text-lg font-semibold text-text-primary mb-3';
export const sectionCountClass = 'ml-2 text-sm font-normal text-text-tertiary tabular-nums';
export const tileGridClass = 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-5 gap-y-6';
export const rowListClass = 'max-w-3xl space-y-2';

/** Case- and accent-insensitive text for the name filters */
export const foldText = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const VIEW_KEY = 'mb-collections-view';
export type TileView = 'grid' | 'list';

/** Grid or list, remembered in this browser */
export function useTileView(): [TileView, (view: TileView) => void] {
  const [view, setView] = useState<TileView>('grid');
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(VIEW_KEY) === 'list') setView('list');
    } catch { /* storage blocked: grid */ }
  }, []);
  const choose = (next: TileView) => {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* not remembered */ }
  };
  return [view, choose];
}

export function ViewSwitch({ view, onChange }: { view: TileView; onChange: (view: TileView) => void }) {
  return (
    <div className="flex flex-shrink-0 gap-0.5 p-[3px] rounded-full bg-background-control" role="group" aria-label="View">
      {(['grid', 'list'] as const).map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={view === v}
          title={v === 'grid' ? 'Grid' : 'List'}
          aria-label={v === 'grid' ? 'Grid view' : 'List view'}
          className={`w-9 h-9 grid place-items-center rounded-full transition-colors ${view === v ? 'bg-background-tertiary text-white' : 'text-text-tertiary hover:text-white'}`}
        >
          {v === 'grid' ? <BiGridAlt className="w-[18px] h-[18px]" /> : <BiListUl className="w-5 h-5" />}
        </button>
      ))}
    </div>
  );
}

export function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className={sectionHeadingClass}>
      {title}
      {count !== undefined && <span className={sectionCountClass}>{count.toLocaleString()}</span>}
    </h2>
  );
}

export interface TileProps {
  href: string;
  name: string;
  detail: string;
  mbUrl: string;
  coverId?: string;           // collection or series whose cached covers make the mosaic
  seriesCollection?: boolean;
  series?: SeriesSummary[];   // a series collection's series, if its page was opened in this browser
  count?: number;
}

function MusicBrainzLink({ name, mbUrl }: { name: string; mbUrl: string }) {
  return (
    <a
      href={mbUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex text-text-secondary hover:text-white transition-colors duration-200 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
      title="Open on MusicBrainz"
      aria-label={`Open ${name} on MusicBrainz`}
    >
      <SiMusicbrainz size={16} />
    </a>
  );
}

/** Empty series collection tile: the first series names, or an icon when they aren't known yet */
function SeriesNames({ series, count }: { series?: SeriesSummary[]; count?: number }) {
  if (!series || series.length === 0) return <BiCollection className="w-8 h-8" />;
  const total = count ?? series.length;
  return (
    <div className="self-stretch justify-self-stretch flex flex-col justify-end p-4 text-left">
      {series.slice(0, 3).map((s, i) => (
        <span key={s.id} className={`block truncate text-[13px] text-text-secondary py-1.5 ${i > 0 ? 'border-t border-white/[0.07]' : ''}`}>{s.name}</span>
      ))}
      {total > 3 && <span className="text-xs text-text-tertiary pt-1">+ {(total - 3).toLocaleString()} more</span>}
    </div>
  );
}

/** Grid view: cover mosaic with the name and detail below */
export function TileCard({ href, name, detail, mbUrl, coverId, seriesCollection, series, count }: TileProps) {
  const mosaic = seriesCollection ? (
    // A small stacked edge on top: a collection of series rather than of release groups
    <div className="relative pt-2">
      <span className="absolute top-0 inset-x-3 h-1 rounded-t bg-white/[0.12]" aria-hidden="true" />
      <span className="absolute top-1 inset-x-1.5 h-1 rounded-t bg-white/[0.18]" aria-hidden="true" />
      <CoverMosaic
        seriesIds={series?.map(s => s.id)}
        className="relative aspect-square w-full rounded-lg"
        emptyIcon={<SeriesNames series={series} count={count} />}
      />
    </div>
  ) : (
    <CoverMosaic collectionId={coverId} className="aspect-square w-full rounded-lg" emptyIcon={<BiCollection className="w-8 h-8" />} />
  );
  return (
    <div className="group min-w-0">
      <Link href={href} className="block hover:opacity-90 transition-opacity">{mosaic}</Link>
      <div className="mt-2 flex items-center gap-2 min-w-0">
        <Link href={href} className="min-w-0 truncate text-sm font-medium text-text-primary hover:text-white/80">{name}</Link>
        <span className="ml-auto" />
        <MusicBrainzLink name={name} mbUrl={mbUrl} />
      </div>
      <div className="text-[13px] text-text-tertiary truncate tabular-nums">{detail}</div>
    </div>
  );
}

/** List view: one compact row with a small mosaic */
export function TileRow({ href, name, detail, mbUrl, coverId, seriesCollection, series, count }: TileProps) {
  return (
    <div className="group flex items-center gap-3 rounded-xl bg-background-secondary hover:bg-background-tertiary transition-colors pr-4">
      <Link href={href} className="flex-1 min-w-0 flex items-center gap-3.5 py-2 pl-2">
        <CoverMosaic
          collectionId={seriesCollection ? undefined : coverId}
          seriesIds={seriesCollection ? series?.map(s => s.id) : undefined}
          className="w-11 h-11 rounded-md flex-shrink-0"
          emptyIcon={seriesCollection && count !== undefined
            ? <span className="text-xs tabular-nums">{count.toLocaleString()}</span>
            : <BiCollection className="w-5 h-5" />}
        />
        <span className="font-medium truncate text-text-primary">{name}</span>
        <span className="ml-auto text-xs tabular-nums whitespace-nowrap text-text-tertiary">{detail}</span>
      </Link>
      <MusicBrainzLink name={name} mbUrl={mbUrl} />
    </div>
  );
}

export function Tile({ view, ...props }: TileProps & { view: TileView }) {
  return view === 'grid' ? <TileCard {...props} /> : <TileRow {...props} />;
}

/** A collection or series the app can't open yet: a plain dimmed row, no cover */
export function UnsupportedRow({ name, detail, mbUrl }: { name: string; detail: string; mbUrl: string }) {
  return (
    <div className="group flex items-center gap-3 rounded-xl bg-[#161616] px-4 py-2.5">
      <span className="font-medium truncate text-white/40">{name}</span>
      <span className="ml-auto text-xs whitespace-nowrap text-white/30">{detail}</span>
      <MusicBrainzLink name={name} mbUrl={mbUrl} />
    </div>
  );
}

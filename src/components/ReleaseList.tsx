/**
 * @ai-file component
 * @ai-description Releases tab of the album details panel: every release of the album, click one to show it
 * @ai-dependencies React, react-icons, release-summary, release-selection
 * @ai-features
 * - One row per release, oldest first: year, format, country, edition note, unofficial status, label and
 *   catalogue number, track count
 * - A check marks the release the panel shows; "auto" marks the app's own pick
 * - Clicking a release makes it the one shown (kept on the server for every device); "Back to automatic"
 *   undoes a choice; while saving the row shows a spinner, a failure shows why
 * - Format chips (Vinyl, CD, Digital, ...) only for albums with more than 8 releases and several formats
 * - Not logged in: the list is shown, choosing needs a login
 */

import React, { useMemo, useState } from 'react';
import { BiCheck, BiLoaderAlt } from 'react-icons/bi';
import { Release } from '@/types/music';
import { FORMAT_GROUPS, FormatGroup, sortReleasesByDate, summarizeRelease } from '@/utils/release-summary';
import { selectPreferredRelease } from '@/utils/release-selection';

interface ReleaseListProps {
  releases: Release[];
  /** The release the panel shows now */
  shownReleaseId?: string;
  /** The user's choice (null: the app picks) */
  choiceId?: string | null;
  canChoose: boolean;
  /** Resolves with an error message, or null when it worked */
  onChoose?: (releaseId: string | null) => Promise<string | null>;
}

const FORMAT_CHIPS_FROM = 9;

const ReleaseList: React.FC<ReleaseListProps> = ({ releases, shownReleaseId, choiceId = null, canChoose, onChoose }) => {
  const [format, setFormat] = useState<FormatGroup | 'All'>('All');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summaries = useMemo(() => sortReleasesByDate(releases.map(summarizeRelease)), [releases]);
  const autoId = useMemo(() => selectPreferredRelease(releases)?.id, [releases]);
  const groupCounts = useMemo(() => {
    const counts = new Map<FormatGroup, number>();
    for (const summary of summaries) counts.set(summary.formatGroup, (counts.get(summary.formatGroup) ?? 0) + 1);
    return counts;
  }, [summaries]);
  const showChips = summaries.length >= FORMAT_CHIPS_FROM && groupCounts.size > 1;
  const shown = showChips && format !== 'All' ? summaries.filter(summary => summary.formatGroup === format) : summaries;
  const interactive = canChoose && !!onChoose;

  const choose = async (releaseId: string | null) => {
    if (!onChoose || pending) return;
    setPending(releaseId ?? 'auto');
    setError(null);
    const failure = await onChoose(releaseId);
    setPending(null);
    setError(failure);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-tertiary">
        {!interactive ? (
          'Log in to pick the release this album shows.'
        ) : choiceId ? (
          <>
            You picked the release shown.{' '}
            <button
              type="button"
              onClick={() => choose(null)}
              disabled={!!pending}
              className="text-text-secondary hover:text-text-primary underline underline-offset-4 disabled:cursor-wait"
            >
              {pending === 'auto' ? 'Going back…' : 'Back to automatic'}
            </button>
          </>
        ) : (
          'Pick the release this album shows.'
        )}
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          Couldn&apos;t change the release: {error}
        </p>
      )}

      {showChips && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Format">
          {(['All', ...FORMAT_GROUPS.filter(group => groupCounts.has(group))] as const).map(group => (
            <button
              key={group}
              type="button"
              aria-pressed={format === group}
              onClick={() => setFormat(group)}
              className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${
                format === group ? 'bg-text-primary text-background' : 'bg-background-tertiary text-text-primary hover:bg-white/15'
              }`}
            >
              {group}
              <span className="ml-1 opacity-60 tabular-nums">{group === 'All' ? summaries.length : groupCounts.get(group)}</span>
            </button>
          ))}
        </div>
      )}

      <ul className="flex flex-col -mx-2.5">
        {shown.map(summary => {
          const isShown = summary.id === shownReleaseId;
          const details = [summary.label, summary.catalogNumber].filter(Boolean).join(' · ');
          return (
            <li key={summary.id}>
              <button
                type="button"
                aria-pressed={isShown}
                disabled={!interactive || !!pending}
                onClick={() => !isShown && choose(summary.id)}
                className={`w-full flex items-center gap-3 text-left rounded-lg px-2.5 py-2 transition-colors ${
                  interactive ? 'hover:bg-white/5 focus-visible:bg-white/5' : ''
                } ${pending && pending !== summary.id ? 'disabled:cursor-wait' : 'disabled:cursor-default'}`}
              >
                <span className="w-[18px] flex-shrink-0 text-text-primary text-lg" aria-hidden="true">
                  {pending === summary.id ? <BiLoaderAlt className="animate-spin" /> : isShown ? <BiCheck /> : null}
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className={`flex flex-wrap items-baseline gap-x-1.5 text-sm font-medium ${summary.unofficialStatus ? 'text-text-tertiary' : 'text-text-primary'}`}>
                    <span className="tabular-nums">{summary.year || 'No date'}</span>
                    <span>{summary.format}</span>
                    {summary.country && (
                      <span className="text-[11px] font-normal text-text-tertiary border border-white/15 rounded px-1 leading-4">{summary.country}</span>
                    )}
                    {summary.disambiguation && <span className="text-xs font-normal text-text-tertiary">{summary.disambiguation}</span>}
                    {summary.unofficialStatus && <span className="text-xs font-normal text-text-tertiary">{summary.unofficialStatus}</span>}
                    {summary.id === autoId && <span className="text-xs font-normal text-text-tertiary">· auto</span>}
                  </span>
                  {details && <span className="text-xs text-text-tertiary truncate">{details}</span>}
                </span>
                {summary.tracks > 0 && (
                  <span className="text-xs text-text-tertiary tabular-nums flex-shrink-0">
                    {summary.tracks} track{summary.tracks === 1 ? '' : 's'}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ReleaseList;

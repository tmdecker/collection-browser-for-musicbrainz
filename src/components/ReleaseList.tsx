/**
 * @ai-file component
 * @ai-description Releases tab of the album details panel: every release of the album, click one to show it
 * @ai-dependencies React, react-icons, release-summary, release-selection
 * @ai-features
 * - One row per release, oldest first: small cover (Cover Art Archive, lazy loaded), year, format, country,
 *   edition note, unofficial status, label and catalogue number, track count
 * - A check left of the track count marks the release the panel shows; other rows show a faint check on hover;
 *   hovering a check explains what picking does; "auto" marks the app's own pick
 * - Clicking a release makes it the one shown (kept on the server for every device); on a chosen release the
 *   check turns into a reset icon on hover (always on touch screens) that goes back to automatic; while saving
 *   the check shows a spinner, a failure shows why
 * - Format chips (Vinyl, CD, Digital, ...) only for albums with more than 8 releases and several formats
 * - Not logged in: the list is shown, choosing needs a login
 */

import React, { useMemo, useState } from 'react';
import NextImage from 'next/image';
import { BiAlbum, BiCheck, BiLoaderAlt, BiReset } from 'react-icons/bi';
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

const coverThumbUrl = (releaseId: string) =>
  `/api/image?url=${encodeURIComponent(`https://coverartarchive.org/release/${releaseId}/front`)}&w=180&h=180&q=80`;

/** Small cover of one release; a plain album icon when it has none (or it fails to load) */
const ReleaseThumb: React.FC<{ releaseId: string; hasCover: boolean }> = ({ releaseId, hasCover }) => {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative w-10 h-10 flex-shrink-0 overflow-hidden rounded bg-background-tertiary grid place-items-center text-text-tertiary" aria-hidden="true">
      {hasCover && !failed ? (
        <NextImage
          src={coverThumbUrl(releaseId)}
          alt=""
          fill
          sizes="40px"
          loading="lazy"
          className="object-cover"
          onError={() => setFailed(true)}
          unoptimized
        />
      ) : (
        <BiAlbum className="text-lg" />
      )}
    </span>
  );
};

type CheckState = 'saving' | 'chosen' | 'shown' | 'pickable' | 'none';

const tooltipClass =
  'pointer-events-none absolute bottom-full right-0 mb-2 px-2 py-1 rounded-md bg-background-tertiary text-xs text-text-primary whitespace-nowrap opacity-0 transition-opacity z-30';

/**
 * The check of one row, a button of its own on top of the row (left of the track count):
 * - chosen by the user: the check becomes a reset icon on hover (always on touch screens) that goes back to automatic
 * - shown (automatic pick) and pickable rows: hovering the check shows the picking hint
 */
const CheckButton: React.FC<{
  state: CheckState;
  hint?: string;
  disabled: boolean;
  onPick: () => void;
  onReset: () => void;
}> = ({ state, hint, disabled, onPick, onReset }) => {
  if (state === 'none') return null;
  const position = 'absolute right-[86px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] grid place-items-center text-lg';
  if (state === 'saving') {
    return (
      <span className={`${position} pointer-events-none`}>
        <BiLoaderAlt className="animate-spin text-text-primary" aria-label="Saving" />
      </span>
    );
  }
  if (state === 'chosen') {
    return (
      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        aria-label="Back to automatic"
        className={`group/check ${position} rounded text-text-primary disabled:cursor-wait`}
      >
        <BiCheck aria-hidden="true" className="[@media(hover:hover)]:group-hover/check:hidden group-focus-visible/check:hidden [@media(hover:none)]:hidden" />
        <BiReset aria-hidden="true" className="hidden [@media(hover:hover)]:group-hover/check:block group-focus-visible/check:block [@media(hover:none)]:block" />
        <span role="presentation" className={`${tooltipClass} [@media(hover:hover)]:group-hover/check:opacity-100 group-focus-visible/check:opacity-100`}>
          Back to automatic
        </span>
      </button>
    );
  }
  // 'shown' (automatic pick) or 'pickable': the row button does the work, this one only carries the hint
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={state === 'pickable' ? onPick : undefined}
      disabled={disabled}
      className={`group/check ${position} text-text-primary ${state === 'shown' ? 'cursor-default' : 'disabled:cursor-wait'}`}
    >
      <BiCheck
        className={
          state === 'shown'
            ? ''
            : 'opacity-0 transition-opacity [@media(hover:hover)]:group-hover/row:opacity-30 group-focus-within/row:opacity-30'
        }
      />
      {hint && <span className={`${tooltipClass} [@media(hover:hover)]:group-hover/check:opacity-100`}>{hint}</span>}
    </button>
  );
};

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
  const pickHint = 'Pick the release this album shows.';
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
      {!interactive && <p className="text-xs text-text-tertiary">Log in to pick the release this album shows.</p>}
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
          const isChosen = isShown && !!choiceId && choiceId === summary.id;
          const details = [summary.label, summary.catalogNumber].filter(Boolean).join(' · ');
          const coverInfo = releases.find(release => release.id === summary.id)?.['cover-art-archive'];
          return (
            <li key={summary.id} className="group/row relative">
              <button
                type="button"
                aria-pressed={isShown}
                disabled={!interactive || !!pending}
                onClick={() => !isShown && choose(summary.id)}
                className={`w-full flex items-center gap-3 text-left rounded-lg px-2.5 py-2 transition-colors ${
                  interactive ? 'group-hover/row:bg-white/5 focus-visible:bg-white/5' : ''
                } ${pending && pending !== summary.id ? 'disabled:cursor-wait' : 'disabled:cursor-default'}`}
              >
                <ReleaseThumb releaseId={summary.id} hasCover={coverInfo?.front !== false} />
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
                {/* Room for the check button, which sits on top so it can do its own thing */}
                <span className="w-[18px] flex-shrink-0" aria-hidden="true" />
                <span className="w-16 text-right text-xs text-text-tertiary tabular-nums flex-shrink-0">
                  {summary.tracks > 0 && `${summary.tracks} track${summary.tracks === 1 ? '' : 's'}`}
                </span>
              </button>
              <CheckButton
                state={
                  pending === summary.id || (isChosen && pending === 'auto')
                    ? 'saving'
                    : isChosen && interactive
                      ? 'chosen'
                      : isShown
                        ? 'shown'
                        : interactive && !pending
                          ? 'pickable'
                          : 'none'
                }
                hint={interactive ? pickHint : undefined}
                disabled={!!pending}
                onPick={() => choose(summary.id)}
                onReset={() => choose(null)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ReleaseList;

/**
 * @ai-file component
 * @ai-description Reviews tab of the album details panel: the album's review links from MusicBrainz
 * @ai-dependencies React, react-icons, review-languages
 * @ai-features
 * - One line per review site (site name, hostname in grey unless it is the same, ↗), opening the review in a new tab
 * - Links in the user's review languages first, in list order; a language tag only on links that are not in
 *   the first language
 * - Links in other languages wait behind one line ("Show 1 more in French"); with no link in the user's
 *   languages that line follows "No reviews in German or English."
 * - web.archive.org links are named after the original site, with "archived"
 */

import React, { useState } from 'react';
import { BiLinkExternal } from 'react-icons/bi';
import type { ReviewLink } from '@/types/reviews';
import { joinLanguageNames, splitReviewLinks } from '@/utils/review-languages';

interface ReviewListProps {
  links: ReviewLink[];
  /** The user's review languages, most wanted first */
  languages: string[];
}

const ReviewRow: React.FC<{ link: ReviewLink; firstLanguage: string | undefined }> = ({ link, firstLanguage }) => (
  <li>
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:bg-white/5"
    >
      <span className="flex-1 min-w-0 flex items-baseline gap-2">
        <span className="text-sm font-medium text-text-primary truncate flex-shrink-0 max-w-full">{link.site}</span>
        {(link.host !== link.site || link.archived) && (
          <span className="text-xs text-text-tertiary truncate">
            {link.host !== link.site && link.host}
            {link.host !== link.site && link.archived && ' · '}
            {link.archived && 'archived'}
          </span>
        )}
      </span>
      {link.language && link.language !== firstLanguage && (
        <span className="flex-shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-secondary bg-background-tertiary rounded px-1.5 leading-5">
          {link.language}
        </span>
      )}
      <BiLinkExternal className="flex-shrink-0 text-text-tertiary" aria-label="Opens in a new tab" />
    </a>
  </li>
);

const ReviewList: React.FC<ReviewListProps> = ({ links, languages }) => {
  const [showOther, setShowOther] = useState(false);
  const { shown, other } = splitReviewLinks(links, languages);
  const firstLanguage = languages[0];
  const otherLanguages = [...new Set(other.map(link => link.language!))];
  const otherIn = otherLanguages.length > 2 ? 'other languages' : joinLanguageNames(otherLanguages, 'and');

  const otherLabel = shown.length > 0
    ? `Show ${other.length} more in ${otherIn}`
    : `Show ${other.length} review${other.length === 1 ? '' : 's'} in ${otherIn}`;

  return (
    <div className="flex flex-col gap-1 pt-2">
      {shown.length === 0 && (
        <p className="text-sm text-text-tertiary pt-1">
          No reviews in {languages.length > 3 ? 'your languages' : joinLanguageNames(languages, 'or')}.
        </p>
      )}
      {shown.length > 0 && (
        <ul className="flex flex-col -mx-2.5">
          {shown.map(link => <ReviewRow key={link.url} link={link} firstLanguage={firstLanguage} />)}
        </ul>
      )}
      {other.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showOther}
            onClick={() => setShowOther(open => !open)}
            className="self-start py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:underline"
          >
            {showOther ? `Hide ${otherIn}` : `${otherLabel} ›`}
          </button>
          {showOther && (
            <ul className="flex flex-col -mx-2.5">
              {other.map(link => <ReviewRow key={link.url} link={link} firstLanguage={firstLanguage} />)}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default ReviewList;

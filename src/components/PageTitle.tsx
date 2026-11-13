/**
 * @ai-file component
 * @ai-description Browser tab title of a page, so tabs, bookmarks and the history list show what is open
 * @ai-features
 * - "<album> · <collection> · Collectionz"; parts not known yet are left out
 * - Rendered as a React <title> (React hoists it into <head>); the root layout sets no title of its own,
 *   because Next's metadata title was applied after the page's own one and replaced it
 */

export const APP_TITLE = 'Collectionz';

/** Tab title from its parts, most specific first; empty or missing parts are left out */
export const pageTitle = (...parts: (string | null | undefined)[]): string =>
  [...parts.filter(part => part && part.trim()), APP_TITLE].join(' · ');

export default function PageTitle({ parts = [] }: { parts?: (string | null | undefined)[] }) {
  return <title>{pageTitle(...parts)}</title>;
}

/**
 * @ai-file types
 * @ai-description Review links shown in the Reviews tab of the album details
 */

export interface ReviewLink {
  /** The link as MusicBrainz has it (a web.archive.org link stays one) */
  url: string;
  /** Display name of the site, e.g. "Pitchfork"; the hostname for sites the app does not know */
  site: string;
  /** Hostname without www., of the original site for archived links */
  host: string;
  /** Two- or three-letter language code of the page, null when unknown */
  language: string | null;
  /** True for web.archive.org copies of a page */
  archived: boolean;
}

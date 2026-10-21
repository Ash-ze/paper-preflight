/** Shared types for the analysis core. Nothing here touches the DOM. */

export type Severity = 'pass' | 'info' | 'warn' | 'fail';

export interface TextLine {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

export interface ImageInfo {
  page: number;
  pxWidth: number;
  pxHeight: number;
  /** Rendered size on the page, in PDF points (1/72 in). */
  widthPt: number;
  heightPt: number;
}

export interface PageModel {
  /** 1-based page number. */
  number: number;
  width: number;
  height: number;
  lines: TextLine[];
  /** All lines joined with "\n". */
  text: string;
  /** URLs from link annotations on this page. */
  links: string[];
  images: ImageInfo[];
}

export interface FontInfo {
  name: string;
  /** e.g. Type1, TrueType, Type3, CIDFontType0 ... as reported by pdf.js */
  type: string;
  isType3: boolean;
  /** false when pdf.js reports that the font program is missing from the file. */
  embedded: boolean;
  pages: number[];
}

export interface DocModel {
  numPages: number;
  /** Document information dictionary (Author, Creator, Producer, Title, ...). */
  info: Record<string, string>;
  /** Parsed XMP metadata, key -> value(s). */
  xmp: Record<string, string>;
  pages: PageModel[];
  fonts: FontInfo[];
  /** Non-fatal extraction problems (e.g. a page that failed to parse). */
  warnings: string[];
}

export type PaperSize = 'letter' | 'a4';

export interface Preset {
  id: string;
  name: string;
  /** Free-form edition label, e.g. "2025". */
  edition?: string;
  pageLimit: number | null;
  doubleBlind: boolean;
  paperSize: PaperSize | null;
  /** true if references count toward pageLimit. */
  referencesCountTowardLimit: boolean;
  /** Optional extra pages allowed for references only (e.g. "+2 pages of references"). */
  referencesPageLimit?: number | null;
  fonts?: {
    allowType3?: boolean;
    requireAllEmbedded?: boolean;
  };
  cfpUrl: string;
  notes?: string;
  /** Field names whose value has not been checked against the official CFP. */
  unverified: string[];
  lastChecked?: string | null;
}

export interface CheckOptions {
  preset: Preset;
  /** Author names to look for (user supplied, kept local). */
  authorNames: string[];
  /** Affiliations / institutions to look for (user supplied, kept local). */
  affiliations: string[];
  /** Main text ends on this page (manual override). null = auto-detect. */
  bodyEndPage: number | null;
  /** Images rendered below this effective DPI are flagged. */
  minImageDpi: number;
}

export interface Evidence {
  text: string;
  /** Highlight range inside text. */
  start: number;
  end: number;
}

export interface Finding {
  severity: Severity;
  /** i18n message key, e.g. "anon.metaAuthor" */
  code: string;
  params?: Record<string, string | number>;
  page?: number;
  evidence?: Evidence;
}

export type CheckId = 'anonymity' | 'fonts' | 'pages' | 'refs' | 'paper' | 'images';

export interface CheckResult {
  id: CheckId;
  status: Severity;
  findings: Finding[];
}

export interface Report {
  checks: CheckResult[];
  status: Severity;
  numPages: number;
  bodyPages: number;
  referencesPage: number | null;
}

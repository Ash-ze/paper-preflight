import { checkAnonymity } from './checks/anonymity';
import { checkFonts } from './checks/fonts';
import { checkImages } from './checks/images';
import { checkPages, detectAppendix } from './checks/pages';
import { checkPaper } from './checks/paper';
import { checkUnresolved } from './checks/refs';
import type { CheckOptions, DocModel, Report } from './types';
import { worst } from './util';

export function runChecks(doc: DocModel, opts: CheckOptions): Report {
  const pages = checkPages(doc, opts);
  const { bodyPages, refsPage, ...pagesResult } = pages;
  const appendix = refsPage ? detectAppendix(doc, refsPage) : null;
  const isBib = (n: number) => refsPage != null && n > bodyPages && n >= refsPage && (appendix == null || n < appendix);

  const checks = [
    checkAnonymity(doc, opts, isBib),
    checkFonts(doc, opts.preset),
    pagesResult,
    checkUnresolved(doc),
    checkPaper(doc, opts.preset.paperSize),
    checkImages(doc, opts.minImageDpi),
  ];
  return {
    checks,
    status: worst(checks.map((c) => c.status)),
    numPages: doc.numPages,
    bodyPages,
    referencesPage: refsPage,
  };
}

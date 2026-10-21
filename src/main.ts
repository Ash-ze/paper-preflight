import './style.css';
import { runChecks } from './core/run';
import type { CheckResult, DocModel, Finding, Preset, Report, Severity } from './core/types';
import { parseList } from './core/util';
import { t as tr, type Lang } from './i18n';
import { PRESETS } from './presets';

type Theme = 'auto' | 'light' | 'dark';

const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(`pp:${k}`);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v === null) localStorage.removeItem(`pp:${k}`);
      else localStorage.setItem(`pp:${k}`, v);
    } catch {
      /* storage unavailable: settings just are not remembered */
    }
  },
};

const urlLang = new URLSearchParams(location.search).get('lang');
const state = {
  lang: ((urlLang === 'zh' || urlLang === 'en' ? urlLang : store.get('lang')) as Lang) || 'en',
  theme: (store.get('theme') as Theme) || 'auto',
  presetId: store.get('preset') || 'neurips',
  bodyEnd: '',
  names: store.get('names') ?? '',
  affils: store.get('affils') ?? '',
  remember: store.get('remember') === '1',
  dpi: Number(store.get('dpi')) || 150,
  doc: null as DocModel | null,
  fileName: '',
  phase: 'idle' as 'idle' | 'loading' | 'done' | 'error',
  progress: [0, 0] as [number, number],
  error: '',
};

const t = (key: string, params?: Record<string, string | number>) => tr(state.lang, key, params);
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function preset(): Preset {
  return PRESETS.find((p) => p.id === state.presetId) ?? PRESETS[0];
}

const ICON: Record<Severity, string> = {
  pass: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="4.5" r="1.2" fill="currentColor"/><path d="M8 7.5v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  warn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="12.3" r="1.2" fill="currentColor"/></svg>',
  fail: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};
const LOCK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const DOC =
  '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 6h15l9 9v27H13z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M28 6v9h9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M19 30l4 4 7-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function badge(sev: Severity) {
  return `<span class="badge sev-${sev}">${ICON[sev]}<span>${esc(t(`sev.${sev}`))}</span></span>`;
}

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', state.theme);
  root.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  document.title = state.lang === 'zh' ? 'Paper Preflight · 投稿 PDF 预检' : 'Paper Preflight';
}

function presetInfo(): string {
  const p = preset();
  const rows: [string, string][] = [
    [t('preset.pages'), p.pageLimit == null ? t('preset.pages.none') : String(p.pageLimit) + (p.referencesPageLimit ? ` (${t('preset.refsExtra', { n: p.referencesPageLimit })})` : '')],
    [t('preset.blind'), p.doubleBlind ? t('yes') : t('no')],
    [t('preset.paper'), p.paperSize ? t(`size.${p.paperSize}`) : t('any')],
    [t('preset.refs'), p.referencesCountTowardLimit ? t('yes') : t('no')],
  ];
  const unverified = p.unverified.length
    ? `<p class="unverified">${esc(t('preset.unverified', { fields: p.unverified.join(', ') }))}</p>`
    : '';
  const cfp = p.cfpUrl
    ? `<a href="${esc(p.cfpUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('preset.cfp'))} ↗</a>`
    : '';
  return `<dl class="facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    ${p.notes ? `<p class="note">${esc(p.notes)}</p>` : ''}${unverified}${cfp}`;
}

function renderShell() {
  applyTheme();
  const options = PRESETS.map(
    (p) => `<option value="${esc(p.id)}" ${p.id === preset().id ? 'selected' : ''}>${esc(p.name)}${p.edition ? ` ${esc(p.edition)}` : ''}</option>`,
  ).join('');
  const themeBtns = (['auto', 'light', 'dark'] as Theme[])
    .map((th) => `<button type="button" data-theme-set="${th}" aria-pressed="${state.theme === th}">${esc(t(`theme.${th}`))}</button>`)
    .join('');

  $('#app').innerHTML = `
  <header class="top">
    <div class="brand">
      <img src="./favicon.svg" alt="" width="28" height="28" />
      <div><h1>${esc(t('app.title'))}</h1><p>${esc(t('app.tagline'))}</p></div>
    </div>
    <div class="controls">
      <div class="seg" role="group" aria-label="${esc(t('theme.label'))}">${themeBtns}</div>
      <button type="button" id="lang" class="ghost">${esc(t('lang.toggle'))}</button>
    </div>
  </header>

  <section class="privacy" aria-label="privacy">
    <span class="lock">${LOCK}</span>
    <div><strong>${esc(t('privacy.title'))}</strong> <span>${esc(t('privacy.body'))}</span></div>
  </section>

  <main class="layout">
    <aside class="card settings">
      <h2>${esc(t('settings.title'))}</h2>
      <label class="field"><span>${esc(t('settings.venue'))}</span>
        <select id="preset">${options}</select>
      </label>
      <div id="preset-info" class="preset-info">${presetInfo()}</div>
      <label class="field"><span>${esc(t('settings.bodyEnd'))}</span>
        <input id="bodyEnd" type="number" min="1" inputmode="numeric" placeholder="auto" value="${esc(state.bodyEnd)}" />
        <small>${esc(t('settings.bodyEnd.hint'))}</small>
      </label>
      <label class="field"><span>${esc(t('settings.names'))}</span>
        <textarea id="names" rows="3" spellcheck="false" autocomplete="off">${esc(state.names)}</textarea>
        <small>${esc(t('settings.names.hint'))}</small>
      </label>
      <label class="field"><span>${esc(t('settings.affils'))}</span>
        <textarea id="affils" rows="2" spellcheck="false" autocomplete="off">${esc(state.affils)}</textarea>
        <small>${esc(t('settings.affils.hint'))}</small>
      </label>
      <label class="checkbox"><input id="remember" type="checkbox" ${state.remember ? 'checked' : ''}/> <span>${esc(t('settings.remember'))}</span></label>
      <p class="hint">${esc(t('settings.local'))}</p>
      <label class="field"><span>${esc(t('settings.dpi'))}</span>
        <input id="dpi" type="number" min="30" max="1200" step="10" value="${state.dpi}" />
      </label>
    </aside>

    <section class="main">
      <label id="drop" class="drop" tabindex="0">
        <input id="file" type="file" accept="application/pdf,.pdf" hidden />
        <span class="drop-icon">${DOC}</span>
        <span class="drop-title">${esc(t('drop.title'))}</span>
        <span class="drop-sub">${esc(t('drop.or'))} <span class="btn">${esc(t('drop.button'))}</span></span>
        <small>${esc(t('drop.hint'))}</small>
      </label>
      <div id="status" aria-live="polite"></div>
      <div id="report"></div>
    </section>
  </main>

  <footer class="foot">
    <span>${esc(t('footer.presets'))}</span>
    <span>Paper Preflight · ${esc(t('footer.source'))}</span>
  </footer>`;

  bind();
  renderStatus();
  renderReport();
}

function renderStatus() {
  const el = $('#status');
  const drop = $('#drop');
  drop.classList.toggle('compact', state.phase === 'done');
  $('.drop-title').textContent = state.phase === 'done' ? t('drop.again') : t('drop.title');
  if (state.phase === 'loading') {
    const [d, n] = state.progress;
    const pct = n ? Math.round((d / n) * 100) : 5;
    el.innerHTML = `<div class="progress"><div class="bar" style="width:${pct}%"></div></div><p class="muted">${esc(n ? t('loading', { done: d, total: n }) : t('loading.open'))}</p>`;
  } else if (state.phase === 'error') {
    el.innerHTML = `<p class="error">${esc(state.error)}</p>`;
  } else el.innerHTML = '';
}

function currentReport(): Report | null {
  if (!state.doc) return null;
  const be = parseInt(state.bodyEnd, 10);
  return runChecks(state.doc, {
    preset: preset(),
    authorNames: parseList(state.names),
    affiliations: parseList(state.affils),
    bodyEndPage: Number.isFinite(be) && be > 0 ? be : null,
    minImageDpi: state.dpi > 0 ? state.dpi : 150,
  });
}

function evidenceHtml(f: Finding): string {
  if (!f.evidence) return '';
  const { text, start, end } = f.evidence;
  return `<details class="evidence"><summary>${esc(t('evidence'))}</summary><code>${esc(text.slice(0, start))}<mark>${esc(text.slice(start, end))}</mark>${esc(text.slice(end))}</code></details>`;
}

function findingHtml(f: Finding): string {
  const page = f.page ? `<span class="page">${esc(t('page', { n: f.page }))}</span>` : '';
  return `<li class="finding sev-${f.severity}" data-code="${esc(f.code)}">
    <span class="dot">${ICON[f.severity]}</span>
    <div class="body"><p>${esc(t(f.code, f.params))} ${page}</p>${evidenceHtml(f)}</div>
  </li>`;
}

const SEV_RANK: Record<Severity, number> = { fail: 0, warn: 1, pass: 2, info: 3 };

function checkHtml(c: CheckResult): string {
  const list = [...c.findings].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
  return `<article class="card check" id="check-${c.id}" data-status="${c.status}">
    <header><h3>${esc(t(`check.${c.id}`))}</h3>${badge(c.status)}</header>
    <ul>${list.map(findingHtml).join('')}</ul>
  </article>`;
}

function renderReport() {
  const el = $('#report');
  const rep = currentReport();
  if (!rep) {
    el.innerHTML = '';
    return;
  }
  const n = { fail: 0, warn: 0, pass: 0 };
  for (const c of rep.checks) if (c.status in n) n[c.status as keyof typeof n]++;
  const warnings = state.doc!.warnings.length
    ? `<p class="muted small">${esc(t('report.warnings', { list: state.doc!.warnings.slice(0, 5).join('; ') }))}</p>`
    : '';
  el.innerHTML = `
    <div class="card summary" data-status="${rep.status}">
      <div class="summary-main">
        ${badge(rep.status)}
        <div>
          <h2 title="${esc(state.fileName)}">${esc(state.fileName)}</h2>
          <p class="muted">${esc(preset().name)} · ${esc(t('report.pages', { n: rep.numPages }))} · ${esc(t('report.body', { n: rep.bodyPages }))}</p>
        </div>
      </div>
      <div class="summary-side">
        <nav class="chips">${rep.checks.map((c) => `<a href="#check-${c.id}" class="chip sev-${c.status}">${ICON[c.status]}${esc(t(`check.${c.id}`))}</a>`).join('')}</nav>
        <button type="button" id="download" class="ghost small">${esc(t('report.download'))}</button>
      </div>
    </div>
    ${warnings}
    <div class="checks">${rep.checks.map(checkHtml).join('')}</div>`;
  $('#download').addEventListener('click', () => download(rep));
}

function toMarkdown(rep: Report): string {
  const lines = [`# ${t('report.title')}: ${state.fileName}`, '', `- ${preset().name} · ${t('report.pages', { n: rep.numPages })} · ${t('report.body', { n: rep.bodyPages })}`, ''];
  for (const c of rep.checks) {
    lines.push(`## ${t(`check.${c.id}`)} — ${t(`sev.${c.status}`)}`, '');
    for (const f of c.findings) {
      const ev = f.evidence ? ` \`${f.evidence.text.replace(/`/g, "'")}\`` : '';
      lines.push(`- **${t(`sev.${f.severity}`)}**${f.page ? ` (${t('page', { n: f.page })})` : ''}: ${t(f.code, f.params)}${ev}`);
    }
    lines.push('');
  }
  lines.push('_Generated locally by Paper Preflight._');
  return lines.join('\n');
}

function download(rep: Report) {
  const blob = new Blob([toMarkdown(rep)], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${state.fileName.replace(/\.pdf$/i, '') || 'paper'}-preflight.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function persistNames() {
  store.set('remember', state.remember ? '1' : null);
  store.set('names', state.remember ? state.names : null);
  store.set('affils', state.remember ? state.affils : null);
}

async function handleFile(file: File) {
  state.fileName = file.name;
  state.phase = 'loading';
  state.progress = [0, 0];
  state.doc = null;
  renderStatus();
  renderReport();
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const head = new TextDecoder().decode(buf.subarray(0, 1024));
    if (!head.includes('%PDF-')) throw new Error(t('error.notPdf'));
    const { analysePdf } = await import('./pdf');
    state.doc = await analysePdf(buf, (d, n) => {
      state.progress = [d, n];
      renderStatus();
    });
    state.phase = 'done';
  } catch (e) {
    state.phase = 'error';
    const msg = (e as Error).message || String(e);
    state.error = msg === t('error.notPdf') ? msg : t('error.parse', { msg });
  }
  renderStatus();
  renderReport();
}

function bind() {
  $('#lang').addEventListener('click', () => {
    state.lang = state.lang === 'en' ? 'zh' : 'en';
    store.set('lang', state.lang);
    renderShell();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-theme-set]').forEach((b) =>
    b.addEventListener('click', () => {
      state.theme = b.dataset.themeSet as Theme;
      store.set('theme', state.theme);
      applyTheme();
      document.querySelectorAll('[data-theme-set]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }),
  );
  $<HTMLSelectElement>('#preset').addEventListener('change', (e) => {
    state.presetId = (e.target as HTMLSelectElement).value;
    store.set('preset', state.presetId);
    $('#preset-info').innerHTML = presetInfo();
    renderReport();
  });
  const onInput = (id: string, fn: (v: string) => void) =>
    $(id).addEventListener('input', (e) => {
      fn((e.target as HTMLInputElement).value);
      renderReport();
    });
  onInput('#bodyEnd', (v) => (state.bodyEnd = v));
  onInput('#names', (v) => {
    state.names = v;
    persistNames();
  });
  onInput('#affils', (v) => {
    state.affils = v;
    persistNames();
  });
  onInput('#dpi', (v) => {
    state.dpi = Number(v);
    store.set('dpi', String(state.dpi));
  });
  $<HTMLInputElement>('#remember').addEventListener('change', (e) => {
    state.remember = (e.target as HTMLInputElement).checked;
    persistNames();
  });

  const drop = $('#drop');
  const input = $<HTMLInputElement>('#file');
  input.addEventListener('change', () => {
    if (input.files?.[0]) handleFile(input.files[0]);
    input.value = '';
  });
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  });
}

// Dropping a file anywhere else should not navigate away from the page.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

renderShell();

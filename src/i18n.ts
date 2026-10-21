export type Lang = 'en' | 'zh';

type Dict = Record<string, string>;

const en: Dict = {
  'app.title': 'Paper Preflight',
  'app.tagline': 'Pre-submission checks for conference PDFs',
  'privacy.title': 'Your PDF never leaves this device.',
  'privacy.body': 'Everything runs in your browser with pdf.js. No uploads, no analytics, no third-party requests. The page blocks outgoing connections with a Content-Security-Policy.',
  'lang.toggle': '中文',
  'theme.auto': 'Auto',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.label': 'Theme',

  'settings.title': 'Settings',
  'settings.venue': 'Venue preset',
  'settings.bodyEnd': 'Main text ends on page',
  'settings.bodyEnd.hint': 'Leave empty to auto-detect the References heading.',
  'settings.names': 'Author names',
  'settings.names.hint': 'One per line. Searched in metadata, text and links.',
  'settings.affils': 'Affiliations',
  'settings.affils.hint': 'One per line, e.g. lab or university names.',
  'settings.dpi': 'Minimum image DPI',
  'settings.remember': 'Remember names on this device (localStorage only)',
  'settings.local': 'Names are only used locally and never sent anywhere.',

  'preset.pages': 'Page limit',
  'preset.pages.none': 'none',
  'preset.blind': 'Double-blind',
  'preset.paper': 'Paper',
  'preset.refs': 'References count',
  'preset.refsExtra': '+{n} pages of references',
  'preset.cfp': 'Official CFP',
  'preset.unverified': 'Unverified: {fields}. Please confirm against the official CFP.',
  'yes': 'yes',
  'no': 'no',
  'any': 'any',

  'drop.title': 'Drop your PDF here',
  'drop.or': 'or',
  'drop.button': 'Choose a file',
  'drop.hint': 'Analysed locally; the file is not uploaded.',
  'drop.again': 'Check another PDF',
  'loading': 'Analysing page {done} of {total}…',
  'loading.open': 'Opening PDF…',
  'error.notPdf': 'This does not look like a PDF file.',
  'error.parse': 'Could not read this PDF: {msg}',

  'report.title': 'Report',
  'report.pages': '{n} pages',
  'report.body': 'main text: {n}',
  'report.download': 'Download report (.md)',
  'report.counts': '{fail} fail · {warn} warn · {pass} pass',
  'report.warnings': 'Extraction warnings: {list}',
  'page': 'p. {n}',
  'evidence': 'Evidence',

  'sev.pass': 'Pass',
  'sev.info': 'Info',
  'sev.warn': 'Warn',
  'sev.fail': 'Fail',

  'check.anonymity': 'Double-blind anonymity',
  'check.fonts': 'Fonts',
  'check.pages': 'Page limit',
  'check.refs': 'Unresolved references',
  'check.paper': 'Paper size',
  'check.images': 'Image resolution',

  'anon.ok': 'No obvious identity leaks found.',
  'anon.notBlind': 'This venue is not double-blind; anonymity findings are informational only.',
  'anon.metaAuthor': 'PDF metadata field "{field}" contains an author name.',
  'anon.metaName': 'PDF metadata field "{field}" matches one of your names or affiliations.',
  'anon.metaPath': 'PDF metadata field "{field}" contains a file path that may include a user name.',
  'anon.metaTools': 'Generator: {tools}',
  'anon.ack': 'Acknowledgements section found. Remove it for the anonymous version.',
  'anon.name': 'Your name "{term}" appears in the text.',
  'anon.nameInRefs': '"{term}" appears in the references. Third-person self-citation is usually fine; check the wording.',
  'anon.affil': 'Affiliation "{term}" appears in the text.',
  'anon.hostLink': 'Link to a {host} account "{user}". Use an anonymised repository instead.',
  'anon.homepage': 'Link that looks like a personal homepage or profile.',
  'anon.email': 'E-mail address found.',
  'anon.institution': 'Institution-like word "{term}" in the first-page author block.',
  'anon.selfCite': 'Self-identifying phrasing. Refer to your own work in the third person.',
  'anon.addNames': 'Tip: add your author names and affiliations in Settings for a stronger check.',

  'fonts.ok': 'All fonts are embedded and none are Type 3.',
  'fonts.type3': 'Type 3 (bitmap/procedural) font "{name}" on pages {pages}. Often from matplotlib; set pdf.fonttype = 42.',
  'fonts.base14': 'Standard Base-14 font "{name}" is not embedded (pages {pages}). Viewers substitute it, but some venues require every font embedded.',
  'fonts.notEmbedded': 'Font "{name}" is not embedded (pages {pages}).',
  'fonts.summary': '{count} fonts used in page content, {embedded} embedded: {list}',
  'fonts.limits': 'Limitation: only fonts used in page content (including figures) are inspected; fonts referenced only by forms or unused resources are not. Embedding is inferred from pdf.js reporting a missing font file.',

  'pages.ok': 'Page count is fine.',
  'pages.total': '{total} pages in total; main text counted as {body} pages.',
  'pages.refsDetected': 'References heading detected on page {page}.',
  'pages.manual': 'Main text ends on page {page} (set manually).',
  'pages.refsNotFound': 'No References heading found; counting all pages as main text. Set the last main-text page in Settings.',
  'pages.overBody': 'Main text is {count} pages, limit is {limit} ({over} over).',
  'pages.overTotal': 'The paper is {count} pages including references, limit is {limit} ({over} over).',
  'pages.within': '{count} of {limit} pages used.',
  'pages.refsLong': 'References take about {count} pages; the venue allows {limit}.',
  'pages.noLimit': 'No page limit set for this preset.',

  'refs.ok': 'No "??" or "[?]" found.',
  'refs.ref': 'Unresolved cross-reference "??". Re-run LaTeX or fix the \\ref label.',
  'refs.cite': 'Unresolved citation "[?]". Re-run BibTeX or fix the \\cite key.',
  'refs.truncated': 'Showing {shown} of {total} occurrences.',

  'paper.ok': 'Paper size matches.',
  'paper.detected': 'Page 1 is {size}: {dims}.',
  'paper.mismatch': '{count} page(s) are {actual}, but the venue requires {expected}.',
  'paper.inconsistent': '{count} page(s) have a different size ({dims}).',
  'size.letter': 'US Letter',
  'size.a4': 'A4',
  'size.other': 'a non-standard size',

  'images.ok': 'No low-resolution bitmaps found.',
  'images.lowres': 'Bitmap image at about {dpi} DPI ({px} shown at {size}); recommended at least {min} DPI.',
  'images.count': '{count} bitmap image(s) larger than 0.5 in inspected. Vector graphics are not affected.',

  'footer.source': 'Open source (MIT)',
  'footer.presets': 'Presets are community-maintained; always double-check the official CFP.',
};

const zh: Dict = {
  'app.title': 'Paper Preflight',
  'app.tagline': '会议投稿 PDF 预检',
  'privacy.title': '你的 PDF 不会离开这台设备。',
  'privacy.body': '所有分析都在浏览器里用 pdf.js 完成：不上传、无统计、无第三方请求。页面通过 Content-Security-Policy 禁止向外发送数据。',
  'lang.toggle': 'English',
  'theme.auto': '跟随系统',
  'theme.light': '浅色',
  'theme.dark': '深色',
  'theme.label': '主题',

  'settings.title': '设置',
  'settings.venue': '会议预设',
  'settings.bodyEnd': '正文结束页',
  'settings.bodyEnd.hint': '留空则自动识别 "References" 标题所在页。',
  'settings.names': '作者姓名',
  'settings.names.hint': '每行一个，会在元数据、正文和链接中搜索。',
  'settings.affils': '机构',
  'settings.affils.hint': '每行一个，例如实验室或大学名称。',
  'settings.dpi': '图片最低 DPI',
  'settings.remember': '在本设备记住姓名（仅存 localStorage）',
  'settings.local': '姓名只在本地使用，不会发送到任何地方。',

  'preset.pages': '页数上限',
  'preset.pages.none': '无',
  'preset.blind': '双盲',
  'preset.paper': '纸张',
  'preset.refs': '参考文献计入页数',
  'preset.refsExtra': '参考文献另有 {n} 页',
  'preset.cfp': '官方 CFP',
  'preset.unverified': '未核实：{fields}。请以官方 CFP 为准。',
  'yes': '是',
  'no': '否',
  'any': '不限',

  'drop.title': '把 PDF 拖到这里',
  'drop.or': '或',
  'drop.button': '选择文件',
  'drop.hint': '在本地分析，文件不会被上传。',
  'drop.again': '检查另一个 PDF',
  'loading': '正在分析第 {done} / {total} 页…',
  'loading.open': '正在打开 PDF…',
  'error.notPdf': '这似乎不是 PDF 文件。',
  'error.parse': '无法读取该 PDF：{msg}',

  'report.title': '检查报告',
  'report.pages': '共 {n} 页',
  'report.body': '正文：{n} 页',
  'report.download': '下载报告（.md）',
  'report.counts': '{fail} 项失败 · {warn} 项警告 · {pass} 项通过',
  'report.warnings': '解析警告：{list}',
  'page': '第 {n} 页',
  'evidence': '证据',

  'sev.pass': '通过',
  'sev.info': '信息',
  'sev.warn': '警告',
  'sev.fail': '失败',

  'check.anonymity': '双盲匿名',
  'check.fonts': '字体',
  'check.pages': '页数',
  'check.refs': '未解析引用',
  'check.paper': '纸张尺寸',
  'check.images': '图片分辨率',

  'anon.ok': '未发现明显的身份泄露。',
  'anon.notBlind': '该会议不是双盲，匿名相关结果仅供参考。',
  'anon.metaAuthor': 'PDF 元数据字段 "{field}" 中含有作者名。',
  'anon.metaName': 'PDF 元数据字段 "{field}" 与你填写的姓名或机构匹配。',
  'anon.metaPath': 'PDF 元数据字段 "{field}" 中含有可能带用户名的文件路径。',
  'anon.metaTools': '生成工具：{tools}',
  'anon.ack': '发现致谢（Acknowledgements）段落，匿名版本应删除。',
  'anon.name': '正文中出现你的姓名 "{term}"。',
  'anon.nameInRefs': '参考文献中出现 "{term}"。以第三人称自引通常没问题，请检查措辞。',
  'anon.affil': '正文中出现机构 "{term}"。',
  'anon.hostLink': '指向 {host} 账号 "{user}" 的链接，建议改用匿名仓库。',
  'anon.homepage': '疑似个人主页或学术档案链接。',
  'anon.email': '发现邮箱地址。',
  'anon.institution': '首页作者区出现疑似机构词 "{term}"。',
  'anon.selfCite': '暴露身份的自引措辞，请用第三人称引用自己的工作。',
  'anon.addNames': '提示：在设置中填写作者姓名和机构，可以检查得更准确。',

  'fonts.ok': '所有字体均已嵌入，且没有 Type 3 字体。',
  'fonts.type3': 'Type 3 字体 "{name}"（第 {pages} 页）。常见于 matplotlib 导出，可设置 pdf.fonttype = 42。',
  'fonts.base14': '标准 Base-14 字体 "{name}" 未嵌入（第 {pages} 页）。阅读器会自动替换，但部分会议要求嵌入所有字体。',
  'fonts.notEmbedded': '字体 "{name}" 未嵌入（第 {pages} 页）。',
  'fonts.summary': '页面内容共用到 {count} 种字体，已嵌入 {embedded} 种：{list}',
  'fonts.limits': '局限：只检查页面内容（含插图）实际用到的字体，表单或未使用资源中的字体不在范围内；是否嵌入依据 pdf.js 报告的字体文件缺失情况推断。',

  'pages.ok': '页数没有问题。',
  'pages.total': '共 {total} 页，正文按 {body} 页计。',
  'pages.refsDetected': '在第 {page} 页识别到 References 标题。',
  'pages.manual': '正文结束于第 {page} 页（手动设置）。',
  'pages.refsNotFound': '未找到 References 标题，按全部页数计算。可在设置中手动指定正文结束页。',
  'pages.overBody': '正文 {count} 页，上限 {limit} 页（超出 {over} 页）。',
  'pages.overTotal': '含参考文献共 {count} 页，上限 {limit} 页（超出 {over} 页）。',
  'pages.within': '已用 {count} / {limit} 页。',
  'pages.refsLong': '参考文献约 {count} 页，会议允许 {limit} 页。',
  'pages.noLimit': '该预设未设置页数上限。',

  'refs.ok': '没有发现 "??" 或 "[?]"。',
  'refs.ref': '未解析的交叉引用 "??"。请重新编译 LaTeX 或修正 \\ref 标签。',
  'refs.cite': '未解析的文献引用 "[?]"。请重新运行 BibTeX 或修正 \\cite 键。',
  'refs.truncated': '共 {total} 处，仅显示 {shown} 处。',

  'paper.ok': '纸张尺寸符合要求。',
  'paper.detected': '第 1 页为 {size}：{dims}。',
  'paper.mismatch': '{count} 页为 {actual}，但会议要求 {expected}。',
  'paper.inconsistent': '{count} 页尺寸不同（{dims}）。',
  'size.letter': 'US Letter',
  'size.a4': 'A4',
  'size.other': '非标准尺寸',

  'images.ok': '未发现低分辨率位图。',
  'images.lowres': '位图约 {dpi} DPI（{px}，显示为 {size}），建议至少 {min} DPI。',
  'images.count': '检查了 {count} 张大于 0.5 英寸的位图。矢量图不受影响。',

  'footer.source': '开源（MIT）',
  'footer.presets': '预设由社区维护，请务必以官方 CFP 为准。',
};

const DICTS: Record<Lang, Dict> = { en, zh };

export function t(lang: Lang, key: string, params: Record<string, string | number> = {}): string {
  const tpl = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    if (v === undefined) return `{${k}}`;
    // translate enumerated values such as paper sizes
    if ((k === 'size' || k === 'actual' || k === 'expected') && typeof v === 'string' && DICTS.en[`size.${v}`]) {
      return DICTS[lang][`size.${v}`] ?? String(v);
    }
    return String(v);
  });
}

export function hasKey(key: string): boolean {
  return key in en && key in zh;
}

export const ALL_KEYS = Object.keys(en);
export const ZH_KEYS = Object.keys(zh);

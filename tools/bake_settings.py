"""Bake the live admin settings into the static site.

Why: the site has no splash screen, so the first paint must already show what the
admin has set. This writes
  * assets/settings-snapshot.js — the settings as window.FSH_SNAPSHOT; api.js merges
    it into CFG before page scripts draw prices, unless the browser already has a
    fresher copy from /api/settings;
  * the edited texts, txauto edits, the promo label and hidden blocks straight into
    the HTML, rendered exactly the way api.js renders them at runtime.
/api/settings still wins on every page load, so a stale bake never breaks anything —
it only brings back a brief flash for whatever changed since the last bake.

Usage (from the repo root):
  python tools/bake_settings.py                 # fetch from the live site
  python tools/bake_settings.py settings.json   # use a saved copy
  python tools/bake_settings.py --check         # report only, change nothing
"""
import hashlib, io, json, re, sys, urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIVE = 'https://www.firmova-shtora.com.ua/api/settings?fresh=1'
PAGES = ['index', 'kviz', 'umovy', 'blog', 'pro2', 'den-nich']   # pages that load api.js
SNAPSHOT = 'assets/settings-snapshot.js'

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
        'source', 'track', 'wbr'}
INLINE = {'em', 'b', 'i', 'strong', 'br', 'span', 'small', 'sup', 'sub', 'u'}   # api.js fshForeign
CLOSES_P = {'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset',
            'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'header', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul'}
DYNAMIC_IDS = {'fabStrip', 'priceWins'}                                          # api.js ДИНАМІЧНІ


class El:
    def __init__(self, tag, attrs, start, open_end, parent):
        self.tag, self.attrs, self.start, self.open_end = tag, dict(attrs), start, open_end
        self.close_start = self.close_end = open_end
        self.parent, self.children = parent, []


class Tree(HTMLParser):
    def __init__(self, src):
        super().__init__(convert_charrefs=True)
        self.src, self.warn = src, []
        self.lines = [0] + [m.end() for m in re.finditer('\n', src)]
        self.root = El('#root', [], 0, 0, None)
        self.stack = [self.root]
        self.feed(src); self.close()

    def off(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def _close(self, el, at, end):
        el.close_start, el.close_end = at, end

    def handle_starttag(self, tag, attrs):
        start = self.off()
        open_end = start + len(self.get_starttag_text())
        top = self.stack[-1]
        if top.tag == 'p' and tag in CLOSES_P:
            self._close(self.stack.pop(), start, start)
        elif top.tag == 'li' and tag == 'li':
            self._close(self.stack.pop(), start, start)
        el = El(tag, attrs, start, open_end, self.stack[-1])
        self.stack[-1].children.append(el)
        if tag not in VOID:
            self.stack.append(el)

    def handle_startendtag(self, tag, attrs):
        start = self.off()
        el = El(tag, attrs, start, start + len(self.get_starttag_text()), self.stack[-1])
        self.stack[-1].children.append(el)

    def handle_endtag(self, tag):
        at = self.off()
        end = self.src.index('>', at) + 1
        if tag in VOID:
            return
        names = [e.tag for e in self.stack]
        if tag not in names:
            self.warn.append(f'stray </{tag}> at {at}')
            return
        while self.stack[-1].tag != tag:
            el = self.stack.pop()
            self.warn.append(f'<{el.tag}> closed implicitly by </{tag}>')
            self._close(el, at, at)
        self._close(self.stack.pop(), at, end)

    def walk(self, el=None):
        el = el or self.root
        for c in el.children:
            yield c
            yield from self.walk(c)

    def body(self):
        return next((e for e in self.walk() if e.tag == 'body'), None)

    def resolve(self, path):
        node = self.body()
        for seg in path.split('>'):
            m = re.fullmatch(r'([a-z0-9]+)\[(\d+)\]', seg)
            if not m or not node:
                return None
            same = [c for c in node.children if c.tag == m[1]]
            node = same[int(m[2]) - 1] if int(m[2]) <= len(same) else None
        return node


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def rich(s):                                              # api.js richText
    e = esc(s)
    e = re.sub(r'\*\*([^*\n]+)\*\*', r'<b>\1</b>', e)
    e = re.sub(r'\*([^*\n]+)\*', r'<em>\1</em>', e)
    return re.sub(r'\r?\n', '<br>', e)


def dynamic(el):
    while el:
        if el.attrs.get('id') in DYNAMIC_IDS or 'data-dyn' in el.attrs:
            return True
        el = el.parent
    return False


def render_text(src, el, val):
    """The new inner HTML of el, as api.js fshRenderText would leave it."""
    val = '' if val is None else str(val)
    if any(c.tag not in INLINE for c in el.children):        # fshSetDirectText
        out, pos, done = [], el.open_end, False
        bounds = [(c.start, c.close_end) for c in el.children] + [(el.close_start, el.close_start)]
        for a, b in bounds:
            gap = src[pos:a]
            for part in re.split(r'(<!--.*?-->)', gap, flags=re.S):
                if part.startswith('<!--') or not part:
                    out.append(part)
                elif not done:
                    out.append(esc(val)); done = True
            out.append(src[a:b]); pos = b
        inner = ''.join(out)
        return inner if done else esc(val) + inner
    if re.search(r'[*\n]', val):
        return rich(val)
    return esc(val)


def promo_label(s):
    cfg = (ROOT / 'assets/config.js').read_text(encoding='utf-8')
    m = re.search(r'promo:\s*\{[^}]*?percent:\s*([\d.]+)', cfg)
    p = {'percent': float(m[1]) if m else 0, **(s.get('promo') or {})}
    if p.get('label'):
        return str(p['label'])
    try:
        pct = float(p.get('percent'))
    except (TypeError, ValueError):
        pct = 0
    return '−' + str(int(pct + 0.5)) + '%' if pct > 0 else '−50%'


def set_attr(tag_text, name, value):
    pat = re.compile(r'\s' + re.escape(name) + r'(\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+))?', re.I)
    tag_text = pat.sub('', tag_text)
    if value is None:
        return tag_text
    add = f' {name}' if value is True else f' {name}="{esc(value)}"'
    return re.sub(r'\s*/?>$', lambda m: add + m.group(0), tag_text, count=1)


def bake_page(page, s, check):
    path = ROOT / (page + '.html')
    if not path.exists():
        return []
    src = io.open(path, encoding='utf-8', newline='').read()
    t = Tree(src)
    edits, notes = {}, []

    def text(el, val, why):
        if el is None:
            notes.append(f'  - {why}: element not found, skipped'); return
        if dynamic(el):
            notes.append(f'  - {why}: inside a dynamic block, left to runtime'); return
        edits[(el.open_end, el.close_start)] = render_text(src, el, val)

    label = promo_label(s)                                  # pro.js promoNow
    for el in t.walk():
        if 'data-promo-pct' in el.attrs:
            text(el, label, 'promo label')
    for key, val in (s.get('texts') or {}).items():
        if val is None:
            continue
        for el in t.walk():
            if el.attrs.get('data-txt') == key:
                text(el, val, f'text {key}')
    # Images are left to runtime on purpose: the admin's «Повернути початкове» deletes
    # the image key, and a baked image would outlive that until the next bake.
    for p, val in ((s.get('txauto') or {}).get(page) or {}).items():
        text(t.resolve(p), val, f'auto text {p}')
    for bid, on in (s.get('blocks') or {}).items():
        for el in t.walk():
            if el.attrs.get('id') == bid and el.parent is not None:
                tag = src[el.start:el.open_end] if (el.start, el.open_end) not in edits else edits[(el.start, el.open_end)]
                edits[(el.start, el.open_end)] = set_attr(tag, 'hidden', None if on else True)

    spans = sorted(edits)
    for (a1, b1), (a2, b2) in zip(spans, spans[1:]):
        if a2 < b1 and not (a1 <= a2 and b2 <= b1):
            raise SystemExit(f'{page}: overlapping edits at {a1}-{b1} and {a2}-{b2}')
    out = src
    for a, b in sorted(edits, reverse=True):
        out = out[:a] + edits[(a, b)] + out[b:]
    out = snapshot_tag(out, s)
    changed = out != src
    if changed and not check:
        io.open(path, 'w', encoding='utf-8', newline='').write(out)
    return [f'{page}.html: {len(edits)} edits, {"changed" if changed else "already up to date"}'] \
        + notes + [f'  ! {w}' for w in t.warn]


def snapshot_tag(html, s):
    ver = hashlib.sha1(json.dumps(s, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:8]
    tag = f'<script src="{SNAPSHOT}?v={ver}"></script>'
    if re.search(re.escape(SNAPSHOT) + r'\?v=\w+', html):
        return re.sub(r'<script src="' + re.escape(SNAPSHOT) + r'\?v=\w+"></script>', tag, html)
    m = re.search(r'<script src="assets/config\.js\?v=\w+"></script>(\r?\n)', html)
    if not m:
        return html
    return html[:m.end()] + tag + m.group(1) + html[m.end():]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    check = '--check' in sys.argv
    if args:
        raw = io.open(args[0], encoding='utf-8').read()
    else:
        req = urllib.request.Request(LIVE, headers={'Accept': 'application/json', 'User-Agent': 'bake-settings'})
        raw = urllib.request.urlopen(req, timeout=20).read().decode('utf-8')
    s = json.loads(raw)
    if not isinstance(s, dict) or not s.get('savedAt'):
        raise SystemExit('settings look empty — refusing to bake')
    body = json.dumps(s, ensure_ascii=False, separators=(',', ':'))
    js = ('// Admin settings baked at release by tools/bake_settings.py (savedAt ' + s['savedAt'] + ').\n'
          '// api.js uses it only until /api/settings answers; do not edit by hand.\n'
          'window.FSH_SNAPSHOT = ' + body + ';\n')
    snap = ROOT / SNAPSHOT
    old = snap.read_text(encoding='utf-8') if snap.exists() else ''
    if js != old and not check:
        snap.write_text(js, encoding='utf-8', newline='\n')
    print(f'{SNAPSHOT}: {"changed" if js != old else "already up to date"} (savedAt {s["savedAt"]})')
    for page in PAGES:
        for line in bake_page(page, s, check):
            print(line)


if __name__ == '__main__':
    main()

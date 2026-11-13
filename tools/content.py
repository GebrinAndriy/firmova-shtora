"""Складає довідник текстів і фото для адмінки зі справжніх сторінок.

Попередній лежав із часів іншої структури сайту: там були розділи,
яких уже немає, і навіть шматки шаблону («${p.title}»), бо збирали
його разом із вмістом <script>. Тут скрипти вирізаються першими.
"""
import io, os, re, json, html

os.chdir(r'C:\Users\GameOn\Desktop\Zhaluzi-Site')

СТОРІНКИ = [
    ('index.html',     'Головна — рулонні'),
    ('den-nich.html',  'Фірмова день-ніч'),
    ('kviz.html',      'Калькулятор'),
    ('blog.html',      'Блог'),
    ('umovy.html',     'Умови'),
]

БЕЗ_ПАРИ = {'img', 'input', 'br', 'hr', 'source', 'meta', 'link'}

def без_скриптів(s):
    s = re.sub(r'<script\b[^>]*>.*?</script>', '', s, flags=re.S | re.I)
    s = re.sub(r'<style\b[^>]*>.*?</style>', '', s, flags=re.S | re.I)
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    return s

def текст(фрагмент):
    t = re.sub(r'<[^>]+>', '', фрагмент)
    return re.sub(r'\s+', ' ', html.unescape(t)).strip()

def атрибут(тег, імя):
    m = re.search(r'\b' + імя + r'\s*=\s*"([^"]*)"', тег)
    return m.group(1) if m else ''

def вміст(s, поч, назва):
    """Шукає закривний тег тієї ж назви з урахуванням вкладених."""
    відкр = re.compile(r'<' + назва + r'\b', re.I)
    закр  = re.compile(r'</' + назва + r'\s*>', re.I)
    i, глибина = поч, 1
    while глибина:
        д = відкр.search(s, i)
        з = закр.search(s, i)
        if not з:
            return s[поч:]
        if д and д.start() < з.start():
            глибина += 1; i = д.end()
        else:
            глибина -= 1; i = з.end()
            if not глибина:
                return s[поч:з.start()]
    return ''

def розділи(s):
    """Межі кожного <section id=…>, щоб знати, у якому розділі елемент."""
    межі = []
    for m in re.finditer(r'<section\b[^>]*\bid="([^"]+)"[^>]*>', s, re.I):
        кінець = m.end() + len(вміст(s, m.end(), 'section'))
        межі.append((m.start(), кінець, m.group(1)))
    return межі

def розділ(межі, поз):
    підхожі = [r for r in межі if r[0] <= поз < r[1]]
    return підхожі[-1][2] if підхожі else 'page'

тексти, фото = [], []
for файл, назва in СТОРІНКИ:
    if not os.path.exists(файл):
        continue
    s = без_скриптів(io.open(файл, encoding='utf-8').read())
    межі = розділи(s)
    for m in re.finditer(r'<([a-zA-Z0-9]+)\b([^>]*\bdata-(txt|img)="[^"]+"[^>]*)>', s):
        тег, атр, вид = m.group(1).lower(), m.group(2), m.group(3)
        ключ = атрибут(атр, 'data-' + вид)
        сек = розділ(межі, m.start())
        if вид == 'txt':
            if тег in БЕЗ_ПАРИ:
                continue
            тексти.append({'key': ключ, 'page': назва, 'section': сек,
                           'tag': тег, 'value': текст(вміст(s, m.end(), тег))})
        else:
            фото.append({'key': ключ, 'page': назва, 'section': сек,
                         'src': атрибут(атр, 'src').split('?')[0],
                         'alt': html.unescape(атрибут(атр, 'alt'))})

def без_повторів(список):
    бачені, out = set(), []
    for x in список:
        if x['key'] in бачені:
            continue
        бачені.add(x['key']); out.append(x)
    return out

дані = {'texts': без_повторів(тексти), 'images': без_повторів(фото)}
io.open('assets/content.json', 'w', encoding='utf-8', newline='\n').write(
    json.dumps(дані, ensure_ascii=False, indent=2))
print('текстів:', len(дані['texts']), ' фото:', len(дані['images']))
import collections
for k, v in collections.Counter(x['page'] for x in дані['texts']).items():
    print('   %-22s %3d' % (k, v))

"""Generates docs/loop.svg and docs/loop.ko.svg. Run: python3 docs/loop.py

The requirements → code → check → done loop, and where cuesheet comes in. Like structure.svg, the diagram carries
its own light background, so it reads the same on GitHub's light and dark themes.
"""
from pathlib import Path

HERE = Path(__file__).parent

L = {
    'en': dict(
        repeat='repeat',
        spec='Requirements', code='Code', check='Check', done='Done',
        bottleneck='the bottleneck',
        aria='Building a client feature runs requirements, code, check and done, with check looping back '
             'to code. Checking is the bottleneck.',
    ),
    'ko': dict(
        repeat='반복',
        spec='요구사항', code='코드 작성', check='검증', done='완료',
        bottleneck='병목',
        aria='클라이언트 기능 개발은 요구사항 → 코드 작성 → 검증 → 완료로 가고, 검증에서 코드 작성으로 다시 '
             '돌아갑니다. 검증이 병목입니다.',
    ),
}

BLUE = '#2563eb'
VIOLET = '#7c3aed'
ORANGE = '#f97316'
GREEN = '#059669'


def icon(kind, x, y, color):
    """A 28×28 tinted square with a small glyph, top-left at (x, y)"""
    g = [f'<rect x="{x}" y="{y}" width="28" height="28" rx="7" fill="{color}" fill-opacity="0.12"/>']
    cx, cy = x + 14, y + 14
    s = f'stroke="{color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"'
    if kind == 'doc':
        g.append(f'<path d="M{cx - 6} {cy - 8} L{cx + 2} {cy - 8} L{cx + 6} {cy - 4} L{cx + 6} {cy + 8} '
                 f'L{cx - 6} {cy + 8} Z" {s}/>')
        g.append(f'<line x1="{cx - 3}" y1="{cy + 1}" x2="{cx + 3}" y2="{cy + 1}" {s}/>')
        g.append(f'<line x1="{cx - 3}" y1="{cy + 5}" x2="{cx + 1}" y2="{cy + 5}" {s}/>')
    elif kind == 'code':
        g.append(f'<path d="M{cx - 3} {cy - 5} L{cx - 8} {cy} L{cx - 3} {cy + 5}" {s}/>')
        g.append(f'<path d="M{cx + 3} {cy - 5} L{cx + 8} {cy} L{cx + 3} {cy + 5}" {s}/>')
    elif kind == 'check':
        g.append(f'<circle cx="{cx}" cy="{cy}" r="8" {s}/>')
        g.append(f'<path d="M{cx - 4} {cy} L{cx - 1} {cy + 3.5} L{cx + 4.5} {cy - 3.5}" {s}/>')
    elif kind == 'done':
        g.append(f'<circle cx="{cx}" cy="{cy}" r="8" fill="{color}"/>')
        g.append(f'<path d="M{cx - 4} {cy} L{cx - 1} {cy + 3.5} L{cx + 4.5} {cy - 3.5}" '
                 'stroke="#ffffff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
    return ''.join(g)


for lang, t in L.items():
    p = []
    p.append('<rect x="0.5" y="0.5" width="1003" height="179" rx="18" fill="#f8fafc" stroke="#e2e8f0"/>')

    steps = [
        (36, t['spec'], 'doc', VIOLET, False),
        (283, t['code'], 'code', BLUE, False),
        (530, t['check'], 'check', ORANGE, True),
        (778, t['done'], 'done', GREEN, False),
    ]
    for x, name, kind, color, hot in steps:
        fill, stroke = ('#fff7ed', '#fdba74') if hot else ('#ffffff', '#e2e8f0')
        p.append(f'<rect x="{x}" y="64" width="190" height="64" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="1.2"/>')
        p.append(icon(kind, x + 24, 82, color))
        cls = 'th' if hot else 't'
        p.append(f'<text class="{cls}" x="{x + 64}" y="101">{name}</text>')

    for x in (226, 473, 720):
        p.append(f'<path class="a" d="M{x} 96 L{x + 55} 96" marker-end="url(#h)"/>')

    # check loops back to writing code, over the top
    p.append('<path class="a" d="M625 62 C625 22 378 22 378 60" marker-end="url(#h)"/>')
    p.append(f'<text class="l" x="501" y="26" text-anchor="middle">{t["repeat"]}</text>')

    # the step that holds everything up
    p.append(f'<text class="hot" x="625" y="152" text-anchor="middle">{t["bottleneck"]}</text>')

    font = "-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo','Noto Sans KR',Helvetica,Arial,sans-serif"
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1004 180" width="1004" height="180" role="img" aria-label="{t['aria']}">
<style>
  text {{ font-family:{font}; }}
  .t {{ font-size:15px; font-weight:650; fill:#0f172a; }}
  .th {{ font-size:15px; font-weight:700; fill:#c2410c; }}
  .hot {{ font-size:11.5px; font-weight:600; fill:#c2410c; letter-spacing:0.4px; }}
  .s {{ font-size:12px; fill:#64748b; }}
  .l {{ font-size:11px; font-weight:600; fill:#94a3b8; letter-spacing:0.4px; }}
  .a {{ fill:none; stroke:#94a3b8; stroke-width:1.5; stroke-linecap:round; }}
</style>
<defs>
  <marker id="h" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9" fill="none" stroke="#94a3b8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker>
</defs>
{chr(10).join(p)}
</svg>
'''
    (HERE / f'loop{"" if lang == "en" else ".ko"}.svg').write_text(svg)

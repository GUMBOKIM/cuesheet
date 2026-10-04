"""Generates docs/structure.svg and docs/structure.ko.svg. Run: python3 docs/structure.py

The diagram carries its own light background, so it reads the same on GitHub's light and dark themes.
"""
from pathlib import Path

HERE = Path(__file__).parent

L = {
    'en': dict(
        set_state='SET THE STATE',
        cue='?cue= link', panel='Panel', code='Code API',
        state='CueState', state_sub='one state for scenarios, delay, clock and offline',
        mock='API mock', mock_sub='named MSW scenarios',
        net='Network', net_sub='delay · offline',
        clock='Clock', clock_sub='frozen or running',
        client='Client app', client_sub='fetch · XHR · Date',
        req='request', res='response',
        server='Real server', server_sub='no handler matched',
        rec='Records', rec_sub='what answered, and how',
        miss='no match', hit='answered',
    ),
    'ko': dict(
        set_state='상태를 정하는 곳',
        cue='?cue= 링크', panel='패널', code='코드 API',
        state='CueState', state_sub='시나리오 · 지연 · 시계 · 오프라인을 담는 하나의 상태',
        mock='API 모킹', mock_sub='이름 붙인 MSW 시나리오',
        net='네트워크', net_sub='지연 · 오프라인',
        clock='시계', clock_sub='멈춤 또는 흐름',
        client='클라이언트 앱', client_sub='fetch · XHR · Date',
        req='요청', res='응답',
        server='실제 서버', server_sub='맞는 핸들러가 없을 때',
        rec='요청 기록', rec_sub='무엇이 어떻게 응답했나',
        miss='매칭 없음', hit='응답함',
    ),
}

BLUE = '#2563eb'
VIOLET = '#7c3aed'
ORANGE = '#f97316'
SLATE = '#64748b'


def icon(kind, x, y, color):
    """A 28×28 tinted square with a small glyph, top-left at (x, y)"""
    g = [f'<rect x="{x}" y="{y}" width="28" height="28" rx="7" fill="{color}" fill-opacity="0.12"/>']
    cx, cy = x + 14, y + 14
    s = f'stroke="{color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"'
    if kind == 'link':
        g.append(f'<rect x="{cx - 8}" y="{cy - 4}" width="9" height="8" rx="4" {s}/>')
        g.append(f'<rect x="{cx - 1}" y="{cy - 4}" width="9" height="8" rx="4" {s}/>')
    elif kind == 'panel':
        g.append(f'<line x1="{cx - 7}" y1="{cy - 4}" x2="{cx + 7}" y2="{cy - 4}" {s}/>')
        g.append(f'<line x1="{cx - 7}" y1="{cy + 4}" x2="{cx + 7}" y2="{cy + 4}" {s}/>')
        g.append(f'<circle cx="{cx - 2}" cy="{cy - 4}" r="2.4" fill="{color}"/>')
        g.append(f'<circle cx="{cx + 3}" cy="{cy + 4}" r="2.4" fill="{color}"/>')
    elif kind == 'code':
        g.append(f'<path d="M{cx - 3} {cy - 5} L{cx - 8} {cy} L{cx - 3} {cy + 5}" {s}/>')
        g.append(f'<path d="M{cx + 3} {cy - 5} L{cx + 8} {cy} L{cx + 3} {cy + 5}" {s}/>')
    elif kind == 'mock':
        g.append(f'<path d="M{cx - 3} {cy - 7} Q{cx - 7} {cy - 7} {cx - 6} {cy - 2} Q{cx - 6} {cy} {cx - 8} {cy} '
                 f'Q{cx - 6} {cy} {cx - 6} {cy + 2} Q{cx - 7} {cy + 7} {cx - 3} {cy + 7}" {s}/>')
        g.append(f'<path d="M{cx + 3} {cy - 7} Q{cx + 7} {cy - 7} {cx + 6} {cy - 2} Q{cx + 6} {cy} {cx + 8} {cy} '
                 f'Q{cx + 6} {cy} {cx + 6} {cy + 2} Q{cx + 7} {cy + 7} {cx + 3} {cy + 7}" {s}/>')
    elif kind == 'net':
        g.append(f'<path d="M{cx - 8} {cy - 2} Q{cx} {cy - 9} {cx + 8} {cy - 2}" {s}/>')
        g.append(f'<path d="M{cx - 4.5} {cy + 1.5} Q{cx} {cy - 2.5} {cx + 4.5} {cy + 1.5}" {s}/>')
        g.append(f'<circle cx="{cx}" cy="{cy + 5}" r="1.8" fill="{color}"/>')
    elif kind == 'clock':
        g.append(f'<circle cx="{cx}" cy="{cy}" r="7.5" {s}/>')
        g.append(f'<path d="M{cx} {cy - 4} L{cx} {cy} L{cx + 3.5} {cy + 2}" {s}/>')
    elif kind == 'server':
        g.append(f'<rect x="{cx - 7}" y="{cy - 7}" width="14" height="6" rx="2" {s}/>')
        g.append(f'<rect x="{cx - 7}" y="{cy + 1}" width="14" height="6" rx="2" {s}/>')
    elif kind == 'records':
        for i, w in enumerate([12, 12, 8]):
            yy = cy - 5 + i * 5
            g.append(f'<circle cx="{cx - 6}" cy="{yy}" r="1.3" fill="{color}"/>')
            g.append(f'<line x1="{cx - 3}" y1="{yy}" x2="{cx - 3 + w}" y2="{yy}" {s}/>')
    return ''.join(g)


def card(x, y, w, h, title, sub=None, kind=None, color=BLUE, dashed=False):
    """A white card with an icon on the left and a title (and optional subtitle)"""
    dash = ' stroke-dasharray="5 4"' if dashed else ''
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.2"{dash}/>']
    tx = x + 16
    if kind is not None:
        out.append(icon(kind, x + 14, y + h / 2 - 14, color))
        tx = x + 52
    if sub is None:
        out.append(f'<text class="t" x="{tx}" y="{y + h / 2 + 5}">{title}</text>')
    else:
        out.append(f'<text class="t" x="{tx}" y="{y + h / 2 - 3}">{title}</text>')
        out.append(f'<text class="s" x="{tx}" y="{y + h / 2 + 14}">{sub}</text>')
    return ''.join(out)


def arrow(d, dashed=False):
    cls = 'a d' if dashed else 'a'
    return f'<path class="{cls}" d="{d}" marker-end="url(#h)"/>'


def label(x, y, text, anchor='middle'):
    return f'<text class="l" x="{x}" y="{y}" text-anchor="{anchor}">{text}</text>'


def mark(x, y, size):
    """The CueSheet icon, top-left at (x, y)"""
    k = size / 128
    return (f'<g transform="translate({x} {y}) scale({k})">'
            '<rect width="128" height="128" rx="28" fill="url(#brand)"/>'
            '<rect x="30" y="24" width="68" height="80" rx="10" fill="#ffffff"/>'
            '<rect x="42" y="40" width="44" height="7" rx="3.5" fill="#cbd5e1"/>'
            f'<rect x="42" y="60.5" width="44" height="7" rx="3.5" fill="{ORANGE}"/>'
            '<rect x="42" y="81" width="30" height="7" rx="3.5" fill="#cbd5e1"/>'
            f'<path d="M20 54.5 L33 64 L20 73.5 Z" fill="{ORANGE}" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>'
            '</g>')


for lang, t in L.items():
    p = []
    # Canvas
    p.append('<rect x="0.5" y="0.5" width="1003" height="459" rx="18" fill="#f8fafc" stroke="#e2e8f0"/>')

    # cuesheet — drawn first so the arrows coming in stay on top of it
    p.append('<rect x="226" y="126" width="508" height="306" rx="16" fill="#ffffff" stroke="#bfdbfe" stroke-width="1.6"/>')
    p.append(mark(244, 394, 22))
    p.append(f'<text class="brand" x="274" y="410">cuesheet</text>')

    # Where the state is set
    p.append(label(480, 36, t['set_state']))
    inputs = [(t['cue'], 'link', BLUE), (t['panel'], 'panel', VIOLET), (t['code'], 'code', ORANGE)]
    for i, (name, kind, color) in enumerate(inputs):
        x = 250 + i * 160
        p.append(card(x, 50, 140, 52, name, None, kind, color))
        cx = x + 70
        p.append(arrow(f'M{cx} 102 L{cx} 164'))

    # CueState
    p.append('<rect x="250" y="166" width="460" height="64" rx="12" fill="url(#brand)"/>')
    p.append(f'<text class="ts" x="480" y="194" text-anchor="middle">{t["state"]}</text>')
    p.append(f'<text class="ss" x="480" y="214" text-anchor="middle">{t["state_sub"]}</text>')

    # What the state decides
    modules = [(t['mock'], t['mock_sub'], 'mock', BLUE), (t['net'], t['net_sub'], 'net', VIOLET),
               (t['clock'], t['clock_sub'], 'clock', ORANGE)]
    for i, (name, sub, kind, color) in enumerate(modules):
        x = 250 + i * 160
        p.append(arrow(f'M{x + 70} 230 L{x + 70} 266'))
        p.append(card(x, 268, 140, 104, '', None, None))
        p.append(icon(kind, x + 56, 282, color))
        p.append(f'<text class="t" x="{x + 70}" y="336" text-anchor="middle">{name}</text>')
        p.append(f'<text class="s" x="{x + 70}" y="354" text-anchor="middle">{sub}</text>')

    # The app
    p.append('<rect x="16" y="218" width="150" height="104" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.2"/>')
    p.append('<path d="M16 246 L166 246" stroke="#e2e8f0" stroke-width="1.2"/>')
    for i, c in enumerate(['#f87171', '#fbbf24', '#34d399']):
        p.append(f'<circle cx="{32 + i * 12}" cy="232" r="4" fill="{c}"/>')
    p.append(f'<text class="t" x="91" y="280" text-anchor="middle">{t["client"]}</text>')
    p.append(f'<text class="s" x="91" y="299" text-anchor="middle">{t["client_sub"]}</text>')
    p.append(arrow('M166 256 L224 256'))
    p.append(label(196, 248, t['req']))
    p.append(arrow('M226 292 L168 292'))
    p.append(label(196, 310, t['res']))

    # Where requests end up
    p.append(arrow('M734 198 L794 198', dashed=True))
    p.append(label(764, 190, t['miss']))
    p.append(card(796, 166, 192, 64, t['server'], t['server_sub'], 'server', SLATE, dashed=True))
    p.append(arrow('M734 320 L794 320'))
    p.append(label(764, 312, t['hit']))
    p.append(card(796, 288, 192, 64, t['rec'], t['rec_sub'], 'records', BLUE))

    font = "-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo','Noto Sans KR',Helvetica,Arial,sans-serif"
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1004 460" width="1004" height="460" role="img" aria-label="cuesheet structure">
<style>
  text {{ font-family:{font}; }}
  .t {{ font-size:14px; font-weight:650; fill:#0f172a; }}
  .s {{ font-size:11.5px; fill:#64748b; }}
  .ts {{ font-size:16px; font-weight:700; fill:#ffffff; }}
  .ss {{ font-size:12px; fill:#dbeafe; }}
  .l {{ font-size:11px; font-weight:600; fill:#94a3b8; letter-spacing:0.4px; }}
  .brand {{ font-size:14px; font-weight:800; fill:{BLUE}; letter-spacing:-0.2px; }}
  .a {{ fill:none; stroke:#94a3b8; stroke-width:1.5; stroke-linecap:round; }}
  .d {{ stroke-dasharray:5 4; }}
</style>
<defs>
  <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient>
  <marker id="h" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9" fill="none" stroke="#94a3b8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker>
</defs>
{chr(10).join(p)}
</svg>
'''
    (HERE / f'structure{"" if lang == "en" else ".ko"}.svg').write_text(svg)

"""Save public programme documents locally; emit only safe, static HTML."""
import concurrent.futures
import hashlib
import html
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'UI/public/training-programmes'
ORIGIN = 'https://pgd.agu.edu.vn'
VOID = {'img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'wbr', 'embed'}
ALLOWED = {'p', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'blockquote', 'caption', 'article'}

def fetch(url):
    if urllib.parse.urlparse(url).netloc != 'pgd.agu.edu.vn':
        raise ValueError('Unexpected document host')
    with urllib.request.urlopen(url, timeout=45) as response:
        return response.read()

class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.active = False
        self.finished = False
        self.skip = 0
        self.parts = []
        self.assets = []

    def asset(self, value, kind):
        url = urllib.parse.urljoin(ORIGIN, value.strip())
        if urllib.parse.urlparse(url).netloc != 'pgd.agu.edu.vn':
            return
        ext = Path(urllib.parse.urlparse(url).path).suffix.lower()
        if ext not in {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf'}:
            return
        name = hashlib.sha256(url.encode()).hexdigest()[:24] + ext
        self.assets.append((url, name))
        if ext == '.pdf':
            self.parts.append(f'<object data="/training-programmes/{name}" type="application/pdf" width="100%" height="900"><p>Không hiển thị được PDF. <a href="/training-programmes/{name}">Mở tài liệu trong hệ thống</a></p></object>')
        elif kind == 'img':
            self.parts.append(f'<img src="/training-programmes/{name}" alt="Trang tài liệu chương trình đào tạo" loading="lazy">')

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if not self.active:
            if not self.finished and tag == 'div' and 'news-body' in attrs.get('class', '').split():
                self.active = True
                self.depth = 1
            return
        if tag not in VOID:
            self.depth += 1
        if tag in {'script', 'style'}:
            self.skip += 1
        if self.skip:
            return
        if tag == 'img':
            self.asset(attrs.get('src', ''), 'img')
        elif tag in {'iframe', 'embed', 'object', 'a'}:
            self.asset(attrs.get('src') or attrs.get('data') or attrs.get('href', ''), 'file')
        elif tag in ALLOWED:
            safe = ''.join(f' {key}="{value}"' for key, value in attrs.items() if key in {'colspan', 'rowspan'} and re.fullmatch(r'[1-9]\d{0,2}', value or ''))
            self.parts.append(f'<{tag}{safe}>')

    def handle_endtag(self, tag):
        if not self.active or tag in VOID:
            return
        if tag in {'script', 'style'}:
            self.skip = max(0, self.skip - 1)
        elif not self.skip and tag in ALLOWED:
            self.parts.append(f'</{tag}>')
        self.depth -= 1
        if self.depth == 0:
            self.active = False
            self.finished = True

    def handle_data(self, data):
        if self.active and not self.skip:
            self.parts.append(html.escape(re.sub(r'\s+', ' ', data)))

def save(programme):
    number = programme['url'].rsplit('/', 1)[1]
    parser = Document()
    parser.feed(fetch(programme['url']).decode('utf8'))
    if not parser.finished or not parser.parts:
        raise ValueError(f'Missing programme body: {number}')
    for url, name in set(parser.assets):
        target = DEST / name
        if not target.exists():
            target.write_bytes(fetch(url))
    title = html.escape(programme['name'])
    body = ''.join(parser.parts)
    css = 'body{font:16px/1.65 Arial,sans-serif;color:#173e57;margin:24px;overflow-wrap:anywhere}table{border-collapse:collapse;max-width:100%;margin:18px 0}td,th{border:1px solid #cbdad8;padding:8px;min-width:40px}th{background:#e8f2ed}img{display:block;max-width:100%;height:auto;margin:12px auto}h1,h2,h3{line-height:1.4}p{margin:10px 0}object{display:block;border:0}'
    document = f'<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\'; style-src \'unsafe-inline\'; object-src \'self\'; base-uri \'none\'; form-action \'none\'"><title>{title}</title><style>{css}</style></head><body>{body}</body></html>'
    (DEST / f'{number}.html').write_text(document, encoding='utf8')
    pdfs = [name for _, name in parser.assets if name.endswith('.pdf')]
    available = bool(pdfs or re.sub(r'<[^>]*>|\s|&nbsp;', '', body))
    return number, {'available': available, 'path': f'/training-programmes/{pdfs[0] if pdfs else number + ".html"}', 'format': 'pdf' if pdfs else 'html'}

if __name__ == '__main__':
    DEST.mkdir(parents=True, exist_ok=True)
    catalog = json.loads((ROOT / 'UI/data/agu_training_programmes.json').read_text(encoding='utf8'))
    programmes = [p for m in catalog['majors'] for p in m['programmes']]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        manifest = dict(pool.map(save, programmes))
    (ROOT / 'UI/data/agu_programme_documents.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
    print(f'{sum(item["available"] for item in manifest.values())}/{len(manifest)} documents available')

import os
import sys
import re
import json
import socket
import datetime
import threading
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from flask import Flask, request, jsonify, send_from_directory
from werkzeug.serving import make_server

app = Flask(__name__)
PORT = 3000
HTTPS_PORT = 3443
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / 'static'
CERT_DIR = BASE_DIR / 'cert'
def _load_dotenv(path: Path) -> None:
    # 依存なしの簡易 .env 読み込み（既存の環境変数は上書きしない）
    if not path.is_file():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv(BASE_DIR / '.env')
# ノートの保存先。Obsidian Vault 内のフォルダなどを環境変数で指定できる。
DATA_DIR = Path(os.environ.get('OUTPUT_FORCE_DATA_DIR') or BASE_DIR / 'data').expanduser()

DATA_DIR.mkdir(parents=True, exist_ok=True)

TASK_LABELS = {
    'recall':  '🧠 フリーリコール',
    'summary': '📝 3文要約',
    'apply':   '🔧 実用例',
    'teach':   '🗣️ 初心者への説明',
}
CAT_LABELS = {
    'tech': '💻 技術', 'biz': '💼 ビジネス', 'sci': '🔬 サイエンス',
    'lang': '🌐 語学', 'other': '📚 その他',
}
STATUS_LABELS = {
    'pending': '⏳ 待機中', 'in_progress': '🔄 進行中', 'done': '✅ 完了',
}


# ── API ─────────────────────────────────────

@app.route('/api/info')
def api_info():
    return jsonify({'ip': get_local_ip(), 'port': PORT, 'httpsPort': HTTPS_PORT})


@app.route('/api/entries')
def api_entries():
    try:
        return jsonify({'items': read_all()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/entry', methods=['POST'])
def api_entry_post():
    try:
        save_item(request.get_json(force=True))
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/entries', methods=['POST'])
def api_entries_post():
    try:
        data = request.get_json(force=True)
        items = data.get('items')
        if not isinstance(items, list):
            raise ValueError('items must be an array')
        for item in items:
            save_item(item)
        return jsonify({'ok': True, 'count': len(items)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/entry/<item_id>', methods=['DELETE'])
def api_entry_delete(item_id):
    try:
        delete_item(item_id)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Static files ─────────────────────────────

@app.route('/')
def index():
    return send_from_directory(str(STATIC_DIR), 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    # static/ 配下のみ配信（cert/ や server.py は公開しない）
    return send_from_directory(str(STATIC_DIR), filename)


# ── Markdown helpers ─────────────────────────

def safe_filename(s: str) -> str:
    s = re.sub(r'[\\/:*?"<>|\r\n]', '', s)
    s = re.sub(r'\s+', '-', s)
    return s[:40]


def item_path(item: dict) -> Path:
    date = (item.get('created') or '')[:10]
    return DATA_DIR / f"{date}_{safe_filename(item.get('title', ''))}_{item['id']}.md"


def item_to_md(item: dict) -> str:
    created = item.get('created', '')
    try:
        dt = datetime.datetime.fromisoformat(created.replace('Z', '+00:00'))
        dt_local = dt.astimezone()
        dt_str = (f'{dt_local.year}年{dt_local.month}月{dt_local.day}日 '
                  f'{dt_local.hour:02d}:{dt_local.minute:02d}')
    except Exception:
        dt_str = created

    cat = item.get('cat', 'other')
    status = item.get('status', 'pending')

    lines = [
        '---',
        f'id: "{item["id"]}"',
        f'title: {json.dumps(item.get("title", ""), ensure_ascii=False)}',
        f'category: "{cat}"',
        f'status: "{status}"',
        f'created: "{created}"',
        '---',
        '',
        f'# {item.get("title", "")}',
        '',
        f'**カテゴリ:** {CAT_LABELS.get(cat, cat)}  ',
        f'**記録日時:** {dt_str}  ',
        f'**ステータス:** {STATUS_LABELS.get(status, status)}  ',
        '',
    ]

    notes = item.get('notes')
    if notes:
        lines += ['---', '', '## メモ', '', notes, '']

    for key in ['recall', 'summary', 'apply', 'teach']:
        outputs = item.get('outputs') or {}
        out = outputs.get(key)
        if out:
            lines += ['---', '', f'## {TASK_LABELS[key]}', '', out.get('text', ''), '']

    return '\n'.join(lines).rstrip() + '\n'


def md_to_item(content: str) -> dict | None:
    fm_match = re.match(r'^---\n([\s\S]*?)\n---\n', content)
    if not fm_match:
        return None

    fm: dict[str, str] = {}
    for line in fm_match.group(1).split('\n'):
        idx = line.find(': ')
        if idx == -1:
            continue
        fm[line[:idx].strip()] = line[idx + 2:].strip().strip('"')

    if not fm.get('id'):
        return None

    item: dict = {
        'id':      fm['id'],
        'title':   fm.get('title', ''),
        'cat':     fm.get('category', 'other'),
        'status':  fm.get('status', 'pending'),
        'created': fm.get('created', ''),
        'notes':   '',
        'outputs': {},
    }

    body = content[fm_match.end():]
    task_map = {
        'フリーリコール': 'recall',
        '3文要約':        'summary',
        '実用例':         'apply',
        '初心者への説明':  'teach',
    }

    for chunk in body.split('\n---\n\n## ')[1:]:
        nl = chunk.find('\n')
        heading = chunk[:nl].strip()
        text = re.sub(r'\n---\s*$', '', chunk[nl + 1:]).strip()

        if heading == 'メモ':
            item['notes'] = text
        else:
            for label, key in task_map.items():
                if label in heading:
                    item['outputs'][key] = {'text': text, 'at': item['created']}
                    break

    return item


# ── CRUD ─────────────────────────────────────

def save_item(item: dict) -> None:
    target = item_path(item)
    for f in DATA_DIR.glob(f'*_{item["id"]}.md'):
        if f != target:
            f.unlink()
    target.write_text(item_to_md(item), encoding='utf-8')


def read_all() -> list[dict]:
    items = []
    for f in DATA_DIR.glob('*.md'):
        try:
            item = md_to_item(f.read_text(encoding='utf-8'))
            if item:
                items.append(item)
        except Exception:
            pass
    items.sort(key=lambda x: x.get('created', ''), reverse=True)
    return items


def delete_item(item_id: str) -> None:
    for f in DATA_DIR.glob(f'*_{item_id}.md'):
        f.unlink()


# ── Network ──────────────────────────────────

def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return 'localhost'


# ── TLS cert ─────────────────────────────────

def load_or_create_cert() -> tuple[str, str]:
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    import ipaddress as ip_module

    key_path  = CERT_DIR / 'key.pem'
    cert_path = CERT_DIR / 'cert.pem'

    if key_path.exists() and cert_path.exists():
        return str(key_path), str(cert_path)

    CERT_DIR.mkdir(parents=True, exist_ok=True)
    local_ip = get_local_ip()

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'output-force.local')])
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
        .not_valid_after(
            datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=3650)
        )
        .add_extension(
            x509.SubjectAlternativeName([
                x509.IPAddress(ip_module.IPv4Address(local_ip)),
                x509.DNSName('localhost'),
            ]),
            critical=False,
        )
        .sign(private_key, hashes.SHA256())
    )

    key_path.write_bytes(private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    ))
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))

    return str(key_path), str(cert_path)


# ── Start ─────────────────────────────────────

if __name__ == '__main__':
    local_ip = get_local_ip()
    sep = '─' * 52

    print(f'\n┌{sep}┐')
    print(f'│  ⚡ Output Force  サーバー起動！{" " * 20}│')
    print(f'├{sep}┤')
    print(f'│  HTTP  (このPC) : http://localhost:{PORT}{" " * 16}│')
    print(f'└{sep}┘\n')

    def _run_https():
        try:
            key_path, cert_path = load_or_create_cert()
            https_srv = make_server('0.0.0.0', HTTPS_PORT, app,
                                    ssl_context=(cert_path, key_path))
            url = f'https://{local_ip}:{HTTPS_PORT}'
            pad = max(0, 50 - len(url))
            print(f'┌{sep}┐')
            print(f'│  🔒 HTTPS 起動（他デバイスはこちら）{" " * 15}│')
            print(f'├{sep}┤')
            print(f'│  {url}{" " * pad}│')
            print(f'│  ※ 初回アクセス時「安全でない」警告 → 詳細 → アクセス│')
            print(f'└{sep}┘\n')
            https_srv.serve_forever()
        except Exception as e:
            print(f'HTTPS サーバー起動失敗: {e}')

    threading.Thread(target=_run_https, daemon=True).start()

    http_srv = make_server('0.0.0.0', PORT, app)
    http_srv.serve_forever()

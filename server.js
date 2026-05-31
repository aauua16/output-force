'use strict';
const express    = require('express');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');
const https      = require('https');
const selfsigned = require('selfsigned');

const app        = express();
const PORT       = 3000;
const HTTPS_PORT = 3443;
const DATA_DIR   = path.join(os.homedir(), 'OneDrive', 'アプリ', 'remotely-save', 'wallfacer');
const CERT_DIR   = path.join(__dirname, 'cert');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// ── API ─────────────────────────────────────

app.get('/api/info', (req, res) => {
  res.json({ ip: getLocalIP(), port: PORT, httpsPort: HTTPS_PORT });
});

app.get('/api/entries', (req, res) => {
  try {
    res.json({ items: readAll() });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/entry', (req, res) => {
  try {
    saveItem(req.body);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Bulk save (migration from localStorage)
app.post('/api/entries', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) throw new Error('items must be an array');
    items.forEach(item => saveItem(item));
    res.json({ ok: true, count: items.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/entry/:id', (req, res) => {
  try {
    deleteItem(req.params.id);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Markdown helpers ─────────────────────────

const TASK_LABELS = {
  recall:  '🧠 フリーリコール',
  summary: '📝 3文要約',
  apply:   '🔧 実用例',
  teach:   '🗣️ 初心者への説明',
};

const CAT_LABELS = {
  tech: '💻 技術', biz: '💼 ビジネス', sci: '🔬 サイエンス',
  lang: '🌐 語学', other: '📚 その他',
};

const STATUS_LABELS = {
  pending: '⏳ 待機中', in_progress: '🔄 進行中', done: '✅ 完了',
};

// ── File path for an item ────────────────────

function safeFilename(str) {
  return str.replace(/[\\/:*?"<>|\r\n]/g, '').replace(/\s+/g, '-').substring(0, 40);
}

function itemPath(item) {
  const date = (item.created || '').slice(0, 10);
  return path.join(DATA_DIR, `${date}_${safeFilename(item.title)}_${item.id}.md`);
}

// ── Write item → Markdown ────────────────────

function itemToMd(item) {
  const dt = new Date(item.created).toLocaleString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const lines = [
    '---',
    `id: "${item.id}"`,
    `title: ${JSON.stringify(item.title)}`,
    `category: "${item.cat || 'other'}"`,
    `status: "${item.status}"`,
    `created: "${item.created}"`,
    '---',
    '',
    `# ${item.title}`,
    '',
    `**カテゴリ:** ${CAT_LABELS[item.cat] || item.cat}  `,
    `**記録日時:** ${dt}  `,
    `**ステータス:** ${STATUS_LABELS[item.status] || item.status}  `,
    '',
  ];

  if (item.notes) {
    lines.push('---', '', '## メモ', '', item.notes, '');
  }

  for (const key of ['recall', 'summary', 'apply', 'teach']) {
    const out = item.outputs && item.outputs[key];
    if (out) {
      lines.push('---', '', `## ${TASK_LABELS[key]}`, '', out.text, '');
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}

// ── Read Markdown → item ─────────────────────

function mdToItem(content) {
  // Parse YAML-like frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) return null;

  const fm = {};
  fmMatch[1].split('\n').forEach(line => {
    const idx = line.indexOf(': ');
    if (idx === -1) return;
    fm[line.slice(0, idx).trim()] = line.slice(idx + 2).trim().replace(/^"|"$/g, '');
  });

  if (!fm.id) return null;

  const item = {
    id:      fm.id,
    title:   fm.title || '',
    cat:     fm.category || 'other',
    status:  fm.status || 'pending',
    created: fm.created || '',
    notes:   '',
    outputs: {},
  };

  // Strip frontmatter block, then parse ## sections
  const body = content.slice(fmMatch[0].length);
  const taskMap = {
    'フリーリコール': 'recall',
    '3文要約':        'summary',
    '実用例':         'apply',
    '初心者への説明':  'teach',
  };

  const chunks = body.split(/\n---\n\n## /);
  for (const chunk of chunks.slice(1)) {
    const nl      = chunk.indexOf('\n');
    const heading = chunk.slice(0, nl).trim();
    const text    = chunk.slice(nl + 1).replace(/\n---\s*$/, '').trim();

    if (heading === 'メモ') {
      item.notes = text;
    } else {
      for (const [label, key] of Object.entries(taskMap)) {
        if (heading.includes(label)) {
          item.outputs[key] = { text, at: item.created };
          break;
        }
      }
    }
  }

  return item;
}

// ── CRUD ─────────────────────────────────────

function saveItem(item) {
  // Remove old file if title was renamed (same id, different name)
  const existing = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith(`_${item.id}.md`));
  existing.forEach(f => {
    const fp = path.join(DATA_DIR, f);
    if (fp !== itemPath(item)) fs.unlinkSync(fp);
  });
  fs.writeFileSync(itemPath(item), itemToMd(item), 'utf8');
}

function readAll() {
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      try { return mdToItem(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.created) - new Date(a.created));
}

function deleteItem(id) {
  fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith(`_${id}.md`))
    .forEach(f => fs.unlinkSync(path.join(DATA_DIR, f)));
}

// ── Network ──────────────────────────────────

function getLocalIP() {
  const candidates = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      candidates.push(iface.address);
    }
  }
  // 192.168.x.x (自宅LAN) を最優先、次に 172.x.x.x、最後に 10.x.x.x (VPN等)
  return candidates.find(ip => ip.startsWith('192.168.'))
      || candidates.find(ip => ip.startsWith('172.'))
      || candidates[0]
      || 'localhost';
}

// ── TLS cert (自己署名・初回自動生成) ────────────

async function loadOrCreateCert() {
  const keyPath  = path.join(CERT_DIR, 'key.pem');
  const certPath = path.join(CERT_DIR, 'cert.pem');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }
  if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });
  const ip   = getLocalIP();
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: 'output-force.local' }],
    {
      days: 3650,
      extensions: [{
        name: 'subjectAltName',
        altNames: [{ type: 'ip', value: ip }, { type: 'dns', value: 'localhost' }],
      }],
    }
  );
  fs.writeFileSync(keyPath,  pems.private);
  fs.writeFileSync(certPath, pems.cert);
  return { key: pems.private, cert: pems.cert };
}

// ── Start ─────────────────────────────────────

const localIP = getLocalIP();
const line    = '─'.repeat(52);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n┌${line}┐`);
  console.log(`│${'  ⚡ Output Force  サーバー起動！'.padEnd(52)}│`);
  console.log(`├${line}┤`);
  console.log(`│  HTTP  (このPC) : http://localhost:${PORT}${''.padEnd(52 - 32)}│`);
  console.log(`└${line}┘\n`);
});

(async () => {
  try {
    const cert = await loadOrCreateCert();
    https.createServer(cert, app).listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`┌${line}┐`);
      console.log(`│${'  🔒 HTTPS 起動（他デバイスはこちら）'.padEnd(52)}│`);
      console.log(`├${line}┤`);
      console.log(`│  https://${localIP}:${HTTPS_PORT}${''.padEnd(52 - 10 - localIP.length - String(HTTPS_PORT).length - 1)}│`);
      console.log(`│  ※ 初回アクセス時「安全でない」警告 → 詳細 → アクセス${''.padEnd(1)}│`);
      console.log(`└${line}┘\n`);
    });
  } catch (e) {
    console.warn('HTTPS サーバー起動失敗:', e.message);
  }
})();

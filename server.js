import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { verificar } from './verify.js';

// Carrega o arquivo .env (se existir)
try {
  process.loadEnvFile();
} catch {
  /* sem .env: usa as variáveis do ambiente */
}

const PORT = Number(process.env.PORT) || 3000;
const RATE_LIMIT = Number(process.env.RATE_LIMIT ?? 15); // verificações por IP a cada 10 min
const WINDOW_MS = 10 * 60 * 1000;

// Origens que podem chamar a API (necessário para o app exportado com Capacitor)
const ALLOWED_ORIGINS = new Set([
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
]);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '28mb' }));

// ---------- Cabeçalhos de segurança ----------
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  });
  next();
});

// ---------- CORS só para /api ----------
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------- Limite de uso por IP (protege o seu custo de API) ----------
const hits = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of hits) if (h.reset < now) hits.delete(ip);
}, 60_000).unref();

function limitar(req, res, next) {
  const now = Date.now();
  let h = hits.get(req.ip);
  if (!h || h.reset < now) {
    h = { n: 0, reset: now + WINDOW_MS };
    hits.set(req.ip, h);
  }
  h.n += 1;
  if (h.n > RATE_LIMIT) {
    res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
    return res
      .status(429)
      .json({ erro: 'Muitas verificações em pouco tempo. Aguarde alguns minutos e tente de novo.' });
  }
  next();
}

// ---------- Rotas ----------
app.get('/api/health', (req, res) => res.json({ ok: true, configurado: Boolean(process.env.ANTHROPIC_API_KEY) }));

app.post('/api/verify', limitar, async (req, res) => {
  const { status, corpo } = await verificar(req.body);
  res.status(status).json(corpo);
});

// ---------- Arquivos do app ----------
// fileURLToPath funciona em Windows, Mac e Linux (inclusive com espaços/acentos no caminho)
const PUBLIC_DIR = fileURLToPath(new URL('./public', import.meta.url));
if (!existsSync(join(PUBLIC_DIR, 'index.html'))) {
  console.error(`ERRO: não encontrei ${join(PUBLIC_DIR, 'index.html')}. Confira se a pasta "public" foi extraída junto com o projeto.`);
}
app.use(
  express.static(PUBLIC_DIR, {
    setHeaders(res, caminho) {
      if (caminho.endsWith('sw.js') || caminho.endsWith('.html')) res.set('Cache-Control', 'no-cache');
    },
  }),
);

// ---------- Erros ----------
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Os arquivos são grandes demais. Envie menos itens ou um vídeo mais curto.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'Pedido inválido.' });
  }
  console.error('Erro inesperado:', err.name);
  res.status(500).json({ erro: 'Algo deu errado. Tente de novo.' });
});

app.listen(PORT, () => {
  console.log(`Confere rodando em http://localhost:${PORT}  (modelo: ${process.env.CLAUDE_MODEL || 'claude-sonnet-5-5'})`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('Aviso: defina ANTHROPIC_API_KEY no .env para ativar as verificações.');
});

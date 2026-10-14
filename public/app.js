'use strict';

(() => {
  const API_BASE = (window.CONFERE_API_BASE || '').replace(/\/+$/, '');
  const MAX_QUADROS = 6;      // limite total de imagens/quadros enviados
  const QUADROS_POR_VIDEO = 3;
  const MAX_VIDEO_MB = 300;
  const MAX_LADO = 1568;      // px

  const $ = (s) => document.querySelector(s);
  const campo = $('#conteudo');
  const inputArquivo = $('#arquivo');
  const listaAnexos = $('#anexos');
  const btnVerificar = $('#btnVerificar');
  const telaEntrada = $('#entrada');
  const telaCarregando = $('#carregando');
  const telaResultado = $('#resultado');
  const msgErro = $('#erro');

  /** @type {{id:number, nome:string, video:boolean, preview:string, quadros:{media_type:string,data:string}[]}[]} */
  let anexos = [];
  let contador = 0;
  let timerMsg = null;

  // ---------- utilidades ----------
  function el(tag, attrs = {}, ...filhos) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos.flat()) {
      if (f != null && f !== false) n.append(f.nodeType ? f : document.createTextNode(String(f)));
    }
    return n;
  }

  function linkSeguro(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
    } catch {
      return null;
    }
  }

  function mostrarErro(msg) {
    msgErro.textContent = msg;
    msgErro.hidden = false;
  }
  function limparErro() {
    msgErro.hidden = true;
    msgErro.textContent = '';
  }

  function tela(nome) {
    telaEntrada.hidden = nome !== 'entrada';
    telaCarregando.hidden = nome !== 'carregando';
    telaResultado.hidden = nome !== 'resultado';
  }

  // ---------- letra grande ----------
  const btnLetra = $('#btnLetra');
  function aplicarLetra(grande) {
    document.documentElement.classList.toggle('letra-grande', grande);
    btnLetra.setAttribute('aria-pressed', String(grande));
    btnLetra.textContent = grande ? 'Letra normal' : 'Aumentar letra';
  }
  try { aplicarLetra(localStorage.getItem('letraGrande') === '1'); } catch { aplicarLetra(false); }
  btnLetra.addEventListener('click', () => {
    const novo = !document.documentElement.classList.contains('letra-grande');
    aplicarLetra(novo);
    try { localStorage.setItem('letraGrande', novo ? '1' : '0'); } catch { /* ignora */ }
  });

  // ---------- anexos: imagem e vídeo viram imagens pequenas (JPEG) ----------
  function desenhar(fonte) {
    const w = fonte.videoWidth || fonte.naturalWidth;
    const h = fonte.videoHeight || fonte.naturalHeight;
    if (!w || !h) throw new Error('dimensao');
    const escala = Math.min(1, MAX_LADO / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * escala));
    cv.height = Math.max(1, Math.round(h * escala));
    cv.getContext('2d').drawImage(fonte, 0, 0, cv.width, cv.height);
    const url = cv.toDataURL('image/jpeg', 0.85);
    return { media_type: 'image/jpeg', data: url.split(',')[1], preview: url };
  }

  function carregarImagem(arquivo) {
    return new Promise((ok, erro) => {
      const u = URL.createObjectURL(arquivo);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(u); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(u); erro(new Error('imagem')); };
      img.src = u;
    });
  }

  function esperar(alvo, evento, ms) {
    return new Promise((ok, erro) => {
      const t = setTimeout(() => erro(new Error('tempo')), ms);
      alvo.addEventListener(evento, () => { clearTimeout(t); ok(); }, { once: true });
      alvo.addEventListener('error', () => { clearTimeout(t); erro(new Error('video')); }, { once: true });
    });
  }

  async function quadrosDoVideo(arquivo) {
    const u = URL.createObjectURL(arquivo);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = u;
    try {
      await esperar(v, 'loadeddata', 20000);
      const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
      const pontos = dur < 1 ? [0] : [0.1, 0.5, 0.9].slice(0, QUADROS_POR_VIDEO).map((p) => p * dur);
      const quadros = [];
      for (const t of pontos) {
        if (dur > 0) {
          v.currentTime = Math.min(Math.max(t, 0.05), Math.max(dur - 0.05, 0.05));
          await esperar(v, 'seeked', 20000);
        }
        quadros.push(desenhar(v));
      }
      return quadros;
    } finally {
      URL.revokeObjectURL(u);
    }
  }

  async function adicionarArquivos(arquivos) {
    limparErro();
    for (const f of arquivos) {
      const video = f.type.startsWith('video/');
      const imagem = f.type.startsWith('image/');
      if (!video && !imagem) {
        mostrarErro('Esse tipo de arquivo não é aceito. Envie uma foto, um vídeo, um link ou um texto.');
        continue;
      }
      if (video && f.size > MAX_VIDEO_MB * 1048576) {
        mostrarErro(`Esse vídeo é muito grande (mais de ${MAX_VIDEO_MB} MB). Tente um mais curto.`);
        continue;
      }
      let quadros;
      try {
        quadros = video ? await quadrosDoVideo(f) : [desenhar(await carregarImagem(f))];
      } catch {
        mostrarErro('Não consegui abrir esse arquivo. Tente tirar um print da tela e enviar o print.');
        continue;
      }
      const total = anexos.reduce((s, a) => s + a.quadros.length, 0);
      if (total + quadros.length > MAX_QUADROS) {
        mostrarErro('Você já anexou o máximo possível. Remova algum arquivo para adicionar outro.');
        continue;
      }
      anexos.push({
        id: ++contador,
        nome: f.name || (video ? 'vídeo' : 'imagem'),
        video,
        preview: quadros[0].preview,
        quadros: quadros.map(({ media_type, data }) => ({ media_type, data })),
      });
    }
    renderAnexos();
  }

  function renderAnexos() {
    listaAnexos.replaceChildren(
      ...anexos.map((a) =>
        el('li', {},
          el('img', { src: a.preview, alt: '' }),
          el('span', { class: 'nome' }, a.nome, el('span', { class: 'tipo', text: a.video ? 'Vídeo' : 'Foto' })),
          el('button', {
            type: 'button',
            'aria-label': `Remover ${a.nome}`,
            text: 'Tirar',
            onclick: () => { anexos = anexos.filter((x) => x.id !== a.id); renderAnexos(); },
          }),
        ),
      ),
    );
  }

  // ---------- entrada ----------
  $('#btnAnexar').addEventListener('click', () => inputArquivo.click());
  inputArquivo.addEventListener('change', async () => {
    const lista = [...inputArquivo.files];
    inputArquivo.value = '';
    if (lista.length) await adicionarArquivos(lista);
  });

  $('#btnColar').addEventListener('click', async () => {
    limparErro();
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (!t) return mostrarErro('Não há nada copiado ainda. Copie um link ou texto e toque em Colar.');
      campo.value = t.slice(0, 8000);
    } catch {
      mostrarErro('Não consegui colar sozinho. Toque e segure dentro do campo e escolha "Colar".');
    }
    campo.focus();
  });

  // Receber conteúdo pelo "Compartilhar" de outros apps (PWA instalado)
  (function lerCompartilhamento() {
    const p = new URLSearchParams(location.search);
    const partes = [p.get('title'), p.get('text'), p.get('url')].filter(Boolean);
    const unicas = partes.filter((x, i) => !partes.slice(0, i).some((y) => y.includes(x)));
    if (unicas.length) campo.value = unicas.join('\n').slice(0, 8000);
    if (location.search) history.replaceState(null, '', location.pathname);
  })();

  // ---------- verificação ----------
  const MENSAGENS = [
    'Lendo o conteúdo…',
    'Procurando em fontes confiáveis…',
    'Comparando com os fatos…',
    'Quase pronto…',
  ];

  async function verificar() {
    limparErro();
    const texto = campo.value.trim();
    if (!texto && anexos.length === 0) {
      mostrarErro('Cole um link ou texto, ou anexe uma foto ou vídeo.');
      campo.focus();
      return;
    }

    btnVerificar.disabled = true;
    tela('carregando');
    let i = 0;
    $('#msgCarregando').textContent = MENSAGENS[0];
    timerMsg = setInterval(() => {
      i = Math.min(i + 1, MENSAGENS.length - 1);
      $('#msgCarregando').textContent = MENSAGENS[i];
    }, 6000);

    try {
      const resp = await fetch(`${API_BASE}/api/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: texto,
          images: anexos.flatMap((a) => a.quadros),
          fromVideo: anexos.some((a) => a.video),
        }),
        signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(130000) : undefined,
      });
      const dados = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(dados.erro || 'Não foi possível verificar agora. Tente de novo em instantes.');
      mostrarResultado(dados);
    } catch (e) {
      tela('entrada');
      if (e.name === 'TimeoutError') mostrarErro('A verificação demorou demais. Tente de novo.');
      else if (e instanceof TypeError) mostrarErro('Não consegui conectar. Confira sua internet e tente de novo.');
      else mostrarErro(e.message);
    } finally {
      clearInterval(timerMsg);
      btnVerificar.disabled = false;
    }
  }
  btnVerificar.addEventListener('click', verificar);

  // ---------- resultado ----------
  const VEREDITOS = {
    verdadeiro: { rotulo: 'Parece verdadeiro', icone: '✓', cls: 'ok' },
    enganoso: { rotulo: 'Enganoso ou fora de contexto', icone: '!', cls: 'aviso' },
    falso: { rotulo: 'Parece falso', icone: '✕', cls: 'ruim' },
    nao_encontrado: { rotulo: 'Não encontramos confirmação', icone: '?', cls: 'neutro' },
    opiniao: { rotulo: 'É uma opinião, não um fato', icone: '“', cls: 'neutro' },
  };
  const NIVEIS_IA = {
    baixa: { rotulo: 'Baixa chance de ter sido feito por IA', n: 1 },
    media: { rotulo: 'Chance média de ter sido feito por IA', n: 2 },
    alta: { rotulo: 'Alta chance de ter sido feito por IA', n: 3 },
    indeterminada: { rotulo: 'Não deu para saber se foi feito por IA', n: 0 },
  };

  function lista(itens) {
    return itens.length ? el('ul', {}, itens.map((t) => el('li', { text: t }))) : null;
  }

  function linkFonte(url, rotulo) {
    const href = linkSeguro(url);
    return href ? el('a', { href, target: '_blank', rel: 'noopener noreferrer', text: rotulo }) : null;
  }

  function mostrarResultado(d) {
    const r = d.resultado || {};
    const v = VEREDITOS[r.veredito] || VEREDITOS.nao_encontrado;
    const ia = NIVEIS_IA[r.ia?.nivel] || NIVEIS_IA.indeterminada;
    const fatos = Array.isArray(r.fatos) ? r.fatos : [];
    const fontes = (Array.isArray(d.fontes) ? d.fontes : []).filter((f) => linkSeguro(f?.url));
    const alertas = Array.isArray(r.alertas) ? r.alertas : [];
    const motivos = Array.isArray(r.ia?.motivos) ? r.ia.motivos : [];

    const notaIA = d.deVideo
      ? 'Para vídeos, olhamos alguns quadros da imagem. O som não foi analisado. Isto é uma estimativa, não uma prova.'
      : 'Isto é uma estimativa, não uma prova. Nenhuma ferramenta acerta sempre.';

    const titulo = el('h2', { id: 'tituloResultado', tabindex: '-1', text: v.rotulo });

    telaResultado.replaceChildren(
      el('div', { class: `veredito ${v.cls}` },
        el('span', { class: 'icone', 'aria-hidden': 'true' }, el('span', { text: v.icone })),
        el('div', {}, titulo, el('p', { text: r.explicacao || '' })),
      ),

      r.resumo ? el('p', { class: 'resumo' }, el('strong', { text: 'O conteúdo diz: ' }), r.resumo) : null,

      alertas.length
        ? el('section', { class: 'cartao alertas' }, el('h3', { text: 'Atenção' }), lista(alertas))
        : null,

      el('section', { class: 'cartao' },
        el('h3', { text: 'Foi feito por inteligência artificial?' }),
        el('div', { class: `medidor n${ia.n}`, role: 'img', 'aria-label': ia.rotulo }, el('span'), el('span'), el('span')),
        el('p', { class: 'nivel', text: ia.rotulo }),
        lista(motivos),
        el('p', { class: 'nota', text: notaIA }),
      ),

      fatos.length
        ? el('section', { class: 'cartao' },
            el('h3', { text: 'O que dizem os fatos' }),
            el('ul', {}, fatos.map((f) =>
              el('li', {}, f.texto, f.url ? [' ', linkFonte(f.url, '(ler fonte)')] : null),
            )),
          )
        : null,

      el('section', { class: 'cartao' },
        el('h3', { text: 'Fontes confiáveis' }),
        fontes.length
          ? el('ul', { class: 'fontes' }, fontes.map((f) =>
              el('li', {}, linkFonte(f.url, f.titulo || f.dominio || f.url), el('span', { class: 'dominio', text: f.dominio || '' })),
            ))
          : el('p', { text: 'Não encontramos reportagens ou checagens confiáveis sobre isso. Desconfie e não compartilhe antes de confirmar.' }),
      ),

      el('div', { class: 'acoes' },
        el('button', { type: 'button', class: 'cheio forte', id: 'btnCompartilhar', text: 'Compartilhar este resultado', onclick: () => compartilhar(r, fontes) }),
        el('button', { type: 'button', class: 'cheio', text: 'Verificar outra coisa', onclick: reiniciar }),
      ),
    );

    tela('resultado');
    titulo.focus();
    window.scrollTo({ top: 0 });
  }

  async function compartilhar(r, fontes) {
    const v = VEREDITOS[r.veredito] || VEREDITOS.nao_encontrado;
    const msg = [`Conferi no app Confere: ${v.rotulo}.`, r.explicacao, fontes[0] ? `Fonte: ${fontes[0].url}` : '']
      .filter(Boolean).join('\n');
    const btn = $('#btnCompartilhar');
    try {
      if (navigator.share) {
        await navigator.share({ text: msg });
      } else {
        await navigator.clipboard.writeText(msg);
        btn.textContent = 'Copiado!';
        setTimeout(() => { btn.textContent = 'Compartilhar este resultado'; }, 2500);
      }
    } catch { /* usuário cancelou */ }
  }

  function reiniciar() {
    campo.value = '';
    anexos = [];
    renderAnexos();
    limparErro();
    tela('entrada');
    window.scrollTo({ top: 0 });
    campo.focus();
  }

  // ---------- instalação offline (PWA) ----------
  if ('serviceWorker' in navigator && !window.Capacitor && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sem offline, tudo bem */ });
  }
})();

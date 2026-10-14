// Fontes consideradas confiáveis. A busca na web do app só enxerga estes domínios,
// e qualquer link mostrado ao usuário também passa por este filtro.
// Edite à vontade: mantenha uma mistura de órgãos oficiais, agências de checagem e imprensa variada.
export const TRUSTED_DOMAINS = [
  // Justiça Eleitoral e órgãos oficiais
  'tse.jus.br',
  'justicaeleitoral.jus.br',
  'stf.jus.br',
  'gov.br',
  'camara.leg.br',
  'senado.leg.br',

  // Agências de checagem
  'lupa.news',
  'aosfatos.org',
  'projetocomprova.com.br',
  'e-farsas.com',
  'boatos.org',
  'checamos.afp.com',

  // Imprensa
  'g1.globo.com',
  'oglobo.globo.com',
  'valor.globo.com',
  'folha.uol.com.br',
  'estadao.com.br',
  'agenciabrasil.ebc.com.br',
  'cnnbrasil.com.br',
  'poder360.com.br',
  'nexojornal.com.br',
  'correiobraziliense.com.br',
  'bbc.com',
  'reuters.com',
  'apnews.com',
];

export function hostnameOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function isTrusted(url) {
  const host = hostnameOf(url);
  if (!host) return false;
  return TRUSTED_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
}

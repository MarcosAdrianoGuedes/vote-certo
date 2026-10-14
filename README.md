# Confere

Site instalável (PWA) para conferir notícias e conteúdos suspeitos no período eleitoral. A pessoa cola um link ou texto, ou anexa foto/vídeo, toca em **Verificar agora** e recebe:

- um veredito (parece verdadeiro, enganoso, falso, sem confirmação ou opinião);
- a chance de o conteúdo ter sido feito por IA, com os motivos;
- os fatos, com links para fontes confiáveis (órgãos oficiais, agências de checagem e imprensa).

É uma tela só. Funciona no celular e no computador, e pode virar app Android/iOS.

## Como funciona

1. O site envia o conteúdo ao seu servidor (`/api/verify`).
2. O servidor pede ao Claude que leia o link (`web_fetch`), busque na web **somente nos domínios de `trusted.js`** (`web_search`) e avalie sinais de IA.
3. O servidor só mostra links que a busca realmente devolveu e que são de domínio confiável. Fonte inventada é descartada.
4. Fotos são reduzidas no aparelho. Em vídeos, 3 quadros são extraídos no aparelho e enviados como imagens (o som não é analisado).

## Rodar no seu computador

Precisa de Node 20.12 ou mais novo e de uma chave da API em https://console.anthropic.com (defina um limite de gasto mensal lá).

```bash
npm install
cp .env.example .env      # coloque sua ANTHROPIC_API_KEY
npm start                 # http://localhost:3000
npm test                  # testes da lógica de verificação
```

## Publicar (necessário para celular)

Qualquer hospedagem Node serve (Render, Railway, Fly.io, VPS). Há um `Dockerfile` pronto. Configure a variável `ANTHROPIC_API_KEY` no painel da hospedagem. Use HTTPS: é obrigatório para instalar como app e para o botão Compartilhar.

Depois de publicado, no celular: abra o site → "Adicionar à tela inicial". Instalado, o Confere aparece na lista de compartilhamento do Android (WhatsApp, navegador etc.), e o conteúdo chega já preenchido.

## Exportar como app de loja

**Caminho rápido (Android): PWABuilder.** Acesse pwabuilder.com, informe o endereço do seu site publicado e gere o pacote Android para a Google Play. Não precisa mexer no código.

**Android e iOS com Capacitor** (app que carrega os arquivos de `public/`):

1. Edite `public/config.js` e coloque o endereço do servidor: `window.CONFERE_API_BASE = 'https://confere.seudominio.com.br';`
2. Edite o `appId` em `capacitor.config.json`.
3. Rode:
   ```bash
   npm i -D @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
   npx cap add android && npx cap add ios
   npx cap sync
   npx cap open android   # ou: npx cap open ios
   ```
4. Gere o app no Android Studio (Android) ou no Xcode (iOS). iOS exige um Mac e conta de desenvolvedor Apple; Android exige conta de desenvolvedor Google Play.

O servidor já aceita chamadas vindas do app (`capacitor://localhost`, `https://localhost`).

## Limites que você deve conhecer (e deixar claros ao público)

- **Detecção de IA é estimativa, não prova.** Nenhuma ferramenta acerta sempre, principalmente com imagens. O app mostra "baixa/média/alta/indeterminada" e avisa isso na tela. Evite divulgar como "detector infalível".
- **Veredito de fato depende do que existe nas fontes.** Boato novo ainda sem checagem aparece como "Não encontramos confirmação", não como falso.
- **Vídeo:** só a imagem de alguns quadros é analisada, não o áudio.
- **Neutralidade:** a lista em `trusted.js` define o que é "confiável". Mantenha-a diversa e pública; é a parte mais sensível do projeto politicamente.
- **Custo:** cada verificação usa a API (busca na web + modelo). O servidor limita 15 verificações por pessoa a cada 10 minutos (`RATE_LIMIT`); mantenha também um limite de gasto no console da API.
- **Privacidade (LGPD):** o app não grava o conteúdo enviado nem faz log dele. O conteúdo é processado pela API da Anthropic; publique uma política de privacidade que diga isso, e confira as regras de retenção da sua conta.
- **Eleições:** se for divulgar durante a campanha, vale consultar as regras da Justiça Eleitoral sobre ferramentas e conteúdo eleitoral.

## Estrutura

```
server.js        servidor web (segurança, CORS, limite de uso, arquivos estáticos)
verify.js        lógica de verificação (prompt, API, filtro de fontes)
trusted.js       lista de fontes confiáveis (edite aqui)
public/          o app: index.html, styles.css, app.js, sw.js, manifest, ícones
test/            testes automáticos
```
"# vote-certo" 

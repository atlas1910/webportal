# ATLAS1910 - Portal Next.js

Esta é a raiz do portal Next.js. A versão estática anterior foi preservada em `legacy/`, com os scripts e dados-fonte necessários para manutenção. O projeto usa Next.js App Router, React e mantém o WebGIS Leaflet em páginas estáticas dentro de `public/`.

## Rotas preparadas

- `/`: homepage editorial com fundo cartográfico animado e atalhos temáticos.
- `/sccp-principal/`: mapa masculino atual, isolado dentro de um iframe e com suporte a parâmetros de camada/subgrupo.
- `/as-brabas/`: URL canônica da página feminina, servida internamente pelo HTML estático preservado.
- `/acervo/`: página textual indexável que explica o conteúdo e a organização do projeto.
- `/sitemap.xml` e `/robots.txt`: gerados pelas convenções do App Router.

Os atalhos de tema apontam para IDs de subgrupo usados pelo catálogo. O mapa masculino da migração apresenta o grupo **Estádios do Corinthians** para deixar sua camada histórica visível e controlável; links antigos para o subgrupo antes chamado `estadios-corinthians` continuam aceitos. A abertura inicial do mapa por `?subgrupo=` ou `?camada=` carrega o conteúdo solicitado conforme o comportamento existente. Links copiados pelo mapa continuam passando pela homepage, que os encaminha para a página correta; links de Brabas abertos dentro do caminho masculino também são encaminhados para `/as-brabas/`. O endereço antigo `/as-brabas.html` redireciona permanentemente para a URL canônica. Links masculinos antigos em `/camadas/:shareId` e links de camada das Brabas têm redirecionamentos de compatibilidade.

## Instalação e execução

Requer Node.js 20.9 ou superior. A geração de prévias lê as camadas do diretório `public/data` e os limites-mestre em `scripts/data/basemap`.
O domínio canônico padrão é `https://atlas1910.vercel.app`. Para usar outro domínio,
defina `SITE_URL` como uma origem HTTP(S) (sem caminho, query ou fragmento) no ambiente
de build e execução. Por exemplo, no PowerShell:

```powershell
$env:SITE_URL = "https://atlas1910.example"
```

```powershell
npm.cmd install
npm.cmd run dev
```

Abra `http://localhost:3000`. Para validar o build de produção:

```powershell
npm.cmd run build
npm.cmd start
```

Para conferir os arquivos Next.js antes do build, rode `npm.cmd run lint`.

## IndexNow

`public/3a7d675b80184d96f398faba3537eabf.txt` deve conter a mesma chave configurada em `.github/workflows/indexnow.yml`. A Action envia as URLs canônicas do sitemap ao Bing após um deploy Vercel com sucesso no ambiente `Production`; também pode ser executada manualmente em **Actions > Notify IndexNow**. O arquivo da chave é público por exigência do protocolo e não deve ser tratado como segredo. IndexNow acelera a descoberta em buscadores participantes, mas não garante indexação nem substitui o sitemap/Search Console do Google.

## Fundo e prévias de mapa

`scripts/sync-public-data.mjs` copia para `public/data` apenas os cinco conjuntos atualizados pelo sincronizador legado. `scripts/generate-map-previews.mjs` gera SVGs locais a partir de estádios, rotas, núcleos da Fiel, Libertadores feminina e fronteiras. `scripts/generate-country-boundaries.mjs` prepara limites compactos para cada mapa; as fontes-mestre ficam em `scripts/data/basemap`, fora da pasta pública. `predev` e `prebuild` executam essas etapas; as animações respeitam `prefers-reduced-motion`.

## Arquitetura do WebGIS preservado

`public/mapa/sccp-principal.html` e `public/as-brabas.html` são cópias dos documentos existentes. Scripts, CSS, imagens e GeoJSONs usados pelo catálogo estão em `public/js`, `public/css`, `public/assets` e `public/data`. Assim, caminhos absolutos antigos (`/js/...`, `/assets/...`, `/data/...`) continuam válidos sem editar os arquivos de origem.

As páginas masculina e feminina são carregadas separadamente do shell Next para preservar as funcionalidades Leaflet, filtros, estatísticas, consultas de feição e compartilhamento. A cópia estática antiga e as ferramentas de manutenção ficam em `legacy/`; apenas os arquivos necessários ao site são servidos de `public/`.

## Antes de publicar em produção

1. Instalar dependências e rodar `npm.cmd run lint` e `npm.cmd run build` na raiz.
2. Testar URLs de entrada, tópicos, todos os links de subgrupo, controles do mapa, histórico de partidas e a seção das Brabas em desktop/mobile.
3. Revisar canonical/sitemap/redirects com Search Console e preservar eventuais URLs externas.
4. Fazer deploy de Preview; comparar Core Web Vitals e confirmar que o mapa e as camadas carregam.
5. Promover a branch de migração para produção somente depois de validar a Preview.

## GitHub e Vercel

Use esta pasta como raiz do repositório. O `package-lock.json` deve acompanhar o `package.json` para instalações reproduzíveis. Na Vercel, selecione **Next.js** e deixe **Root Directory** vazio.

O workflow em `.github/workflows/update-meutimao.yml` executa `legacy/scripts/sync_meutimao.py` e publica os arquivos gerados em `public/data/`. Os scripts e dados antigos ficam organizados sob `legacy/`, sem serem servidos pelo Next.

O App Router gera a home, `robots.txt` e `sitemap.xml`; `next.config.ts` mantém os redirecionamentos. Não restaure os equivalentes estáticos da raiz antiga. Não envie `node_modules/`, `.next/`, `.vercel/`, `.env*` ou `.venv/`; o `.gitignore` já os exclui. Configure `SITE_URL` com a origem pública final e valide primeiro uma Preview.

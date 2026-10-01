# ATLAS1910 - Acervo Cartográfico do Corinthians

Geoportal analítico e histórico desenvolvido com **Leaflet.js**, mapas base gratuitos de alta disponibilidade, tipografia oficial **Inter** (Neo-Grotesque / Helvetica) e arquitetura temática responsiva para desktop e mobile.

---

## Como Executar

### Opção 1 (Recomendada): Via Servidor Local
Para evitar que o navegador restrinja o carregamento de arquivos GeoJSON locais via protocolo `file:///`:
1. Dê um duplo clique no arquivo `run_portal.bat`
2. O servidor iniciará em `http://localhost:8080` e abrirá automaticamente no seu navegador padrão.

*Ou, com o terminal aberto na pasta do projeto:*
```bash
python -m http.server 8080
```

Abra `http://localhost:8080` no navegador. Use um servidor local para que o navegador permita carregar os arquivos GeoJSON.

---

## Novas Funcionalidades e Layout

### 1. Barra Lateral Ampliada & Recolhível (Desktop)
- **Largura Expandida (480px)**: Proporciona leitura confortável para títulos longos de camadas, descrições e controle de opacidade.
- **Botão de Recolher**: Posicionado no cabeçalho da barra lateral para recolher o painel a qualquer momento.
- **Botão de Expandir (Camadas do Acervo)**: Posicionado na área do mapa para reabrir o painel em tela cheia com redimensionamento automático via `map.invalidateSize()`.

### 2. Otimização Responsiva para Dispositivos Móveis (Mobile)
- **Mapa em Tela Cheia (100vh)**: Ao carregar no celular, o mapa ocupa a totalidade da tela sem obstruções.
- **Gaveta Retrátil Compacta (*Bottom Drawer*)**: A barra lateral funciona como uma folha inferior moderna (`max-height: 44vh`) com alça de arraste visual e botão de fechar.
- **Botão Flutuante Inferior (`Camadas`)**: Permite abrir a lista de temáticas com um único toque.
- **Fechamento por Toque Fora**: Toque no mapa ou no fundo escurecido (*backdrop*) fecha o painel instantaneamente.

### 3. Mapas Base no Canto Superior Direito (Horizontal)
A seleção de mapa base agora fica em formato de barra em pílula flutuante no **canto superior direito do mapa**:
- **Escuro**: *Esri World Dark Gray Canvas* (modo noturno padrão)
- **Claro**: *Esri World Light Gray Canvas* (modo clássico)
- **Satélite**: *Esri World Imagery* (fotos aéreas de alta definição)
- **Ruas**: *OpenStreetMap* (vias, mobilidade e referências urbanas)
- **100% Gratuitos e Estáveis**: Todas as camadas dependentes de chaves de API externas (como CARTO) foram removidas para garantir disponibilidade contínua sem erros de validação.

### 4. Identidade Visual e Tipografia Exclusiva
- **Tipografia Inter**: Definida como fonte visual única em toda a plataforma (Neo-Grotesque no estilo Helvetica/Neue Haas Grotesk), garantindo clareza cartográfica e elegância editorial.
- **JetBrains Mono**: Utilizada exclusivamente para valores numéricos, porcentagens e contadores de feições.
- **Alternância de Tema**: Suporte instantâneo entre tema escuro e claro.
- **Controle flutuante de tema**: botão circular rotativo logo abaixo dos mapas base; na página das Brabas alterna entre roxo e branco.

---

## Estrutura de Arquivos

```
atlas1910_geoportal/
├── index.html            # Estrutura e marcação semântica do geoportal
├── run_portal.bat        # Inicializador rápido com servidor HTTP local
├── README.md             # Documentação do projeto
├── vercel.json           # Configuração de deploy contínuo na Vercel
├── assets/               # Imagens, brasões e logotipos (dark/light)
├── scripts/              # Sincronização, exportação e preparação de dados
├── css/
│   └── style.css         # Design system com Inter e responsividade avançada
├── js/
│   ├── app.js            # Inicialização do mapa, eventos, painel histórico e sidebar
│   ├── basemaps.js       # Gerenciador dos 4 mapas base e barra horizontal flutuante
│   └── camadas.js        # Catálogo temático, grupos e classificação Jenks
├── data/
│   ├── basemap/          # Fronteiras estáticas, fora da sincronização diária
│   └── ...               # Partidas e estatísticas atualizadas pelo sincronizador
└── archive/              # Referências e dados legados locais, ignorados pelo Git
```

## Grupos de estádios e estatísticas

Os menus masculino e feminino usam a mesma hierarquia compacta de estádios: os grupos **Estádios do Corinthians** (Campo do Lenheiro, Ponte Grande, Estádio Alfredo Schürig (Fazendinha), Pacaembu e Arena Corinthians) e **Outros Estádios** aparecem recolhidos inicialmente. Toda camada de localização e estatística do site usa diretamente as bases combinadas `estadios_estatisticas_unificadas.geojson` e `as_brabas_estadios_unificadas.geojson`; as camadas geográficas legadas não são requisitadas pelo navegador. Essas bases combinadas também alimentam o painel global “Números”, inclusive os registros sem geometria. O arquivo completo de partidas masculinas e o pacote de partidas das Brabas são carregados apenas quando a pessoa pede histórico ou aplica filtros por competição, não para desenhar o mapa ou abrir a página. Camadas ocultas não são pré-carregadas: cada GeoJSON só é baixado quando sua camada ou seu grupo/subgrupo é ativado. No mapa feminino, os estádios sem jogos das Brabas (Campo do Lenheiro e Ponte Grande) não são exibidos; o número de estádios mapeados considera nomes equivalentes uma única vez. **Outros Estádios** mantém as subcamadas **História** e **Estatística**, que podem ser ativadas simultaneamente; a camada **Estatísticas em cada Estádio**, com a base combinada, começa ativa em ambos os mapas. A legenda mostra separadamente as classes Jenks de cada camada estatística ativa. Escudos e círculos aparecem opacos por padrão; os controles de opacidade permitem ao usuário ajustar a transparência de cada camada. A camada Localizações abre uma ficha narrativa com referências à Wikipedia e ao arquivo de partidas do Meu Timão. O filtro de período/década foi removido; atualmente, as páginas masculina e feminina oferecem filtro de competição, sem filtro independente de mando.

Nas subcamadas História de **Estádios do Corinthians** e **Outros Estádios**, os escudos locais em `assets/icones/escudos-historicos/` são escolhidos pela data de estreia registrada no acervo, de forma igual nas páginas masculina e feminina. O ano de 1910 alterna entre `CP-1910.png` (tema claro) e `CP-1910-BRANCO.png` (tema escuro). Para 1916, janeiro a abril usa `1916-A.png`, maio a agosto usa `1916-B.png` e setembro a dezembro usa `1916-C.png`, que prevalece no período de sobreposição indicado; sem data completa, usa-se `1916 a 1919.png`. As demais versões são aplicadas conforme o intervalo/ano indicado no nome do arquivo; datas sem uma versão correspondente mantêm o ícone padrão. A troca de tema atualiza também os marcadores já exibidos.

### Legenda e filtros do mapa

A legenda permanece visível independentemente de os filtros estarem recolhidos. Seu cabeçalho recolhe e expande a gaveta como o controle **Filtros**; as camadas ativas continuam atualizando a legenda enquanto ela está recolhida. Os dois controles são independentes e estão disponíveis tanto no mapa principal quanto na página das Brabas.

### Deslocamentos - Campeonato Brasileiro 2026

Na seção principal do mapa masculino, o grupo **Deslocamentos** contém o subgrupo **Campeonato Brasileiro 2026**, com cada rota em sua própria camada GeoJSON, carregada somente quando ativada; as rotas começam desativadas e o subgrupo recolhido para reduzir requisições e renderização. Palmeiras e São Paulo não aparecem porque o regime de torcida única impede deslocamento de torcida visitante nesses clássicos; o Santos permanece conforme solicitado. O marco zero no Parque São Jorge é um marcador fixo, fora da lista de camadas, com o escudo do Corinthians em tamanho maior; ele aparece enquanto ao menos uma rota do subgrupo está ativa e some quando todas são desativadas. Cada destino usa a miniatura do clube mandante. As linhas são contínuas e têm espessura uniforme; para equipes com uniforme verde, a rota usa branco no tema escuro e preto no tema claro, em vez de verde. As demais rotas usam a cor do respectivo clube, e clubes com identidade preto-e-branca alternam entre branco e preto conforme o tema para manter contraste. As rotas com data de partida visitante confirmada na agenda consultada aparecem em ordem cronológica; rotas sem partida visitante correspondente ficam ao final, sem data atribuída.

### Torcidas - Fiel Pelo Mundo

O grupo **Torcidas** contém o subgrupo **Fiel Pelo Mundo**, com os 35 pontos do KMZ fornecido. A camada fica desativada inicialmente e só carrega o GeoJSON quando habilitada; cada ponto informa o núcleo e a região, além do Instagram quando existente. Os pontos usam os ícones locais que correspondem aos nomes dos núcleos; as imagens são reduzidas a 96 × 96 para limitar o tráfego e manter nitidez em telas de alta densidade. Para converter novamente a fonte KMZ e copiar os ícones correspondentes, execute `python scripts/prepare_fiel_pelo_mundo.py "D:\0-ATLAS DO POVO\1-FEED\00-FIEL PELO MUNDO\KMZ\Fiel Pelo Mundo - O Mapa.kmz" data/torcidas/fiel_pelo_mundo.geojson --icons-dir "D:\0-ATLAS DO POVO\1-FEED\00-FIEL PELO MUNDO"` e depois `powershell -ExecutionPolicy Bypass -File scripts/optimize_fiel_icons.ps1 -Directory assets/icones/torcidas`. O núcleo **Gaviões da Fiel USA - PDE MIAMI** permanece com o ícone genérico porque não há uma imagem com esse nome na pasta fonte.

### Competições - Libertadores Feminina 2026

Na página **As Brabas**, o grupo **COMPETIÇÕES** contém o subgrupo **Libertadores** e a camada **2026**, inicialmente desativada. Ela reúne os 16 estádios da fase de grupos (quatro por grupo), usa as geometrias Point em EPSG:4326 do GeoPackage fonte e mantém os atributos acentuados do CSV UTF-8 que o acompanha. Cada ponto usa um escudo local; o escudo atual do Corinthians (arquivo 2012 fornecido pelo usuário) aparece em tamanho maior que os demais. Ao selecionar o marcador, o mapa informa equipe, grupo, estádio e cidade/país. A camada só baixa o GeoJSON quando ativada.

Para regenerar `data/competicoes/libertadores-2026.geojson`, execute `python scripts/prepare_libertadores_2026.py "D:\0-ATLAS DO POVO\1-FEED\0-FUTEBOL FEMININO-BRABAS\0-LIBERTADORES-2026\FASE DE GRUPOS\BASE GIS\LIBERTADORES 2026.gpkg" "D:\0-ATLAS DO POVO\1-FEED\0-FUTEBOL FEMININO-BRABAS\0-LIBERTADORES-2026\FASE DE GRUPOS\BASE GIS\LIBERTADORES 2026 - EQUIPES.csv"`. O conversor valida a projeção, confere coordenadas e grupos entre as duas fontes e interrompe com erro se faltar algum escudo local. As fontes e observações de licença estão em `assets/icones/escudos-clubes/SOURCES.md`.

As rotas candidatas foram calculadas pelo perfil de carro do OSRM com dados do OpenStreetMap, sem trânsito em tempo real e sem perfil específico de ônibus. Distâncias e durações são estimativas do serviço, não uma recomendação de navegação. O painel e as legendas usam nomes compactos de camadas sem qualificadores de projeção; a legenda exibe apenas o símbolo e o título de cada camada ativa. Os links de cópia ficam nos cabeçalhos dos subgrupos, não nas linhas individuais; o link compartilhado abre as camadas daquele subgrupo. A camada **Países que o Corinthians já jogou** permanece no grupo **Estádios** e começa ativa. Links antigos do subgrupo de deslocamentos continuam válidos e abrem o novo subgrupo **Campeonato Brasileiro 2026**. Os arquivos convertidos e otimizados estão em `data/deslocamentos/brasileirao-2026/`; para reproduzi-los, execute `scripts/prepare_brasileirao_2026_routes.py` com a pasta fonte GIS disponível. Os dados originais não são modificados.

### Otimização de imagens e escudo atual

O escudo 2012 fornecido em `ESCUDOS PARA WEBGIS/2012.png` é servido localmente em `assets/icones/escudos-historicos/2012.png`: foi reduzido para 192 × 192 px para exibição em marcadores, preservando resolução suficiente para telas de alta densidade. O marco zero do Parque São Jorge e os marcadores atuais masculinos e femininos usam essa imagem; registros históricos de 2005 a 2011 continuam usando o escudo histórico correspondente e, de 2012 em diante, usam o atual. As imagens PNG do site foram regravadas com compressão sem perdas e os escudos usados em mapa foram reduzidos à resolução necessária; logos Open Graph ficaram em 1200 × 1200 px, o QR Code manteve sua dimensão original e o favicon passou a usar uma miniatura própria. Arquivos duplicados e PNGs sem referência no site foram removidos após a atualização dos caminhos.

Todos os mapas base impedem a repetição horizontal do mundo e limitam o arraste aos limites geográficos globais em Web Mercator. O zoom mínimo é calculado pelos limites projetados do mapa e reavaliado após redimensionamentos; o espaço fora dos tiles recebe uma cor de fundo correspondente ao basemap ativo para evitar bordas pretas. Os tiles recebem um desfoque sutil, que começa um pouco mais forte e diminui gradualmente ao trocar o mapa base; marcadores, escudos, controles e atribuições permanecem nítidos. Esse tratamento suaviza a leitura visual, mas não impede capturas de tela. O filtro de competição fica sobre o mapa imediatamente acima da legenda; em telas estreitas, controles, classes e seletores reduzem o espaçamento e a área pode rolar sem sobrepor os controles. Ao filtrar, as feições de estádios incompatíveis são ocultadas e deixam de responder a cliques, com aliases históricos consolidados. Listas de opções e campos acompanham as cores do tema. A legenda exibe somente um símbolo e o título de cada camada ativa, sem faixas de classificação ou textos auxiliares, e pode ser recolhida sem perder o estado das camadas. Os destaques masculinos usam a mesma paleta neutra; o acento visual feminino permanece roxo. O controle de tema fica acima do zoom, e a escala do mapa é posicionada logo abaixo do botão **Camadas**.

O grupo de países exibe os limites dos países onde cada equipe jogou: vermelho no mapa masculino e roxo no feminino. As fronteiras estão em `data/basemap/paises_limites_wof.geojson`, separadas dos dados regenerados diariamente; só são baixadas quando essa camada é ativada. A resolução detalhada preserva costas, ilhas e contornos com mais vértices; os atributos são reduzidos ao nome e ao código do país. A espessura das linhas acompanha a escala do mapa: aumenta discretamente no zoom out e diminui no zoom in. A legenda mostra somente o título da camada ativa. O conjunto Who's On First está sob a licença informada pela fonte e é preparado manualmente por `scripts/prepare_wof_basemap.py`. Na ficha de cada estádio das Brabas, **Histórico de partidas** lista placares, datas, competições e, quando disponível, o link para a ficha do Meu Timão.

## Navegação, acessibilidade e indexação

Os mapas mantêm o botão **Colabore** no alto à esquerda, equilibrado com a seleção de mapas base no alto à direita. Logo abaixo dos mapas base, os controles de zoom formam uma régua vertical sem moldura: botões compactos **+** e **−**, controle deslizante com limites mínimo/máximo e, ao lado, o alternador de tema circular rotativo. O botão **Camadas** ocupa o lugar do antigo controle de leitura e abre a gaveta de camadas em telas móveis ou reabre a barra lateral recolhida em desktop. As descrições e estatísticas das feições são abertas diretamente ao selecionar uma feição no mapa; a ficha pode ser fechada pelo botão próprio. A escala métrica fica logo abaixo de **Camadas**. Os botões **Legenda**, **Camadas** e **Colabore** compartilham o mesmo estilo de pílula, tipografia, altura, borda, cores do tema e transparência ao repouso; a legenda recolhida permanece compacta e expande pelo controle no próprio cabeçalho. Ambas as páginas incluem descrições e metadados Open Graph/Twitter, dados estruturados em JSON-LD, canonical, regras de indexação e entradas em `sitemap.xml`; os controles do mapa possuem rótulos acessíveis e um atalho de teclado permite saltar ao mapa.

## Atualização do acervo de partidas e estádios

O fluxo `scripts/sync_meutimao.py` compila os jogos masculinos (1910 até a temporada atual) a partir do [Meu Timão](https://www.meutimao.com.br/resultados-dos-jogos-do-corinthians/). A base feminina unificada usa Daniel Keppler de 1997 a 2015 e Meu Timão de 2016 até a temporada atual; os aliases de estádio são consolidados antes do recálculo dos agregados. O workflow do GitHub Actions executa a sincronização diariamente e também pode ser iniciado manualmente. Para reconstruir localmente apenas os arquivos femininos e preservar os dados masculinos, execute `python scripts/sync_meutimao.py --rebuild-feminino-only`.

O processo atualiza os arquivos de partidas, regenera as duas bases combinadas usadas pelo site e o pacote `data/as_brabas/brabas_bootstrap.json`, além de enriquecer as fontes GeoPackage. Os GeoJSONs legados continuam disponíveis para operações locais do QGIS, mas deixam de ser enviados como parte da atualização diária do site. Coordenadas são resolvidas prioritariamente a partir do acervo existente e de fontes públicas como OpenStreetMap, Wikipedia e Wikidata; quando só há referência de município, essa precisão aproximada é identificada no atributo correspondente. Partidas sem estádio identificado na fonte permanecem registradas como pendência, sem coordenadas inventadas.

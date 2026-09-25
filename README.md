# ATLAS1910 — Acervo Cartográfico do Corinthians

Geoportal analítico e histórico desenvolvido com **Leaflet.js**, mapas base gratuitos de alta disponibilidade, tipografia oficial **Montserrat** e arquitetura temática responsiva para desktop e mobile.

---

## 🚀 Como Executar

### Opção 1 (Recomendada): Via Servidor Local
Para evitar que o navegador restrinja o carregamento de arquivos GeoJSON locais via protocolo `file:///`:
1. Dê um duplo clique no arquivo `run_portal.bat`
2. O servidor iniciará em `http://localhost:8080` e abrirá automaticamente no seu navegador padrão.


### Opção 2: Abrir Diretamente
Abra o arquivo `index.html` em qualquer navegador web moderno (Google Chrome, Edge, Firefox, Brave, Safari).

---

## 🛠️ Novas Funcionalidades e Layout

### 1. Barra Lateral Ampliada & Recolhível (Desktop)
- **Largura Expandida (480px)**: Proporciona leitura confortável para títulos longos de camadas, descrições e controle de opacidade.
- **Botão de Recolher (`◀`)**: Posicionado no cabeçalho da barra lateral para recolher o painel a qualquer momento.
- **Botão de Expandir (`▶ Camadas do Acervo`)**: Posicionado estrategically na área do mapa para reabrir o painel em tela cheia com redimensionamento automático via `map.invalidateSize()`.

### 2. Otimização Responsiva para Dispositivos Móveis (Mobile)
- **Mapa em Tela Cheia (100vh)**: Ao carregar no celular, o mapa ocupa a totalidade da tela sem obstruções.
- **Gaveta Retrátil Compacta (*Bottom Drawer*)**: A barra lateral funciona como uma folha inferior moderna (`max-height: 44vh`) com alça de arraste visual e botão de fechar (`✕`).
- **Botão Flutuante Inferior (`☰ Camadas`)**: Permite abrir a lista de temáticas com um único toque.
- **Fechamento por Toque Fora**: Toque no mapa ou no fundo escurecido (*backdrop*) fecha o painel instantaneamente.

### 3. Mapas Base no Canto Superior Direito (Horizontal)
A seleção de mapa base agora fica em formato de barra em pílula flutuante no **canto superior direito do mapa**:
- 🌙 **Escuro**: *Esri World Dark Gray Canvas* (modo noturno padrão)
- ☀️ **Claro**: *Esri World Light Gray Canvas* (modo clássico)
- 🛰️ **Satélite**: *Esri World Imagery* (fotos aéreas de alta definição)
- 🗺️ **Ruas**: *OpenStreetMap* (vias, mobilidade e referências urbanas)
- **100% Gratuitos e Estáveis**: Todas as camadas dependentes de chaves de API externas (como CARTO) foram removidas para garantir disponibilidade contínua sem erros de validação.

### 4. Identidade Visual e Tipografia Exclusiva
- **Tipografia Montserrat**: Definida como fonte visual única em toda a plataforma, garantindo peso editorial clássico, clareza cartográfica e elegância.
- **JetBrains Mono**: Utilizada exclusivamente para valores numéricos, porcentagens e contadores de feições.
- **Alternância de Tema**: Suporte instantâneo entre Modo 🏴 (Bandeira Preta) e Modo 🏳️ (Bandeira Branca).

---

## 📂 Estrutura de Arquivos

```
atlas1910_geoportal/
├── index.html            # Estrutura e marcação semântica do geoportal
├── run_portal.bat        # Inicializador rápido com servidor HTTP local
├── README.md             # Documentação do projeto
├── vercel.json           # Configuração de deploy contínuo na Vercel
├── assets/               # Imagens, brasões e logotipos (dark/light)
├── css/
│   └── style.css         # Design system com Montserrat e responsividade avançada
├── js/
│   ├── app.js            # Inicialização do mapa, eventos, inspeção espacial e sidebar
│   ├── basemaps.js       # Gerenciador dos 4 mapas base e barra horizontal flutuante
│   └── camadas.js        # Catálogo temático (Torcida, Estádios, História)
└── data/                 # Acervo de arquivos GeoJSON exportados do QGIS
```

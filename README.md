# ATLAS1910 — Geoportal Analítico e Espacial

Geoportal temático e analítico moderno desenvolvido com **Leaflet.js**, suporte à chave de autenticação **CARTO**, mapas base de alta resolução e mecanismo avançado de **Upload e Categorização de Arquivos Espaciais** diretamente no navegador.

---

## 🚀 Como Executar

### Opção 1 (Recomendada): Via Servidor Local
Para evitar que o navegador bloqueie tiles ou restrinja o acesso a arquivos locais via `file:///`:
1. Dê um duplo clique no arquivo `run_portal.bat`
2. O servidor iniciará em `http://localhost:8080` e abrirá automaticamente no seu navegador padrão.

*Ou via terminal:*
```bash
cd scratch/atlas1910_geoportal
python -m http.server 8080
```

### Opção 2: Abrir Diretamente
Abra o arquivo `index.html` em qualquer navegador web moderno (Google Chrome, Edge, Firefox, Brave).

---

## 🛠️ Funcionalidades Principais

### 1. Mapas Base Sem Bloqueio
- **Esri Dark Gray Canvas**: Alternativa dark premium com estabilidade máxima, sem necessidade de autenticação e visual sofisticado em preto.
- **CARTO Dark Matter (Escuro)**: Camada escura oficial em alta resolução.
- **Esri Claro & CARTO Claro (Positron)**: Camadas limpas e claras para visualização no Modo Normal.
- **Satélite (World Imagery)**: Imagens de satélite de altíssima definição sem limites de requisição.
- **Ruas (OpenStreetMap)**: Mapa viário global.

### 2. Upload de Arquivos & Categorização Dinâmica
Clique no botão **"+ Importar Camada"** ou arraste arquivos para a tela:
- **Formatos Aceitos**:
  - `GeoJSON` (`.geojson`, `.json`)
  - `Shapefile compactado em ZIP` (`.zip` contendo `.shp`, `.dbf`, `.prj`)
  - `KML` (`.kml`)
  - `CSV com coordenadas` (`.csv` com colunas como `lat,lon` ou `latitude,longitude`)
- **Categorização**:
  - Vincule o arquivo a uma temática existente (*Torcida Organizada*, *Malha Ferroviária*, *Estádios*) ou crie uma **Nova Temática** na hora (+ cor personalizada).
  - Defina estilos específicos para os marcadores (círculos, losangos/diamantes, anéis ocos).
  - Zoom automático imediato para a extensão dos dados importados.

### 3. Persistência e Exportação do Projeto
- **Persistência IndexedDB**: As camadas importadas e temas criados ficam salvos no navegador, sobrevivendo ao recarregamento de página (F5).
- **Exportar Backup**: Botão **"💾 Exportar"** gera um arquivo JSON consolidado com todas as camadas e feições geográficas para você não perder seus dados.

### 4. Personalização de Fontes e Visual
Clique no ícone de engrenagem **⚙️** no canto superior direito da barra lateral:
- Alterne entre tipografias completas em tempo real:
  - **Syne** (Editorial, imponente, padrão do ATLAS1910)
  - **Space Grotesk** (Técnica e cartográfica moderna)
  - **Montserrat** (Geométrica e marcante)
  - **Inter** (Minimalista e legível)
- Edite ou atualize a chave de API CARTO a qualquer momento.

---

## 📂 Estrutura de Arquivos

```
atlas1910_geoportal/
├── index.html            # Estrutura da aplicação web
├── run_portal.bat        # Atalho de execução rápida no Windows
├── README.md             # Instruções e documentação
├── css/
│   └── style.css         # Design system dark mode, fontes e componentes
├── js/
│   ├── basemaps.js       # Provedores de mapa base e autenticação CARTO
│   ├── storage.js        # Persistência local com IndexedDB
│   ├── uploader.js       # Parsers de GeoJSON, Shapefile ZIP, KML e CSV
│   └── app.js            # Orquestração do Leaflet, UI e Ficha de Atributos
└── data/
    └── exemplo_pontos_interesse.csv # Arquivo de teste para upload
```

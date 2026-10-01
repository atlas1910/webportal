# Guia Prático: Como Adicionar Novas Camadas do QGIS no ATLAS1910

## Bases consolidadas para QGIS offline

Use estes arquivos para analisar e editar as estatísticas de estádios. Eles são independentes por seção, mas compartilham o mesmo schema de atributos e usam `EPSG:4326`:

- [Estatísticas masculinas consolidadas](data/estadios/estadios_estatisticas_unificadas.geojson)
- [Estatísticas das Brabas consolidadas](data/as_brabas/as_brabas_estadios_unificadas.geojson)
- [Partidas masculinas, uma por linha](data/partidas/corinthians_masculino.geojson)
- [Partidas das Brabas, uma por linha](data/as_brabas/as_brabas_jogos.geojson)

Os dois primeiros arquivos mantêm uma única feição por coordenada. Estádios distintos no mesmo ponto ficam descritos em `ESTADIOS_AGRUPADOS`; `NUM_ESTADIOS_NO_PONTO` conta as identidades e `NUM_ESTADIOS_COM_JOGOS_NO_PONTO` conta quantas têm jogos, nunca quantas geometrias existem. Partidas cujo local segue como `Desconhecido` ou `Indefinido` permanecem na tabela com `geometry: null` e `TIPO_REGISTRO = SEM_GEOMETRIA`; o site não as desenha no mapa.

O schema comum inclui datas da primeira e da última partida, totais de jogos, vitórias, empates, derrotas, pontos, aproveitamento, gols pró/contra, saldo, médias, origem dos registros e precisão/fonte das coordenadas. `NOME_ATUAL`, `NOME_ANTIGO_1` e `NOME_ANTIGO_2` preservam a cronologia dos nomes; por exemplo, Nubank Parque, Allianz Parque e Parque Antarctica.

Os arquivos locais não contêm assistência nem autoria de gols. Por isso `ASSISTENCIAS` fica nulo e `ASSISTENCIAS_DISPONIVEIS` fica falso, em vez de inferir um valor. A coluna `ESTADIOS_AGRUPADOS` é texto JSON para manter seus detalhes acessíveis sem criar tipos complexos na tabela do QGIS.

Para regenerar as bases consolidadas a partir dos arquivos locais, execute `python scripts/sync_meutimao.py --rebuild-map-ready-stadium-layers-only`. Isso não apaga nem substitui os arquivos usados pelo QGIS.

Sempre que você estiver mapeando ou editando no QGIS e quiser publicar uma nova camada no site, o processo é dividido em 3 passos rápidos:

---

## As 3 Categorias Oficiais do Portal:
1. **Torcida** - Pasta correspondente: `data/torcida/`
2. **Estádios** - Pasta correspondente: `data/estadios/`
3. **História** - Pasta correspondente: `data/historia/`

---

## Passo 1: Exportar do QGIS para GeoJSON

1. No **QGIS**, clique com o botão direito sobre a camada que você terminou de editar.
2. Vá em **Exportar** - **Salvar Feições Como...**
3. Configure os 4 campos essenciais:
   - **Formato**: Selecione `GeoJSON`
   - **Nome do Arquivo**: Clique em `...` e salve na pasta da categoria correspondente dentro do projeto:
     - Exemplo para Torcida: `atlas1910_geoportal/data/torcida/gavioes.geojson`
     - Exemplo para Estádios: `atlas1910_geoportal/data/estadios/fazendinha.geojson`
     - Exemplo para História: `atlas1910_geoportal/data/historia/invasao1976.geojson`
   - **SRC (Sistema de Referência de Coordenadas)**:
     **Selecione `EPSG:4326 - WGS 84`** *(Obrigatório para mapas web como o Leaflet posicionarem a camada exatamente sobre as ruas de São Paulo)*.
   - **Codificação**: `UTF-8`
4. Clique em **OK**.

---

## Passo 2: Cadastrar a Camada no `js/camadas.js`

1. Abra o arquivo [`js/camadas.js`](file:///C:/Users/Felipe/.gemini/antigravity/scratch/atlas1910_geoportal/js/camadas.js) em qualquer editor de texto (Bloco de Notas, VS Code, etc.).
2. Encontre a categoria desejada (`Torcida`, `Estádios` ou `História`).
3. Adicione uma vírgula após a última camada e cole o bloco da nova camada:

```javascript
      ,
      {
        id: "gavioes_sedes",
        nome: "Gaviões da Fiel - Sedes & Subsedes",
        arquivo: "data/torcida/gavioes.geojson",
        tipo: "ponto",       // 'ponto', 'linha' ou 'poligono'
        forma: "circulo",    // 'circulo', 'diamante' ou 'anel' (apenas se for ponto)
        cor: "#ffffff",      // Cor do marcador ou linha
        ativa: true,         // true para começar ligada no mapa
        opacidade: 1.0       // De 0.1 a 1.0
      }
```
4. Salve o arquivo (`Ctrl + S`).

---

## Passo 3: Subir para o GitHub (Para atualizar na Vercel)

1. Acesse o seu repositório no [GitHub](https://github.com/).
2. Clique no botão **"Add file"** - **"Upload files"**.
3. Arraste para a tela:
   - O arquivo `.geojson` novo que você exportou.
   - O arquivo `js/camadas.js` atualizado.
4. Clique no botão verde **"Commit changes"** na parte inferior.
5. **Pronto!** Em cerca de 20 segundos, a Vercel atualiza o site `https://atlas1910.vercel.app/` automaticamente e sua nova camada já estará visível para todo mundo!

---

## Dica: Como Usar Imagens / Ícones Personalizados nos Pontos

Você tem duas formas fáceis de fazer isso:

### Método A: Ícone igual para toda a camada (Ex: brasão em todas as sedes)
1. Salve sua imagem (PNG, SVG ou WebP) na pasta `assets/icones/` do projeto (ex: `assets/icones/camisa12.png`).
2. No [`js/camadas.js`](file:///C:/Users/Felipe/.gemini/antigravity/scratch/atlas1910_geoportal/js/camadas.js), adicione a propriedade `icone`:
```javascript
{
  id: "camisa12_sedes",
  nome: "Camisa 12 - Sedes",
  arquivo: "data/torcida/camisa12_subsedes.geojson",
  tipo: "ponto",
  icone: "assets/icones/camisa12.png", // Sua imagem personalizada!
  tamanhoIcone: [30, 30],              // Largura e altura em pixels
  ativa: true
}
```

### Método B: Cada ponto com sua própria imagem (Direto do QGIS)
1. No **QGIS**, abra a tabela de atributos da camada e crie um novo campo de texto chamado `icone`.
2. Em cada linha, digite o caminho da imagem correspondente (ex: `assets/icones/estadio_itaquera.png`, `assets/icones/pacaembu.png`).
3. Ao exportar para GeoJSON, o mapa detectará automaticamente o atributo `icone` e colocará a imagem certa em cada ponto!

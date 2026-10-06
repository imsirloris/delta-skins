# Delta Skin Generator

Web app para gerar skins do emulador [Delta](https://faq.deltaemulator.com) (`.deltaskin`) com as medidas exatas de um iPhone específico.

Segue a spec de <https://noah978.gitbook.io/delta-docs/skins> e os exemplos de filtros de <https://noah978.gitbook.io/delta-docs/skins/filter-examples>. Resoluções dos iPhones vêm de <https://iosref.com/res>.

## Como usar

1. Abra `index.html` no navegador (funciona direto via `file://`, sem build nem servidor; as libs ficam em `vendor/`).
2. Escolha o **iPhone** e o **console** (GBC, GBA, NES, SNES, N64, DS, Genesis). Um layout padrão é gerado para retrato e paisagem.
   - **Regenerar layout** cria o layout padrão, com todos os botões na tela.
   - **FlipPad layout** é para o controle FlipPad, que cobre a parte de baixo da tela em retrato. Retrato fica só com a tela do jogo e os botões do Delta, no estilo da skin GBA `ekwipt_graphite`: rótulos MENU, SAVE, LOAD e FFW espaçados, logo acima da área coberta (que começa em 550pt no iPhone 17 Pro). A tela do jogo fica centralizada entre a safe area de cima e os botões. No DS, as duas telas ocupam todo o espaço. Nos outros iPhones, tudo é escalado pela largura. O editor mostra hachurada a área coberta pelo controle. Paisagem usa o layout padrão. Trocar iPhone ou console mantém o tipo de layout escolhido.
   - **Importar .deltaskin** usa uma skin existente como base. As telas, os botões e os filtros são convertidos para os pontos do iPhone escolhido, e a arte original (PNG, ou a imagem de dentro do PDF) vira o fundo. Trocar o iPhone reconverte a skin. A arte já tem os botões desenhados, então mover elementos no editor não move o desenho. Orientações que a skin não tem recebem o layout padrão. Skins com arte vetorial em PDF não são suportadas.
3. Ajuste no canvas: arraste para mover, use a alça no canto para redimensionar e as setas para mover 1pt (Shift move 10pt). As telas mantêm a proporção do `inputFrame`; segure Shift para ignorar a proporção.
4. Edite inputs, `extendedEdges` e filtros CoreImage das telas no painel da direita.
   - **Guias**: ao arrastar, o elemento gruda nas bordas e nos centros dos outros elementos e no centro da skin. Linhas rosa mostram o alinhamento. Segure **Alt** para mover livre.
   - **Grid**: mostra uma grade (padrão 8pt). Com **Snap no grid**, a posição arredonda para a grade quando nenhuma guia casar.
   - **Vários elementos**: use Shift/Ctrl+clique (no canvas ou na lista) ou arraste no vazio para selecionar vários. Ctrl+A seleciona todos os botões. Arrastar move o grupo inteiro. O painel oferece alinhar (esquerda, centro, direita, topo, meio, base), distribuir na horizontal ou vertical (3 ou mais elementos) e igualar largura ou altura.
   - **Desfazer/Refazer**: use os botões no topo, Ctrl+Z e Ctrl+Shift+Z (ou Ctrl+Y). Vale para posições, alinhamentos, troca de console/iPhone e edições do painel. As imagens de fundo enviadas não entram no histórico.
5. Use a arte gerada (cores configuráveis) ou envie sua própria imagem para cada orientação.
6. Clique em **Exportar .deltaskin** e mande o arquivo para o iPhone (Arquivos ou AirDrop). Abra no Delta para importar.

Ative **debug** para o Delta desenhar as áreas de toque em vermelho e conferir o mapeamento no aparelho.

## Como as medidas funcionam

- `mappingSize` = resolução lógica do aparelho em pontos (ex.: iPhone 17 Pro = 402×874; em paisagem fica 874×402). Todos os frames estão nesse sistema de coordenadas, então o mapeamento é 1:1 no aparelho escolhido. Em outros aparelhos, o Delta escala a skin.
- As imagens são renderizadas na resolução física (pontos × escala, ex.: 1206×2622 px).
  - **PDF**: asset `resizable`, com a página em pontos.
  - **PNG**: o mesmo arquivo serve como `small`, `medium` e `large`.
- iPhones com notch ou Dynamic Island usam a representação `edgeToEdge`, e iPhones com botão home usam `standard`. A skin só aparece no Delta para aparelhos da mesma família.
- A área das telas fica transparente na imagem exportada.
- As safe areas (notch e indicador de home) são aproximadas e só servem para o layout automático. Dá para editá-las na barra lateral.

## Projeto

O projeto é salvo automaticamente no `localStorage`. Use **Salvar projeto** e **Abrir projeto** para guardar ou carregar um JSON com tudo, incluindo as imagens.

## Scripts

```sh
node scripts/validate.js minha-skin.deltaskin   # valida info.json + assets do zip
node scripts/smoke.js                           # gera e valida todos iPhone × console
node scripts/snap-test.js                       # testa guias, grid, alinhar e distribuir
```

## Estrutura

| Arquivo | Papel |
| --- | --- |
| `js/devices.js` | presets de iPhone (pontos, escala, pixels, safe area) |
| `js/consoles.js` | `gameTypeIdentifier`, `inputFrame` e botões válidos de cada console |
| `js/layout.js` | layout automático em pontos |
| `js/skinjson.js` | monta o `info.json` (também é usado pelos scripts Node) |
| `js/render.js` | desenha a arte no canvas |
| `js/snap.js` | guias inteligentes, grid, alinhar e distribuir |
| `js/editor.js` | edição no canvas (seleção múltipla, arrastar, redimensionar) |
| `js/export.js` | gera PDF/PNG e empacota o `.deltaskin` |
| `js/importer.js` | importa `.deltaskin` (converte medidas e extrai a arte de PNG/PDF) |
| `js/app.js` | estado do app e interface |

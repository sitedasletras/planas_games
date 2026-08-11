# Planas Games

Plataforma web com vários mini-games esportivos reunidos num só hub,
o **World Special Player (WSP)**.

## Jogos planejados

- ⚽ Futebol — em desenvolvimento (partida jogável)
- 🏎️ Fórmula 1 / Fórmula 2 — planejado
- 🏐 Vôlei — planejado
- 🏀 Basquete — planejado
- 🏍️ Moto velocidade — planejado (se viável)

## Estrutura

```
/hub          -> tela inicial, seleciona o jogo
/games/futebol -> partida de futebol (campo, jogadores, IA, placar)
/shared       -> código/UI compartilhado entre os jogos
```

## Rodando localmente

Abra `hub/index.html` num navegador, ou sirva a pasta com qualquer servidor
estático (ex: `npx serve .`).

## Roadmap

1. Partida de futebol jogável (MVP atual)
2. Meta-jogo de futebol (elenco, mercado, campeonato)
3. Loja/bônus premium: editar escudo, nome do jogador, número da camisa,
   cores do time e do uniforme
4. Novos esportes (F1/F2, vôlei, basquete, moto)

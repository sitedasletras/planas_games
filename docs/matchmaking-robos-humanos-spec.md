# WSP — Matchmaking progressivo (robôs → humanos)

> Ideia dada pelo dono do projeto em 13/08/2026, durante o desenvolvimento
> do Futebol. Vale para **todos os jogos esportivos** da plataforma World
> Special Player (WSP) — Futebol, Fórmula 1/2, Vôlei, Basquete, Moto
> Velocidade — e também para o futuro **Futebol Mister Class** (jogo
> separado, controle manual em tempo real). Os jogos baseados em livros
> (fora da WSP) **não** entram nesse modelo — continuam de versão única,
> sem multiplayer.
> Ainda não iniciado — guardado aqui para consulta quando entrarmos nessa
> fase. Requer infraestrutura de backend que o projeto ainda não tem hoje.

## Conceito geral

Hoje cada jogo da WSP roda 100% local (localStorage do navegador, sem
conta de usuário nem servidor compartilhado). O modelo de matchmaking
progressivo muda isso: os campeonatos passam a ser compartilhados entre
jogadores reais, preenchidos por robôs (bots) apenas nas vagas que
ainda não têm gente de verdade.

Funciona assim, igual ao Top Eleven:

1. A pessoa se cadastra e entra no primeiro campeonato (divisão mais
   baixa). Como ainda tem pouca gente cadastrada, a maior parte do grupo
   é robô — algo como **6 a 9 robôs** dividindo espaço com os poucos
   humanos que também estão nessa faixa.
2. Conforme mais gente se cadastra e joga, essas vagas de robô vão
   sendo ocupadas por jogadores reais.
3. Subindo de divisão (por resultado esportivo, do jeito que a Liga/Copa
   já funcionam hoje), a proporção de humanos aumenta — cada divisão
   mais alta tem menos robôs e mais gente de verdade.
4. No topo da pirâmide, o campeonato é 100% humano.

Isso vale igualmente para os outros esportes da WSP quando forem
desenvolvidos (F1/F2, Vôlei, Basquete, Moto) — a mecânica de
robô-preenche-vaga-até-ter-humano-suficiente é a mesma, só muda o
esporte por trás.

## Distinção: Futebol (WSP) vs. Futebol Mister Class

O modelo de matchmaking é o mesmo nos dois, mas a **experiência da
partida** é diferente:

| | Futebol (WSP, atual) | Futebol Mister Class (futuro, jogo separado) |
|---|---|---|
| Controle | Nenhum — partida 100% automática (tática/instruções antes e durante pausas) | Controle manual em tempo real, estilo FIFA / Winning Eleven |
| Onde roda | Local, sem servidor | Servidor com jogadores conectados ao vivo |
| Duração de cada tempo | Tempo comprimido de simulação (ver `HALF_DISPLAY_SECONDS`/`CLOCK_SCALE` em `game.js`) | 46 minutos de jogo representados em **2min30s reais** por tempo |
| Parada técnica | já existe, tempo fixo do jogo atual | **15 segundos** reais |
| Intervalo | já existe, tempo fixo do jogo atual | **30 segundos** reais para mexer em tática/instruções |
| Matchmaking robô→humano | Sim | Sim (mesmo modelo) |

O Mister Class é um jogo à parte — não é uma variação de configuração
dentro do Futebol atual. Quando entrarmos nessa fase, provavelmente
nasce como um novo diretório em `games/` (ou até um repositório
separado, a definir), reaproveitando o que fizer sentido do motor de
partida atual mas com o loop de input em tempo real que removemos do
Futebol "gestão" (ver commit "Partida totalmente automática, sem
controle manual de jogador").

## O que falta para viabilizar (infraestrutura)

Nada disso existe ainda no projeto. Antes de implementar matchmaking de
verdade, precisa decidir/construir:

- **Conta de usuário real** — hoje só existe o cloud-save por e-mail
  (Firebase Auth + Firestore, ver `games/futebol/cloud.js`), que
  sincroniza o save de uma pessoa entre aparelhos, mas não cria uma
  identidade competindo contra outras pessoas.
- **Backend compartilhado** — a Liga/Copa/temporada hoje vivem inteiras
  no `localStorage` de cada navegador (`season.js`). Pra ter divisões
  compartilhadas entre jogadores reais, os dados do campeonato (tabela,
  calendário, resultados) precisam morar num servidor/banco de dados
  central, não mais só no aparelho da pessoa.
- **Serviço de matchmaking** — lógica que sabe quantos humanos reais
  existem em cada faixa/divisão e decide quantas vagas de robô preencher
  ou liberar, e que promove/rebaixa gente de verdade junto com o "elenco"
  de robôs da mesma forma que a Liga já faz hoje com times fictícios.
- **Sincronização de partidas entre humanos** — quando dois jogadores
  reais se enfrentam, alguém precisa decidir como a partida acontece:
  simulada automaticamente pro par (Futebol WSP) ou jogada ao vivo com
  os dois conectados (Mister Class) — isso implica lidar com fuso
  horário, disponibilidade, e o que acontece se um lado não aparecer.

Nenhuma dessas peças precisa ser resolvida agora — é só o mapa do que
vem pela frente quando decidirmos entrar nessa fase.

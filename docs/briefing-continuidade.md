# Briefing de continuidade — World Special Player / Planas Games

Documento de handoff para retomar o desenvolvimento em uma nova conversa (ou
num computador diferente), sem perder contexto. **Sempre ler este arquivo
inteiro no início de uma sessão nova neste projeto**, antes de qualquer
trabalho — e os dois outros docs desta pasta quando for mexer em Fórmula 1
(`formula-racing-manager-spec.md`) ou no matchmaking robô→humano
(`matchmaking-robos-humanos-spec.md`).

Última atualização: 15/08/2026.

## O projeto

- **Nome**: World Special Player (WSP) / "Planas Games" — hub de jogos esportivos navegador-only.
- **Repositório**: `sitedasletras/planas_games`, branch `main`.
- **Site publicado**: https://sitedasletras.github.io/planas_games/ (também acessível via `https://sitedasletras.github.io/` — repositório separado `sitedasletras/sitedasletras.github.io` que só redireciona pra cá).
- **Stack**: HTML/CSS/JavaScript puro, sem build step, sem framework, sem backend de verdade (tudo em `localStorage` do navegador — ver "Persistência e limitações" abaixo, é importante). Padrão de módulo: cada arquivo `.js` é uma IIFE que exporta um objeto global (`window.WSPSquad`, `window.WSPClub`, `window.WSPF1Equipe`, etc).
- **Jogos funcionais hoje**: Futebol (`games/futebol/`) e Fórmula 1 (`games/formula1/`), os dois desbloqueados e jogáveis de ponta a ponta a partir do `index.html` raiz. Vôlei, Basquete, Fórmula 2, Fórmula Indy e Fórmula E ainda "Em breve".
- **Importante**: este repositório é **diferente** do `sitedasletras/triploohesigmalbpl` (conteúdo literário) e do `sitedasletras/CeleiroLiterario` — são projetos separados, não confundir.

## Persistência e limitações (leia antes de prometer algo ao usuário)

- **Não existe conta de usuário nem backend real.** Tudo (elenco, clube,
  temporada, orçamento, F1...) fica só no `localStorage` do navegador que
  o usuário está usando. Trocar de navegador, trocar de aparelho, limpar
  dados do site ou usar modo anônimo = progresso perdido.
- O futebol tem um paliativo pra isso: `backup.js`/`backup.html`
  (`games/futebol/`), com salvar/carregar via Firebase por e-mail (sem
  senha) e também um código manual. **O F1 ainda não tem isso** — se o
  usuário pedir export/import ou sincronizar entre aparelhos no F1, esse
  é o padrão a replicar (não inventar um sistema novo).
- Isso é completamente diferente da "memória" do Claude entre sessões —
  aquilo é sobre o navegador do jogador; isto aqui (este arquivo) é sobre
  o Claude não perder o fio da meada do projeto entre conversas/máquinas
  diferentes. As duas coisas foram perguntadas juntas numa conversa e vale
  não confundir se o assunto voltar.

## Convenção de nomes fictícios (motores, chassis, pneus, circuitos, pilotos)

**Regra fixa, já documentada em `docs/formula-racing-manager-spec.md`
(seções 4, 5, 9, 35, 36) desde 12/08: nunca usar nomes reais de marcas,
equipes, pilotos, motores, chassis, pneus ou circuitos de F1 — só
fictícios, a não ser que surja uma licença.** Quando o nome fictício for
inspirado num nome real, traduzir/reinterpretar em vez de usar o nome
original (pedido explícito do usuário) — exemplo dado por ele: chassi
"Lotus" vira **"Chassi Flor de Lótus"**, combustível "Petrobras" vira
**"Petróleo do Brás"**. Isso já foi aplicado em:

- **Motores** (`MOTORES` em `games/formula1/equipe.js`): Motores Auge de
  Coventry, Motores de Corrida Britânicos, Motores Modernos, Motores
  Vida, Peças de Reposição Racing, Motores Cervo, Motores Sombra, Motores
  Pégaso.
- **Chassis** (`CHASSIS`, mesmo arquivo): Chassi Flor de Lótus, Chassi
  Lobo, Chassi Flechas, Chassi Março, Chassi Ônix, Chassi Águia, Chassi
  Insígnia, Chassi Pacífico.
- **Fornecedoras de pneu** (`TIRE_SUPPLIERS` em `games/formula1/corrida.js`):
  5 marcas fictícias (Borrachas Aurora, Pneus Titã, Rodagem Cristal,
  Compostos Vulcano, Pneus Zênite), cada uma com rendimento independente
  no seco x na chuva — de propósito desbalanceado entre os dois eixos.
- **Circuitos** (`CIRCUIT_POOL` em `games/formula1/calendario.js`): 42
  circuitos fictícios (nomes brasileiros/genéricos inventados), **não** os
  nomes reais de GP. O usuário mandou uma "Enciclopédia de Circuitos de
  F1" em PDF (1950–2026, real) — ela foi usada só como referência de
  *estrutura* (categorias de circuito, formato de fim de semana, ~21-22
  corridas por temporada), não pra copiar os nomes reais.
- **Patrocinadores institucionais**: "Planas Games" e "Instituto Celeiro
  Literário" (o instituto/seal do próprio usuário) entram como opções
  reais no pool de patrocinador principal do F1 (`SPONSOR_NAMES.carroceria_principal`
  em `equipe.js`) — esses dois **não** são fictícios, foram pedidos
  assim de propósito.
- **Pilotos**: sempre gerados (nome/sobrenome de pool próprio), nunca
  nomes reais de pilotos de F1.

## Arquivos principais — Futebol (`games/futebol/`)

- `game.js` — motor da partida (canvas 2D), o maior arquivo. Partida 100%
  automática (sem controle manual), mas a escalação que o usuário monta em
  `escalacao.html` **é respeitada** (`selectStartersFromLineup`) — sorteio
  aleatório só entra se não houver escalação salva pra aquela tática.
  Sistemas já maduros: instruções por jogador (aplicam na próxima bola
  parada se dadas ao vivo, instantâneo se pausado/pré-jogo), duelo
  jogador-contra-jogador (popup), replay 2D de perfil (gol animado
  pé→rede diferenciando jogo/falta/pênalti, confusão, VAR em duas etapas,
  DEFESAÇO), evento de confusão pós-falta dura, artilheiro/assistência com
  regras corretas, motor tático do adversário (reage ao placar, faz
  substituições), motor de decisão dos jogadores por atributo, relatório
  completo da partida (`#report-btn` no fim de jogo).
- `squad.js` — elenco (jogadores, posições, nota, potencial 0-200,
  mercado, condição física, lesões).
- `club.js` — clube: orçamento (`STARTING_BUDGET = 20000`), departamentos/
  Campus (`MAX_LEVEL = 20`), patrocínios, escudo/cores, torcida, moral.
- `season.js` — temporada, ligas (10 divisões em 4 campeonatos), copas,
  promoção/rebaixamento, mercado de transferências de rivais.
- `calendario.js` — cooldown de 3 dias entre partidas + assistir vídeo
  pra adiantar 1 dia, com **teto de 8 vídeos por dia real** (não confundir
  com dia de jogo) e **R$ 150 de recompensa por vídeo** — adicionado
  15/08.
- `elenco.html`/`escalacao.html`/`personalizacao.html`/`temporada.html`/
  `confronto.html`/`historico.html`/`treino.html`/`medico.html`/
  `diretoria.html`/`trilha.html`/`clube.html` — telas de gestão.
- `presidente.js` — tour de onboarding "Presidente/Presidenta do Time",
  cobre todas as telas.
- `backup.js`/`backup.html` — salvar/carregar (Firebase por e-mail, código
  manual, reset total). `cloud.js` — integração Firebase.
- `daily.js` — recompensa diária (streak de login).

## Arquivos principais — Fórmula 1 (`games/formula1/`, construído em 15/08)

Módulo inteiro construído numa sessão só, seguindo o mesmo padrão do
futebol (telas .html + módulo .js correspondente, tudo automático exceto
decisões de estratégia). Visão completa/de longo prazo está em
`docs/formula-racing-manager-spec.md` (não construída inteira — só um MVP
jogável, como o próprio doc já orientava fazer).

- `pilotos.js` — elenco de 3 pilotos (titular_1, titular_2, reserva),
  espelha `squad.js`.
- `equipe.js` — clube: orçamento, departamentos (`FACILITY_GROUPS`:
  médico, comissão técnica, engenharia [aerodinâmica/motor/chassi],
  boxes, imprensa, fã-clube), patrocínios, motor/chassi/pneu escolhidos
  (`motorSupplier`/`chassiSupplier`/`tireSupplier`), customização.
- `corrida.js` — **tabela de dados/fórmulas puras** (sem DOM): compostos
  de pneu, fornecedoras de pneu, combustível, tempo de pit stop (cai com
  o nível de boxes+engenharia), catálogo de falhas mecânicas/batidas
  (1-3 por temporada, sorteio pesado pro time mais fraco), e o
  **rendimento de motor por temporada** (`rollMotorPerformances` — cada
  motor varia até 4 pontos pra cima/baixo a cada nova temporada, partindo
  do valor anterior).
- `grid.js` — monta o grid completo (jogador + 9 rivais fixas, 2 pilotos
  cada = 20 carros), aplica o fator de rendimento do motor da temporada
  no ritmo de cada carro.
- `calendario.js` — temporada: 21 corridas, 7 com Sprint (espalhadas, não
  amontoadas), pool de 42 circuitos com **rotação garantida de pelo menos
  metade a cada nova temporada** (`selectSeasonCircuits`), pontuação
  estilo F1 real (25-18-...-1 na corrida, 8-7-...-1 na sprint),
  classificação de pilotos/construtores.
- `corridamotor.js` — motor de corrida **puro** (sem canvas): pneu com
  desgaste/troca de composto, combustível com peso variável, pit stop,
  clima dinâmico (pode chover, força troca de pneu), reabastecimento
  estratégico opcional na Sprint, falha mecânica agendada. Tem um teto
  duro de tempo (`raceRealMs * 1.6`) pra corrida nunca travar mesmo se
  chuva atrasar o pelotão inteiro — isso já foi um bug real, corrigido.
- `corrida.html` — tela de corrida: painel de estratégia pré-largada
  (composto + refuel na sprint) e a corrida ao vivo (canvas oval, HUD,
  ticker, líderes, pit manual, velocidade/pausa).
- `temporada.html`, `escuderia.html`(+`.css`), `personalizacao.html`(+`.css`),
  `pilotos.html` — telas de gestão, espelhando as equivalentes do futebol.

## Fluxo de trabalho / testes

1. Editar arquivo(s).
2. `node --check <arquivo>.js` pra validar sintaxe rápido.
3. **Playwright agora está instalado de verdade** (antes não estava — só
   descobri isso quando o usuário perguntou e mandei instalar em 15/08).
   `package.json` na raiz do repo (`private: true`, devDependency
   `playwright`), `node_modules/` no `.gitignore`. Rodar
   `cd /workspace/planas_games && npm install` se o `node_modules` não
   existir na sessão atual (o container é efêmero, mas o `package.json`
   está no git — sempre vai estar lá).
   - **Não usar `require('playwright')` direto de um script fora do
     projeto** — só funciona chamando o módulo pelo caminho absoluto:
     `require('/workspace/planas_games/node_modules/playwright')`.
   - Navegador: **não rodar `playwright install`**, já tem Chromium
     pré-instalado em `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
     (o número da versão pode mudar — conferir com
     `find /opt/pw-browsers -iname "*chrome*" -type f -executable`).
     Lançar com `chromium.launch({ executablePath: '/opt/pw-browsers/.../chrome' })`.
   - Testes de lógica pura (sem DOM) continuam valendo a pena escrever
     como harness Node simples (`eval(fs.readFileSync(...))` dos módulos
     + `global.window = {}` + mock de `localStorage`) — mais rápido pra
     testar fórmulas/simulação em massa (dezenas de temporadas/corridas).
     Mas isso **não substitui** testar a página de verdade — já achou um
     bug real (`ReferenceError` de temporal dead zone em `corrida.html`)
     que só apareceu rodando no Chromium, nunca nos harness de dados.
4. Subir um servidor de teste local: `python3 -m http.server <porta> --directory /workspace/planas_games` via Bash com `run_in_background: true` (a porta muda a cada sessão nova porque o container reinicia e mata processos em background — sempre conferir com `curl -sI http://localhost:<porta>/index.html` antes de rodar testes).
5. Sempre rodar uma regressão de partida/corrida completa antes de subir
   qualquer mudança em `game.js` ou `corridamotor.js` (futebol: `#btn-speed`,
   aguardar `#overlay-title === 'FIM DE JOGO'`; F1: rodar `stepRace` em
   loop até `isFinished`), checando 0 erros de página (`page.on('pageerror', ...)`).
6. `git add` só os arquivos relevantes (nunca `-A` sem checar), commitar com mensagem em português explicando o quê e o porquê, `git push -u origin main`.

## Estado das pendências antigas (lista de 13/08 — todas resolvidas)

A lista de pendências registrada em 13/08 (escalação interativa, excesso
de faltas, ritmo da partida, rebalancear economia pra 20k, subir
`MAX_LEVEL` pra 20, botões cortados no mobile) **foi toda resolvida** ao
longo das sessões seguintes — confirmado direto no código (`STARTING_BUDGET
= 20000`, `MAX_LEVEL = 20`, `selectStartersFromLineup` em uso). O tour do
Presidente do Time também foi construído e cobre todas as telas. Não há
necessidade de retrabalhar nada disso.

## Pendências reais / ideias em aberto agora

1. **F1 ainda não tem backup/export de save** (ver "Persistência e
   limitações" acima) — replicar o padrão do futebol (`backup.js`) se o
   usuário pedir.
2. **Formula Racing Manager (`formula-racing-manager-spec.md`) tem MUITA
   coisa além do que foi construído** — o que existe hoje é um MVP
   (equipe → fim de semana → corrida → resultado → temporada). Não
   construídos ainda: engenheiro de corrida com rádio/mensagens durante a
   prova, previsão do tempo com margem de erro (hoje o clima é só um
   evento surpresa, sem previsão nenhuma pro jogador), configuração de
   carro por sessão (asa/altura/pressão dos pneus), árvore de
   desenvolvimento do carro ao longo da temporada, editor de circuito
   próprio, política da categoria/votações, modo dinastia de décadas,
   dificuldade selecionável, funcionários por departamento (hoje só tem
   nível 0-20 do departamento, sem contratar pessoas individuais). Ver o
   documento inteiro antes de expandir o F1 — ele já tem a resposta pra
   "como deveria funcionar" de quase tudo.
3. **Fórmula 2, Fórmula Indy, Fórmula E**: `formula-racing-manager-spec.md`
   é o roteiro-base pros quatro, não só F1. Quando entrar nesses, reusar
   a arquitetura do F1 (grid/calendario/corridamotor já são bem
   genéricos) em vez de recomeçar do zero. **Regra explícita do usuário
   (15/08): circuitos ovais são pra Fórmula Indy, não pra F1** — o
   `CIRCUIT_POOL` de `games/formula1/calendario.js` não deve ganhar
   nenhum circuito oval; quando o oval fizer sentido, ele entra no pool
   da Fórmula Indy.
4. **Vôlei, Basquete**: ainda sem nenhum trabalho iniciado.
5. **Matchmaking progressivo robô→humano**: documentado em
   `docs/matchmaking-robos-humanos-spec.md`, não iniciado, vale pra todos
   os jogos esportivos da WSP.
6. **[IMPLEMENTADO 15/08]** Motor mais potente bebe mais combustível —
   `motorFuelMult(motorLevel)` em `corrida.js`, usado dentro de `stepRace`
   em `corridamotor.js` junto com `motorSupplierFuelFactor` (consumo fixo
   por marca, independente da potência sazonal).
7. **[IMPLEMENTADO 15/08] Regra global do usuário: nenhuma porcentagem de
   fornecedor pode passar de 98% nem ficar abaixo de 86%** — vale pra
   pneu (`TIRE_SUPPLIERS`), motor (`MOTOR_PERFORMANCE_MIN/MAX` e
   `MOTOR_FUEL_PROFILES`, ambos em `corrida.js`) e chassi
   (`CHASSIS_PACE_PROFILES` em `equipe.js`). Todas as tabelas foram
   remapeadas pra essa banda preservando a ordem relativa entre marcas
   (quem era melhor/pior continua sendo, só a escala mudou).
   Também nesse pedido: **criado o fornecedor de Câmbio** (não existia —
   só existia "câmbio" como TIPO de pane mecânica, ligado ao
   departamento de chassi). Em vez de repetir o multiplicador de ritmo
   que chassi já usa, a marca de câmbio (`CAMBIO` em `equipe.js`, 8 nomes
   fictícios "sabor original") mexe em **confiabilidade**:
   `CAMBIO_RELIABILITY_PROFILES`/`cambioReliabilityPct` (em `corrida.js`)
   dão a porcentagem (86-98%) de cada marca, e `cambioReliabilityMult`
   reduz a chance de QUALQUER pane mecânica em até 25% pro melhor câmbio
   (não decide a corrida, só inclina, mesmo espírito dos outros
   fornecedores) — plugado em `failureChanceForRace`/`pickAffectedEntrant`.
   Contrato de câmbio trava por temporada igual motor/chassi/pneu
   (`cambioLockedSeason`, `setCambioSupplier`). É mecânica só do
   jogador (rivais não têm `cambioSupplier`), mesmo padrão já usado pro
   chassi. UI: novo card "⚙️ Marca do câmbio" em `escuderia.html`.
8. **[IMPLEMENTADO 16/08] Bateria grande de correções/pedidos do usuário
   numa sessão só:**
   - **Bug real de ritmo (jogador ficava voltas inteiras pra trás mesmo
     cedo na corrida)**: `playerTeamPace` (grid.js) usava uma escala
     (58-99) incompatível com a banda 88-97 que os rivais sempre vivem
     (`generateRivalTeam`) — corrigido pra partir de 91 (perto do meio da
     banda) e ir até 97 com departamentos maxados. Também: chassi/pneu
     estavam sendo aplicados como multiplicador CRU de 86-98% direto na
     física (até 14% de diferença sozinho); agora comprimem pra um
     efeito estreito (~0.97-1.03), igual o rendimento de motor já fazia
     (`chassiPaceEffectFactor` em equipe.js, `tireSupplierEffectFactor`
     em corrida.js — a porcentagem exibida continua 86-98%, só o efeito
     de física ficou pequeno). Trava final de ±3 em volta do pace nominal
     da própria equipe (jogador E rival) pra nenhuma combinação de
     fatores empilhar até virar decisiva sozinha.
   - **Bug real de tempo de pit stop (27s de pit custando 4+ voltas de
     chão)**: a corrida roda num relógio comprimido (raceRealMs/
     totalLaps por volta, uns 5-6s), mas `PIT_STOP_BASE_MS`/`MIN_MS`
     eram valores fixos de 9-25 SEGUNDOS REAIS nesse mesmo relógio —
     custava várias voltas inteiras. Agora `pitStopMs`/`pitStopMsForClub`
     recebem `avgLapMs` e o pit custa uma FRAÇÃO de volta (12%-40%
     conforme boxes/engenharia), do jeito que pit real custa fração de
     volta na F1 de verdade.
   - **Estratégia de pit manual**: a "planilha" pré-corrida agora deixa
     claro que só projeta a 1ª parada; o antigo botão único "Chamar pro
     pit" (lógica automática de 2 ramos) virou um seletor real de 5
     compostos por carro (`#driver-controls` em corrida.html) — o
     jogador escolhe o pneu de CADA parada, quantas quiser, sem mínimo
     forçado além do que o próprio pneu exige.
   - **Plano de estratégia por piloto**: composto/volta-alvo de
     combustível/estilo de pilotagem eram um valor ÚNICO pros dois
     carros do jogador; agora `corridamotor.js` aceita
     `opts.playerStrategies` (mapa por id de entrant) e cada carro tem
     `car.drivingStyle` próprio (`setDrivingStyle` agora recebe carId).
     UI: abas por piloto na tela de estratégia (`#driver-tab-row`) e um
     card de controle por carro na corrida ao vivo.
   - **Desenho do circuito na estratégia**: `#circuit-shape-preview`
     (canvas) no painel de dados do circuito, reusando `buildTrackShape`/
     `strokeTrackShape` que o canvas ao vivo já usava.
   - **Classificatória virou sessão ao vivo** (igual treino livre) em vez
     de instantânea — `temporada.html` não tem mais botão "Rodar
     Classificatória" (`instant-btn`/`runInstant` removidos, eram código
     morto depois da mudança); agora roteia pra `corrida.html` como
     qualquer sessão ao vivo. `recordSessionResult` (calendario.js) já
     sabia tratar isso (`if (type === 'classificatoria') w.gridOrder =
     order`), só faltava a sessão rodar de verdade.
   - **Pontuação**: já estava correta antes desse pedido — `RACE_POINTS`
     (25-18-15-12-10-8-6-4-2-1) e `SPRINT_POINTS` (8-7-6-5-4-3-2-1) em
     `calendario.js` já batem com a pontuação real da F1. Confirmado,
     nenhuma mudança necessária.
   - Regressão completa (18 harness Node + Playwright) rodada depois de
     cada mudança, sem quebrar nada do que já existia.
9. **[IMPLEMENTADO 16/08] Clima em 4 níveis + previsão do tempo +
   especialidade de clima por piloto + carreira/contrato:**
   - **Clima 4 níveis com mm** (pedido explícito, veio de foto de
     caderno): `WEATHER_TIER_KEYS`/`WEATHER_CONDITIONS` em `corrida.js` —
     Seco (0mm) → Ventos Fortes (2mm) → Chuva Grossa (4mm) → Chuva
     Intensa (6mm). Só 2 compostos molhados existem (`intermediario`,
     `chuva`), então Ventos Fortes E Chuva Grossa mapeiam pro
     intermediário como ideal; só Chuva Intensa exige o pneu de chuva
     cheio — decisão de design comunicada ao usuário, não corrigida.
   - **Timeline determinística compartilhada** (o pedido central: "a
     gente fica perdido quando o tempo muda sem aviso"):
     `buildWeatherTimeline(seedStr, totalLaps, climaKey)` gera a
     sequência de clima/temperatura da sessão INTEIRA, volta a volta, de
     uma vez, com uma semente. `corrida.html` monta a MESMA semente
     (`circuito|sessão|temporada|índice`) e chama a MESMA função tanto
     pra desenhar a tabela de previsão (`weatherForecastCheckpoints` —
     início/meio/fim) quanto pra passar como `weatherSeed`/`clima` pro
     `createRaceState` em `corridamotor.js`, que usa a timeline pra
     decidir `state.weather` a cada volta (`applyWeatherTick`
     reescrito). Nunca pula mais de 1 nível de uma vez (regra explícita
     do usuário), e pode ficar parado no mesmo nível a sessão inteira —
     ambos verificados por harness (`node_check_climate.js`,
     `node_check_weather.js`). Vale pras 4 sessões (treino, classificatória,
     sprint, corrida) — antes só a corrida principal tinha chance de
     chuva, e sprint nem isso.
   - **Clima afeta desgaste/consumo**: `weatherWearMult`/`weatherFuelMult`
     (mm × 3%/1.5% respectivamente) multiplicam o desgaste de pneu e o
     consumo de combustível em `stepRace`, além do grip que já mudava
     com pneu errado.
   - **Especialidade de clima por piloto**: cada piloto pode ter UMA das
     4 especialidades (ou nenhuma — sem ganho nem perda). Matriz fixa
     `WEATHER_SPECIALTY_FACTOR` em `corrida.js` (dada pelo usuário +
     derivada por "2 grupos" — seco/ventos formam um grupo, chuva
     grossa/intensa o outro: 100% na própria especialidade, 50% no
     parceiro do grupo, 0% no oposto mais próximo, -25% no mais
     distante), escalada por potência 0-20 (referência = potência 10,
     `weatherSpecialtyPaceFactor`), com teto de ±6% de ritmo (mesmo
     espírito "não decide sozinho" dos outros sistemas). Pilotos do
     jogador (`pilotos.js`) E rivais (`grid.js`) têm o campo, pra manter
     justo.
   - **Carreira/contrato** (`pilotos.js`): potência de clima evolui
     junto com o rating (auge/declínio) em `advanceSeason`; aposentadoria
     automática aos 40 anos; contratos de 2 temporadas — ao vencer, o
     piloto "vira agente livre" e o jogador decide renovar ou dispensar
     (pergunta feita ao usuário via AskUserQuestion, essa foi a opção
     escolhida). `advanceSeason` — que existia mas nunca era chamada —
     agora é disparada no clique de "Iniciar nova temporada"
     (`temporada.html`), com um overlay de relatório (evoluções,
     declínios, mudança de fase, aposentadorias) e cards de decisão de
     contrato que TRAVAM o botão "Continuar" até todos serem resolvidos.
     Aposentadoria/dispensa de titular promove reserva automaticamente
     (`promoteReserveIfVacant`), nunca deixa vaga.
   - Regressão completa rodada depois da mudança (harness Node +
     Playwright cobrindo previsão de tempo, corrida ao vivo com clima,
     especialidade em ação, aposentadoria+promoção, contrato
     vencido→renovar/dispensar), sem quebrar nada do que já existia.

10. **[IMPLEMENTADO 19/08] Bateria de pedidos do usuário — futebol (3
    itens) + F1 (correção de emergência + 3 itens novos):**
    - **Futebol — equilíbrio de força**: rating do rival (`game.js`,
      `scaledAwayRating`) estava ancorado quase só na força fixa do clube
      adversário (definida pelo tier da liga), então um rival de liga alta
      chegava perto de 99 mesmo com o jogador em 50, sem nunca dar
      alcance (mesmo bug já resolvido na F1 antes). Agora ancorado na
      média do PRÓPRIO elenco do jogador (medida ao vivo a cada partida),
      travado a no máximo ±10 acima/abaixo — testado nos dois sentidos.
    - **Futebol — falta em colisão de corpo**: falta só era checada no
      raio minúsculo de disputa pela bola (~22px); um defensor podia
      colidir de corpo com o dono da bola sem entrar nesse raio (a bola
      fica deslocada na frente do dono) e nada acontecia. Nova checagem
      de contato mais ampla (~32px), chance por frame bem menor pra não
      virar faltômetro.
    - **Futebol — construção de jogada de verdade**: antes o portador da
      bola SEMPRE corria reto pro gol. Agora cada posse tem um estado
      (`computeBuildupState`): pressionado (solta rápido), aberto (pode
      acelerar) ou contido (segura/circula esperando brecha) — muda tanto
      o movimento quanto a chance de passar vs. seguir driblando. Duas
      calibrações erradas travaram o jogo de verdade (partida inteira
      0x0, quase sem finalização) antes de chegar na versão final
      (testada até o fim: gol de verdade com assistência).
    - **Futebol — velocidade geral**: pedido explícito "ainda está muito
      rápida" — velocidades de jogador/bola reduzidas ~20%
      (`TEAMMATE_SPEED`/`CHASER_SPEED`/`DRIBBLE_SPEED`/`GK_SPEED`/
      `SHOOT_POWER`/`PASS_POWER`/`CLEAR_POWER`) e `HALF_REAL_SECONDS`
      subiu de 170 pra 220 (relógio da partida mais devagar também).
    - **F1 — pilotos.js corrompido (emergência)**: ao empurrar o commit
      do futebol, o `git push` revelou que o `pilotos.js` no GitHub tinha
      sido truncado de 528 pra 42 linhas por um upload manual malsucedido
      (o usuário tentando subir uma "mecânica de Safety Car" direto pelo
      site) — `node --check` dava erro de sintaxe, o módulo de F1 inteiro
      quebraria. Restaurado a partir do último commit bom, preservando as
      mudanças reais que vieram junto no merge (visual do carro/pista, e
      a mecânica de Safety Car de verdade — `SC_CHANCE_PER_LAP` etc. em
      `corridamotor.js`, com sistema de "moral do piloto" referenciado
      mas nunca implementado, virou guarda defensiva neutra). 4 arquivos
      de upload duplicado (`corrida (1).html`, `*.txt`) removidos.
    - **F1 — relatório "Migoo" comparado com o código real**: o usuário
      trouxe um relatório de outra ferramenta de IA com uma lista de
      "bugs" e ideias novas. Boa parte dos bugs listados (personalização
      em branco, mercado com R$0/sem candidatos, combustível zerado sem
      consequência, pilotos.js sem elenco base) **não existiam mais** —
      testado ao vivo, tudo funcionando. "Sprint roda 1/3 das voltas" não
      é bug, é regra real de Sprint. Das ideias novas, 3 foram
      implementadas (abaixo); 2 ficaram de fora por decisão própria
      (não pedidas de volta ainda): sliders de setup 0-99 (substituiria
      um sistema categórico já testado, sem o usuário presente pra
      calibrar em tempo real) e patrocínio cruzado com o Celeiro
      Literário (decisão de branding, cruza com outro projeto).
    - **F1 — POT (potência do motor ao vivo)**: controle ajustável
      DURANTE a corrida (0-20, 10=neutro, botões +/- por piloto) — mais
      potência ganha até +5% de ritmo mas custa até +12% de combustível e
      +10% de desgaste de pneu (`motorPowerPaceFactor`/
      `motorPowerFuelMult`/`motorPowerWearMult` em `corrida.js`,
      `setMotorPower` em `corridamotor.js`). Testado: uma corrida inteira
      em potência máxima chegou a ficar sem combustível antes do fim.
    - **F1 — rádio da equipe**: mensagens do engenheiro ao vivo, só pros
      carros do jogador — pneu gasto (>75%), combustível baixo (<15%),
      clima prestes a mudar (mesma timeline da previsão pré-corrida, avisa
      ANTES de acontecer) e rival colado na frente. Cooldown de 25s reais
      por carro, aparece no log/ticker já existente (`checkTeamRadio` em
      `corridamotor.js`).
    - **F1 — tabela de estratégia em 4 colunas**: baseada no caderno do
      usuário — abaixo da planilha de combustível já existente, uma nova
      tabela projeta TODOS os trechos da corrida (início + cada parada
      esperada), com trecho/pneu/combustível/cálculo base (aguenta ou não,
      com folga em voltas). Atualiza sozinha ao trocar composto/estilo.
    - **F1 — moral do piloto**: completa um stub que já existia
      (`moralPaceMult` era chamado defensivamente em `corridamotor.js`
      desde a correção de emergência, mas a função nunca tinha sido
      implementada de verdade). Cada piloto tem moral 0-100 (padrão 50,
      neutro) com 5 faixas de rótulo (🔥 Excelente a 😰 Em Crise),
      afetando o ritmo em corrida em até ±10%
      (`moralPaceMult` em `pilotos.js`). Sobe com resultado bom (P1 +12,
      pódio +7, pontos +3/+1), desce com abandono (-4) ou último lugar
      (-5), sobe também quando o acerto de carro combina com o asfalto do
      fim de semana (+3). Sem corrida, tende de volta ao neutro sozinha
      com o tempo (`applyMoralRecovery`, mesmo padrão de recuperação de
      condição física já usado em `equipe.js`). Chip de moral visível em
      Pilotos e Mercado. Testado via harness Node (rótulo, multiplicador,
      ajustes de resultado/abandono/acerto, clamp 0-100, recuperação ao
      longo do tempo, backfill de elenco salvo sem o campo).
    - Regressão completa (harness Node + Playwright) rodada depois de
      cada mudança, incluindo um bug de rótulo ("2ª parada" em vez de "1ª
      parada" no 2º trecho) pego e corrigido durante o próprio teste.

11. **[IMPLEMENTADO 19/08] F1 — modo de câmera "Seguir Piloto" (2 de 3
    modos pedidos)**: usuário trouxe mais 3 relatórios (`relatoriof1.md`,
    `relatoriofutebol.md`, `relatorioplataformaeoutros.md`) e pediu 3
    modos de transmissão da corrida: 1) o geral de sempre; 2) câmera que
    segue só a disputa de um piloto escolhido no trecho onde ele está no
    momento; 3) visão de cockpit ("sensação de estar dirigindo"). Também
    pediu visual 2.5D pros dois jogos.
    - **Modo 2 implementado** (`corrida.html`): 2 botões acima da pista
      (Geral/Seguir Piloto) + ◀▶ pra escolher o alvo entre os carros
      ainda na corrida (ordenados pela posição atual). É uma
      transformação de câmera só (`ctx.translate`/`ctx.scale` recentrado
      no ponto do carro seguido a cada frame), reaproveitando 100% do
      mesmo desenho de pista/carros do modo geral — nenhuma lógica de
      corrida mudou. Minimapa e velocímetro continuam mostrando a corrida
      inteira, só a pista principal dá zoom. Testado com Playwright
      (troca de modo, ciclo de alvo, corrida rodando 3s+ sem erro de
      página) e visualmente por screenshot (carro seguido centralizado,
      disputa local visível ao redor, contexto preservado).
    - **Modo 3 (cockpit) e visual 2.5D (F1 + futebol) — DEFERIDOS por
      decisão própria**, não implementados: o botão "🚗 Cockpit" já
      aparece na tela (desabilitado, "Em desenvolvimento") pra deixar
      claro que não foi esquecido. Motivo de não tocar sozinho: a pista
      hoje é desenhada em 2D de cima (elipse/traçado real), sem nenhuma
      perspectiva de estrada — visão de cockpit de verdade e visual 2.5D
      são reformas de renderização praticamente do zero, bem mais
      subjetivas ("sensação de dirigir") que qualquer coisa feita até
      aqui. Os próprios relatórios anteriores já marcavam isso como
      "Fase 2/3, futuro distante". E a lição do build-up do futebol desta
      mesma sessão é direta: mesmo testando sozinho a fundo, 2
      calibrações erradas seguidas aconteceram numa mudança bem menor que
      essa — decisão visual grande sem o usuário por perto pra dar
      feedback ao vivo é risco de retrabalho alto demais. Fica esperando
      o usuário decidir prioridade/direção quando acordar.

## Outras notas importantes

- **Google AdSense**: conta criada, site verificado (via `sitedasletras/sitedasletras.github.io`, repositório novo criado especificamente pra isso, com página de redirecionamento pro jogo), revisão pedida ao Google — só falta aguardar aprovação (pode levar horas/dias, chega por e-mail). Nada mais a fazer até a aprovação chegar.
- Câmera 3D: ideia guardada pra quando "tivermos recursos financeiros" — não iniciar sem pedido explícito.
- Jogo separado "Futebol Mister Class" (controle manual em tempo real, timing comprimido: 2min30s por tempo) — ideia guardada, não iniciado.
- Conta de e-mail do jogo (usada no AdSense/contato): `omeutimaoeumabosta@gmail.com`.

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
   genéricos) em vez de recomeçar do zero.
4. **Vôlei, Basquete**: ainda sem nenhum trabalho iniciado.
5. **Matchmaking progressivo robô→humano**: documentado em
   `docs/matchmaking-robos-humanos-spec.md`, não iniciado, vale pra todos
   os jogos esportivos da WSP.

## Outras notas importantes

- **Google AdSense**: conta criada, site verificado (via `sitedasletras/sitedasletras.github.io`, repositório novo criado especificamente pra isso, com página de redirecionamento pro jogo), revisão pedida ao Google — só falta aguardar aprovação (pode levar horas/dias, chega por e-mail). Nada mais a fazer até a aprovação chegar.
- Câmera 3D: ideia guardada pra quando "tivermos recursos financeiros" — não iniciar sem pedido explícito.
- Jogo separado "Futebol Mister Class" (controle manual em tempo real, timing comprimido: 2min30s por tempo) — ideia guardada, não iniciado.
- Conta de e-mail do jogo (usada no AdSense/contato): `omeutimaoeumabosta@gmail.com`.

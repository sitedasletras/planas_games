# Briefing de continuidade — World Special Player / Planas Games

Documento de handoff para retomar o desenvolvimento em uma nova conversa, sem perder contexto.

## O projeto

- **Nome**: World Special Player (WSP) / "Planas Games" — hub de jogos esportivos navegador-only.
- **Repositório**: `sitedasletras/planas_games`, branch `main`.
- **Site publicado**: https://sitedasletras.github.io/planas_games/ (também acessível via `https://sitedasletras.github.io/` — repositório separado `sitedasletras/sitedasletras.github.io` que só redireciona pra cá).
- **Stack**: HTML/CSS/JavaScript puro, sem build step, sem framework, sem backend (tudo em `localStorage`). Padrão de módulo: cada arquivo `.js` é uma IIFE que exporta um objeto global (`window.WSPSquad`, `window.WSPClub`, etc).
- **Jogo funcional hoje**: só Futebol (`games/futebol/`). Outros esportes/jogos do hub estão "Em breve" (travados no `index.html` raiz).
- **Importante**: este repositório é **diferente** do `sitedasletras/triploohesigmalbpl` (conteúdo literário) e do `sitedasletras/CeleiroLiterario` — são projetos separados, não confundir.

## Arquivos principais (`games/futebol/`)

- `game.js` — motor da partida (canvas 2D), o maior arquivo. Partida 100% automática (sem controle manual).
- `squad.js` — geração/gestão do elenco (jogadores, posições, nota, potencial, mercado).
- `club.js` — clube (orçamento, departamentos/Campus, patrocínios, escudo/cores, torcida).
- `season.js` — temporada, ligas, copas, tiers (bairro/cidade/regional/estadual).
- `elenco.js`/`elenco.html` — tela de elenco + mercado de contratações.
- `escalacao.js`/`escalacao.html` — hoje é só **prévia read-only** dos titulares (não é interativa, não influencia a partida — ver pendências).
- `personalizacao.js` — editor de nome do clube, cores, escudo, jogadores (nome/número).
- `temporada.js`/`confronto.js`/`historico.js` — telas de temporada, prévia de confronto, histórico/troféus.
- `trilha.js`/`trilha.html` — trilha "Patrocinador Especial" (pontos por partida, prêmios, prêmio final exclusivo).
- `daily.js` — recompensa diária (streak de login).
- `backup.js`/`backup.html` — salvar/carregar (nuvem via Firebase e-mail, código manual, e botão de reset total).
- `cloud.js` — integração Firebase (login por e-mail, sem senha).

## Sistemas já implementados (histórico completo)

Times 100% automáticos (sem joystick), zoom de comemoração no gol, arquibancada reage à Torcida, duelo jogador-contra-jogador (popup), barra de pressão/posse de bola, artilheiro/assistências por jogador com regras corretas (escanteio=assistência exceto gol olímpico, falta perto do gol=assistência, tiro de meta do goleiro=assistência do goleiro, lateral que originou o gol=assistência), instruções por jogador (aplicam na próxima bola parada se dadas ao vivo, instantâneo se dadas pausado/pré-jogo), recompensa diária com streak, trilha "Patrocinador Especial" (pontos por resultado, prêmios em dinheiro + emblema de escudo exclusivo + uniformes exclusivos no prêmio final), sistema de **potencial** (0-200, hoje só usa 2-10 no elenco/mercado normal e 11-15 em "joias" raras e caras — separado da nota 0-99, influencia evolução na troca de temporada), Google AdSense (site verificado, aguardando aprovação do Google), política de privacidade.

## Rebalanceamentos e correções desta sessão (13/08)

1. Elenco inicial reduzido de 23 para **16 jogadores**; aviso no Elenco pedindo pra contratar mais 7 (até completar 23).
2. Mercado de contratações corrigido: agora sempre mostra **10 candidatos**, com distribuição garantida 1 goleiro + 3 defensores + 3 meio-campistas + 3 atacantes (antes enviesava pra defesa).
3. Cor do escudo agora editável separadamente do uniforme.
4. Números da camisa: removido um rótulo "#N" fixo (não editável) que confundia o usuário achando que a numeração estava travada — **corrigido**, o campo de número que sempre funcionou continua ao lado do botão Salvar.
5. Chips do Elenco: removida a nota (0-99) das listas (confundia com o potencial); no lugar, o Elenco mostra o número da camisa. A escala de cores (verde/amarelo/cinza) agora indica o **potencial**, não mais a nota.
6. Botões do topo da partida (⏸ ⏩ etc.) cortados em telas estreitas — **corrigido** (tamanhos reduzidos + rolagem de segurança).

## Pendências abertas (nesta ordem de prioridade, combinada com o usuário)

(A lista de tasks do gerenciador interno é por sessão e não é carregada automaticamente numa conversa nova — recriar as tasks abaixo com `TaskCreate` ao retomar, se for usar o gerenciador.)

1. **Re-investigar numeração** (pode já estar resolvido pelo item 4 acima — reconfirmar no site publicado, não só localmente, pois GitHub Pages pode levar 1-2 min pra atualizar após push).
2. **Escalação interativa conectada à partida** — hoje `escalacao.html` só mostra uma prévia; a partida (`selectStarters()` em `game.js`) sorteia o time **aleatoriamente**, ignorando qualquer preferência do usuário. Pedido do usuário: poder escolher os titulares/reservas manualmente, e a partida usar essa escolha real (encaixando na tática selecionada). Também apareceu no feedback: "não tinha a posição de escolha dos jogos (titulares e reservas), quem estava no banco" — ligado a este mesmo ponto.
3. **Reduzir excesso de faltas/expulsões** — usuário relatou muitas faltas e **2 expulsões numa única partida** (viu pelos prints: falta dura seguida de 2º amarelo rapidamente, e outro jogador com vermelho direto). Revisar as constantes de chance de falta/cartão em `game.js` (buscar por `FOUL_CHANCE`, lógica de cartão/expulsão).
4. **Ritmo da partida mais cadenciado** — usuário achou o jogo rápido demais, "parece pebolim", quer algo mais próximo do ritmo real de futebol. Revisar velocidades de jogador/bola e frequência de ações em `game.js`.
5. **Rebalancear economia**: baixar `STARTING_BUDGET` de 100.000 para **20.000**, e reduzir proporcionalmente (aprox. ÷5) todas as despesas — custo de melhorias de departamento (`BASE_COST`), despesas de partida (`OTHER_EXPENSES_PER_MATCH`), salários (`BUCKET_BASE_SALARY`), custo de desbloqueio premium (`PREMIUM_COST`), receita de bilheteria (`BASE_MATCH_REVENUE`, `REVENUE_PER_TORCIDA_LEVEL`), valores de propostas de patrocínio (`SPONSOR_SLOTS`) — **EXCETO** o passe/valor de mercado dos jogadores (`MARKET_VALUE_MIN`/`MAX`, `transferFee`), que o usuário quer manter como está (fica proporcionalmente mais caro/relevante com o orçamento menor — "apostar tudo" ao contratar).
6. **Aumentar níveis de departamento**: hoje `MAX_LEVEL = 5` (os "5 pontinhos" nos departamentos do Campus). Usuário pediu para subir para **pelo menos 20** níveis. Isso também exige reajustar `CAMPUS_TIER_CAPS` (hoje `{ bairro: 1, cidade: 2, regional: 4, estadual: 5 }`, proporcionalmente para uma escala de 20) e revisar a fórmula `upgradeCost(level)` pra não ficar absurda em 20 níveis, já compatível com o orçamento menor do item 5.
7. **Corrigir botões do topo cortados no mobile** — ✅ já corrigido nesta sessão (ver acima), só falta reconfirmar no site publicado.

## Depois das pendências acima: Tour do "Presidente do Time"

Pedido do usuário, para depois de resolver os itens acima: um sistema de **onboarding guiado**, no estilo "tour", com um personagem "Presidente do Time" (o jogador escolhe no cadastro se é homem ou mulher) guiando o novo usuário pelas telas/funcionalidades do jogo, dando recompensas conforme ele avança/conhece cada parte. Ideia do usuário: "eu que criei o jogo contigo estou tendo dificuldades, imagine quem não conhece" — ou seja, o jogo está ficando complexo demais pra quem chega sem contexto, e esse tour resolveria isso. Ainda não iniciado — é uma funcionalidade grande (personagem, fluxo de tutorial passo a passo, sistema de recompensa por etapa), avaliar escopo com calma antes de começar.

## Fluxo de trabalho / testes (usado a sessão inteira)

1. Editar arquivo(s).
2. `node --check <arquivo>.js` pra validar sintaxe.
3. Subir um servidor de teste local: `python3 -m http.server <porta> --directory /workspace/planas_games` via Bash com `run_in_background: true` (a porta muda a cada sessão nova porque o container reinicia e mata processos em background — sempre conferir com `curl -sI http://localhost:<porta>/games/futebol/index.html` antes de rodar testes).
4. Escrever script Playwright em `/tmp/claude-0/.../scratchpad/test_*.js` e rodar com `NODE_PATH=/opt/node22/lib/node_modules node <script>.js` (também via `run_in_background: true` — partidas completas em 2x velocidade levam ~2-3 min).
5. Sempre rodar uma regressão de partida completa (`#btn-speed`, aguardar `#overlay-title === 'FIM DE JOGO'`, checar 0 banners de erro) antes de subir qualquer mudança em `game.js`.
6. `git add` só os arquivos relevantes (nunca `-A` sem checar), commitar com mensagem em português explicando o quê e o porquê, `git push -u origin main`.

## Outras notas importantes

- **Google AdSense**: conta criada, site verificado (via `sitedasletras/sitedasletras.github.io`, repositório novo criado especificamente pra isso, com página de redirecionamento pro jogo), revisão pedida ao Google — só falta aguardar aprovação (pode levar horas/dias, chega por e-mail). Nada mais a fazer até a aprovação chegar.
- **Ideias salvas pra depois** (não iniciar sem pedido explícito): matchmaking progressivo robô→humano para todos os jogos esportivos da WSP (documentado em `docs/matchmaking-robos-humanos-spec.md`), câmera 3D ("só quando tivermos recursos financeiros"), jogo separado "Futebol Mister Class" (controle manual em tempo real, timing comprimido: 2min30s por tempo).
- Conta de e-mail do jogo (usada no AdSense/contato): `omeutimaoeumabosta@gmail.com`.

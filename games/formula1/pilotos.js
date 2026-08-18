Vitor', 'Felipe', 'Igor', 'André', 'Caio', 'Danilo', 'Everton', 'Wesley',
    'Jonas', 'Kaique', 'Renan', 'Otávio', 'Fábio', 'Gustavo', 'Marcelo',
    'Alisson', 'Douglas', 'Elias', 'Fernando', 'Hugo', 'Ivan', 'Josué',
    'Max', 'Lewis', 'Charles', 'Carlos', 'Lando', 'Oscar', 'Fernando', 'Yuki',
    'Pierre', 'Esteban', 'Nico', 'Valtteri', 'Sergio', 'Lance', 'Alex',
  ];
  const LAST_NAMES = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Almeida', 'Ferreira',
    'Costa', 'Pereira', 'Carvalho', 'Gomes', 'Martins', 'Araújo', 'Barbosa',
    'Cardoso', 'Ribeiro', 'Teixeira', 'Moreira', 'Correia', 'Nascimento',
    'Verstoppen', 'Hamiltone', 'Leclerque', 'Sainzo', 'Norrisen', 'Piastro',
    'Alonzo', 'Tsunodo', 'Gasly', 'Oconne', 'Rossberg', 'Bottaso', 'Perezo',
  ];

  const STAGE_RATING_MULT = { promessa: 0.8, ascensao: 0.92, auge: 1.1, experiente: 1.0, declinio: 0.85 };
  const BASE_RATING = 62;

  function randomRating(age) {
    const stage = careerStageFor(age);
    const base = BASE_RATING * STAGE_RATING_MULT[stage];
    const variance = (Math.random() - 0.5) * 18;
    return Math.round(Math.max(35, Math.min(99, base + variance)));
  }

  // Potencial: teto de crescimento do piloto (0-200, mesma escala do futebol).
  // Ligas iniciais ficam entre 2 e 10; raramente aparece uma "joia" jovem
  // com potencial até 15, bem mais cara de contratar.
  const POTENTIAL_GEM_CHANCE = 0.08;
  function randomPotential(age) {
    const stage = careerStageFor(age);
    const isYoung = stage === 'promessa' || stage === 'ascensao';
    if (isYoung && Math.random() < POTENTIAL_GEM_CHANCE) {
      return 11 + Math.floor(Math.random() * 5); // joia: 11-15
    }
    return 2 + Math.floor(Math.random() * 9); // normal: 2-10
  }

  const STAGE_SALARY_MULT = { promessa: 0.6, ascensao: 0.85, auge: 1.3, experiente: 1.0, declinio: 0.7 };
  const BASE_SALARY = 90;

  function randomSalary(age) {
    const stage = careerStageFor(age);

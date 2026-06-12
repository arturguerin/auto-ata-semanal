// =============================================================================
// PROJETO 2 — Trello (Planner E-commerce) -> Ata Semanal no Google Docs
// Apps Script vinculado ao Google Doc da ata
//
// Como instalar:
//   1. Abra o Google Doc onde ficam as atas
//   2. Extensoes -> Apps Script -> cole este codigo
//   3. Va em Configuracoes (engrenagem) -> Propriedades do script -> adicione:
//        TRELLO_API_KEY  ->  sua key  (trello.com/app-key)
//        TRELLO_TOKEN    ->  seu token
//   4. Habilite o Servico Avancado: Servicos (+) -> Google Docs API -> Adicionar
//   5. Rode configurarTrigger() UMA VEZ para agendar o cron
//   6. Rode gerarAta() manualmente para testar
// =============================================================================

// § (U+00A7) — marca paragrafos que viram checklist nativo.
// Improvavel de aparecer em nomes de cards do Trello.
var MARKER = "\u00A7";

// -----------------------------------------------------------------------------
// CONFIGURACAO
// -----------------------------------------------------------------------------

var CONFIG_ATA = {
  TRELLO_BOARD_ID: "69d93d13d4f3553e08d8b38c",  // Planner E-commerce

  // ID do Google Doc onde as atas sao inseridas
  DOC_ID: "1fvbl1_J8eU3NDHf3sXvSPMkLXg4567tz8he1yfiaO0A",

  // Listas utilitarias do board
  DONE_LIST_ID:    "69d93d13d4f3553e08d8b38b",
  STANDBY_LIST_ID: "69d93d13d4f3553e08d8b38a",
  BACKLOG_LIST_ID: "69de87b962354639a4abf761",

  // Listas individuais por colaborador (cards = tarefas em execucao na semana)
  COLABORADORES: [
    { nome: "Victor",     listaId: "69d94d767b7c7127594f43ef" },
    { nome: "Livia",      listaId: "69d93d13d4f3553e08d8b386" },
    { nome: "Leticia",    listaId: "69d93d13d4f3553e08d8b387" },
    { nome: "Kaylane",    listaId: "69d94d7a526b541ad7b75063" },
    { nome: "Artur",      listaId: "6a28c170f7f064160fb18917" },
    { nome: "Tecnologia", listaId: "6a28d52e7026d5298aa77f7d" },
  ],
};

// -----------------------------------------------------------------------------
// FUNCAO PRINCIPAL
// -----------------------------------------------------------------------------

function gerarAta() {
  var props  = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty("TRELLO_API_KEY");
  var token  = props.getProperty("TRELLO_TOKEN");

  if (!apiKey || !token) {
    Logger.log("ERRO: TRELLO_API_KEY e/ou TRELLO_TOKEN nao configurados nas Propriedades do Script.");
    return;
  }

  // Datas
  var hoje          = new Date();
  var semana        = getWeekNumber(hoje);
  var dataFormatada = Utilities.formatDate(hoje, "America/Fortaleza", "dd/MM/yyyy");
  var tituloAta     = "W" + semana + " - " + dataFormatada + " | Semanal Ecommerce";

  // Segunda-feira desta semana para filtrar concluidos
  var segunda    = getMondayOfCurrentWeek(hoje);
  var segundaISO = Utilities.formatDate(segunda, "UTC", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

  Logger.log("Gerando ata: " + tituloAta);
  Logger.log("Filtrando concluidos desde: " + segundaISO);

  // Busca dados do Trello
  var concluidos = buscarConcluidosSemana(apiKey, token, segundaISO);
  var emExecucao = buscarEmExecucao(apiKey, token);
  var standby    = buscarCards(CONFIG_ATA.STANDBY_LIST_ID, apiKey, token);
  var backlog    = buscarCards(CONFIG_ATA.BACKLOG_LIST_ID, apiKey, token);

  // Abre o Google Doc e insere no topo (indice 0)
  var doc  = DocumentApp.openById(CONFIG_ATA.DOC_ID);
  var body = doc.getBody();
  var idx  = 0;

  // --- Titulo da ata (Heading 2) ---
  var paraTitulo = body.insertParagraph(idx++, tituloAta);
  paraTitulo.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  // --- Anotacoes ---
  idx = inserirLabel(body, idx, "Anotacoes");
  var pAnotacao = body.insertParagraph(idx++, "");
  pAnotacao.editAsText().setBold(false);

  // --- Concluido na semana ---
  idx = inserirLabel(body, idx, "Concluido na semana");
  if (concluidos.length === 0) {
    var p = body.insertParagraph(idx++, "Nenhum card concluido esta semana.");
    p.editAsText().setBold(false);
  } else {
    concluidos.forEach(function(card) {
      var p = body.insertParagraph(idx++, card.name);
      p.setGlyphType(DocumentApp.GlyphType.BULLET);
      p.editAsText().setBold(false);
    });
  }

  // --- Em execucao por responsavel (itens com prefixo § viram checklist) ---
  idx = inserirLabel(body, idx, "Em execucao por responsavel");
  var totalExecucao = 0;
  CONFIG_ATA.COLABORADORES.forEach(function(colab) {
    var cards = emExecucao[colab.nome] || [];
    if (cards.length === 0) return;

    var pColab = body.insertParagraph(idx++, colab.nome + ":");
    pColab.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    pColab.editAsText().setBold(true);

    cards.forEach(function(card) {
      var texto = MARKER + " " + card.name;
      if (card.due) {
        var dueFormatada = Utilities.formatDate(new Date(card.due), "America/Fortaleza", "dd/MM/yyyy");
        texto += " — prazo: " + dueFormatada;
      }
      var p = body.insertParagraph(idx++, texto);
      p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
      p.editAsText().setBold(false);
      totalExecucao++;
    });
  });
  if (totalExecucao === 0) {
    var p = body.insertParagraph(idx++, "Nenhum card em execucao.");
    p.editAsText().setBold(false);
  }

  // --- Stand By ---
  idx = inserirLabel(body, idx, "Stand By");
  if (standby.length === 0) {
    var p = body.insertParagraph(idx++, "Nenhum card em stand by.");
    p.editAsText().setBold(false);
  } else {
    standby.forEach(function(card) {
      var p = body.insertParagraph(idx++, card.name);
      p.setGlyphType(DocumentApp.GlyphType.BULLET);
      p.editAsText().setBold(false);
    });
  }

  // --- Backlog ---
  idx = inserirLabel(body, idx, "Backlog");
  if (backlog.length === 0) {
    var p = body.insertParagraph(idx++, "Backlog vazio.");
    p.editAsText().setBold(false);
  } else {
    backlog.forEach(function(card) {
      var p = body.insertParagraph(idx++, card.name);
      p.setGlyphType(DocumentApp.GlyphType.BULLET);
      p.editAsText().setBold(false);
    });
  }

  // Linha separadora
  var pSep = body.insertParagraph(idx++, "\u2015\u2015\u2015");
  pSep.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  pSep.editAsText().setBold(false);

  // Salva e aplica checklist nativo via Docs Advanced Service
  doc.saveAndClose();
  Utilities.sleep(2000);

  if (totalExecucao > 0) {
    aplicarChecklistViaDocs(CONFIG_ATA.DOC_ID);
  }

  Logger.log("Ata gerada com sucesso: " + tituloAta);
}

// -----------------------------------------------------------------------------
// LABEL DE SECAO — bold, estilo Normal (nao polui o outline do doc)
// -----------------------------------------------------------------------------

function inserirLabel(body, index, texto) {
  var p = body.insertParagraph(index, texto);
  p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  p.editAsText().setBold(true);
  return index + 1;
}

// -----------------------------------------------------------------------------
// BUSCA TRELLO
// -----------------------------------------------------------------------------

/**
 * Retorna cards que foram movidos para a lista Done desde segunda-feira.
 * Usa o endpoint de actions do board com filtro updateCard.
 */
function buscarConcluidosSemana(apiKey, token, desde) {
  var url = "https://api.trello.com/1/boards/" + CONFIG_ATA.TRELLO_BOARD_ID
    + "/actions?filter=updateCard&since=" + encodeURIComponent(desde)
    + "&limit=1000&fields=data,date"
    + "&key=" + apiKey + "&token=" + token;

  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    Logger.log("Erro ao buscar actions: " + res.getResponseCode() + " " + res.getContentText().substring(0, 200));
    return [];
  }

  var actions   = JSON.parse(res.getContentText());
  var vistos    = {};
  var concluidos = [];

  actions.forEach(function(action) {
    var data      = action.data || {};
    var listAfter = data.listAfter || {};
    var card      = data.card || {};
    if (listAfter.id === CONFIG_ATA.DONE_LIST_ID && card.id && !vistos[card.id]) {
      vistos[card.id] = true;
      concluidos.push({ name: card.name || "(sem nome)", id: card.id });
    }
  });

  Logger.log("Concluidos na semana: " + concluidos.length);
  return concluidos;
}

/**
 * Retorna um objeto { NomeColab: [cards] } com as tarefas em execucao.
 */
function buscarEmExecucao(apiKey, token) {
  var resultado = {};
  CONFIG_ATA.COLABORADORES.forEach(function(colab) {
    resultado[colab.nome] = buscarCards(colab.listaId, apiKey, token);
    Logger.log(colab.nome + ": " + resultado[colab.nome].length + " card(s)");
  });
  return resultado;
}

/**
 * Busca todos os cards de uma lista do Trello.
 */
function buscarCards(listaId, apiKey, token) {
  var url = "https://api.trello.com/1/lists/" + listaId
    + "/cards?fields=name,due&key=" + apiKey + "&token=" + token;
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    Logger.log("Erro ao buscar lista " + listaId + ": " + res.getResponseCode());
    return [];
  }
  return JSON.parse(res.getContentText());
}

// -----------------------------------------------------------------------------
// CHECKLIST NATIVO VIA DOCS ADVANCED SERVICE
// Requer: Servicos (+) -> Google Docs API -> Adicionar (no editor do Apps Script)
// -----------------------------------------------------------------------------

/**
 * Le o documento via Docs.Documents, encontra todos os paragrafos com
 * prefixo §, aplica BULLET_CHECKBOX e remove o § em ordem reversa.
 */
function aplicarChecklistViaDocs(docId) {
  var doc     = Docs.Documents.get(docId);
  var content = doc.body.content;

  var checkRanges  = [];
  var deleteRanges = [];

  for (var i = 0; i < content.length; i++) {
    var elem = content[i];
    if (!elem.paragraph) continue;

    var texto = (elem.paragraph.elements || [])
      .map(function(e) { return e.textRun ? e.textRun.content : ""; })
      .join("");

    if (texto.charAt(0) === MARKER) {
      checkRanges.push({ startIndex: elem.startIndex, endIndex: elem.endIndex });
      // Deleta apenas o caractere § (1 char)
      deleteRanges.push({ startIndex: elem.startIndex, endIndex: elem.startIndex + 1 });
    }
  }

  if (checkRanges.length === 0) {
    Logger.log("Nenhum paragrafo com § encontrado para converter.");
    return;
  }

  // 1. createParagraphBullets nao altera indices, pode ir em qualquer ordem
  // 2. deleteContentRange DEVE ir em ordem reversa (de baixo para cima)
  var requests = [];

  checkRanges.forEach(function(range) {
    requests.push({
      createParagraphBullets: {
        range: range,
        bulletPreset: "BULLET_CHECKBOX",
      },
    });
  });

  deleteRanges.reverse().forEach(function(range) {
    requests.push({ deleteContentRange: { range: range } });
  });

  Docs.Documents.batchUpdate({ requests: requests }, docId);
  Logger.log("Checklist nativo aplicado em " + checkRanges.length + " item(s).");
}

// -----------------------------------------------------------------------------
// TRIGGER
// -----------------------------------------------------------------------------

/**
 * Configura o cron para rodar toda sexta-feira as 10h (America/Fortaleza).
 * Rode manualmente UMA UNICA VEZ apos colar o script.
 */
function configurarTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "gerarAta") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("gerarAta")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(10)
    .inTimezone("America/Fortaleza")
    .create();

  Logger.log("Trigger configurado: toda sexta-feira as 10h (America/Fortaleza).");
}

// -----------------------------------------------------------------------------
// UTILITARIOS
// -----------------------------------------------------------------------------

/** Retorna o numero da semana ISO (1-53) para uma data. */
function getWeekNumber(date) {
  var d      = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/** Retorna a segunda-feira da semana da data fornecida (hora 00:00:00). */
function getMondayOfCurrentWeek(date) {
  var d   = new Date(date);
  var day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

// -----------------------------------------------------------------------------
// HELPERS — rodar manualmente para inspecionar IDs do Trello
// -----------------------------------------------------------------------------

/** Lista todas as listas do board. Resultado em: Visualizar -> Registros. */
function listarListasAta() {
  var props  = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty("TRELLO_API_KEY");
  var token  = props.getProperty("TRELLO_TOKEN");
  var url = "https://api.trello.com/1/boards/" + CONFIG_ATA.TRELLO_BOARD_ID
    + "/lists?key=" + apiKey + "&token=" + token;
  JSON.parse(UrlFetchApp.fetch(url).getContentText()).forEach(function(l) {
    Logger.log(l.name + "  ->  " + l.id);
  });
}

/** Lista todos os membros do board. */
function listarMembrosAta() {
  var props  = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty("TRELLO_API_KEY");
  var token  = props.getProperty("TRELLO_TOKEN");
  var url = "https://api.trello.com/1/boards/" + CONFIG_ATA.TRELLO_BOARD_ID
    + "/members?key=" + apiKey + "&token=" + token;
  JSON.parse(UrlFetchApp.fetch(url).getContentText()).forEach(function(m) {
    Logger.log(m.fullName + " (@" + m.username + ")  ->  " + m.id);
  });
}

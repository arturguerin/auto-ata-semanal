// =============================================================================
// PROJETO 1 — Google Chat /task -> Trello Card
// Apps Script implantado como Web App (webhook doPost)
//
// Como instalar:
//   1. Acesse script.google.com -> Novo projeto
//   2. Cole este codigo
//   3. Va em Configuracoes (engrenagem) -> Propriedades do script -> adicione:
//        TRELLO_API_KEY   ->  sua key  (trello.com/app-key)
//        TRELLO_TOKEN     ->  seu token
//        WEBHOOK_SECRET   ->  uma senha qualquer (ex: "minha_senha_secreta")
//   4. Preencha CONFIG abaixo (TRELLO_LIST_ID e MEMBER_MAP)
//   5. Implante: Implantar -> Nova implantacao -> App da Web
//        Executar como: Eu | Acesso: Qualquer pessoa
//   6. Copie a URL gerada -> configure no Google Chat API com ?secret=WEBHOOK_SECRET
// =============================================================================

const CONFIG = {
  // ID da lista Backlog no Trello (rode listarListas() para confirmar)
  TRELLO_LIST_ID: "69de87b962354639a4abf761",

  // Mapa @apelido -> ID do membro no Trello
  // Rode listarMembros() para descobrir os IDs e preencha aqui
  MEMBER_MAP: {
    "@victor":      "",
    "@livia":       "",
    "@leticia":     "",
    "@kaylane":     "",
    "@artur":       "",
    "@tecnologia":  "",
  },
};

// -----------------------------------------------------------------------------
// WEBHOOK PRINCIPAL
// -----------------------------------------------------------------------------

function doPost(e) {
  try {
    var props  = PropertiesService.getScriptProperties();
    var secret = props.getProperty("WEBHOOK_SECRET") || "";
    var params = e.parameter || {};

    if (secret && params.secret !== secret) {
      return responder("Acesso negado.");
    }

    var body = JSON.parse(e.postData.contents);

    if (body.type !== "MESSAGE") {
      return responder("");
    }

    var texto = (body.message && body.message.argumentText)
      ? body.message.argumentText.trim()
      : "";

    if (!texto) {
      return responder("Uso: /task Titulo | Descricao | @pessoa | dd/mm/aaaa | - item1, item2");
    }

    var resultado = criarCardTrello(texto);
    return responder(resultado);

  } catch (err) {
    Logger.log("Erro no doPost: " + err.toString());
    return responder("Erro interno: " + err.message);
  }
}

// -----------------------------------------------------------------------------
// CRIACAO DO CARD
// -----------------------------------------------------------------------------

function criarCardTrello(texto) {
  var props  = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty("TRELLO_API_KEY");
  var token  = props.getProperty("TRELLO_TOKEN");

  if (!apiKey || !token) {
    return "ERRO: TRELLO_API_KEY e/ou TRELLO_TOKEN nao configurados nas Propriedades do Script.";
  }

  // Formato: Titulo | Descricao | @pessoa | dd/mm/aaaa | - item1, item2
  var partes      = texto.split("|").map(function(p) { return p.trim(); });
  var titulo      = partes[0] || "";
  var descricao   = partes[1] || "";
  var responsavel = partes[2] || "";
  var dataStr     = partes[3] || "";
  var checklistStr = partes[4] || "";

  if (!titulo) {
    return "ERRO: Titulo obrigatorio. Uso: /task Titulo | Descricao | @pessoa | dd/mm/aaaa | - item1, item2";
  }

  if (!responsavel) {
    return "ERRO: Responsavel obrigatorio. Use @apelido.";
  }

  var alias    = responsavel.toLowerCase().replace(/\s/g, "");
  var membroId = CONFIG.MEMBER_MAP[alias] || "";
  if (!membroId) {
    return "ERRO: Membro '" + responsavel + "' nao encontrado. Verifique o MEMBER_MAP no CONFIG.";
  }

  // Converte data dd/mm/aaaa -> ISO
  var dueDate = "";
  if (dataStr) {
    var partsData = dataStr.split("/");
    if (partsData.length === 3) {
      dueDate = partsData[2] + "-" + partsData[1] + "-" + partsData[0] + "T23:59:59.000Z";
    }
  }

  var payload = {
    name:      titulo,
    desc:      descricao,
    idList:    CONFIG.TRELLO_LIST_ID,
    idMembers: membroId,
    key:       apiKey,
    token:     token,
  };
  if (dueDate) payload.due = dueDate;

  var res = UrlFetchApp.fetch("https://api.trello.com/1/cards", {
    method: "post",
    payload: payload,
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() !== 200) {
    Logger.log("Erro Trello: " + res.getContentText());
    return "ERRO ao criar card no Trello (" + res.getResponseCode() + "): " + res.getContentText().substring(0, 100);
  }

  var card = JSON.parse(res.getContentText());

  if (checklistStr) {
    adicionarChecklist(card.id, checklistStr, apiKey, token);
  }

  return "Card criado: " + card.shortUrl;
}

// -----------------------------------------------------------------------------
// CHECKLIST
// -----------------------------------------------------------------------------

function adicionarChecklist(cardId, checklistStr, apiKey, token) {
  try {
    var res = UrlFetchApp.fetch("https://api.trello.com/1/checklists", {
      method: "post",
      payload: { idCard: cardId, name: "Checklist", key: apiKey, token: token },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) return;
    var checklist = JSON.parse(res.getContentText());

    // Formato: "- item1, item2" ou "item1, item2"
    var itens = checklistStr.replace(/^-\s*/, "").split(",").map(function(i) { return i.trim(); });
    itens.forEach(function(item) {
      if (!item) return;
      UrlFetchApp.fetch(
        "https://api.trello.com/1/checklists/" + checklist.id + "/checkItems",
        {
          method: "post",
          payload: { name: item, key: apiKey, token: token },
          muteHttpExceptions: true,
        }
      );
    });
  } catch (err) {
    Logger.log("Erro ao criar checklist: " + err.toString());
  }
}

// -----------------------------------------------------------------------------
// RESPOSTA PARA O CHAT
// -----------------------------------------------------------------------------

function responder(texto) {
  return ContentService
    .createTextOutput(JSON.stringify({ text: texto || "" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// -----------------------------------------------------------------------------
// HELPERS — rodar manualmente no editor para descobrir IDs do Trello
// -----------------------------------------------------------------------------

/**
 * Lista todas as listas do board Planner E-commerce.
 * Veja o resultado em: Visualizar -> Registros de execucao
 */
function listarListas() {
  var props  = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty("TRELLO_API_KEY");
  var token  = props.getProperty("TRELLO_TOKEN");
  var boardId = "69d93d13d4f3553e08d8b38c";
  var url = "https://api.trello.com/1/boards/" + boardId
    + "/lists?key=" + apiKey + "&token=" + token;
  JSON.parse(UrlFetchApp.fetch(url).getContentText()).forEach(function(l) {
    Logger.log(l.name + "  ->  " + l.id);
  });
}

/**
 * Lista todos os membros do board com seus IDs.
 * Use os IDs para preencher o MEMBER_MAP no CONFIG.
 */
function listarMembros() {
  var props  = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty("TRELLO_API_KEY");
  var token  = props.getProperty("TRELLO_TOKEN");
  var boardId = "69d93d13d4f3553e08d8b38c";
  var url = "https://api.trello.com/1/boards/" + boardId
    + "/members?key=" + apiKey + "&token=" + token;
  JSON.parse(UrlFetchApp.fetch(url).getContentText()).forEach(function(m) {
    Logger.log(m.fullName + " (@" + m.username + ")  ->  " + m.id);
  });
}

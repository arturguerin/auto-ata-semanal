# GoCase E-commerce — Automações com Google Apps Script

Dois projetos independentes que integram **Trello**, **Google Chat** e **Google Docs** sem infraestrutura externa (sem servidor, sem deployment, sem Service Account).

---

## Estrutura

```
projeto1-chat-trello.gs   → Google Chat /task → card no Trello
projeto2-ata-semanal.gs   → Trello → Ata semanal no Google Docs
```

---

## Projeto 1 — Google Chat `/task` → Trello

Transforma mensagens `/task` no Google Chat em cards no Trello (lista Backlog).

### Formato do comando

```
/task Título | Descrição | @pessoa | dd/mm/aaaa | - item1, item2
```

| Campo | Obrigatório | Descrição |
|---|---|---|
| Título | ✅ | Nome do card |
| Descrição | — | Texto descritivo |
| @pessoa | ✅ | Responsável (mapeado no MEMBER_MAP) |
| dd/mm/aaaa | — | Data de entrega |
| - item1, item2 | — | Itens de checklist |

### Instalação

1. Acesse [script.google.com](https://script.google.com) → **Novo projeto**
2. Cole o conteúdo de `projeto1-chat-trello.gs`
3. **Propriedades do script** (⚙️) → adicione:
   - `TRELLO_API_KEY` → [trello.com/app-key](https://trello.com/app-key)
   - `TRELLO_TOKEN` → mesma página, clique em **Token**
   - `WEBHOOK_SECRET` → qualquer string (ex: `minha_senha`)
4. Rode `listarMembros()` no editor para descobrir os IDs e preencha o `MEMBER_MAP` no código
5. **Implantar → Nova implantação → App da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
6. Copie a URL e configure no Google Chat API como:
   ```
   https://script.google.com/macros/s/SEU_ID/exec?secret=minha_senha
   ```

---

## Projeto 2 — Ata Semanal Automática (Trello → Google Docs)

Gera automaticamente toda sexta-feira às 10h a ata de reunião semanal do time de e-commerce, puxando dados do Trello e inserindo no Google Docs.

### Seções geradas

| Seção | Fonte |
|---|---|
| Anotações | Campo livre para preenchimento manual |
| Concluído na semana | Cards movidos para Done desde segunda-feira |
| Em execução por responsável | Cards nas listas individuais de cada colaborador |
| Stand By | Cards na lista Stand By |
| Backlog | Cards na lista Backlog |

Os itens de **Em execução** viram **checklists nativos** do Google Docs (clicáveis).

### Instalação

1. Abra o Google Doc onde ficam as atas
2. **Extensões → Apps Script** → cole o conteúdo de `projeto2-ata-semanal.gs`
3. **Propriedades do script** (⚙️) → adicione:
   - `TRELLO_API_KEY`
   - `TRELLO_TOKEN`
4. **Habilite o Serviço Avançado:**
   - No editor, clique em **Serviços (+)** → **Google Docs API** → **Adicionar**
5. Rode `configurarTrigger()` **uma única vez** para agendar o cron
6. Rode `gerarAta()` para testar

### Board Trello — IDs configurados

| Lista | ID |
|---|---|
| Done | `69d93d13d4f3553e08d8b38b` |
| Stand By | `69d93d13d4f3553e08d8b38a` |
| Backlog | `69de87b962354639a4abf761` |
| Victor | `69d94d767b7c7127594f43ef` |
| Lívia | `69d93d13d4f3553e08d8b386` |
| Letícia | `69d93d13d4f3553e08d8b387` |
| Kaylane | `69d94d7a526b541ad7b75063` |
| Artur | `6a28c170f7f064160fb18917` |
| Tecnologia | `6a28d52e7026d5298aa77f7d` |

---

## Decisões técnicas

- **Apps Script vs worker externo:** Apps Script elimina Service Account, JWT auth e deployment scripts — tudo roda dentro do Google com autenticação nativa.
- **Checklist nativo no Google Docs:** `GlyphType.CHECK` não existe no Apps Script. A solução usa prefixo `§` + `Docs.Documents.batchUpdate()` com preset `BULLET_CHECKBOX` via Google Docs Advanced Service.
- **Credenciais:** armazenadas em `PropertiesService.getScriptProperties()`, nunca hardcoded.
- **Filtro de concluídos:** usa o endpoint `/boards/{id}/actions?filter=updateCard&since=<monday-iso>` para capturar apenas cards movidos para Done durante a semana corrente.

---

## Tecnologias

- Google Apps Script
- Trello REST API
- Google Docs Advanced Service (`Docs.Documents.batchUpdate`)
- Google Chat API (slash command + webhook)

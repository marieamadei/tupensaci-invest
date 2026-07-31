(() => {
  "use strict";

  const STORAGE_KEY = "tupensaci-ai-mockup-v11";
  const VALID_SCREENS = new Set(Array.from({ length: 21 }, (_, index) => String(index + 1).padStart(2, "0")));
  const FLOW_ORDER = ["01", "02", "14", "03", "04", "20", "21", "15", "05", "06", "07", "08", "09", "10", "16", "11", "17", "12", "18", "19", "13"];

  /* Decisioni approvate per il primo MVP:
     - lo spunto di oggi è la porta quotidiana stabile e può essere una frase, una domanda o un check-in;
     - il tono predefinito è gentile e resta una preferenza esplicita;
     - la memoria è separata dal consenso al servizio e richiede conferma puntuale;
     - i pattern sono sempre formulati come ipotesi correggibili. */
  const defaultState = () => ({
    version: 2,
    scenario: "day1",
    currentScreen: "01",
    onboardingComplete: false,
    intention: "cambiamento",
    tone: "gentile",
    rhythm: "scelgo",
    memoryEnabled: true,
    workbook: "diario",
    workbookStage: "mese-2",
    workbookPromise: "Rimettere me stessa al centro, senza aspettare di avere più tempo.",
    desiredSelf: "Una persona che protegge il proprio tempo senza sentirsi in colpa.",
    workbookSource: "existing-copy",
    workbookLinked: false,
    serviceConsent: true,
    remindersEnabled: false,
    accountEmail: "marie@example.com",
    reflection: "",
    smallStep: "Bloccare due sere in agenda senza lavoro",
    proposedMemory: "Stai cercando di proteggere due sere alla settimana dal lavoro.",
    memoryDecision: "pending",
    memories: [],
    savedPhrase: false,
    feedback: null,
    feedbackReason: null,
    responseVariant: "primary",
    stepStatus: "open",
    patternCorrection: "",
    lastUpdated: new Date().toISOString()
  });

  let state = loadState();
  let toastTimer = null;
  let editMode = "memory";

  const screens = [...document.querySelectorAll("[data-screen]")];
  const appChrome = document.querySelector("[data-app-chrome]");
  const phoneShell = document.getElementById("phone-shell");
  const toast = document.querySelector("[data-toast]");
  const prototypeDialog = document.getElementById("prototype-dialog");
  const editDialog = document.getElementById("edit-memory-dialog");
  const clearDialog = document.getElementById("clear-dialog");
  const feedbackDialog = document.getElementById("feedback-dialog");
  const deleteAccountDialog = document.getElementById("delete-account-dialog");

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved && saved.version === 2 ? { ...defaultState(), ...saved } : defaultState();
    } catch (error) {
      return defaultState();
    }
  }

  function persist() {
    state.lastUpdated = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast("Non riesco a salvare in locale. L’esperienza resta comunque utilizzabile.");
    }
  }

  function currentScreenFromHash() {
    const hash = window.location.hash.replace("#", "");
    return VALID_SCREENS.has(hash) ? hash : state.currentScreen;
  }

  function goTo(screenId) {
    const next = String(screenId).padStart(2, "0");
    if (!VALID_SCREENS.has(next)) return;
    state.currentScreen = next;
    persist();
    if (window.location.hash !== `#${next}`) {
      window.location.hash = next;
    } else {
      renderScreen(next, true);
    }
  }

  function renderScreen(screenId, moveFocus = false) {
    const current = VALID_SCREENS.has(screenId) ? screenId : "01";
    state.currentScreen = current;

    const ordinal = FLOW_ORDER.indexOf(current) + 1;
    document.querySelectorAll("[data-current-screen]").forEach((node) => {
      node.textContent = String(ordinal || 1).padStart(2, "0");
    });

    const guideStage = {
      "01": "01", "02": "01", "03": "01", "04": "01", "14": "01", "15": "01", "20": "01", "21": "01",
      "05": "05", "06": "05", "07": "07", "08": "08",
      "09": "09", "10": "09", "16": "09", "11": "09", "17": "09",
      "12": "08", "18": "18", "19": "18", "13": "13"
    }[current];
    document.querySelectorAll("[data-guide-screen]").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.guideScreen === guideStage);
    });

    screens.forEach((screen) => {
      screen.hidden = screen.dataset.screen !== current;
    });

    const immersive = new Set(["01", "02", "03", "04", "08", "13", "14", "15", "16", "19", "20", "21"]);
    appChrome.hidden = immersive.has(current);
    renderGlobalState();

    if (phoneShell) phoneShell.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "auto" });

    if (moveFocus) {
      window.requestAnimationFrame(() => {
        const title = document.querySelector(`[data-screen="${current}"] h1`);
        if (title) {
          title.setAttribute("tabindex", "-1");
          title.focus({ preventScroll: true });
        }
      });
    }
  }

  function renderGlobalState() {
    document.querySelectorAll("[data-scenario]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.scenario === state.scenario));
    });

    document.querySelectorAll("[data-choice-group='intention'] [data-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.choice === state.intention));
    });

    document.querySelectorAll("[data-workbook]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.workbook === state.workbook));
    });

    const workbookForm = document.getElementById("workbook-form");
    if (workbookForm) {
      workbookForm.elements.workbookStage.value = state.workbookStage;
      if (document.activeElement !== workbookForm.elements.workbookPromise) workbookForm.elements.workbookPromise.value = state.workbookPromise;
      if (document.activeElement !== workbookForm.elements.desiredSelf) workbookForm.elements.desiredSelf.value = state.desiredSelf;
    }

    const activeMemories = state.memories.filter((memory) => memory.status !== "deleted");
    document.querySelectorAll("[data-memory-status]").forEach((node) => {
      node.textContent = activeMemories.length ? `Memoria attiva · ${activeMemories.length}` : "Memoria vuota";
      node.closest(".memory-status")?.classList.toggle("is-active", activeMemories.length > 0);
    });

    document.querySelectorAll("[data-memory-count]").forEach((node) => {
      node.textContent = `${activeMemories.length} ${activeMemories.length === 1 ? "elemento" : "elementi"}`;
    });

    const form = document.getElementById("preferences-form");
    if (form) {
      const tone = form.querySelector(`[name="tone"][value="${state.tone}"]`);
      const rhythm = form.querySelector(`[name="rhythm"][value="${state.rhythm}"]`);
      if (tone) tone.checked = true;
      if (rhythm) rhythm.checked = true;
      form.elements.memory.checked = state.memoryEnabled;
    }

    const consentForm = document.getElementById("consent-form");
    if (consentForm) {
      consentForm.elements.serviceConsent.checked = state.serviceConsent;
      consentForm.elements.memoryConsent.checked = state.memoryEnabled;
      consentForm.elements.reminderConsent.checked = state.remindersEnabled;
    }

    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) {
      const settingsTone = settingsForm.querySelector(`[name="settingsTone"][value="${state.tone}"]`);
      if (settingsTone) settingsTone.checked = true;
      settingsForm.elements.settingsRhythm.value = state.rhythm;
      settingsForm.elements.settingsMemory.checked = state.memoryEnabled;
      settingsForm.elements.settingsReminders.checked = state.remindersEnabled;
    }

    const reflectionInput = document.getElementById("reflection-input");
    if (reflectionInput && reflectionInput.value !== state.reflection) reflectionInput.value = state.reflection;

    const stepInput = document.getElementById("small-step-input");
    if (stepInput && document.activeElement !== stepInput) stepInput.value = state.smallStep;

    const userMessage = document.querySelector("[data-user-message]");
    if (userMessage) {
      userMessage.textContent = state.reflection.trim() || "Vorrei proteggere del tempo che sia davvero mio.";
    }

    document.querySelectorAll("[data-moment-reflection], [data-recovered-copy]").forEach((node) => {
      node.textContent = state.reflection.trim() || "Vorrei proteggere del tempo che sia davvero mio.";
    });
    document.querySelectorAll("[data-moment-step]").forEach((node) => {
      node.textContent = state.smallStep || "Bloccare due sere in agenda senza lavoro";
    });

    document.querySelectorAll("[data-step-status]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.stepStatus === state.stepStatus);
    });

    document.querySelectorAll("[data-proposed-memory]").forEach((node) => {
      node.textContent = `“${state.proposedMemory}”`;
    });

    const saveButton = document.querySelector("[data-save-phrase]");
    if (saveButton) {
      saveButton.setAttribute("aria-pressed", String(state.savedPhrase));
      const label = saveButton.querySelector("[data-save-label]");
      if (label) label.textContent = state.savedPhrase ? "Salvata" : "Salva";
      const mark = saveButton.querySelector("span:first-child");
      if (mark) mark.textContent = state.savedPhrase ? "✓" : "+";
    }

    document.querySelectorAll("[data-feedback]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.feedback === state.feedback);
    });

    renderToday();
    renderConversation();
    renderMemoryList();
    renderTimeline();
  }

  function renderConversation() {
    const listen = document.querySelector("[data-ai-listen]");
    const question = document.querySelector("[data-ai-question]");
    if (!listen || !question) return;

    const answer = state.reflection.toLowerCase();
    if (state.responseVariant === "alternative") {
      listen.textContent = "Provo a restare più vicina alle tue parole: desideri uno spazio tuo, ma trasformarlo in un impegno potrebbe renderlo ancora meno libero.";
      question.textContent = "Quale confine minimo ti farebbe sentire che quel tempo ti appartiene davvero?";
    } else if (answer.includes("aiuto") || answer.includes("sola")) {
      listen.textContent = "Chiedere aiuto può sembrare un peso da aggiungere agli altri. Ma può anche essere il modo più concreto per non continuare a portare tutto da sola.";
      question.textContent = "A chi potresti chiedere una cosa piccola e precisa, oggi?";
    } else if (answer.includes("no") || answer.includes("lavoro") || answer.includes("tempo")) {
      listen.textContent = "Non sembra che ti manchi la volontà. Forse il punto è dare a quel tempo lo stesso valore che dai agli impegni presi con gli altri.";
      question.textContent = "Qual è una cosa abbastanza piccola da poterla fare oggi?";
    } else {
      listen.textContent = "Non serve risolvere tutto adesso. Possiamo cercare il punto più vicino a te, quello su cui hai davvero margine oggi.";
      question.textContent = "Quale piccolo segnale ti farebbe dire che hai iniziato?";
    }
  }

  function renderToday() {
    const date = document.querySelector("[data-today-date]");
    const phrase = document.querySelector("[data-daily-phrase]");
    const theme = document.querySelector("[data-phrase-theme]");
    const bridge = document.querySelector("[data-bridge-copy]");
    const context = document.querySelector("[data-workbook-context]");
    const source = document.querySelector("[data-phrase-source]");
    const linked = state.workbookLinked && state.workbook !== "none";
    if (context) {
      context.hidden = !linked;
      if (linked) {
        context.querySelector("span").textContent = workbookLabel(state.workbook);
        context.querySelector("strong").textContent = stageLabel(state.workbookStage);
      }
    }
    if (source) {
      source.textContent = linked
        ? `Dal ${workbookLabel(state.workbook)} · ${stageLabel(state.workbookStage)} · Selezione editoriale demo`
        : "Dal quaderno TUPENSACI · Selezione editoriale demo";
    }

    if (state.scenario === "day14") {
      if (date) date.textContent = "Lunedì, 27 luglio";
      if (phrase) phrase.textContent = "“Non tutto ciò che merita spazio deve prima diventare urgente.”";
      if (theme) theme.textContent = "Confini";
      if (bridge) bridge.textContent = linked
        ? `Puoi riprendere la promessa che hai scelto — “${state.workbookPromise}” — oppure partire solo da ciò che conta oggi.`
        : "Puoi riprendere il filo che avevi lasciato oppure partire solo da ciò che conta oggi.";
    } else {
      if (date) date.textContent = "Lunedì, 13 luglio";
      if (phrase) phrase.textContent = "“Non devi avere tutto chiaro per fare il prossimo passo.”";
      if (theme) theme.textContent = state.intention === "altro" ? "Il tuo momento" : capitalize(state.intention || "Cambiamento");
      if (bridge && linked) {
        bridge.textContent = `Sei in ${stageLabel(state.workbookStage).toLowerCase()} del tuo percorso. Questo spunto incontra la promessa che hai scelto: “${state.workbookPromise}”`;
      } else if (bridge) {
        const intention = state.intention && state.intention !== "altro" ? `dal ${state.intention}` : "da ciò che conta oggi";
        bridge.textContent = `Hai scelto di partire ${intention}. Vuoi vedere dove questo spunto incontra il tuo momento?`;
      }
    }
  }

  function renderTimeline() {
    const firstStep = document.querySelector("[data-timeline] .timeline-item:first-child h3");
    if (firstStep) firstStep.textContent = state.smallStep || "Un piccolo passo scelto da te";
  }

  function renderMemoryList() {
    const container = document.querySelector("[data-memory-list]");
    const empty = document.querySelector("[data-empty-memory]");
    if (!container || !empty) return;

    const memories = state.memories.filter((memory) => memory.status !== "deleted");
    container.replaceChildren();
    empty.hidden = memories.length > 0;

    memories.forEach((memory) => {
      const article = document.createElement("article");
      article.className = "memory-item";

      const top = document.createElement("div");
      top.className = "memory-item-top";

      const category = document.createElement("span");
      category.className = "memory-category";
      category.textContent = memory.category;

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "memory-delete";
      deleteButton.dataset.memoryDelete = memory.id;
      deleteButton.textContent = "Elimina";
      deleteButton.setAttribute("aria-label", `Elimina memoria: ${memory.text}`);

      top.append(category, deleteButton);

      const label = document.createElement("label");
      label.className = "sr-only";
      label.htmlFor = `memory-${memory.id}`;
      label.textContent = `Modifica ${memory.category}`;

      const input = document.createElement("input");
      input.id = `memory-${memory.id}`;
      input.value = memory.text;
      input.dataset.memoryInput = memory.id;

      const source = document.createElement("p");
      source.className = "memory-source";
      source.textContent = memory.source;

      article.append(top, label, input, source);
      container.append(article);
    });
  }

  function setScenario(scenario) {
    state.scenario = scenario;
    if (scenario === "day14") {
      ensureDay14Seed();
      persist();
      goTo("09");
      return;
    }
    if (scenario === "return") {
      ensureDay14Seed();
      persist();
      goTo("16");
      return;
    }
    if (scenario === "safety") {
      persist();
      goTo("13");
      return;
    }
    // Il selettore Prototype configura uno scenario isolato: Giorno 1 deve
    // mostrare davvero l'assenza di memoria, anche dopo aver testato Giorno 14.
    state.memories = [];
    state.memoryDecision = "pending";
    state.onboardingComplete = false;
    state.reflection = "";
    state.responseVariant = "primary";
    persist();
    goTo("01");
  }

  function ensureDay14Seed() {
    const seeds = [
      {
        id: "demo-intention",
        category: "Intenzione",
        text: "Proteggere due sere alla settimana dal lavoro.",
        source: "Confermata dopo la riflessione · 13 lug 2026",
        date: "2026-07-13",
        status: "active"
      },
      {
        id: "demo-preference",
        category: "Preferenza",
        text: "Preferisco un tono gentile e domande brevi.",
        source: "Scelta nelle preferenze demo · 13 lug 2026",
        date: "2026-07-13",
        status: "active"
      }
    ];

    seeds.forEach((seed) => {
      if (!state.memories.some((memory) => memory.id === seed.id)) state.memories.push(seed);
    });
    state.onboardingComplete = true;
    state.memoryDecision = "accepted";
  }

  function acceptProposedMemory() {
    if (!state.memoryEnabled) {
      state.memoryEnabled = true;
    }
    const existing = state.memories.find((memory) => memory.id === "first-intention");
    if (existing) {
      existing.text = state.proposedMemory;
      existing.status = "active";
    } else {
      state.memories.push({
        id: "first-intention",
        category: "Intenzione",
        text: state.proposedMemory,
        source: "Confermata dopo la riflessione · 13 lug 2026",
        date: "2026-07-13",
        status: "active"
      });
    }
    state.memoryDecision = "accepted";
    persist();
    document.querySelector("[data-memory-sheet]").hidden = true;
    document.querySelector("[data-memory-confirmed]").hidden = false;
    renderGlobalState();
    showToast("Memoria confermata. Il controllo resta tuo.");
  }

  function showMemoryProposalState() {
    const sheet = document.querySelector("[data-memory-sheet]");
    const confirmed = document.querySelector("[data-memory-confirmed]");
    if (!sheet || !confirmed) return;
    sheet.hidden = state.memoryDecision === "accepted";
    confirmed.hidden = state.memoryDecision !== "accepted";
  }

  function openEditDialog(mode = "memory") {
    editMode = mode;
    const title = document.getElementById("edit-memory-title");
    const label = document.querySelector("label[for='edit-memory-input']");
    const input = document.getElementById("edit-memory-input");

    if (mode === "pattern") {
      title.textContent = "Qual è la lettura più corretta?";
      label.textContent = "La tua correzione";
      input.value = state.patternCorrection;
      input.placeholder = "Per esempio: non temo di deludere, ho bisogno di più tempo per decidere.";
    } else {
      title.textContent = "Come vuoi formularlo?";
      label.textContent = "Memoria proposta";
      input.value = state.proposedMemory;
      input.placeholder = "Scrivi solo ciò che vuoi conservare.";
    }
    showDialog(editDialog);
  }

  function saveEditedText() {
    const value = document.getElementById("edit-memory-input").value.trim();
    if (!value) {
      showToast("Scrivi una formulazione oppure annulla.");
      return;
    }
    if (editMode === "pattern") {
      state.patternCorrection = value;
      showToast("Correzione registrata per questa demo, non aggiunta alla memoria.");
      persist();
      editDialog.close();
      goTo("09");
    } else {
      state.proposedMemory = value;
      state.memoryDecision = "pending";
      persist();
      editDialog.close();
      renderGlobalState();
      showToast("Memoria proposta aggiornata. Ora puoi confermarla.");
    }
  }

  function clearAllMemories() {
    state.memories = [];
    state.memoryDecision = "pending";
    persist();
    renderGlobalState();
    showToast("Memoria cancellata. Le preferenze del prototipo sono rimaste invariate.");
  }

  function exportMemory() {
    const payload = {
      exportedAt: new Date().toISOString(),
      prototype: true,
      account: "Marie (demo)",
      memories: state.memories.filter((memory) => memory.status !== "deleted")
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tupensaci-memoria-demo.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Esportazione demo preparata.");
  }

  function showDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function showToast(message, duration = 3400) {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, duration);
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
  }

  function workbookLabel(value) {
    return { diario: "Diario del Nuovo Inizio", crea: "Crea", arte: "L’Arte" }[value] || "Con te, ogni giorno";
  }

  function stageLabel(value) {
    return { inizio: "Inizio", "mese-1": "Mese 1", "mese-2": "Mese 2", "mese-3": "Mese 3", "mese-4": "Mese 4 o oltre" }[value] || "Il tuo punto";
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, a");
    if (!target) return;

    if (target.matches("[data-go]")) {
      event.preventDefault();
      goTo(target.dataset.go);
      return;
    }

    if (target.matches("[data-scenario]")) {
      setScenario(target.dataset.scenario);
      return;
    }

    if (target.matches("[data-open-dialog]")) {
      showDialog(document.getElementById(target.dataset.openDialog));
      return;
    }

    if (target.matches("[data-map-go]")) {
      closeDialog(prototypeDialog);
      goTo(target.dataset.mapGo);
      return;
    }

    if (target.matches("[data-choice]")) {
      state.intention = target.dataset.choice;
      persist();
      renderGlobalState();
      return;
    }

    if (target.matches("[data-workbook]")) {
      state.workbook = target.dataset.workbook;
      state.workbookLinked = false;
      persist();
      renderGlobalState();
      return;
    }

    if (target.matches("[data-workbook-continue]")) {
      if (state.workbook === "none") {
        state.workbookLinked = false;
        persist();
        goTo("15");
      } else {
        goTo("21");
      }
      return;
    }

    if (target.matches("[data-skip-workbook]")) {
      state.workbookLinked = false;
      persist();
      goTo("15");
      return;
    }

    if (target.matches("[data-intention-continue]")) {
      goTo("04");
      return;
    }

    if (target.matches("[data-skip-intention]")) {
      state.intention = "";
      persist();
      goTo("04");
      return;
    }

    if (target.matches("[data-suggestion]")) {
      const input = document.getElementById("reflection-input");
      input.value = target.dataset.suggestion;
      state.reflection = input.value;
      persist();
      input.focus();
      return;
    }

    if (target.matches("[data-reflect-only]")) {
      state.reflection = document.getElementById("reflection-input").value;
      persist();
      showToast("Va bene. La domanda resta tua, senza dover rispondere.");
      goTo("05");
      return;
    }

    if (target.matches("[data-save-phrase]")) {
      state.savedPhrase = !state.savedPhrase;
      persist();
      renderGlobalState();
      showToast(state.savedPhrase ? "Frase salvata in Con te, ogni giorno." : "Frase rimossa da Con te, ogni giorno.");
      return;
    }

    if (target.matches("[data-not-today]")) {
      showToast("Va bene così. Nessun recupero, nessuna assenza da giustificare.");
      return;
    }

    if (target.matches("[data-feedback]")) {
      state.feedback = target.dataset.feedback;
      persist();
      renderGlobalState();
      if (state.feedback === "no") {
        showDialog(feedbackDialog);
      } else {
        showToast("Grazie. Terrò conto di questo feedback.");
      }
      return;
    }

    if (target.matches("[data-feedback-reason]")) {
      state.feedbackReason = target.dataset.feedbackReason;
      persist();
      document.querySelectorAll("[data-feedback-reason]").forEach((button) => {
        button.classList.toggle("is-selected", button === target);
      });
      return;
    }

    if (target.matches("[data-try-alternative]")) {
      state.responseVariant = "alternative";
      persist();
      closeDialog(feedbackDialog);
      renderGlobalState();
      showToast("Ho riformulato la risposta seguendo la tua correzione.");
      return;
    }

    if (target.matches("[data-close-here]")) {
      showToast("La conversazione è chiusa. Nulla di nuovo è stato aggiunto alla memoria.");
      goTo("11");
      return;
    }

    if (target.matches("[data-accept-memory]")) {
      acceptProposedMemory();
      return;
    }

    if (target.matches("[data-edit-proposed]")) {
      openEditDialog("memory");
      return;
    }

    if (target.matches("[data-save-proposed-edit]")) {
      event.preventDefault();
      saveEditedText();
      return;
    }

    if (target.matches("[data-reject-memory]")) {
      state.memoryDecision = "rejected";
      persist();
      showToast("Non sarà ricordato. Il tuo passo resta comunque tuo.");
      goTo("11");
      return;
    }

    if (target.matches("[data-pattern-answer]")) {
      const answer = target.dataset.patternAnswer;
      if (answer === "yes") {
        state.reflection = "Mi risuona: a volte dire no mi sembra un modo per deludere qualcuno.";
        persist();
        goTo("07");
      } else if (answer === "edit") {
        openEditDialog("pattern");
      } else {
        showToast("Grazie della correzione. L’ipotesi non viene salvata.");
        goTo("09");
      }
      return;
    }

    if (target.matches("[data-open-moment]")) {
      goTo("17");
      return;
    }

    if (target.matches("[data-step-status]")) {
      state.stepStatus = target.dataset.stepStatus;
      persist();
      renderGlobalState();
      showToast("Esito aggiornato senza giudizio né punteggio.");
      return;
    }

    if (target.matches("[data-resume-thread]")) {
      state.scenario = "day14";
      persist();
      goTo("09");
      return;
    }

    if (target.matches("[data-start-fresh]")) {
      state.scenario = "day1";
      persist();
      goTo("05");
      return;
    }

    if (target.matches("[data-memory-delete]")) {
      const memory = state.memories.find((item) => item.id === target.dataset.memoryDelete);
      if (memory) memory.status = "deleted";
      persist();
      renderGlobalState();
      showToast("Elemento eliminato dalla memoria.");
      return;
    }

    if (target.matches("[data-save-memories]")) {
      persist();
      showToast("Modifiche salvate. Userò solo questa versione.");
      return;
    }

    if (target.matches("[data-export-memory]")) {
      exportMemory();
      return;
    }

    if (target.matches("[data-clear-memory]")) {
      showDialog(clearDialog);
      return;
    }

    if (target.matches("[data-confirm-clear]")) {
      event.preventDefault();
      clearAllMemories();
      closeDialog(clearDialog);
      return;
    }

    if (target.matches("[data-show-resources]")) {
      const panel = document.querySelector("[data-resource-panel]");
      panel.hidden = !panel.hidden;
      target.textContent = panel.hidden ? "Vedi altre risorse" : "Nascondi risorse";
      if (!panel.hidden) panel.querySelector("a")?.focus();
      return;
    }

    if (target.matches("[data-trusted-person]")) {
      event.preventDefault();
      showToast("Su mobile, questa azione apre i contatti per chiamare una persona fidata.", 4300);
      return;
    }

    if (target.matches("[data-simulate-error]")) {
      closeDialog(prototypeDialog);
      goTo("19");
      return;
    }

    if (target.matches("[data-retry-response]")) {
      showToast("Connessione ripristinata. Riprendiamo dalla bozza conservata.");
      goTo("07");
      return;
    }

    if (target.matches("[data-delete-account]")) {
      showDialog(deleteAccountDialog);
      return;
    }

    if (target.matches("[data-confirm-delete-account]")) {
      localStorage.removeItem(STORAGE_KEY);
      state = defaultState();
      closeDialog(deleteAccountDialog);
      persist();
      showToast("Account demo cancellato. Il mockup riparte dal primo ingresso.");
      goTo("01");
      return;
    }

    if (target.matches("[data-reset-demo]")) {
      localStorage.removeItem(STORAGE_KEY);
      state = defaultState();
      closeDialog(prototypeDialog);
      persist();
      showMemoryProposalState();
      showToast("Demo ripristinata al primo ingresso.");
      goTo("01");
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("#reflection-input")) {
      state.reflection = event.target.value;
      persist();
    }

    if (event.target.matches("[data-memory-input]")) {
      const memory = state.memories.find((item) => item.id === event.target.dataset.memoryInput);
      if (memory) {
        memory.text = event.target.value;
        persist();
      }
    }
  });

  document.getElementById("preferences-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.tone = form.get("tone") || "gentile";
    state.rhythm = form.get("rhythm") || "scelgo";
    state.memoryEnabled = form.get("memory") === "on";
    state.onboardingComplete = true;
    persist();
    goTo("20");
  });

  document.getElementById("workbook-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.workbookStage = String(form.get("workbookStage") || "inizio");
    state.workbookPromise = String(form.get("workbookPromise") || "").trim();
    state.desiredSelf = String(form.get("desiredSelf") || "").trim();
    state.workbookLinked = Boolean(state.workbookPromise || state.desiredSelf);
    persist();
    showToast(`${workbookLabel(state.workbook)} collegato. Potrai modificare questi elementi in qualsiasi momento.`);
    goTo("15");
  });

  document.getElementById("access-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.accountEmail = String(form.get("email") || "marie@example.com");
    persist();
    showToast("Accesso demo verificato. Nel prodotto reale riceveresti un link sicuro.");
    goTo("03");
  });

  document.getElementById("consent-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.serviceConsent = form.get("serviceConsent") === "on";
    state.memoryEnabled = form.get("memoryConsent") === "on";
    state.remindersEnabled = form.get("reminderConsent") === "on";
    persist();
    goTo("05");
  });

  document.getElementById("settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.tone = String(form.get("settingsTone") || "gentile");
    state.rhythm = String(form.get("settingsRhythm") || "scelgo");
    state.memoryEnabled = form.get("settingsMemory") === "on";
    state.remindersEnabled = form.get("settingsReminders") === "on";
    persist();
    renderGlobalState();
    showToast("Preferenze salvate. Restano modificabili in qualsiasi momento.");
  });

  document.getElementById("reflection-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = document.getElementById("reflection-input").value.trim();
    state.reflection = value || "Vorrei proteggere del tempo che sia davvero mio.";
    state.responseVariant = "primary";
    persist();
    showToast("Sto collegando le tue parole al contesto che hai scelto…", 900);
    window.setTimeout(() => goTo("07"), 500);
  });

  document.getElementById("small-step-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("small-step-input");
    state.smallStep = input.value.trim() || "Proteggere un momento senza lavoro";
    state.proposedMemory = /due sere/i.test(state.smallStep)
      ? "Stai cercando di proteggere due sere alla settimana dal lavoro."
      : `Hai scelto questo piccolo passo: ${state.smallStep}.`;
    state.memoryDecision = "pending";
    persist();
    showMemoryProposalState();
    goTo("08");
  });

  window.addEventListener("hashchange", () => {
    const screen = currentScreenFromHash();
    state.currentScreen = screen;
    persist();
    showMemoryProposalState();
    renderScreen(screen, true);
  });

  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
  });

  const initial = currentScreenFromHash();
  if (!VALID_SCREENS.has(window.location.hash.replace("#", ""))) {
    window.location.hash = initial;
  }
  showMemoryProposalState();
  renderScreen(initial, false);
})();

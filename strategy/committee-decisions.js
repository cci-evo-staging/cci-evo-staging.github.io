(() => {
  const host = window.parent !== window && window.parent.__ECCI_OKR;
  if (!host?.decisionLinks || host.view === "projects") return;

  const tr = (ru, en) => host.lang === "en" ? en : ru;
  const eligible = ".tt-node[data-ttid]:is(.mission,.uo,.kr,.ko,.ui,.pi)";
  let linksByNode = new Map();
  let editor = null;
  let revision = 0;

  function make(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  async function request(params = {}) {
    const { data, error } = await host.decisionLinks(params);
    if (error) throw error;
    return data;
  }

  function drawBadges() {
    document.querySelectorAll(".tt-wrap .tt-node[data-ttid]").forEach(card => {
      const links = card.matches(eligible) ? linksByNode.get(card.dataset.ttid) || [] : [];
      const signature = JSON.stringify(links);
      const old = card.querySelector(":scope > .sc-okr-badges");
      if (!links.length) { old?.remove(); return; }
      if (old?.dataset.links === signature) return;
      const row = make("div", "", "sc-okr-badges");
      row.dataset.links = signature;
      for (const link of links) {
        const badge = make("span", link.code);
        badge.title = link.name;
        row.append(badge);
      }
      if (old) old.replaceWith(row);
      else card.querySelector(":scope > .t")?.after(row);
    });
  }

  async function refreshBadges() {
    const current = ++revision;
    try {
      const { linked } = await request();
      if (current !== revision) return;
      const map = new Map();
      for (const link of linked) {
        if (!map.has(link.node)) map.set(link.node, []);
        map.get(link.node).push(link);
      }
      linksByNode = map;
      drawBadges();
    } catch {
      if (current === revision) linksByNode.clear();
      drawBadges();
    }
  }

  function showEditor(state, data) {
    if (editor !== state) return;
    const { panel } = state;
    const heading = make("div", tr("Решения Стратегического комитета", "Strategic Committee decisions"), "tt-eb");
    const error = make("p", "", "sc-okr-error");
    error.setAttribute("role", "alert");
    panel.replaceChildren(heading);
    const write = async (id, on) => {
      const buttons = Array.from(panel.querySelectorAll("button"));
      buttons.forEach(button => { button.disabled = true; });
      error.textContent = "";
      try {
        const saved = await request({ p_node: state.node, p_decision: id, p_on: on });
        ++revision;
        linksByNode.set(state.node, saved.linked);
        drawBadges();
        showEditor(state, saved);
      } catch {
        error.textContent = tr("Не удалось сохранить связь. Обновите дерево и повторите.", "Could not save the link. Reload the tree and try again.");
        buttons.forEach(button => { button.disabled = false; });
      }
    };
    for (const link of data.linked) {
      const line = make("div", "", "sc-okr-link");
      line.append(make("span", link.code + " · " + link.name));
      if (data.editable) {
        const remove = make("button", tr("Снять связь", "Unlink"), "tt-btn");
        remove.type = "button";
        remove.onclick = () => void write(link.id, false);
        line.append(remove);
      }
      panel.append(line);
    }
    if (data.editable) {
      const chosen = new Set(data.linked.map(link => link.id));
      const available = data.choices.filter(link => !chosen.has(link.id));
      if (available.length) {
        const control = make("div", "", "sc-okr-link");
        const select = make("select");
        select.setAttribute("aria-label", tr("Опубликованное решение", "Published decision"));
        select.add(new Option(tr("Выберите решение…", "Select a decision…"), ""));
        for (const link of available) select.add(new Option(link.code + " · " + link.name, link.id));
        const add = make("button", tr("Привязать решение", "Link decision"), "tt-btn pri");
        add.type = "button";
        add.disabled = true;
        select.onchange = () => { add.disabled = !select.value; };
        add.onclick = () => { if (select.value) void write(select.value, true); };
        control.append(select, add);
        panel.append(control);
      } else if (!data.linked.length) {
        panel.append(make("p", tr("Нет доступных опубликованных решений.", "No published decisions available.")));
      }
    } else if (!data.linked.length) {
      panel.hidden = true;
    }
    panel.append(error);
  }

  function sync() {
    drawBadges();
    const modal = document.querySelector(".tt-modal");
    const card = modal && document.querySelector(".tt-wrap " + eligible + ".sel");
    if (!card) {
      editor?.panel.remove();
      editor = null;
      return;
    }
    const node = card.dataset.ttid;
    if (editor?.modal === modal && editor.node === node && editor.panel.isConnected) return;
    editor?.panel.remove();
    const panel = make("section", "", "sc-okr-editor");
    panel.setAttribute("aria-label", tr("Решения Стратегического комитета", "Strategic Committee decisions"));
    panel.append(make("p", tr("Загрузка решений…", "Loading decisions…")));
    const actions = modal.querySelector(":scope > .tt-grp");
    modal.insertBefore(panel, actions || modal.lastElementChild);
    const state = editor = { modal, node, panel };
    request({ p_node: node }).then(data => showEditor(state, data)).catch(() => {
      if (editor === state) panel.textContent = tr("Не удалось загрузить решения.", "Could not load decisions.");
    });
  }

  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; sync(); });
  }).observe(document.getElementById("root"), { childList: true, subtree: true });
  void refreshBadges();
  window.addEventListener("focus", () => void refreshBadges());
})();

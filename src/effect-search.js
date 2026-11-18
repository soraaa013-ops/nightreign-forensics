// Accessible combobox; raw IDs are retained for report links and rule evaluation.
export function createEffectSearch(input, index, getEffects, onSelect) {
  const list = document.createElement("ul");
  list.id = `effect-options-${index}`;
  list.className = "suggestions";
  list.role = "listbox";
  list.setAttribute("aria-label", `第${index + 1}词条候选`);
  list.hidden = true;
  input.after(list);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-label", `第${index + 1}词条`);
  input.setAttribute("aria-required", "true");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute(
    "aria-describedby",
    `effect-hint effect-preview-${index} form-error`,
  );
  let results = [],
    active = -1,
    composing = false;
  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }
  function select(effect) {
    input.value = `${effect.name} · #${effect.id}`;
    input.setCustomValidity("");
    close();
    onSelect();
  }
  function highlight() {
    [...list.querySelectorAll("[role=option]")].forEach((node, i) =>
      node.setAttribute("aria-selected", String(i === active)),
    );
    if (active >= 0) {
      input.setAttribute("aria-activedescendant", `${list.id}-${active}`);
      list.children[active].scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  }
  function open() {
    const query = input.value.trim().toLowerCase();
    const matches = getEffects().filter(
      (effect) =>
        !query ||
        effect.name.toLowerCase().includes(query) ||
        String(effect.id) === query.replace("#", "") ||
        input.value === `${effect.name} · #${effect.id}`,
    );
    results = matches.slice(0, 40);
    active = -1;
    list.replaceChildren(
      ...results.map((effect, i) => {
        const item = document.createElement("li");
        item.id = `${list.id}-${i}`;
        item.role = "option";
        item.setAttribute("aria-selected", "false");
        item.textContent = `${effect.name} · #${effect.id}`;
        item.addEventListener("pointerdown", (event) => event.preventDefault());
        item.addEventListener("click", () => select(effect));
        return item;
      }),
    );
    if (!results.length || matches.length > results.length) {
      const note = document.createElement("li");
      note.className = "search-note";
      note.role = "presentation";
      note.textContent = results.length
        ? `显示前 ${results.length} 条，请继续输入关键词缩小范围。`
        : "没有找到词条，请换一个关键词或检查模板。";
      list.append(note);
    }
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.removeAttribute("aria-activedescendant");
  }
  input.addEventListener("compositionstart", () => {
    composing = true;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    open();
  });
  input.addEventListener("input", () => {
    input.setCustomValidity("");
    if (!composing) open();
  });
  input.addEventListener("focus", open);
  input.addEventListener("blur", close);
  input.addEventListener("keydown", (event) => {
    if (composing || event.isComposing) return;
    if (event.key === "Escape") {
      close();
      return;
    }
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (list.hidden) open();
      if (results.length) {
        active =
          active === -1
            ? event.key === "ArrowDown"
              ? 0
              : results.length - 1
            : (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) %
              results.length;
        highlight();
      }
    } else if (event.key === "Enter" && !list.hidden && active >= 0) {
      event.preventDefault();
      select(results[active]);
    }
  });
  return { close };
}

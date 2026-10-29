import {
  RESOURCE_KIND_LABELS,
  RESOURCES,
  findResource,
  matchResources,
  resourcesOfKind,
  resolveResourceRelation,
  validateTemplate,
  type Resource,
  type ResourceKind,
  type ResourceRelation,
} from "./resources.js";

interface Options {
  root: HTMLElement;
  input: HTMLTextAreaElement;
  trigger: HTMLButtonElement;
  busy: () => boolean;
  changed: () => void;
  notice: (text: string) => void;
  saveTemplate: (id: string, revision: number, body: string, reset: boolean) => Promise<{body: string; revision: number}>;
}

const TAB_KINDS: readonly ResourceKind[] = ["template", "skill", "tool", "extension", "package"];
const MEMBER_KINDS: readonly ResourceKind[] = ["template", "skill", "extension"];

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = ""): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

function button(text: string, className: string, action: () => void): HTMLButtonElement {
  const el = node("button", text, className);
  el.type = "button";
  el.addEventListener("click", action);
  return el;
}

function resourceStatusLabel(resource: Resource): string {
  if (resource.status === "unavailable") return "资源不可用";
  if (resource.status === "design-example") return "设计示例 · 未接入";
  return resource.kind === "template" ? "已加载 · 可编辑" : "已加载 · 只读";
}

function resourceSearchText(resource: Resource): string {
  return [resource.id, resource.name, resource.code, resource.command, resource.description].filter(Boolean).join(" ").toLowerCase();
}

function matchesResource(resource: Resource, query: string): boolean {
  return !query.trim() || resourceSearchText(resource).includes(query.trim().toLowerCase());
}

export function createResourceUI(options: Options) {
  const { root, input, trigger, busy, changed, notice } = options;
  let saving = false;
  const listSearches = new Map<ResourceKind, string>();
  const memberSearches = new Map<string, string>();
  const memberFilters = new Map<string, ResourceKind | "all">();
  let selected: Resource | null = findResource("template.query-tickets") ?? resourcesOfKind("template")[0] ?? null;
  let kind: ResourceKind = "template";
  let history: Array<{ kind: ResourceKind; id: string }> = [];
  let editor: HTMLTextAreaElement | undefined;
  let saveButton: HTMLButtonElement | undefined;
  let resetButton: HTMLButtonElement | undefined;
  let useButton: HTMLButtonElement | undefined;
  let feedback: HTMLElement | undefined;
  let packageMemberSearch: HTMLInputElement | undefined;
  let packageMemberFilter: HTMLSelectElement | undefined;
  let packageMemberList: HTMLElement | undefined;

  const value = () => selected?.kind === "template" ? selected.currentBody ?? selected.body : "";
  const dirty = () => Boolean(editor && selected?.kind === "template" && editor.value !== value());

  const dialog = node("dialog", "", "modal-dialog resource-dialog");
  dialog.dataset.testid = "resource-dialog";
  dialog.setAttribute("aria-labelledby", "resource-title");
  const title = node("h2", "能力库", "modal-title");
  title.id = "resource-title";
  const header = node("header", "", "modal-header");
  const close = button("×", "modal-close", () => leave(() => dialog.close()));
  close.setAttribute("aria-label", "关闭能力库");
  header.append(title, close);

  const tabs = node("div", "", "resource-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "能力类型");
  const body = node("div", "", "resource-layout");
  body.setAttribute("role", "tabpanel");
  body.id = "resource-panel";
  const list = node("nav", "", "library-list");
  list.setAttribute("aria-label", "资源列表");
  const listHeading = node("div", "", "library-list-heading");
  const listLabel = node("strong");
  const listCount = node("small", "", "library-list-count");
  listHeading.append(listLabel, listCount);
  const listSearch = node("input", "", "library-list-search") as HTMLInputElement;
  listSearch.type = "search";
  listSearch.autocomplete = "off";
  listSearch.addEventListener("input", () => {
    listSearches.set(kind, listSearch.value);
    renderListItems();
  });
  const listItems = node("div", "", "library-list-items");
  list.append(listHeading, listSearch, listItems);
  const detail = node("section", "", "library-detail");
  body.append(list, detail);

  const tabButtons = TAB_KINDS.map((tabKind) => {
    const tab = button(RESOURCE_KIND_LABELS[tabKind], "resource-tab", () => switchKind(tabKind));
    tab.id = `resource-tab-${tabKind}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", body.id);
    tabs.append(tab);
    return tab;
  });
  tabs.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent) || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = Math.max(0, tabButtons.findIndex((tab) => tab === document.activeElement));
    const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabButtons.length - 1 : (current + offset + tabButtons.length) % tabButtons.length;
    const next = tabButtons[nextIndex];
    next.focus();
    switchKind(TAB_KINDS[nextIndex]);
  });

  dialog.append(header, tabs, body);
  root.append(dialog);

  // Shared confirmation for dirty edits, resetting defaults, and replacing composer drafts.
  const guard = node("dialog", "", "modal-dialog resource-confirm");
  guard.setAttribute("aria-labelledby", "resource-confirm-title");
  const guardTitle = node("h2", "确认操作", "modal-title");
  guardTitle.id = "resource-confirm-title";
  const guardText = node("p");
  const actions = node("div", "", "modal-actions");
  let pending: (() => void) | null = null;
  let returnFocus: HTMLElement | null = null;
  const cancel = button("继续编辑", "secondary-button", () => {
    pending = null;
    guard.close();
    returnFocus?.focus();
  });
  const accept = button("放弃修改", "primary-button", () => {
    const action = pending;
    pending = null;
    guard.close();
    action?.();
  });
  guard.addEventListener("cancel", () => { pending = null; });
  actions.append(cancel, accept);
  guard.append(guardTitle, guardText, actions);
  root.append(guard);

  function confirm(text: string, yes: string, no: string, action: () => void): void {
    if (guard.open) return;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    guardText.textContent = text;
    accept.textContent = yes;
    cancel.textContent = no;
    pending = action;
    guard.showModal();
    cancel.focus();
  }

  function leave(action: () => void): void {
    if (saving) { notice("模板正在保存，请稍候。"); return; }
    if (dirty()) confirm("有未保存的修改，离开后将丢失。", "放弃修改", "继续编辑", action);
    else action();
  }

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    leave(() => dialog.close());
  });
  dialog.addEventListener("close", () => {
    if (!guard.open && document.activeElement !== input) trigger.focus();
  });
  trigger.addEventListener("click", () => {
    hideMenu();
    selected = (selected && findResource(selected.id)) || resourcesOfKind(kind)[0] || null;
    renderList();
    renderDetail();
    if (!dialog.open) dialog.showModal();
    sync();
    close.focus();
  });

  function renderTabs(): void {
    tabButtons.forEach((tab, index) => {
      const active = TAB_KINDS[index] === kind;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    body.setAttribute("aria-labelledby", `resource-tab-${kind}`);
  }

  function renderList(): void {
    listLabel.textContent = RESOURCE_KIND_LABELS[kind];
    const resources = resourcesOfKind(kind);
    listCount.textContent = `${resources.length} 项`;
    listSearch.setAttribute("aria-label", kind === "package" ? "搜索包" : "搜索资源");
    listSearch.placeholder = kind === "package" ? "搜索包名称或标识" : "搜索名称、标识或说明";
    listSearch.value = listSearches.get(kind) ?? "";
    renderListItems();
    renderTabs();
  }

  function renderListItems(): void {
    const query = listSearches.get(kind) ?? "";
    const resources = resourcesOfKind(kind);
    const visible = resources.filter((resource) => matchesResource(resource, query));
    listItems.replaceChildren();
    if (!visible.length) {
      listItems.append(node("p", "没有匹配的资源", "library-empty"));
      return;
    }
    for (const resource of visible) {
      const item = button("", "resource-item", () => selectResource(resource));
      item.setAttribute("aria-label", resource.name);
      item.setAttribute("aria-current", String(selected?.id === resource.id));
      const primary = node("strong", resource.name);
      const secondary = node("small", resource.code ?? resource.command ?? resourceStatusLabel(resource));
      item.append(primary, secondary);
      listItems.append(item);
    }
  }

  function sync(): void {
    if (busy()) hideMenu();
    if (!dialog.open) return;
    if (!dirty() && !saving) {
      const current = selected && findResource(selected.id);
      if (current && current !== selected && (current.templateRevision ?? 0) >= (selected?.templateRevision ?? 0)) { selected = current; if (editor) editor.value = value(); }
      if (!selected && resourcesOfKind(kind).length) { selected = resourcesOfKind(kind)[0]; renderList(); renderDetail(); return; }
    }
    if (editor) editor.readOnly = busy() || saving;
    if (saveButton) saveButton.disabled = busy() || saving || !dirty();
    if (resetButton) resetButton.disabled = busy() || saving || (selected?.kind === "template" && value() === selected.body && !dirty());
    if (useButton) useButton.disabled = busy();
    if (feedback) {
      if (busy()) feedback.textContent = "任务进行中，请先停止或完成报告确认；当前只能浏览。";
      else if (feedback.textContent?.startsWith("任务进行中")) feedback.textContent = dirty() ? "有未保存修改" : "";
    }
  }

  function sourceRows(resource: Resource): Array<[string, string]> {
    return [
      ["来源", resource.source],
      ["版本", resource.version],
      ["状态", resourceStatusLabel(resource)],
      ["稳定 ID", resource.id],
    ];
  }

  function definitionList(rows: Array<[string, string]>): HTMLElement {
    const result = node("dl", "", "resource-meta");
    for (const [label, text] of rows) result.append(node("dt", label), node("dd", text));
    return result;
  }

  function relationButton(resourceRelation: ResourceRelation): HTMLButtonElement {
    const target = resolveResourceRelation(resourceRelation);
    const text = target ? `${resourceRelation.label} · ${target.name}` : `${resourceRelation.label} · 不可用关联`;
    const relationLink = button(text, `resource-relation${target ? "" : " is-unavailable"}`, () => {
      if (target) navigateTo(target, true);
    });
    relationLink.setAttribute("aria-label", text);
    if (!target) {
      relationLink.disabled = true;
      relationLink.title = "关联目标未登记，当前不可用";
    } else if (target.code ?? target.command) {
      relationLink.append(node("code", target.code ?? target.command ?? ""));
    }
    return relationLink;
  }

  function renderRelations(resource: Resource): HTMLElement | null {
    const relations = resource.relations.filter((item) => item.type !== "contains" && (resource.kind !== "extension" || item.type !== "provides"));
    if (!relations.length) return null;
    const section = node("section", "", "resource-relations");
    section.append(node("h4", "关联资源"));
    const links = node("div", "", "resource-relation-list");
    for (const item of relations) links.append(relationButton(item));
    section.append(links);
    return section;
  }

  function renderExtensionTools(resource: Resource): HTMLElement {
    const provided = resource.relations.filter((item) => item.type === "provides");
    const section = node("section", "", "extension-tools");
    section.append(node("h4", `提供的工具 · ${provided.length} 项`));
    if (!provided.length) {
      section.append(node("p", "当前扩展没有登记工具；其他能力以扩展说明为准。", "resource-note"));
      return section;
    }
    const list = node("div", "", "extension-tool-list");
    for (const relation of provided) {
      const target = resolveResourceRelation(relation);
      const item = button("", "extension-tool-card", () => { if (target) navigateTo(target, true); });
      if (!target) {
        item.disabled = true;
        item.append(node("strong", "关联工具不可用"), node("small", relation.targetId));
      } else {
        item.setAttribute("aria-label", `查看工具：${target.name}`);
        const title = node("span", "", "extension-tool-title");
        title.append(node("strong", target.name));
        if (target.code) title.append(node("code", target.code));
        item.append(title, node("span", target.description, "extension-tool-description"), node("small", resourceStatusLabel(target)));
      }
      list.append(item);
    }
    section.append(list);
    return section;
  }

  function packageMembers(resource: Resource): Array<{ relation: ResourceRelation; target: Resource }> {
    return resource.relations.flatMap((item) => {
      if (item.type !== "contains") return [];
      const target = resolveResourceRelation(item);
      return target ? [{ relation: item, target }] : [];
    });
  }

  function renderPackageMembers(resource: Resource): void {
    if (!packageMemberList || !packageMemberSearch || !packageMemberFilter) return;
    const all = packageMembers(resource);
    const query = memberSearches.get(resource.id) ?? "";
    const filter = memberFilters.get(resource.id) ?? "all";
    packageMemberSearch.value = query;
    packageMemberFilter.value = filter;
    packageMemberList.replaceChildren();
    const visible = all.filter(({ target }) =>
      (filter === "all" || target.kind === filter) && matchesResource(target, query),
    );
    if (!all.length) {
      packageMemberList.append(node("p", "当前包没有登记成员。", "library-empty"));
      return;
    }
    if (!visible.length) {
      packageMemberList.append(node("p", "没有匹配的包成员。", "library-empty"));
      return;
    }
    for (const memberKind of MEMBER_KINDS) {
      const group = visible.filter(({ target }) => target.kind === memberKind);
      if (!group.length) continue;
      const section = node("section", "", "package-member-group");
      section.append(node("h5", `${RESOURCE_KIND_LABELS[memberKind]} · ${group.length}`));
      const groupList = node("div", "", "package-member-items");
      for (const { target } of group) {
        const item = button(target.name, "resource-relation package-member", () => navigateTo(target, true));
        item.setAttribute("aria-label", `${RESOURCE_KIND_LABELS[target.kind]}：${target.name}`);
        item.append(node("small", target.code ?? target.command ?? resourceStatusLabel(target)));
        groupList.append(item);
      }
      section.append(groupList);
      packageMemberList.append(section);
    }
  }

  function packageMemberControls(resource: Resource): HTMLElement {
    const section = node("section", "", "package-members");
    const heading = node("div", "", "package-members-heading");
    heading.append(node("h4", "包成员"), node("span", `${packageMembers(resource).length} 项`, "package-member-count"));
    const controls = node("div", "", "package-member-controls");
    packageMemberSearch = node("input", "", "package-member-search") as HTMLInputElement;
    packageMemberSearch.type = "search";
    packageMemberSearch.placeholder = "搜索成员名称或标识";
    packageMemberSearch.setAttribute("aria-label", "搜索包成员");
    packageMemberSearch.addEventListener("input", () => {
      memberSearches.set(resource.id, packageMemberSearch!.value);
      renderPackageMembers(resource);
    });
    packageMemberFilter = node("select", "", "package-member-filter") as HTMLSelectElement;
    packageMemberFilter.setAttribute("aria-label", "包成员类型");
    const allOption = node("option", "全部类型") as HTMLOptionElement;
    allOption.value = "all";
    packageMemberFilter.append(allOption);
    for (const memberKind of MEMBER_KINDS) {
      const option = node("option", RESOURCE_KIND_LABELS[memberKind]) as HTMLOptionElement;
      option.value = memberKind;
      packageMemberFilter.append(option);
    }
    packageMemberFilter.addEventListener("change", () => {
      memberFilters.set(resource.id, packageMemberFilter!.value as ResourceKind | "all");
      renderPackageMembers(resource);
    });
    controls.append(packageMemberSearch, packageMemberFilter);
    packageMemberList = node("div", "", "package-member-list");
    section.append(heading, controls, packageMemberList);
    renderPackageMembers(resource);
    return section;
  }

  async function persistTemplate(reset: boolean): Promise<void> {
    if (busy() || saving || !editor || selected?.kind !== "template") return;
    const resource = selected;
    if (resource.templateRevision === undefined) { notice("模板版本尚未同步，请重新连接。"); return; }
    const body = editor.value;
    const error = reset ? null : validateTemplate(body);
    if (error) { if (feedback) feedback.textContent = error; editor.focus(); return; }
    saving = true;
    sync();
    try {
      const result = await options.saveTemplate(resource.id, resource.templateRevision, body, reset);
      selected = {...resource, currentBody: result.body, templateRevision: result.revision};
      editor.value = result.body;
      if (feedback) feedback.textContent = "已持久化保存，下一轮将使用新版本。";
    } catch (error) {
      if (feedback) feedback.textContent = `${error instanceof Error ? error.message : "保存失败"}；编辑内容仍保留。`;
    } finally { saving = false; sync(); }
  }

  function appendFooter(resource: Resource, detailContent: HTMLElement): void {
    feedback = node("p", "", "resource-feedback");
    feedback.setAttribute("role", "status");
    const footer = node("div", "", "resource-actions");
    if (resource.kind === "template") {
      resetButton = button("恢复默认", "secondary-button", () => {
        if (busy() || !selected) return;
        confirm("恢复内置默认正文，将覆盖当前保存内容和未保存修改。", "恢复默认", "取消", () => {
          if (busy() || !selected || selected.kind !== "template") return;
          void persistTemplate(true);
        });
      });
      saveButton = button("保存修改", "primary-button", () => {
        void persistTemplate(false);
      });
      footer.append(resetButton, saveButton);
    }
    if ((resource.kind === "template" || resource.kind === "skill") && resource.command) {
      useButton = button("用于对话", "secondary-button", () => {
        if (busy()) return;
        leave(() => {
          const current = selected;
          dialog.close();
          if (current) fill(current);
        });
      });
      footer.append(useButton);
    }
    detailContent.append(feedback, footer);
  }

  function renderDetail(): void {
    editor = undefined;
    saveButton = undefined;
    resetButton = undefined;
    useButton = undefined;
    feedback = undefined;
    packageMemberSearch = undefined;
    packageMemberFilter = undefined;
    packageMemberList = undefined;
    detail.replaceChildren();
    if (!selected) {
      detail.append(node("p", "当前分类没有可展示的资源。", "library-empty"));
      return;
    }
    const resource = selected;
    const heading = node("div", "", "resource-heading");
    const headingCopy = node("div", "", "resource-heading-copy");
    headingCopy.append(node("h3", resource.name));
    const identifier = resource.command ?? resource.code ?? resource.id;
    headingCopy.append(node("code", identifier));
    heading.append(headingCopy);
    if (history.length) heading.append(button("返回上一详情", "secondary-button resource-back", goBack));
    detail.append(heading);
    if (resource.kind === "tool" || resource.kind === "extension" || resource.kind === "package") {
      detail.append(node("h4", "Description · 功能描述", "library-description-heading"));
    }
    detail.append(node("p", resource.description, "library-description"), definitionList(sourceRows(resource)));

    const detailContent = node("div", "", "resource-detail-content");
    if (resource.kind === "template") {
      detailContent.append(node("p", "命令不带参数；复杂要求可通过自然语言补充。", "resource-note"));
      editor = node("textarea", "", "template-editor") as HTMLTextAreaElement;
      editor.setAttribute("aria-label", "模板正文");
      editor.spellcheck = false;
      editor.value = value();
      editor.addEventListener("input", () => {
        if (feedback) feedback.textContent = dirty() ? "有未保存修改" : "";
        sync();
      });
      detailContent.append(editor, node("p", "仅空闲时允许保存。保存成功表示已落盘并能用于下一轮请求。", "resource-note"));
    } else if (resource.kind === "skill") {
      detailContent.append(node("span", "只读 · 项目受控资源", "resource-badge"), node("h4", "使用说明"), node("pre", resource.body, "skill-body"), node("h4", "资源文件"));
      for (const file of resource.files ?? []) detailContent.append(node("div", file, "skill-file"));
      detailContent.append(node("p", "Skill 由后端显式加载；此处只读展示，不提供在线修改或脚本执行。", "resource-note"));
    } else {
      const bodyHeading = resource.kind === "tool" ? "接口与边界" : resource.kind === "extension" ? "实际职责" : "资源组成";
      detailContent.append(node("span", resourceStatusLabel(resource), "resource-badge"), node("h4", bodyHeading), node("p", resource.body, resource.kind === "extension" ? "resource-body extension-body" : "resource-body"));
      if (resource.kind === "extension") {
        detailContent.append(node("p", "Extension 是加载后运行的扩展模块，可以注册工具或处理事件；Tool 是模型在对话中可调用的一项操作。此页展示实际登记关系，不会执行工具。", "extension-role-note"));
        detailContent.append(renderExtensionTools(resource));
      }
      if (resource.kind === "package") detailContent.append(packageMemberControls(resource));
    }
    const relations = renderRelations(resource);
    if (relations) detailContent.append(relations);
    appendFooter(resource, detailContent);
    detail.append(detailContent);
    sync();
  }

  function ensureVisible(resource: Resource): void {
    const query = listSearches.get(resource.kind) ?? "";
    if (query && !matchesResource(resource, query)) listSearches.set(resource.kind, "");
  }

  function selectResource(resource: Resource): void {
    if (selected?.id === resource.id) return;
    leave(() => {
      selected = resource;
      history = [];
      kind = resource.kind;
      renderList();
      renderDetail();
    });
  }

  function navigateTo(resource: Resource, pushHistory: boolean): void {
    leave(() => {
      if (pushHistory && selected) history = [...history, { kind, id: selected.id }];
      ensureVisible(resource);
      selected = resource;
      kind = resource.kind;
      renderList();
      renderDetail();
    });
  }

  function goBack(): void {
    const previous = history.at(-1);
    if (!previous) return;
    leave(() => {
      history = history.slice(0, -1);
      const resource = findResource(previous.id);
      if (!resource) {
        notice("上一详情已不可用，当前目录未登记该资源。");
        renderDetail();
        return;
      }
      ensureVisible(resource);
      selected = resource;
      kind = previous.kind;
      renderList();
      renderDetail();
    });
  }

  function switchKind(nextKind: ResourceKind): void {
    if (kind === nextKind) return;
    leave(() => {
      kind = nextKind;
      selected = resourcesOfKind(kind)[0] ?? null;
      history = [];
      renderList();
      renderDetail();
    });
  }

  const menu = node("div", "", "command-menu");
  menu.hidden = true;
  const choices = node("div");
  choices.id = "command-options";
  choices.setAttribute("role", "listbox");
  choices.setAttribute("aria-label", "可用命令");
  menu.append(choices, node("div", "↑ ↓ 选择 · Enter / Tab 填入 · Esc 关闭", "command-help"));
  input.parentElement!.append(menu);
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", choices.id);
  let matches: Resource[] = [];
  let active = 0;

  function hideMenu(): void {
    menu.hidden = true;
    input.removeAttribute("aria-activedescendant");
  }

  function fill(resource: Resource): void {
    if (!resource.command) return;
    fillText(resource.command, resource.kind === "skill"
      ? "Skill 命令已填入，请确认资料后发送。"
      : "命令已填入，请检查资料后发送。");
  }

  function fillText(text: string, message = "问题已填入，请确认后发送。"): void {
    if (busy()) return;
    const apply = () => {
      if (busy()) return;
      input.value = text;
      hideMenu();
      input.focus();
      changed();
      notice(message);
    };
    if (input.value.trim() && input.value.trim() !== text) confirm("输入框已有内容，是否替换为所选内容？", "替换输入", "保留原文", apply);
    else apply();
  }

  function chooseMatch(resource: Resource): void {
    if (busy() || !resource.command) return;
    input.value = resource.command;
    hideMenu();
    input.focus();
    changed();
    notice(resource.kind === "skill" ? "Skill 命令已填入，请确认后发送。" : "命令已填入，请确认后发送。");
  }

  function highlight(): void {
    Array.from(choices.querySelectorAll<HTMLElement>("[role=option]")).forEach((el, index) => {
      el.setAttribute("aria-selected", String(index === active));
      if (index === active) {
        input.setAttribute("aria-activedescendant", el.id);
        el.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function search(): void {
    if (busy() || !input.value.startsWith("/")) {
      hideMenu();
      return;
    }
    matches = matchResources(input.value);
    active = 0;
    choices.replaceChildren();
    let lastKind: ResourceKind | "" = "";
    matches.forEach((resource, index) => {
      if (resource.kind !== lastKind) {
        choices.append(node("div", RESOURCE_KIND_LABELS[resource.kind], "command-group"));
        lastKind = resource.kind;
      }
      const option = button("", "command-option", () => chooseMatch(resource));
      option.id = `command-option-${index}`;
      option.setAttribute("role", "option");
      option.tabIndex = -1;
      option.append(node("code", resource.command ?? ""), node("span", resource.name), node("small", resource.kind === "skill" ? "只读 Skill" : resource.description));
      option.addEventListener("mousedown", (event) => event.preventDefault());
      choices.append(option);
    });
    if (!matches.length) choices.append(node("p", "没有匹配的命令", "command-empty"));
    menu.hidden = false;
    highlight();
  }

  input.addEventListener("blur", hideMenu);

  function keydown(event: KeyboardEvent): boolean {
    if (menu.hidden) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      hideMenu();
      return true;
    }
    if (matches.length && ["ArrowDown", "ArrowUp", "Enter", "Tab"].includes(event.key) && !event.shiftKey) {
      event.preventDefault();
      if (event.key === "Enter" || event.key === "Tab") chooseMatch(matches[active]);
      else {
        active = (active + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
        highlight();
      }
      return true;
    }
    return false;
  }

  renderList();
  renderDetail();
  return { fill, fillText, search, keydown, hideMenu, sync };
}

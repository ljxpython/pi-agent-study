import { chatMarkdown, reportPreview } from "./markdown.js";
import { setupLayout } from "./layout.js";
import { RESOURCES } from "./resources.js";
import { createResourceUI } from "./resource-ui.js";
import {
  datasetVersion,
  validateDatasetFile,
  type Dataset,
  type DatasetPayload,
} from "./domain.js";
import { createIcon, type IconName } from "./icons.js";
import { ApiRuntime, isBusy } from "./runtime.js";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("缺少应用根节点");
const appRoot = app;
const syncVisualViewport = () => {
  const height = window.visualViewport?.height ?? window.innerHeight;
  appRoot.style.setProperty("--app-viewport-height", `${height}px`);
  appRoot.classList.toggle("is-compact-viewport", height <= 520);
};
window.visualViewport?.addEventListener("resize", syncVisualViewport);
syncVisualViewport();

interface AppState {
  datasets: Dataset[];
  selectedDatasetId: string | null;
  activeTab: "result" | "report";
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

interface PendingUpload {
  name: string;
  payload: DatasetPayload;
  version: string;
  count: number;
}

interface UiRefs {
  shell: HTMLElement;
  leftPanel: HTMLDialogElement;
  rightPanel: HTMLDialogElement;
  leftToggle: HTMLButtonElement;
  rightToggle: HTMLButtonElement;
  datasetList: HTMLElement;
  uploadInput: HTMLInputElement;
  mobileRight: HTMLButtonElement;
  selection: HTMLElement;
  textarea: HTMLTextAreaElement;
  sendButton: HTMLButtonElement;
  messages: HTMLElement;
  notice: HTMLElement;
  resultTab: HTMLButtonElement;
  reportTab: HTMLButtonElement;
  resultContent: HTMLElement;
  reportContent: HTMLElement;
  settingsDialog: HTMLDialogElement;
  settingsLocal: HTMLInputElement;
  settingsIndependent: HTMLInputElement;
  settingsBaseUrl: HTMLInputElement;
  settingsApiKey: HTMLInputElement;
  settingsModelId: HTMLInputElement;
  settingsFeedback: HTMLElement;
  settingsProvider: HTMLInputElement;
  settingsApi: HTMLSelectElement;
  detailDialog: HTMLDialogElement;
  detailTitle: HTMLElement;
  detailBody: HTMLElement;
  uploadDialog: HTMLDialogElement;
  uploadTitle: HTMLElement;
  uploadBody: HTMLElement;
  uploadAdd: HTMLButtonElement;
}

const state: AppState = {
  datasets: [],
  selectedDatasetId: null,
  activeTab: "result",
  leftCollapsed: false,
  rightCollapsed: false,

};

let refs: UiRefs;
let syncLayout: (() => void) | undefined;
let datasetPicker: HTMLSelectElement;
let datasetSource: HTMLSelectElement;
let datasetSearch: HTMLInputElement;
let datasetCount: HTMLElement;
let datasetEmpty: HTMLElement;
let resourceUI: ReturnType<typeof createResourceUI>;
let resourceTrigger: HTMLButtonElement;
let stopButton: HTMLButtonElement;
let reportDialog: HTMLDialogElement;
let reportDialogBody: HTMLElement;
let reportActionId: string | null = null;
let composing = false;
let shownQueryId: string | null = null;
let shownActionId: string | null = null;
const runtime = new ApiRuntime(() => {
  if (!refs) return;
  const catalogChanged = state.datasets !== runtime.datasets || state.selectedDatasetId !== runtime.selectedDatasetId;
  state.datasets = runtime.datasets;
  state.selectedDatasetId = runtime.selectedDatasetId;
  if (catalogChanged) { updateDatasetList(); updateSelection(); }
  const badge = refs.shell.querySelector(".demo-badge-text");
  if (badge) badge.textContent = runtime.readonly ? "恢复只读模式" : runtime.connected ? "已连接后端" : "后端未连接";
  setNotice(runtime.notice);
  updateControls();
  renderRuntime();
  const request = runtime.request;
  if (refs.settingsDialog.open && request?.kind.startsWith("model_test")) {
    refs.settingsFeedback.textContent = `模型测试：${request.status}${request.error ? ` · ${request.error.message}` : ""}`;
  }
});
let pendingUpload: PendingUpload | null = null;
let lastFocusedElement: HTMLElement | null = null;
let uploadGeneration = 0;
let uploadProcessing = false;
let uploadAdding = false;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.append(document.createTextNode(text));
  return node;
}

function testId<T extends HTMLElement>(node: T, id: string): T {
  node.dataset.testid = id;
  return node;
}

function labelledButton(
  label: string,
  className = "",
  iconName?: IconName,
): HTMLButtonElement {
  const button = element("button", className);
  button.type = "button";
  if (iconName) button.append(createIcon(iconName));
  const text = element("span", "button-label", label);
  button.append(text);
  return button;
}

function iconButton(label: string, className: string, iconName: IconName): HTMLButtonElement {
  const button = element("button", className);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(createIcon(iconName));
  return button;
}

function getSelectedDataset(): Dataset | undefined {
  return state.datasets.find((dataset) => dataset.id === state.selectedDatasetId);
}

function createTicketTable(tickets: Dataset["tickets"]): HTMLElement {
  const wrap = element("div", "ticket-table-wrap");
  const table = element("table", "ticket-table");
  const headers = ["id", "title", "team", "priority", "status", "createdAt"];
  const thead = element("thead");
  const headerRow = element("tr");
  for (const header of headers) headerRow.append(element("th", "", header));
  thead.append(headerRow);
  const tbody = element("tbody");
  for (const ticket of tickets) {
    const row = element("tr");
    for (const value of [ticket.id, ticket.title, ticket.team, ticket.priority, ticket.status, ticket.createdAt]) {
      row.append(element("td", "", value));
    }
    tbody.append(row);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

function createDetailDefinitionList(rows: Array<[string, string]>): HTMLElement {
  const details = element("dl", "detail-list");
  for (const [label, value] of rows) {
    details.append(element("dt", "detail-label", label), element("dd", "detail-value", value));
  }
  return details;
}

function isMobile(): boolean {
  return window.matchMedia("(max-width: 1099px)").matches;
}

function setNotice(message: string): void {
  runtime.notice = message;
  refs.notice.textContent = message;
}

function toggleDataset(datasetId: string): void {
  if (isBusy(runtime.status)) {
    setNotice("当前状态忙碌，不能更换资料；请先取消或完成当前任务或报告确认。");
    return;
  }
  void runtime.select(state.selectedDatasetId === datasetId ? null : datasetId).catch(() => {});
}

function ensureDatasetSelected(datasetId: string): void {
  if (state.selectedDatasetId === datasetId) {
    setNotice("该资料已在输入区，重复拖入不会改变当前选择。");
    return;
  }
  toggleDataset(datasetId);
}

function createResourceDetailButton(
  title: string,
  description: string,
  iconName: IconName,
  onOpen: () => void,
): HTMLButtonElement {
  const button = element("button", "resource-detail");
  button.type = "button";
  button.setAttribute("aria-label", `查看详情：${title}`);
  button.addEventListener("click", onOpen);
  button.append(createIcon(iconName));
  const textWrap = element("span", "resource-detail-copy");
  textWrap.append(element("strong", "resource-name", title));
  textWrap.append(element("span", "resource-description", description));
  button.append(textWrap);
  return button;
}

function updateResourceSelection(card: Element, selected: boolean): void {
  card.classList.toggle("is-selected", selected);
  const button = card.querySelector<HTMLButtonElement>(".resource-add")!;
  if (button.getAttribute("aria-pressed") === String(selected)) return;
  button.classList.toggle("is-selected", selected);
  button.setAttribute("aria-pressed", String(selected));
  button.title = selected ? "已添加，再次点击移除" : button.getAttribute("aria-label")!;
  button.replaceChildren(createIcon(selected ? "check" : "plus"),
    element("span", "resource-add-label", selected ? "已添加" : "添加"));
}

function createResourceAddButton(
  label: string,
  selected: boolean,
  onToggle: () => void,
): HTMLButtonElement {
  const button = element("button", `resource-add${selected ? " is-selected" : ""}`);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(selected));
  button.title = selected ? "已添加，再次点击移除" : label;
  button.append(createIcon(selected ? "check" : "plus"));
  button.append(element("span", "resource-add-label", selected ? "已添加" : "添加"));
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onToggle();
  });
  return button;
}

function filterDatasets(): void {
  const keyword = datasetSearch.value.trim().toLowerCase();
  let count = 0;
  state.datasets.forEach((dataset, index) => {
    const type = datasetSource.value;
    const visible = dataset.name.toLowerCase().includes(keyword) && (type === "all" || (type === "selected" ? dataset.id === state.selectedDatasetId : dataset.origin === type));
    (refs.datasetList.children[index] as HTMLElement).hidden = !visible;
    if (visible) count++;
  });
  datasetCount.textContent = `${count} / ${state.datasets.length} 份资料`;
  datasetEmpty.hidden = count !== 0;
}

function updateDatasetList(): void {
  for (const [index, dataset] of state.datasets.entries()) {
    const selected = state.selectedDatasetId === dataset.id;
    const existing = refs.datasetList.children[index];
    if (existing) {
      updateResourceSelection(existing, selected);
      continue;
    }
    const card = element("article", `resource-card${selected ? " is-selected" : ""}`);
    card.draggable = true;
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("application/x-pi-dataset", dataset.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
    });
    const detail = createResourceDetailButton(
      dataset.name,
      `${dataset.count}条记录 · ${dataset.origin === "fixture" ? "内置只读" : "本地保存"}`,
      "file",
      () => openDatasetDetails(dataset),
    );
    const add = createResourceAddButton(`添加${dataset.name}`, selected, () => toggleDataset(dataset.id));
    card.append(detail, add);
    refs.datasetList.append(card);
    const option = element("option", "", dataset.name);
    option.value = dataset.id; datasetPicker.append(option);
  }
  datasetPicker.value = state.selectedDatasetId ?? "";
  filterDatasets();
}

function createSelectionChip(label: string, iconName: IconName, removeLabel: string, onRemove: () => void): HTMLElement {
  const chip = element("span", "selection-chip");
  chip.append(createIcon(iconName));
  chip.append(element("span", "selection-chip-label", label));
  const remove = iconButton(removeLabel, "selection-chip-remove", "close");
  remove.addEventListener("click", onRemove);
  chip.append(remove);
  return chip;
}

function updateSelection(): void {
  refs.selection.replaceChildren();
  const decoration = element("span", "selection-decoration", "✎");
  decoration.setAttribute("aria-hidden", "true");
  refs.selection.append(decoration);
  const dataset = getSelectedDataset();
  if (dataset) {
    refs.selection.append(
      createSelectionChip(dataset.name, "file", `移除资料：${dataset.name}`, () => toggleDataset(dataset.id)),
    );
  }
  if (!dataset) {
    refs.selection.append(element("span", "selection-empty", "无需资料也能提问；分析具体工单时再选择资料"));
  }
}

function updateTabs(): void {
  const resultActive = state.activeTab === "result";
  refs.resultTab.classList.toggle("is-active", resultActive);
  refs.reportTab.classList.toggle("is-active", !resultActive);
  refs.resultTab.setAttribute("aria-selected", String(resultActive));
  refs.reportTab.setAttribute("aria-selected", String(!resultActive));
  refs.resultContent.hidden = !resultActive;
  refs.reportContent.hidden = resultActive;
}

function updatePanelCollapse(): void {
  refs.leftPanel.classList.toggle("is-collapsed", state.leftCollapsed);
  refs.rightPanel.classList.toggle("is-collapsed", state.rightCollapsed);
  const leftLabel = state.leftCollapsed ? "展开资料栏" : "收起资料栏";
  const rightLabel = state.rightCollapsed ? "展开成果栏" : "收起成果栏";
  refs.leftToggle.setAttribute("aria-label", leftLabel);
  refs.leftToggle.title = leftLabel;
  refs.leftToggle.replaceChildren(createIcon(state.leftCollapsed ? "chevron-right" : "chevron-left"));
  refs.rightToggle.setAttribute("aria-label", rightLabel);
  refs.rightToggle.title = rightLabel;
  refs.rightToggle.replaceChildren(createIcon(state.rightCollapsed ? "chevron-left" : "chevron-right"));
  syncLayout?.();
}

function updateControls(): void {
  refs.sendButton.disabled = isBusy(runtime.status) || !refs.textarea.value.trim();
  refs.textarea.readOnly = isBusy(runtime.status);
  if (stopButton) stopButton.hidden = !runtime.canStop;
  updateUploadActions();
  resourceUI?.sync();
  if (datasetPicker) datasetPicker.disabled = isBusy(runtime.status);
}

async function openDatasetDetails(dataset: Dataset): Promise<void> {
  try { dataset = await runtime.dataset(dataset.id); }
  catch (error) { setNotice(error instanceof Error ? error.message : "资料读取失败"); return; }
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  refs.detailTitle.textContent = dataset.name;
  refs.detailBody.replaceChildren();
  refs.detailBody.append(
    element("p", "dialog-lead", "这是后端保存的只读资料。添加标签不会删除或修改原资料。"),
  );
  refs.detailBody.append(
    createDetailDefinitionList([
    ["记录数", String(dataset.count)],
    ["资料版本", dataset.version],
    ["来源状态", dataset.origin === "fixture" ? "内置教学fixture · 只读" : "用户上传 · 本地保存 · 只读"],
    ["now", dataset.now ?? "未提供"],
    [
      "policy",
      dataset.policy ? `urgentHours=${dataset.policy.urgentHours}，normalHours=${dataset.policy.normalHours}` : "未提供",
    ],
    ]),
    element("h3", "table-title", "工单记录（原始字段）"),
    createTicketTable(dataset.tickets),
  );
  refs.detailDialog.showModal();
}

function validateSettingsForm(): string | null {
  if (refs.settingsLocal.checked) return null;
  const modelId = refs.settingsModelId.value.trim();
  if (!modelId || modelId.length > 120) return "模型ID不能为空且不能超过120个字符。";
  try {
    const url = new URL(refs.settingsBaseUrl.value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
  } catch {
    return "Base URL必须是有效的HTTP或HTTPS地址。";
  }
  return null;
}

function clearApiKey(): void {
  refs.settingsApiKey.value = "";
}

function syncSettingsMode(): void {
  const local = refs.settingsLocal.checked;
  refs.settingsBaseUrl.disabled = local;
  refs.settingsApiKey.disabled = local;
  refs.settingsApi.disabled = local;
  if (local) clearApiKey();
  refs.settingsApiKey.placeholder = "留空保留同一端点的内存密钥";
  refs.settingsFeedback.className = "form-feedback";
  refs.settingsFeedback.textContent = local
    ? "仅复用本机模型认证，不加载全局扩展和资源。"
    : "密钥仅存后端进程内存；后端重启后需重新输入，不回退本机认证。";
}

function updateUploadActions(): void {
  refs.uploadAdd.disabled = uploadProcessing || uploadAdding || pendingUpload === null || isBusy(runtime.status);
}

function openSettings(): void {
  if (isBusy(runtime.status)) { setNotice("当前任务进行中，暂不能切换模型设置。"); return; }
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const model = runtime.model;
  refs.settingsLocal.checked = model?.credentialMode !== "independent";
  refs.settingsIndependent.checked = !refs.settingsLocal.checked;
  refs.settingsBaseUrl.value = model?.baseUrl ?? "";
  refs.settingsModelId.value = model?.modelId ?? "glm-5.3";
  refs.settingsProvider.value = model?.provider ?? "tongba";
  refs.settingsApi.value = model?.api ?? "openai-completions";
  clearApiKey();
  syncSettingsMode();
  refs.settingsDialog.showModal();
  (refs.settingsLocal.checked ? refs.settingsLocal : refs.settingsBaseUrl).focus();
}

async function applySettings(): Promise<void> {
  if (isBusy(runtime.status)) return;
  const error = validateSettingsForm();
  if (error) { refs.settingsFeedback.textContent = error; return; }
  const local = refs.settingsLocal.checked;
  const key = refs.settingsApiKey.value;
  try {
    const model = await runtime.configure({expectedRevision: runtime.model?.revision,
      credentialMode: local ? "host" : "independent", provider: refs.settingsProvider.value.trim(),
      modelId: refs.settingsModelId.value.trim(), api: local ? null : refs.settingsApi.value,
      baseUrl: local ? null : refs.settingsBaseUrl.value.trim(), keyAction: !local && key ? "replace" : "keep",
      ...(!local && key ? {apiKey: key} : {})});
    refs.settingsFeedback.textContent = model.configured ? `设置已保存：当前请求模型 ${model.provider}/${model.modelId}。请分别测试问答和工具调用；请求标识不证明上游实际模型身份。` : "设置已保存，尚需有效密钥。";
  } catch (error) { refs.settingsFeedback.textContent = error instanceof Error ? error.message : "设置保存失败"; }
  finally { clearApiKey(); }
}

function closeUploadDialog(): void {
  uploadGeneration += 1;
  pendingUpload = null;
  uploadProcessing = false;
  uploadAdding = false;
  updateUploadActions();
  refs.uploadDialog.close();
}

async function handleUpload(file: File): Promise<void> {
  refs.uploadInput.value = "";
  if (isBusy(runtime.status)) {
    setNotice("当前状态忙碌，不能更换资料；请先取消或完成当前任务或报告确认。");
    return;
  }


  const generation = ++uploadGeneration;
  uploadProcessing = true;
  pendingUpload = null;
  updateUploadActions();
  setNotice("正在校验上传资料，尚未加入左栏……");
  try {
    const result = await validateDatasetFile(file);
    if (generation !== uploadGeneration) return;
    if (!result.ok) {
      setNotice(`上传未添加：${result.error}`);
      return;
    }
    const version = await datasetVersion(result.value);
    if (generation !== uploadGeneration) return;
    pendingUpload = {
      name: file.name,
      payload: result.value,
      version,
      count: result.value.tickets.length,
    };
    refs.uploadTitle.textContent = `预览资料：${file.name}`;
    refs.uploadBody.replaceChildren(
      element("p", "dialog-lead", "校验通过。确认后保存到左栏，仍需主动选择才会绑定分析。"),
      createDetailDefinitionList([
        ["记录数", String(pendingUpload.count)],
        ["规范化版本", pendingUpload.version],
        ["上传处理", "确认添加后保存到后端本地目录"],
        ["now", pendingUpload.payload.now ?? "未提供"],
      ]),
      element("h3", "table-title", "工单记录（原始字段）"),
      createTicketTable(pendingUpload.payload.tickets),
    );
    refs.uploadAdd.setAttribute("aria-label", `添加${file.name}`);
    refs.uploadAdd.textContent = "添加资料";
    lastFocusedElement = refs.uploadInput;
    if (!refs.uploadDialog.open) refs.uploadDialog.showModal();
  } finally {
    if (generation === uploadGeneration) {
      uploadProcessing = false;
      updateUploadActions();
    }
  }
}

async function addPendingUpload(): Promise<void> {
  if (!pendingUpload || uploadProcessing || uploadAdding) return;
  if (isBusy(runtime.status)) {
    setNotice("当前状态忙碌，不能更换资料；请先取消或完成当前任务或报告确认。");
    return;
  }

  const candidate = pendingUpload;
  const generation = uploadGeneration;
  uploadAdding = true;
  updateUploadActions();
  try {
    await runtime.upload(candidate.name, candidate.payload);
    if (generation !== uploadGeneration || pendingUpload !== candidate) return;
    setNotice(`已保存${candidate.name}，可从左栏选择后分析。`);
    pendingUpload = null;
    closeUploadDialog();
    updateDatasetList();
    updateSelection();
    updateControls();
  } catch (error) {
    setNotice(`上传资料未添加：${error instanceof Error ? error.message : "校验失败"}`);
  } finally {
    if (generation === uploadGeneration) {
      uploadAdding = false;
      updateUploadActions();
    }
  }
}

function handleDrop(event: DragEvent): void {
  event.preventDefault();
  const datasetId = event.dataTransfer?.getData("application/x-pi-dataset");
  if (datasetId && state.datasets.some((dataset) => dataset.id === datasetId)) ensureDatasetSelected(datasetId);

}

function openPanel(panel: HTMLDialogElement): void {
  if (isMobile()) {
    if (!panel.open) panel.showModal();
  } else {
    panel.open = true;
  }
}

function createPanelHeader(
  title: string,
  subtitle: string,
  collapseLabel: string,
  iconName: IconName,
  titleId: string,
): { header: HTMLElement; toggle: HTMLButtonElement } {
  const header = element("header", "panel-header");
  const titleWrap = element("div", "panel-title-wrap");
  const titleElement = element("h2", "panel-title", title);
  titleElement.id = titleId;
  titleWrap.append(titleElement, element("span", "panel-subtitle", subtitle));
  const toggle = iconButton(collapseLabel, "collapse-toggle", iconName);
  header.append(titleWrap, toggle);
  return { header, toggle };
}

function buildApp(): UiRefs {
  const shell = element("div", "app-shell");
  const topbar = element("header", "topbar");
  const brand = element("div", "brand");
  brand.append(element("span", "brand-mark", "Pi"), element("span", "brand-name", "工单助手"));
  const topbarActions = element("div", "topbar-actions");
  const demoBadge = element("span", "demo-badge");
  demoBadge.append(element("span", "demo-dot"), element("span", "demo-badge-text", "正在连接后端"));
  const settingsButton = labelledButton("设置", "settings-button", "settings");
  settingsButton.setAttribute("aria-label", "打开模型设置");
  settingsButton.addEventListener("click", openSettings);
  resourceTrigger = labelledButton("能力库", "resource-trigger", "file");
  resourceTrigger.setAttribute("aria-label", "打开能力库");
  const reconnect = labelledButton("重新连接", "secondary-button");
  reconnect.addEventListener("click", () => runtime.connect());
  topbarActions.append(reconnect, demoBadge, element("span", "topbar-divider"), resourceTrigger, settingsButton);
  topbar.append(brand, topbarActions);

  const mobileControls = element("div", "mobile-panel-triggers");
  const mobileLeft = labelledButton("资料", "mobile-panel-trigger", "file");
  mobileLeft.setAttribute("aria-label", "展开资料栏");
  const mobileRight = labelledButton("成果", "mobile-panel-trigger", "report");
  mobileRight.setAttribute("aria-label", "展开成果栏");
  mobileControls.append(mobileLeft, mobileRight);

  const workspace = element("main", "workspace");

  const leftPanel = element("dialog", "panel left-panel") as HTMLDialogElement;
  leftPanel.dataset.testid = "left-panel";
  leftPanel.setAttribute("aria-labelledby", "left-panel-title");
  const leftHeader = createPanelHeader("资料", "选择后加入输入区", "收起资料栏", "chevron-left", "left-panel-title");
  const leftBody = element("div", "panel-body");
  const datasetHeading = element("div", "section-heading");
  datasetHeading.append(element("h3", "section-title", "资料"));
  const uploadLabel = element("label", "upload-button");
  uploadLabel.append(createIcon("plus"), element("span", "button-label", "上传"));
  const uploadInput = element("input", "sr-only") as HTMLInputElement;
  uploadInput.type = "file";
  uploadInput.accept = ".json,application/json";
  uploadInput.setAttribute("aria-label", "上传JSON资料");
  uploadLabel.append(uploadInput);
  datasetHeading.append(uploadLabel);
  const datasetList = element("div", "resource-list");
  const filters = element("div", "dataset-filters");
  datasetPicker = element("select"); datasetPicker.setAttribute("aria-label", "当前资料");
  const none = element("option", "", "不选择资料"); none.value = ""; datasetPicker.append(none);
  datasetPicker.addEventListener("change", () => {
    const id = datasetPicker.value;
    if (isBusy(runtime.status)) { datasetPicker.value = state.selectedDatasetId ?? ""; return; }
    if (id) ensureDatasetSelected(id);
    else if (state.selectedDatasetId) toggleDataset(state.selectedDatasetId);
  });
  datasetSource = element("select"); datasetSource.setAttribute("aria-label", "筛选资料来源");
  for (const [value, label] of [["all", "全部资料"], ["fixture", "内置资料"], ["upload", "上传资料"], ["selected", "当前已选"]]) {
    const option = element("option", "", label); option.value = value; datasetSource.append(option);
  }
  datasetSource.addEventListener("change", filterDatasets);
  datasetSearch = element("input"); datasetSearch.type = "search"; datasetSearch.maxLength = 120;
  datasetSearch.placeholder = "按文件名搜索"; datasetSearch.setAttribute("aria-label", "搜索资料");
  datasetSearch.addEventListener("input", filterDatasets);
  const filterRow = element("div", "dataset-filter-row"); filterRow.append(datasetSource, datasetSearch);
  datasetCount = element("span", "dataset-count"); datasetCount.setAttribute("role", "status");
  const clear = labelledButton("清空筛选", "filter-clear");
  clear.addEventListener("click", () => { datasetSource.value = "all"; datasetSearch.value = ""; filterDatasets(); });
  const filterStatus = element("div", "dataset-filter-row"); filterStatus.append(datasetCount, clear);
  filters.append(createField("当前资料", datasetPicker), filterRow, filterStatus);
  datasetEmpty = element("p", "dataset-empty", "没有匹配的资料。可更换关键词或清空筛选；当前选中资料不会改变。");
  datasetEmpty.hidden = true;
  leftBody.append(datasetHeading, filters, datasetList, datasetEmpty);
  leftPanel.append(leftHeader.header, leftBody);

  const conversation = testId(element("section", "conversation"), "conversation");
  conversation.setAttribute("aria-label", "中心会话区");
  const conversationHeader = element("div", "conversation-header");
  conversationHeader.append(
    element("span", "conversation-kicker", "工单问答工作台"),
    element("span", "conversation-hint", "可直接提问，分析工单时再选资料"),
  );
  const messages = testId(element("div", "messages"), "messages");
  messages.setAttribute("aria-live", "polite");
  const emptyState = element("div", "empty-state");
  const emptyIcon = element("div", "empty-state-icon");
  emptyIcon.append(createIcon("message"));
  emptyState.append(
    emptyIcon,
    element("h1", "empty-state-title", "从一个问题开始"),
    element("p", "empty-state-copy", "无需资料，也可以先了解我的职责和能力"),
    element("p", "empty-state-note", "分析工单时可选择内置示例或上传资料"),
  );
  const introSuggestions = element("div", "suggestions intro-suggestions");
  for (const [label, question] of [["你能做什么", "你能做什么"], ["能访问哪些文件", "你能访问哪些文件"], ["能力边界", "你的能力边界是什么"]]) {
    const button = labelledButton(label, "suggestion-button");
    button.addEventListener("click", () => resourceUI.fillText(question));
    introSuggestions.append(button);
  }
  emptyState.append(introSuggestions);
  const suggestions = element("div", "suggestions");
  for (const [label, command] of [["查询工单", "/query"], ["整理报告", "/report"]]) {
    const suggestion = labelledButton(`${label} ${command}`, "suggestion-button", "file");
    suggestion.addEventListener("click", () => {
      const resource = RESOURCES.find(r => r.command === command);
      if (resource) resourceUI.fill(resource);
    });
    suggestions.append(suggestion);
  }
  emptyState.append(suggestions);
  messages.append(emptyState);

  const composer = testId(element("form", "composer"), "composer");
  composer.setAttribute("aria-label", "问题输入区");
  const selection = element("div", "selection");
  const textarea = element("textarea") as HTMLTextAreaElement;
  textarea.setAttribute("aria-label", "输入问题");
  textarea.maxLength = 4000;
  textarea.rows = 3;
  textarea.placeholder = "输入问题，或输入 / 选择命令…";
  textarea.addEventListener("input", () => {
    updateControls();
    if (!composing) resourceUI.search();
  });
  textarea.addEventListener("compositionstart", () => { composing = true; resourceUI.hideMenu(); });
  textarea.addEventListener("compositionend", () => { composing = false; resourceUI.search(); });
  textarea.addEventListener("keydown", (event) => {
    if (event.isComposing || composing) return;
    if (resourceUI.keydown(event)) return;
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && !composing) {
      event.preventDefault();
      submitQuestion();
    }
  });
  const composerFooter = element("div", "composer-footer");
  composerFooter.append(element("span", "composer-help", "输入 / 选择命令 · Enter 发送 · Shift + Enter 换行"));
  const composerActions = element("div", "composer-actions");
  const dragHint = element("span", "drag-hint", "可拖入资料");
  const sendButton = element("button", "send-button") as HTMLButtonElement;
  sendButton.type = "submit";
  sendButton.setAttribute("aria-label", "发送问题");
  sendButton.disabled = true;
  sendButton.append(createIcon("send"));
  stopButton = labelledButton("停止生成", "secondary-button");
  stopButton.hidden = true;
  stopButton.addEventListener("click", () => runtime.stop());
  composerActions.append(dragHint, stopButton, sendButton);
  composerFooter.append(composerActions);
  composer.append(selection, textarea, composerFooter);
  const syncMessageLane = () => {
    const horizontalSpace = window.innerWidth <= 600 ? 28 : 56;
    const messagePadding = window.innerWidth <= 600 ? 32 : 56;
    const width = Math.max(0, Math.min(980, conversation.clientWidth - horizontalSpace, messages.clientWidth - messagePadding));
    composer.style.width = `${width}px`;
    messages.style.setProperty("--message-lane-width", `${width}px`);
  };
  new ResizeObserver(syncMessageLane).observe(conversation);
  new ResizeObserver(syncMessageLane).observe(messages);
  composer.addEventListener("dragover", (event) => {
    event.preventDefault();
    composer.classList.add("is-drag-over");
  });
  composer.addEventListener("dragleave", () => composer.classList.remove("is-drag-over"));
  composer.addEventListener("drop", (event) => {
    composer.classList.remove("is-drag-over");
    handleDrop(event);
  });
  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    submitQuestion();
  });
  const notice = element("p", "notice", runtime.notice);
  conversation.append(conversationHeader, messages, composer, notice);

  const rightPanel = element("dialog", "panel right-panel") as HTMLDialogElement;
  rightPanel.dataset.testid = "right-panel";
  rightPanel.setAttribute("aria-labelledby", "right-panel-title");
  const rightHeader = createPanelHeader("成果", "查询与报告", "收起成果栏", "chevron-right", "right-panel-title");
  const rightBody = element("div", "panel-body result-panel-body");
  const tabs = element("div", "result-tabs");
  tabs.setAttribute("role", "tablist");
  const resultTab = labelledButton("查询结果", "result-tab");
  const reportTab = labelledButton("报告", "result-tab");
  resultTab.setAttribute("role", "tab");
  reportTab.setAttribute("role", "tab");
  tabs.append(resultTab, reportTab);
  const resultContent = testId(element("section", "result-content"), "result-content");
  resultContent.setAttribute("aria-label", "查询结果内容");
  const resultEmpty = element("div", "result-empty");
  const resultIcon = element("div", "result-empty-icon");
  resultIcon.append(createIcon("file"));
  resultEmpty.append(
    resultIcon,
    element("h3", "result-empty-title", "等待第一次查询"),
    element("p", "result-empty-copy", "查询后显示记录、统计和资料来源。"),
  );
  resultContent.append(resultEmpty);
  const reportContent = testId(element("section", "report-content"), "report-content");
  reportContent.setAttribute("aria-label", "报告内容");
  const reportEmpty = element("div", "report-empty");
  const reportIcon = element("div", "result-empty-icon");
  reportIcon.append(createIcon("report"));
  reportEmpty.append(
    reportIcon,
    element("h3", "result-empty-title", "还没有报告"),
    element("p", "result-empty-copy", "先完成查询，再整理处理建议。"),
    element("p", "report-actions-note", "先预览草稿，确认后保存文件"),
  );
  reportContent.append(reportEmpty);
  rightBody.append(tabs, resultContent, reportContent);
  rightPanel.append(rightHeader.header, rightBody);

  workspace.append(leftPanel, conversation, rightPanel);
  syncLayout = setupLayout(workspace, () => [state.leftCollapsed, state.rightCollapsed]);
  shell.append(topbar, mobileControls, workspace);

  const settingsDialog = element("dialog", "modal-dialog settings-dialog") as HTMLDialogElement;
  settingsDialog.setAttribute("aria-labelledby", "settings-title");
  const settingsForm = element("form", "modal-form");
  const settingsHeader = element("header", "modal-header");
  const settingsTitle = element("h2", "modal-title", "模型设置");
  settingsTitle.id = "settings-title";
  settingsHeader.append(settingsTitle);
  const settingsClose = iconButton("关闭模型设置", "modal-close", "close");
  settingsClose.addEventListener("click", () => settingsDialog.close());
  settingsHeader.append(settingsClose);
  const settingsBody = element("div", "modal-body");
  const sourceFieldset = element("fieldset", "source-fieldset");
  sourceFieldset.append(element("legend", "field-label", "模型来源"));
  const settingsLocal = element("input") as HTMLInputElement;
  settingsLocal.type = "radio";
  settingsLocal.name = "model-source";
  settingsLocal.value = "local";
  settingsLocal.id = "source-local";
  const settingsIndependent = element("input") as HTMLInputElement;
  settingsIndependent.type = "radio";
  settingsIndependent.name = "model-source";
  settingsIndependent.value = "independent";
  settingsIndependent.id = "source-independent";
  const localLabel = element("label", "source-option");
  localLabel.htmlFor = "source-local";
  localLabel.append(settingsLocal, element("span", "source-copy", "本机 Pi 配置"), element("small", "source-note", "使用内置模型配置"));
  const independentLabel = element("label", "source-option is-selected");
  independentLabel.htmlFor = "source-independent";
  independentLabel.append(settingsIndependent, element("span", "source-copy", "独立配置"), element("small", "source-note", "使用自定义接口配置"));
  sourceFieldset.append(localLabel, independentLabel);
  const formGrid = element("div", "form-grid");
  const interfaceSelect = element("select") as HTMLSelectElement;
  interfaceSelect.name = "interfaceType";
  for (const api of ["openai-completions", "openai-responses", "anthropic-messages"]) {
    const option = element("option", "", api); option.value = api; interfaceSelect.append(option);
  }
  const settingsProvider = element("input") as HTMLInputElement;
  settingsProvider.autocomplete = "off";
  formGrid.append(createField("Provider", settingsProvider));
  formGrid.append(createField("接口类型", interfaceSelect));
  const settingsBaseUrl = element("input") as HTMLInputElement;
  settingsBaseUrl.type = "url";
  settingsBaseUrl.name = "baseUrl";
  settingsBaseUrl.autocomplete = "off";
  formGrid.append(createField("Base URL", settingsBaseUrl));
  const settingsApiKey = element("input") as HTMLInputElement;
  settingsApiKey.type = "password";
  settingsApiKey.name = "apiKey";
  settingsApiKey.autocomplete = "off";
  settingsApiKey.placeholder = "仅后端进程内存使用";
  const apiKeyField = createField("API Key", settingsApiKey);
  apiKeyField.append(element("small", "field-note", "密钥仅保存在后端进程内存，不落盘、不回显"));
  formGrid.append(apiKeyField);
  const settingsModelId = element("input") as HTMLInputElement;
  settingsModelId.type = "text";
  settingsModelId.name = "modelId";
  settingsModelId.autocomplete = "off";
  formGrid.append(createField("模型 ID", settingsModelId));
  const statusGrid = element("div", "test-status-grid");
  for (const [label, kind] of [["问答测试", "chat"], ["工具调用测试", "tool"]] as const) {
    const test = labelledButton(label, "secondary-button");
    test.addEventListener("click", () => {
      if (isBusy(runtime.status)) return;
      void runtime.testModel(kind).then(() => { refs.settingsFeedback.textContent = "测试已受理，请查看任务进度；受理不表示测试通过。"; }).catch(() => {});
    });
    statusGrid.append(test);
  }
  const settingsFeedback = element("p", "form-feedback", "先保存设置，再分别进行真实问答和工具测试。");
  const settingsActions = element("div", "modal-actions");
  const settingsValidate = labelledButton("本地校验", "secondary-button");
  const settingsSave = labelledButton("保存设置", "primary-button");
  const clearKey = labelledButton("清除独立密钥", "secondary-button");
  clearKey.addEventListener("click", () => {
    const model = runtime.model;
    if (!model || model.credentialMode !== "independent" || isBusy(runtime.status)) return;
    const {revision, configured: _configured, ...preferences} = model;
    void runtime.configure({...preferences, expectedRevision: revision, keyAction: "clear"})
      .then(() => { clearApiKey(); refs.settingsFeedback.textContent = "后端内存密钥已清除，需重新输入才能请求模型。"; }).catch(() => {});
  });
  settingsActions.append(settingsValidate, clearKey, settingsSave);
  settingsBody.append(sourceFieldset, formGrid, statusGrid, settingsFeedback, settingsActions);
  settingsForm.append(settingsHeader, settingsBody);
  settingsDialog.append(settingsForm);

  const detailDialog = element("dialog", "modal-dialog detail-dialog") as HTMLDialogElement;
  detailDialog.setAttribute("aria-labelledby", "detail-title");
  const detailHeader = element("header", "modal-header");
  const detailTitle = element("h2", "modal-title", "详情");
  detailTitle.id = "detail-title";
  const detailClose = iconButton("关闭详情", "modal-close", "close");
  detailClose.addEventListener("click", () => detailDialog.close());
  detailHeader.append(detailTitle, detailClose);
  const detailBody = element("div", "modal-body");
  detailDialog.append(detailHeader, detailBody);

  const uploadDialog = element("dialog", "modal-dialog upload-dialog") as HTMLDialogElement;
  uploadDialog.setAttribute("aria-labelledby", "upload-title");
  const uploadHeader = element("header", "modal-header");
  const uploadTitle = element("h2", "modal-title", "预览资料");
  uploadTitle.id = "upload-title";
  const uploadClose = iconButton("取消上传", "modal-close", "close");
  uploadClose.addEventListener("click", () => closeUploadDialog());
  uploadHeader.append(uploadTitle, uploadClose);
  const uploadBody = element("div", "modal-body");
  const uploadActions = element("div", "modal-actions");
  const uploadCancel = labelledButton("取消", "secondary-button");
  uploadCancel.addEventListener("click", () => closeUploadDialog());
  const uploadAdd = labelledButton("添加资料", "primary-button");
  uploadActions.append(uploadCancel, uploadAdd);
  uploadBody.append(element("p", "dialog-note", "上传资料保存到后端本地目录；同名文件仍有独立资料身份。"));
  uploadDialog.append(uploadHeader, uploadBody, uploadActions);

  shell.append(settingsDialog, detailDialog, uploadDialog);
  appRoot.replaceChildren(shell);

  const ui: UiRefs = {
    shell,
    leftPanel,
    rightPanel,
    leftToggle: leftHeader.toggle,
    rightToggle: rightHeader.toggle,
    datasetList,
    uploadInput,
    mobileRight,
    selection,
    textarea,
    sendButton,
    messages,
    notice,
    resultTab,
    reportTab,
    resultContent,
    reportContent,
    settingsDialog,
    settingsLocal,
    settingsIndependent,
    settingsBaseUrl,
    settingsApiKey,
    settingsModelId,
    settingsFeedback,
    settingsProvider,
    settingsApi: interfaceSelect,
    detailDialog,
    detailTitle,
    detailBody,
    uploadDialog,
    uploadTitle,
    uploadBody,
    uploadAdd,
  };

  const desktop = !isMobile();
  leftPanel.open = desktop;
  rightPanel.open = desktop;
  leftHeader.toggle.addEventListener("click", () => {
    if (isMobile()) leftPanel.close();
    else {
      state.leftCollapsed = !state.leftCollapsed;
      updatePanelCollapse();
    }
  });
  rightHeader.toggle.addEventListener("click", () => {
    if (isMobile()) rightPanel.close();
    else {
      state.rightCollapsed = !state.rightCollapsed;
      updatePanelCollapse();
    }
  });
  mobileLeft.addEventListener("click", () => openPanel(leftPanel));
  mobileRight.addEventListener("click", () => openPanel(rightPanel));
  uploadInput.addEventListener("change", () => {
    const file = uploadInput.files?.[0];
    if (file) void handleUpload(file);
  });
  resultTab.addEventListener("click", () => {
    state.activeTab = "result";
    updateTabs();
  });
  reportTab.addEventListener("click", () => {
    state.activeTab = "report";
    updateTabs();
  });
  settingsValidate.addEventListener("click", () => {
    const error = validateSettingsForm();
    refs.settingsFeedback.className = `form-feedback${error ? " is-error" : ""}`;
    refs.settingsFeedback.textContent = error ?? "格式校验通过；模型可用性需真实测试。";
  });
  settingsLocal.addEventListener("change", syncSettingsMode);
  settingsIndependent.addEventListener("change", syncSettingsMode);
  settingsSave.addEventListener("click", applySettings);
  settingsDialog.addEventListener("close", () => {
    clearApiKey();
    if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
  });
  detailDialog.addEventListener("close", () => {
    if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
  });
  uploadDialog.addEventListener("cancel", event => { event.preventDefault(); closeUploadDialog(); });
  uploadDialog.addEventListener("close", () => {
    // Native close events are queued: never invalidate a newer upload here.
    if (!uploadProcessing && !uploadAdding && !uploadDialog.open && lastFocusedElement?.isConnected) lastFocusedElement.focus();
  });
  uploadAdd.addEventListener("click", () => void addPendingUpload());
  let wasMobile = isMobile();
  window.addEventListener("resize", () => {
    if (wasMobile === isMobile()) return;
    wasMobile = isMobile();
    if (isMobile()) {
      state.leftCollapsed = false;
      state.rightCollapsed = false;
      if (leftPanel.open) leftPanel.close();
      if (rightPanel.open) rightPanel.close();
    } else {
      if (leftPanel.open) leftPanel.close();
      if (rightPanel.open) rightPanel.close();
      leftPanel.open = true;
      rightPanel.open = true;
      updatePanelCollapse();
    }
  });
  return ui;
}

async function submitQuestion(): Promise<void> {
  const text = refs.textarea.value;
  if (await runtime.submit(text)) {
    if (refs.textarea.value === text) refs.textarea.value = "";
    resourceUI.hideMenu();
    updateControls();
  }
}

function viewArtifact(tab: "result" | "report"): void {
  state.activeTab = tab;
  state.rightCollapsed = false;
  updateTabs();
  updatePanelCollapse();
  openPanel(refs.rightPanel);
}

function sourceDetails(source: { datasetId: string; name: string; version: string }, requestId: string): HTMLElement {
  const details = element("details", "artifact-source");
  details.append(element("summary", "", `来源：${source.name}`), createDetailDefinitionList([
    ["资料 ID", source.datasetId], ["版本", source.version], ["请求 ID", requestId],
  ]));
  return details;
}

function renderRuntime(): void {
  if (runtime.messages.length) {
    refs.messages.replaceChildren();
    for (const message of runtime.messages) {
      const row = testId(element("div", `message-row message-row-${message.role}`), "message-row");
      const card = testId(element("article", `chat-message message-${message.role}`), "message");
      const label = element("div", "message-label");
      if (message.role === "assistant") {
        const badge = element("span", "assistant-badge", "Pi");
        badge.setAttribute("aria-hidden", "true");
        label.append(badge);
      }
      label.append(element("span", "", message.role === "user" ? "你" : message.role === "assistant" ? "助手" : "操作提示"));
      card.append(label, message.role === "assistant" ? chatMarkdown(message.text) : element("p", "message-text", message.text));
      if (message.role === "assistant" && message.status !== "completed") {
        const status: Record<string, string> = {partial: "生成中…", cancelled: "已停止", failed: "回复未完成，请查看错误提示", interrupted: "后端重启，任务已中断"};
        card.append(element("small", "message-status", status[message.status] ?? "状态未知"));
      }
      row.append(card);
      refs.messages.append(row);
    }
    const last = refs.messages.lastElementChild;
    if (last && (runtime.query || runtime.preview) && runtime.status !== "running") {
      const tab = runtime.previewState === "pending" ? "report" : "result";
      const button = labelledButton(tab === "report" ? "查看报告草稿" : "查看查询结果", "artifact-link");
      button.addEventListener("click", () => viewArtifact(tab));
      (last.querySelector(".chat-message") ?? last).append(button);
    }
    refs.messages.scrollTop = refs.messages.scrollHeight;
  }
  if (runtime.steps.length) {
    const row = testId(element("div", "message-row message-row-progress"), "message-row");
    const progress = element("details", "tool-progress");
    progress.append(element("summary", "", `工具调用（${runtime.steps.length}）：${runtime.steps.map(step => step.label).join(" → ")}`));
    const labels: Record<string, string> = {running: "进行中", completed: "完成", failed: "失败", cancelled: "已停止"};
    for (const step of runtime.steps) progress.append(element("p", "", `${step.label} · ${labels[step.status] ?? step.status}${step.durationMs === null ? "" : ` · ${step.durationMs} ms`}${step.error ? ` · ${step.error.message}` : ""}`));
    row.append(progress);
    refs.messages.append(row);
  }
  if (runtime.query) {
    const query = runtime.query;
    if (shownQueryId !== query.requestId) { state.activeTab = "result"; shownQueryId = query.requestId; }
    refs.resultContent.replaceChildren(element("h3", "artifact-title", `${query.filters.team} · ${query.filters.status}`),
      element("p", "result-statistics", `${query.count} 条工单 · urgent ${query.statistics.urgent} · normal ${query.statistics.normal}`));
    for (const ticket of query.records) {
      const card = element("article", "ticket-result");
      card.dataset.ticketId = ticket.id;
      card.append(element("strong", "", `${ticket.id} · ${ticket.title}`), element("span", "", `${ticket.priority} · ${ticket.status}`));
      refs.resultContent.append(card);
    }
    if (!query.count) refs.resultContent.append(element("p", "artifact-empty", "查询成功，当前条件下没有匹配记录。"));
    if (query.summaryStatus === "failed") refs.resultContent.append(element("p", "form-feedback is-error", "查询事实已取得，但模型总结未完成。"));
    if (query.evaluation) {
      const evaluation = query.evaluation;
      const description = evaluation.evaluation === "not_evaluated"
        ? `尚未判断超时，缺少依据：${evaluation.missingRules.join("、")}`
        : `超时 ${evaluation.counts.overdue} · 未超时 ${evaluation.counts.within_limit} · 未来时间异常 ${evaluation.counts.future} · 不适用 ${evaluation.counts.not_applicable}`;
      refs.resultContent.append(element("p", "result-statistics", description), createDetailDefinitionList([
        ["分析时间", evaluation.basis.now ?? "未提供"],
        ["urgent 阈值（小时）", String(evaluation.basis.policy.urgentHours ?? "未提供")],
        ["normal 阈值（小时）", String(evaluation.basis.policy.normalHours ?? "未提供")],
      ]));
    }
    refs.resultContent.append(sourceDetails(query.sourceRef, query.requestId));
  } else if (shownQueryId) {
    refs.resultContent.replaceChildren(element("p", "artifact-empty", "资料已切换，请重新查询。"));
    shownQueryId = null;
  }
  if (runtime.preview || runtime.reports.length) {
    refs.reportContent.replaceChildren();
    if (runtime.preview) {
      const preview = runtime.preview;
      if (shownActionId !== preview.actionId) { state.activeTab = "report"; shownActionId = preview.actionId; }
      const labels: Record<string, string> = { saving: "正在保存文件", failed: "保存失败", interrupted: "保存中断", none: "", pending: "草稿待确认", cancelled: "已取消 · 未新增报告", expired: "确认超时 · 未新增报告", saved: "文件已保存" };
      refs.reportContent.append(element("h3", "artifact-title", labels[runtime.previewState] ?? "草稿状态未知"), reportPreview(preview.body));
      if (runtime.previewState === "pending") {
        const button = labelledButton("预览并确认", "primary-button");
        button.addEventListener("click", openReportDialog);
        refs.reportContent.append(button, element("p", "report-actions-note", "确认有效期10分钟，刷新不续期；确认后才保存文件。"));
      }
    }
    if (runtime.previewState === "expired") {
      const reapply = labelledButton("重新申请保存", "secondary-button");
      reapply.addEventListener("click", () => { void runtime.reapply(); });
      refs.reportContent.append(reapply);
    }
    refs.reportContent.append(element("h3", "artifact-title", `已保存报告（${runtime.reports.length}）`));
    for (const report of [...runtime.reports].reverse()) {
      const details = testId(element("details", "saved-report"), "saved-report");
      details.append(element("summary", "", `${report.title} · ${report.sourceRef.name}`), reportPreview(report.body), sourceDetails(report.sourceRef, report.reportId));
      const download = labelledButton("下载 Markdown", "secondary-button");
      download.addEventListener("click", () => { void runtime.download(report.reportId); });
      details.append(download);
      refs.reportContent.append(details);
    }
  } else if (shownActionId) {
    refs.reportContent.replaceChildren(element("p", "artifact-empty", "资料已切换，请重新查询后生成草稿。"));
    shownActionId = null;
  }
  if (runtime.previewState !== "pending" && reportDialog?.open) reportDialog.close();
  refs.rightToggle.classList.toggle("has-new-artifact", state.rightCollapsed && Boolean(runtime.query || runtime.preview));
  refs.mobileRight.classList.toggle("has-new-artifact", Boolean(runtime.query || runtime.preview));
  updateTabs();
}

function buildReportDialog(): void {
  reportDialog = testId(element("dialog", "modal-dialog report-confirmation"), "report-confirmation");
  reportDialog.setAttribute("aria-labelledby", "report-confirmation-title");
  const header = element("header", "modal-header");
  const title = element("h2", "modal-title", "确认保存报告"); title.id = "report-confirmation-title";
  header.append(title);
  reportDialogBody = element("div", "modal-body");
  const actions = element("div", "modal-actions report-confirm-actions");
  const cancel = labelledButton("取消", "secondary-button");
  cancel.autofocus = true;
  const confirm = labelledButton("确认保存", "primary-button");
  cancel.addEventListener("click", () => runtime.cancelPreview());
  confirm.addEventListener("click", () => { if (reportActionId) runtime.confirm(reportActionId); });
  reportDialog.addEventListener("cancel", event => { event.preventDefault(); runtime.cancelPreview(); });
  reportDialog.addEventListener("close", () => { reportActionId = null; refs.textarea.focus(); });
  actions.append(cancel, confirm);
  reportDialog.append(header, reportDialogBody, actions);
  refs.shell.append(reportDialog);
}

function openReportDialog(): void {
  const preview = runtime.preview;
  if (!preview || runtime.previewState !== "pending") return;
  reportActionId = preview.actionId;
  reportDialogBody.replaceChildren(element("p", "dialog-lead", "确认将把这份草稿保存到后端本地目录。生成草稿与保存文件是两个独立步骤。"), reportPreview(preview.body), sourceDetails(preview.sourceRef, preview.requestId));
  if (!reportDialog.open) reportDialog.showModal();
  reportDialog.querySelector<HTMLButtonElement>("button")?.focus();
}

function createField(label: string, control: HTMLElement): HTMLElement {
  const field = element("label", "form-field");
  field.append(element("span", "field-label", label), control);
  return field;
}

async function start(): Promise<void> {
  refs = buildApp();
  resourceUI = createResourceUI({ root: refs.shell, input: refs.textarea, trigger: resourceTrigger, busy: () => isBusy(runtime.status), changed: updateControls, notice: setNotice, saveTemplate: (id, revision, body, reset) => runtime.saveTemplate(id, revision, body, reset) });
  buildReportDialog();
  runtime.connect();
  updateDatasetList();
  updateSelection();
  updateTabs();
  updatePanelCollapse();
  updateControls();
}

void start().catch((error: unknown) => {
  appRoot.textContent = error instanceof Error ? `应用初始化失败：${error.message}` : "应用初始化失败";
});

const sourceRows = [
  ["", "국가(사이트)", "KR", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "언어", "KR", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "포맷/산출물", "얼리버드", "", "", "", "", "", "", "", "상세페이지 오픈", "", "", "", "", "", "", "", "", "", "", "", "영상공개", "", "", "", "", "", ""],
  ["", "", "얼리버드 오가닉", "", "", "", "", "", "", "", "사이트", "", "", "", "", "오가닉", "", "", "", "", "", "", "사이트", "오가닉", "", "", "", "", ""],
  ["", "", "콜로소 공계 피드", "", "스토리", "연사용 공계 피드", "", "카카오톡", "코스카드 썸네일", "EDM", "상세페이지", "메인배너", "큐레이션 배너", "포맷 전용 페이지", "", "피드", "", "스토리", "연사용 공계 피드", "", "EDM", "광고", "상세페이지 수정", "콜로소 공계 피드", "", "스토리", "연사용 오가닉", "", "광고"],
  ["", "", "1:1", "4:5", "", "1:1", "4:5", "", "", "", "", "", "", "메인 페이지 ", "개별 상세 페이지", "1:1", "4:5", "", "1:1", "4:5", "", "", "", "1:1", "4:5", "", "1:1", "4:5", ""],
];

const siteLanguageOptions = [
  { site: "KR", language: "KO" },
  { site: "JP", language: "JO" },
  { site: "GL", language: "EN" },
  { site: "GL", language: "ZH-TW" },
  { site: "GL", language: "TH" },
];

const courseTypes = ["오리지널", "현지화"];

const courseFormatOptions = [
  "코스",
  "시그니처",
  "딕셔너리",
  "프로젝트",
  "클래스",
  "클래스 +",
  "신규",
  "에셋 유형",
];

const localizationTypeOptions = ["폐강옵션", "정규", "더빙", "확장"];

const csvColumns = [
  { key: "id", label: "ID" },
  { key: "site", label: "사이트" },
  { key: "language", label: "언어" },
  { key: "courseType", label: "코스유형" },
  { key: "courseFormat", label: "코스포맷" },
  { key: "localizationType", label: "현지화유형" },
  { key: "phase", label: "업무구간" },
  { key: "group", label: "구분" },
  { key: "output", label: "업무내용" },
  { key: "size", label: "규격" },
  { key: "workIncluded", label: "업무유무" },
  { key: "typeFit", label: "유형적합여부" },
];

const headerMap = new Map(
  csvColumns.flatMap((column) => [
    [column.key, column.key],
    [column.label, column.key],
  ])
);

const overrideStorageKey = "colosoDesignOutputChecks";
let overrides = loadOverrides();
let items = applyOverrides(buildItems(sourceRows));
let hasUnsavedChanges = false;

const els = {
  siteFilter: document.getElementById("siteFilter"),
  languageFilter: document.getElementById("languageFilter"),
  courseTypeFilter: document.getElementById("courseTypeFilter"),
  courseFormatFilter: document.getElementById("courseFormatFilter"),
  localizationTypeFilter: document.getElementById("localizationTypeFilter"),
  phaseFilter: document.getElementById("phaseFilter"),
  selectedScope: document.getElementById("selectedScope"),
  taskCount: document.getElementById("taskCount"),
  taskList: document.getElementById("taskList"),
  managementCount: document.getElementById("managementCount"),
  managementTableBody: document.getElementById("managementTableBody"),
  csvFileInput: document.getElementById("csvFileInput"),
  importCsvBtn: document.getElementById("importCsvBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  saveBtn: document.getElementById("saveBtn"),
  tabButtons: document.querySelectorAll("[data-view]"),
  viewPanels: document.querySelectorAll("[data-panel]"),
};

function buildItems(rows) {
  const baseItems = [];
  const carry = {
    phase: "",
    group: "",
    output: "",
  };

  for (let column = 2; column < rows[0].length; column += 1) {
    carry.phase = rows[2][column] || carry.phase;
    carry.group = rows[3][column] || carry.group;
    carry.output = rows[4][column] || carry.output;

    const size = rows[5][column] || "";

    if (!carry.phase || !carry.output) continue;

    baseItems.push({
      sourceColumn: column,
      phase: carry.phase,
      group: carry.group,
      output: carry.output.trim(),
      size: size.trim(),
    });
  }

  return siteLanguageOptions.flatMap((option) =>
    courseTypes.flatMap((courseType) => {
      const localizationTypes =
        courseType === "현지화" ? localizationTypeOptions : ["-"];

      return courseFormatOptions.flatMap((courseFormat) =>
        localizationTypes.flatMap((localizationType) =>
          baseItems.map((item) => ({
            ...withDefaults({
              site: option.site,
              language: option.language,
              courseType,
              courseFormat,
              localizationType,
              ...item,
            }),
          }))
        )
      );
    })
  );
}

function withDefaults(item) {
  return {
    ...item,
    id: makeId(item),
    workIncluded: "O",
    typeFit: "O",
  };
}

function makeId(item) {
  return [
    item.site,
    item.language,
    item.courseType,
    item.courseFormat,
    item.localizationType,
    item.sourceColumn,
  ]
    .join("_")
    .replace(/\s+/g, "");
}

function loadOverrides() {
  const saved = localStorage.getItem(overrideStorageKey);
  if (!saved) return {};

  try {
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function applyOverrides(baseItems) {
  return baseItems.map((item) => ({
    ...item,
    ...(overrides[item.id] || {}),
  }));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function fillSelect(select, values) {
  const current = select.value;
  const options = values.length > 1 ? ["전체", ...values] : values;

  select.innerHTML = options
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");

  if (options.includes(current)) {
    select.value = current;
  }
}

function renderSiteOptions() {
  fillSelect(els.siteFilter, unique(siteLanguageOptions.map((item) => item.site)));
}

function renderLanguageOptions() {
  const site = els.siteFilter.value;
  fillSelect(
    els.languageFilter,
    unique(
      siteLanguageOptions
        .filter((item) => site === "전체" || item.site === site)
        .map((item) => item.language)
    )
  );
}

function renderFormatOptions() {
  const site = els.siteFilter.value;
  const language = els.languageFilter.value;
  fillSelect(
    els.phaseFilter,
    unique(
      items
        .filter(
          (item) =>
            (site === "전체" || item.site === site) &&
            (language === "전체" || item.language === language) &&
            (els.courseTypeFilter.value === "전체" ||
              item.courseType === els.courseTypeFilter.value) &&
            (els.courseFormatFilter.value === "전체" ||
              item.courseFormat === els.courseFormatFilter.value) &&
            (els.localizationTypeFilter.value === "전체" ||
              item.localizationType === els.localizationTypeFilter.value)
        )
        .map((item) => item.phase)
    )
  );
}

function renderCourseTypeOptions() {
  const site = els.siteFilter.value;
  const language = els.languageFilter.value;
  fillSelect(
    els.courseTypeFilter,
    unique(
      items
        .filter(
          (item) =>
            (site === "전체" || item.site === site) &&
            (language === "전체" || item.language === language)
        )
        .map((item) => item.courseType)
    )
  );
}

function renderCourseFormatOptions() {
  const site = els.siteFilter.value;
  const language = els.languageFilter.value;
  const courseType = els.courseTypeFilter.value;
  fillSelect(
    els.courseFormatFilter,
    unique(
      items
        .filter(
          (item) =>
            (site === "전체" || item.site === site) &&
            (language === "전체" || item.language === language) &&
            (courseType === "전체" || item.courseType === courseType)
        )
        .map((item) => item.courseFormat)
    )
  );
}

function renderLocalizationTypeOptions() {
  const site = els.siteFilter.value;
  const language = els.languageFilter.value;
  const courseType = els.courseTypeFilter.value;
  const courseFormat = els.courseFormatFilter.value;
  fillSelect(
    els.localizationTypeFilter,
    unique(
      items
        .filter(
          (item) =>
            (site === "전체" || item.site === site) &&
            (language === "전체" || item.language === language) &&
            (courseType === "전체" || item.courseType === courseType) &&
            (courseFormat === "전체" || item.courseFormat === courseFormat)
        )
        .map((item) => item.localizationType)
    )
  );
}

function getSelectedItems() {
  return dedupeItems(getFilteredItems().filter(isVisible));
}

function getFilteredItems() {
  return items.filter(
    (item) =>
      (els.siteFilter.value === "전체" || item.site === els.siteFilter.value) &&
      (els.languageFilter.value === "전체" || item.language === els.languageFilter.value) &&
      (els.courseTypeFilter.value === "전체" || item.courseType === els.courseTypeFilter.value) &&
      (els.courseFormatFilter.value === "전체" ||
        item.courseFormat === els.courseFormatFilter.value) &&
      (els.localizationTypeFilter.value === "전체" ||
        item.localizationType === els.localizationTypeFilter.value) &&
      (els.phaseFilter.value === "전체" || item.phase === els.phaseFilter.value)
  );
}

function dedupeItems(source) {
  const seen = new Set();
  return source.filter((item) => {
    const key = [
      item.site,
      item.language,
      item.courseType,
      item.courseFormat,
      item.localizationType,
      item.phase,
      item.group,
      item.output,
      item.size,
      item.workIncluded,
      item.typeFit,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isVisible(item) {
  return !isNo(item.workIncluded) && !isNo(item.typeFit);
}

function isNo(value) {
  return ["N", "NO", "X", "FALSE", "0", "불필요", "미노출"].includes(
    String(value || "").trim().toUpperCase()
  );
}

function renderList() {
  const selectedItems = getSelectedItems();
  els.selectedScope.textContent = `${els.siteFilter.value} · ${els.languageFilter.value} · ${els.courseTypeFilter.value} · ${els.courseFormatFilter.value} · ${els.localizationTypeFilter.value} · ${els.phaseFilter.value}`;
  els.taskCount.textContent = `${selectedItems.length}개`;

  if (!selectedItems.length) {
    els.taskList.innerHTML = `<div class="empty-state">등록된 업무 구조가 없습니다</div>`;
    return;
  }

  els.taskList.innerHTML = renderDashboardTable(selectedItems);
}

function renderDashboardTable(selectedItems) {
  return `
    <div class="table-wrap compact">
      <table class="dashboard-table">
        <thead>
          <tr>
            <th>업무 구간</th>
            <th>구분</th>
            <th>업무내용</th>
            <th>코스 포맷</th>
            <th>현지화 유형</th>
            <th>규격</th>
          </tr>
        </thead>
        <tbody>
          ${selectedItems
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.phase)}</td>
                  <td>${escapeHtml(item.group || "-")}</td>
                  <td>${escapeHtml(item.output)}</td>
                  <td>${escapeHtml(item.courseFormat)}</td>
                  <td>${escapeHtml(item.localizationType || "-")}</td>
                  <td>${escapeHtml(item.size || "-")}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderManagementTable() {
  const managedItems = getFilteredItems();
  els.managementCount.textContent = `${managedItems.length}개`;

  if (!managedItems.length) {
    els.managementTableBody.innerHTML = `<tr><td colspan="11" class="empty-state">편집할 업무 항목이 없습니다</td></tr>`;
    return;
  }

  els.managementTableBody.innerHTML = managedItems
    .map(
      (item) => `
        <tr class="${isVisible(item) ? "" : "is-hidden-row"}">
          <td>${escapeHtml(item.site)}</td>
          <td>${escapeHtml(item.language)}</td>
          <td>${escapeHtml(item.courseType)}</td>
          <td>${escapeHtml(item.courseFormat)}</td>
          <td>${escapeHtml(item.localizationType || "-")}</td>
          <td>${escapeHtml(item.phase)}</td>
          <td>${escapeHtml(item.group || "-")}</td>
          <td>${escapeHtml(item.output)}</td>
          <td>
            <input
              class="table-input"
              data-id="${escapeHtml(item.id)}"
              data-field="size"
              value="${escapeHtml(item.size || "")}"
            />
          </td>
          <td>${renderEditableSelect(item, "workIncluded")}</td>
          <td>${renderEditableSelect(item, "typeFit")}</td>
        </tr>
      `
    )
    .join("");
}

function renderEditableSelect(item, field) {
  const value = normalizeCheckValue(item[field] || "O");
  return `
    <select class="table-select" data-id="${escapeHtml(item.id)}" data-field="${field}">
      ${["O", "X"]
        .map(
          (option) =>
            `<option value="${option}" ${value === option ? "selected" : ""}>${option}</option>`
        )
        .join("")}
    </select>
  `;
}

function updateItem(id, field, value) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  overrides[id] = {
    ...(overrides[id] || {}),
    [field]: field === "size" ? value : normalizeCheckValue(value),
  };
  items = applyOverrides(buildItems(sourceRows));
  renderList();
  renderManagementTable();
  setSaveState("dirty");
}

function exportCsv() {
  const csv = [
    csvColumns.map((column) => column.label).join(","),
    ...items.map((item) =>
      csvColumns.map((column) => csvEscape(item[column.key] || "")).join(",")
    ),
  ].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "coloso-design-output-checks.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(String(reader.result || ""));
    const headers = rows.shift() || [];
    const normalizedHeaders = headers.map((header) => headerMap.get(header.trim()) || "");
    const nextOverrides = {};

    rows.forEach((row) => {
      const record = {};
      normalizedHeaders.forEach((key, index) => {
        if (key) record[key] = row[index] || "";
      });

      if (!record.id) return;

      nextOverrides[record.id] = {
        size: record.size || "",
        workIncluded: normalizeCheckValue(record.workIncluded || "O"),
        typeFit: normalizeCheckValue(record.typeFit || "O"),
      };
    });

    overrides = nextOverrides;
    items = applyOverrides(buildItems(sourceRows));
    renderAll();
    setSaveState("dirty");
  };
  reader.readAsText(file);
}

function parseCsv(text) {
  const rows = [];
  let cell = "";
  let row = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((csvRow) => csvRow.some((value) => value.trim()));
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeCheckValue(value) {
  return isNo(value) ? "X" : "O";
}

function setSaveState(state) {
  els.saveBtn.classList.remove("is-dirty", "is-saved");

  if (state === "dirty") {
    hasUnsavedChanges = true;
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "저장";
    els.saveBtn.classList.add("is-dirty");
    return;
  }

  if (state === "saved") {
    hasUnsavedChanges = false;
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = "저장됨";
    els.saveBtn.classList.add("is-saved");
    return;
  }

  hasUnsavedChanges = false;
  els.saveBtn.disabled = true;
  els.saveBtn.textContent = "저장";
}

function groupBy(source, keyGetter) {
  const groups = new Map();
  source.forEach((item) => {
    const key = keyGetter(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

function renderAll() {
  renderSiteOptions();
  renderLanguageOptions();
  renderCourseTypeOptions();
  renderCourseFormatOptions();
  renderLocalizationTypeOptions();
  renderFormatOptions();
  renderList();
  renderManagementTable();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

els.siteFilter.addEventListener("change", () => {
  renderLanguageOptions();
  renderCourseTypeOptions();
  renderCourseFormatOptions();
  renderLocalizationTypeOptions();
  renderFormatOptions();
  renderList();
  renderManagementTable();
});
els.languageFilter.addEventListener("change", () => {
  renderCourseTypeOptions();
  renderCourseFormatOptions();
  renderLocalizationTypeOptions();
  renderFormatOptions();
  renderList();
  renderManagementTable();
});
els.courseTypeFilter.addEventListener("change", () => {
  renderCourseFormatOptions();
  renderLocalizationTypeOptions();
  renderFormatOptions();
  renderList();
  renderManagementTable();
});
els.courseFormatFilter.addEventListener("change", () => {
  renderLocalizationTypeOptions();
  renderFormatOptions();
  renderList();
  renderManagementTable();
});
els.localizationTypeFilter.addEventListener("change", () => {
  renderFormatOptions();
  renderList();
  renderManagementTable();
});
els.phaseFilter.addEventListener("change", renderList);
els.phaseFilter.addEventListener("change", renderManagementTable);
els.exportCsvBtn.addEventListener("click", exportCsv);
els.importCsvBtn.addEventListener("click", () => els.csvFileInput.click());
els.csvFileInput.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  if (file) importCsv(file);
  event.target.value = "";
});
els.managementTableBody.addEventListener("change", (event) => {
  const target = event.target;
  if (!target.matches("[data-id][data-field]")) return;
  updateItem(target.dataset.id, target.dataset.field, target.value);
});
els.saveBtn.addEventListener("click", () => {
  if (!hasUnsavedChanges) return;
  localStorage.setItem(overrideStorageKey, JSON.stringify(overrides));
  setSaveState("saved");
  window.setTimeout(() => {
    setSaveState("clean");
  }, 1200);
});
els.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    els.tabButtons.forEach((tab) => tab.classList.toggle("is-active", tab === button));
    els.viewPanels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.panel === button.dataset.view);
    });
  });
});

renderAll();
setSaveState("clean");

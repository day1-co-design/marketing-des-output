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

const courseFormatRows = [
  { category: "오리지널", type: "코스" },
  { category: "오리지널", type: "시그니처" },
  { category: "오리지널", type: "딕셔너리" },
  { category: "오리지널", type: "프로젝트" },
  { category: "오리지널", type: "클래스" },
  { category: "오리지널", type: "클래스 +" },
  { category: "오리지널", type: "신규" },
  { category: "현지화", type: "폐강옵션" },
  { category: "현지화", type: "정규" },
  { category: "현지화", type: "더빙" },
  { category: "현지화", type: "확장" },
];

const els = {
  siteFilter: document.getElementById("siteFilter"),
  languageFilter: document.getElementById("languageFilter"),
  courseTypeFilter: document.getElementById("courseTypeFilter"),
  courseFormatFilter: document.getElementById("courseFormatFilter"),
  phaseFilter: document.getElementById("phaseFilter"),
  selectedScope: document.getElementById("selectedScope"),
  taskCount: document.getElementById("taskCount"),
  taskList: document.getElementById("taskList"),
};

const items = buildItems(sourceRows);

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
      phase: carry.phase,
      group: carry.group,
      output: carry.output.trim(),
      size: size.trim(),
    });
  }

  return siteLanguageOptions.flatMap((option) =>
    courseFormatRows.flatMap((courseFormat) =>
      baseItems.map((item) => ({
        site: option.site,
        language: option.language,
        courseType: courseFormat.category,
        courseFormat: courseFormat.type,
        ...item,
      }))
    )
  );
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
              item.courseFormat === els.courseFormatFilter.value)
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

function getSelectedItems() {
  const selected = items.filter(
    (item) =>
      (els.siteFilter.value === "전체" || item.site === els.siteFilter.value) &&
      (els.languageFilter.value === "전체" || item.language === els.languageFilter.value) &&
      (els.courseTypeFilter.value === "전체" || item.courseType === els.courseTypeFilter.value) &&
      (els.courseFormatFilter.value === "전체" ||
        item.courseFormat === els.courseFormatFilter.value) &&
      (els.phaseFilter.value === "전체" || item.phase === els.phaseFilter.value)
  );

  return dedupeItems(selected);
}

function dedupeItems(source) {
  const seen = new Set();
  return source.filter((item) => {
    const key = [
      item.courseType,
      item.courseFormat,
      item.phase,
      item.group,
      item.output,
      item.size,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderList() {
  const selectedItems = getSelectedItems();
  els.selectedScope.textContent = `${els.siteFilter.value} · ${els.languageFilter.value} · ${els.courseTypeFilter.value} · ${els.courseFormatFilter.value} · ${els.phaseFilter.value}`;
  els.taskCount.textContent = `${selectedItems.length}개`;

  if (!selectedItems.length) {
    els.taskList.innerHTML = `<div class="empty-state">등록된 업무 구조가 없습니다</div>`;
    return;
  }

  els.taskList.innerHTML = `
    <div class="parallel-board">
      ${[...groupBy(selectedItems, (item) => item.phase || "기타").entries()]
        .map(([phase, phaseItems]) => renderPhaseColumn(phase, phaseItems))
        .join("")}
    </div>
  `;
}

function renderPhaseColumn(phase, phaseItems) {
  return `
    <section class="phase-column">
      <div class="phase-heading">
        <strong>${escapeHtml(phase)}</strong>
        <span>${phaseItems.length}개</span>
      </div>
      <div class="group-grid">
        ${renderGroupColumns(phaseItems)}
      </div>
    </section>
  `;
}

function renderGroupColumns(phaseItems) {
  return [...groupBy(phaseItems, (item) => item.group || "기타").entries()]
    .map(([group, groupItems]) => {
      const outputGroups = groupBy(groupItems, (item) => item.output || "산출물");
      return `
        <section class="group-column">
          <div class="group-heading">
            <strong>${escapeHtml(group)}</strong>
            <span>${groupItems.length}개</span>
          </div>
          <div class="output-grid">
            ${[...outputGroups.entries()]
              .map(([output, outputItems]) => renderOutputColumn(output, outputItems))
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderOutputColumn(output, outputItems) {
  const sizes = unique(outputItems.map((item) => item.size || "-"));
  const courseTypeMeta = els.courseTypeFilter.value === "전체"
    ? unique(outputItems.map((item) => item.courseType))
    : [];
  const courseFormatMeta = els.courseFormatFilter.value === "전체"
    ? unique(outputItems.map((item) => item.courseFormat))
    : [];

  return `
    <article class="output-column">
      <h3>${escapeHtml(output)}</h3>
      ${
        courseTypeMeta.length
          ? `<div class="meta-group">
              <span class="meta-label">코스 유형</span>
              <div class="meta-stack">${courseTypeMeta
                .map((value) => `<span>${escapeHtml(value)}</span>`)
                .join("")}</div>
            </div>`
          : ""
      }
      ${
        courseFormatMeta.length
          ? `<div class="meta-group">
              <span class="meta-label">코스 포맷</span>
              <div class="meta-stack">${courseFormatMeta
              .map((value) => `<span>${escapeHtml(value)}</span>`)
              .join("")}</div>
            </div>`
          : ""
      }
      <div class="size-stack">
        ${sizes.map((size) => `<span>${escapeHtml(size)}</span>`).join("")}
      </div>
    </article>
  `;
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
  renderFormatOptions();
  renderList();
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
  renderFormatOptions();
  renderList();
});
els.languageFilter.addEventListener("change", () => {
  renderCourseTypeOptions();
  renderCourseFormatOptions();
  renderFormatOptions();
  renderList();
});
els.courseTypeFilter.addEventListener("change", () => {
  renderCourseFormatOptions();
  renderFormatOptions();
  renderList();
});
els.courseFormatFilter.addEventListener("change", () => {
  renderFormatOptions();
  renderList();
});
els.phaseFilter.addEventListener("change", renderList);

renderAll();

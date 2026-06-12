const STORAGE_KEY = "uestc-padel-state-v1";
const ADMIN_KEY = "uestc-padel-admin";
const ADMIN_PASSWORD = "uestc";

const state = loadState();
let isAdmin = localStorage.getItem(ADMIN_KEY) === "true";
let currentEventId = null;

const els = {
  adminToggle: document.querySelector("#adminToggle"),
  adminPanel: document.querySelector("#adminPanel"),
  adminPassword: document.querySelector("#adminPassword"),
  adminLogin: document.querySelector("#adminLogin"),
  adminState: document.querySelector("#adminState"),
  tabs: document.querySelectorAll(".tab"),
  views: {
    events: document.querySelector("#eventsView"),
    leaderboard: document.querySelector("#leaderboardView"),
  },
  eventListScreen: document.querySelector("#eventListScreen"),
  newEventButton: document.querySelector("#newEventButton"),
  eventForm: document.querySelector("#eventForm"),
  eventFormTitle: document.querySelector("#eventFormTitle"),
  backToEventsFromForm: document.querySelector("#backToEventsFromForm"),
  eventId: document.querySelector("#eventId"),
  eventName: document.querySelector("#eventName"),
  eventSize: document.querySelector("#eventSize"),
  eventStartTime: document.querySelector("#eventStartTime"),
  eventEndTime: document.querySelector("#eventEndTime"),
  eventLocation: document.querySelector("#eventLocation"),
  eventFormat: document.querySelector("#eventFormat"),
  scoreMode: document.querySelector("#scoreMode"),
  scoreTarget: document.querySelector("#scoreTarget"),
  resetEventForm: document.querySelector("#resetEventForm"),
  eventsList: document.querySelector("#eventsList"),
  eventDetailScreen: document.querySelector("#eventDetailScreen"),
  backToEventsFromDetail: document.querySelector("#backToEventsFromDetail"),
  detailTitle: document.querySelector("#detailTitle"),
  detailMeta: document.querySelector("#detailMeta"),
  detailStatus: document.querySelector("#detailStatus"),
  detailActions: document.querySelector("#detailActions"),
  eventDetailBody: document.querySelector("#eventDetailBody"),
  globalSort: document.querySelector("#globalSort"),
  globalLeaderboard: document.querySelector("#globalLeaderboard"),
  template: document.querySelector("#eventTemplate"),
};

function loadState() {
  const fallback = { events: [] };
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || fallback;
  } catch {
    return fallback;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowTs() {
  return Date.now();
}

function eventStartTime(event) {
  return event.startTime || event.time;
}

function eventEndTime(event) {
  return event.endTime || new Date(new Date(eventStartTime(event)).getTime() + 12 * 60 * 60 * 1000).toISOString();
}

function eventTimeLabel(event) {
  return `${formatDateTime(eventStartTime(event))} - ${formatDateTime(eventEndTime(event))}`;
}

function scoreModeLabel(event) {
  return event.scoreMode === "sets" ? `${event.scoreTarget} 局制` : `抢 ${event.scoreTarget} 分`;
}

function hashName(name) {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createAvatar(name) {
  const hash = hashName(name || "player");
  const avatar = el("span", "avatar");
  avatar.title = name;
  avatar.setAttribute("aria-label", `${name} 的头像`);
  avatar.style.setProperty("--avatar-bg", `hsl(${hash % 360} 72% 88%)`);
  avatar.style.setProperty("--avatar-fg", `hsl(${(hash >>> 8) % 360} 72% 42%)`);
  avatar.style.setProperty("--avatar-accent", `hsl(${(hash >>> 16) % 360} 82% 52%)`);

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const mirrorCol = col > 2 ? 4 - col : col;
      const bit = (hash >> ((row * 3 + mirrorCol) % 24)) & 1;
      const pixel = el("i");
      if (bit || (row === 1 && col === 2)) pixel.className = (row + col + hash) % 5 === 0 ? "accent" : "filled";
      avatar.append(pixel);
    }
  }
  return avatar;
}

function normalizeScore(event, score) {
  const raw = Number(score) || 0;
  return event.scoreMode === "sets" ? raw * 4 : raw;
}

function eventStatus(event) {
  const scheduled = new Date(eventStartTime(event)).getTime();
  const ended = nowTs() > new Date(eventEndTime(event)).getTime();
  if (ended) return "locked";
  if (event.startedAt || scheduled <= nowTs()) return "running";
  return "draft";
}

function statusText(status) {
  return { draft: "报名中", running: "进行中", locked: "已锁定" }[status];
}

function canEditPlayers(event) {
  return eventStatus(event) === "draft";
}

function canEditScores(event) {
  return eventStatus(event) === "running";
}

function ensureEventStarted(event) {
  if (event.startedAt || eventStatus(event) !== "running" || event.players.length !== 4) return;
  event.startedAt = eventStartTime(event);
  event.matches = pairsForFour(event.players).map((match) => ({
    id: uid("match"),
    ...match,
    scoreA: "",
    scoreB: "",
  }));
  persist();
}

function pairsForFour(players) {
  const [a, b, c, d] = players;
  return [
    { label: "第 1 场", teamA: [a.id, b.id], teamB: [c.id, d.id] },
    { label: "第 2 场", teamA: [a.id, c.id], teamB: [b.id, d.id] },
    { label: "第 3 场", teamA: [a.id, d.id], teamB: [b.id, c.id] },
  ];
}

function startEvent(event) {
  if (event.players.length !== 4) {
    alert("目前仅支持 4 人转转赛，请先凑满 4 位球员。");
    return;
  }
  event.startedAt = event.startedAt || new Date().toISOString();
  event.matches = pairsForFour(event.players).map((match, index) => ({
    id: event.matches?.[index]?.id || uid("match"),
    ...match,
    scoreA: event.matches?.[index]?.scoreA ?? "",
    scoreB: event.matches?.[index]?.scoreB ?? "",
  }));
  persist();
  render();
}

function buildEventRanking(event) {
  const rows = event.players.map((player) => ({
    id: player.id,
    gender: player.gender,
    wins: 0,
    net: 0,
    scored: 0,
    basePoints: 0,
    rank: 0,
    bonus: 0,
    totalPoints: 0,
  }));
  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const match of event.matches || []) {
    const scoreA = normalizeScore(event, match.scoreA);
    const scoreB = normalizeScore(event, match.scoreB);
    if (match.scoreA === "" || match.scoreB === "" || scoreA === scoreB) continue;
    const teamAWon = scoreA > scoreB;
    for (const id of match.teamA) {
      const row = byId.get(id);
      row.scored += scoreA;
      row.net += scoreA - scoreB;
      row.wins += teamAWon ? 1 : 0;
      row.basePoints += teamAWon ? 2 : 1;
    }
    for (const id of match.teamB) {
      const row = byId.get(id);
      row.scored += scoreB;
      row.net += scoreB - scoreA;
      row.wins += teamAWon ? 0 : 1;
      row.basePoints += teamAWon ? 1 : 2;
    }
  }

  rows.sort((a, b) => b.wins - a.wins || b.net - a.net || b.scored - a.scored || a.id.localeCompare(b.id));
  let previous = null;
  rows.forEach((row, index) => {
    const tied = previous && row.wins === previous.wins && row.net === previous.net && row.scored === previous.scored;
    row.rank = tied ? previous.rank : index + 1;
    row.bonus = event.players.length - row.rank;
    row.totalPoints = row.basePoints + row.bonus;
    previous = row;
  });
  return rows;
}

function buildGlobalLeaderboard(sortBy = "points") {
  const totals = new Map();
  for (const event of state.events) {
    if (!event.startedAt) continue;
    for (const row of buildEventRanking(event)) {
      const total = totals.get(row.id) || { id: row.id, events: 0, points: 0, scored: 0 };
      total.events += 1;
      total.points += row.totalPoints;
      total.scored += row.scored;
      totals.set(row.id, total);
    }
  }
  const sorters = {
    points: (a, b) => b.points - a.points || b.scored - a.scored || a.id.localeCompare(b.id),
    events: (a, b) => b.events - a.events || b.points - a.points || a.id.localeCompare(b.id),
    scored: (a, b) => b.scored - a.scored || b.points - a.points || a.id.localeCompare(b.id),
  };
  return [...totals.values()].sort(sorters[sortBy]);
}

function render() {
  renderAdmin();
  renderEvents();
  renderEventDetail();
  renderGlobalLeaderboard();
}

function renderAdmin() {
  els.adminToggle.textContent = isAdmin ? "退出" : "管理员";
  els.adminLogin.textContent = isAdmin ? "退出登录" : "登录";
  els.adminState.textContent = isAdmin ? "管理员已登录，可编辑和删除活动。" : "球员可创建活动和维护报名；管理员可管理所有活动。";
}

function logoutAdmin() {
  isAdmin = false;
  localStorage.removeItem(ADMIN_KEY);
  els.adminPassword.value = "";
  els.adminPanel.classList.add("hidden");
}

function applyScoreModeDefault() {
  els.scoreTarget.value = els.scoreMode.value === "sets" ? 4 : 21;
}

function showEventList() {
  currentEventId = null;
  els.eventListScreen.classList.remove("hidden");
  els.eventForm.classList.add("hidden");
  els.eventDetailScreen.classList.add("hidden");
  clearEventForm();
  renderEvents();
}

function showEventForm(event = null) {
  els.eventListScreen.classList.add("hidden");
  els.eventDetailScreen.classList.add("hidden");
  els.eventForm.classList.remove("hidden");
  els.eventFormTitle.textContent = event ? "编辑活动" : "创建活动";
  if (event) {
    fillEventForm(event);
  } else {
    clearEventForm();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showEventDetail(id) {
  currentEventId = id;
  els.eventListScreen.classList.add("hidden");
  els.eventForm.classList.add("hidden");
  els.eventDetailScreen.classList.remove("hidden");
  renderEventDetail();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderEvents() {
  els.eventsList.innerHTML = "";
  if (!state.events.length) {
    els.eventsList.innerHTML = '<div class="empty">还没有活动，先点右上角 + 创建一个。</div>';
    return;
  }

  const sorted = [...state.events].sort((a, b) => new Date(eventStartTime(a)) - new Date(eventStartTime(b)));
  for (const event of sorted) {
    ensureEventStarted(event);
    const node = els.template.content.firstElementChild.cloneNode(true);
    const status = eventStatus(event);
    node.querySelector("h2").textContent = event.name;
    node.querySelector(".meta").textContent = `${eventTimeLabel(event)} · ${event.location} · ${scoreModeLabel(event)}`;
    node.querySelector(".status-pill").textContent = statusText(status);
    node.addEventListener("click", () => showEventDetail(event.id));
    els.eventsList.append(node);
  }
}

function renderEventDetail() {
  if (!currentEventId || els.eventDetailScreen.classList.contains("hidden")) return;
  const event = state.events.find((item) => item.id === currentEventId);
  if (!event) {
    showEventList();
    return;
  }
  ensureEventStarted(event);
  const status = eventStatus(event);
  els.detailTitle.textContent = event.name;
  els.detailMeta.textContent = `${eventTimeLabel(event)} · ${event.location} · ${scoreModeLabel(event)}`;
  els.detailStatus.textContent = statusText(status);

  els.detailActions.innerHTML = "";
  els.detailActions.classList.toggle("hidden", !isAdmin);
  if (isAdmin) {
    els.detailActions.append(
      actionButton("编辑活动", () => showEventForm(event), status !== "draft"),
      actionButton("删除活动", () => deleteEvent(event.id), false, "danger-btn"),
    );
  }

  els.eventDetailBody.innerHTML = "";
  const startActions = el("div", "inline-actions");
  startActions.append(actionButton("开始活动", () => startEvent(event), status === "locked" || event.players.length !== 4 || Boolean(event.startedAt)));
  els.eventDetailBody.append(startActions, renderPlayers(event), renderMatches(event), renderEventRanking(event));
}

function renderPlayers(event) {
  const section = el("section", "subsection");
  const head = el("div", "subsection-head");
  head.append(el("h3", "", `球员 ${event.players.length}/${event.size}`));
  section.append(head);

  const list = el("div", "list");
  if (!event.players.length && !canEditPlayers(event)) {
    list.append(el("div", "empty", "暂无报名"));
  }
  for (const player of event.players) {
    const row = el("div", "list-row");
    const info = el("div", "player-info");
    info.append(createAvatar(player.id), el("strong", "", player.id), el("span", "gender", player.gender));
    row.append(info);
    if (canEditPlayers(event)) {
      row.append(actionButton("删除", () => removePlayer(event.id, player.id), false, "ghost-btn"));
    }
    list.append(row);
  }
  if (canEditPlayers(event) && event.players.length < event.size) {
    list.append(renderAddPlayerSlot(event.id));
  }
  section.append(list);
  return section;
}

function renderAddPlayerSlot(eventId) {
  const slot = el("div", "empty-player-card");
  const joinButton = actionButton("加入", () => showInlinePlayerForm(slot, eventId), false, "join-player-btn");
  slot.append(joinButton);
  return slot;
}

function showInlinePlayerForm(slot, eventId) {
  slot.innerHTML = "";
  const form = el("form", "inline-player-form");
  form.innerHTML = `
    <label>球员姓名<input required name="name" maxlength="24" placeholder="输入姓名"></label>
    <label>性别<select name="gender"><option value="男" selected>男</option><option value="女">女</option></select></label>
    <div class="inline-player-actions">
      <button type="submit">保存</button>
      <button class="ghost-btn" type="button">取消</button>
    </div>
  `;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    addPlayer(eventId, String(data.get("name")).trim(), String(data.get("gender")));
  });
  form.querySelector(".ghost-btn").addEventListener("click", () => {
    slot.replaceWith(renderAddPlayerSlot(eventId));
  });
  slot.append(form);
  form.querySelector("input").focus();
}

function renderMatches(event) {
  const section = el("section", "subsection");
  section.append(el("h3", "", "场次"));
  if (!event.startedAt) {
    section.append(el("div", "empty", "活动开始后自动生成三场比赛。"));
    return section;
  }

  const names = new Map(event.players.map((player) => [player.id, player.id]));
  for (const match of event.matches || []) {
    const card = el("div", "match-card");
    const teamA = match.teamA.map((id) => names.get(id)).join(" / ");
    const teamB = match.teamB.map((id) => names.get(id)).join(" / ");
    card.innerHTML = `
      <div class="match-title"><span>${match.label}</span><span>${teamA} vs ${teamB}</span></div>
      <div class="score-inputs">
        <label>${teamA}<input inputmode="numeric" min="0" type="number" value="${match.scoreA}"></label>
        <strong>:</strong>
        <label>${teamB}<input inputmode="numeric" min="0" type="number" value="${match.scoreB}"></label>
        <button type="button">保存</button>
      </div>
    `;
    const [scoreA, scoreB] = card.querySelectorAll("input");
    const button = card.querySelector("button");
    scoreA.disabled = scoreB.disabled = button.disabled = !canEditScores(event);
    button.addEventListener("click", () => {
      match.scoreA = scoreA.value === "" ? "" : Number(scoreA.value);
      match.scoreB = scoreB.value === "" ? "" : Number(scoreB.value);
      persist();
      render();
    });
    section.append(card);
  }
  if (canEditScores(event)) {
    const actions = el("div", "inline-actions");
    actions.append(actionButton("保存全部比分", () => saveAllScores(event, section), false, "muted-btn"));
    section.append(actions);
  }
  return section;
}

function saveAllScores(event, section) {
  const cards = [...section.querySelectorAll(".match-card")];
  cards.forEach((card, index) => {
    const [scoreA, scoreB] = card.querySelectorAll("input");
    event.matches[index].scoreA = scoreA.value === "" ? "" : Number(scoreA.value);
    event.matches[index].scoreB = scoreB.value === "" ? "" : Number(scoreB.value);
  });
  persist();
  render();
}

function renderEventRanking(event) {
  const section = el("section", "subsection");
  section.append(el("h3", "", "活动排行"));
  if (!event.startedAt) {
    section.append(el("div", "empty", "活动开始后显示排行。"));
    return section;
  }
  for (const row of buildEventRanking(event)) {
    const item = el("div", "rank-row");
    const info = el("div", "player-info");
    info.append(createAvatar(row.id), el("span", "", `${row.id} · 胜 ${row.wins} · 净胜 ${row.net} · 得分 ${row.scored}`));
    item.append(
      el("span", "badge", `#${row.rank}`),
      info,
      el("strong", "", `${row.totalPoints} 分`),
    );
    section.append(item);
  }
  return section;
}

function renderGlobalLeaderboard() {
  els.globalLeaderboard.innerHTML = "";
  const rows = buildGlobalLeaderboard(els.globalSort.value);
  if (!rows.length) {
    els.globalLeaderboard.innerHTML = '<div class="empty">还没有已开始的活动。</div>';
    return;
  }
  rows.forEach((row, index) => {
    const item = el("div", "rank-row");
    const info = el("div", "player-info");
    info.append(createAvatar(row.id), el("span", "", `${row.id} · ${row.events} 次 · 总得分 ${row.scored}`));
    item.append(
      el("span", "badge", `#${index + 1}`),
      info,
      el("strong", "", `${row.points} 分`),
    );
    els.globalLeaderboard.append(item);
  });
}

function fillEventForm(event) {
  els.eventId.value = event.id;
  els.eventName.value = event.name;
  els.eventSize.value = event.size;
  els.eventStartTime.value = toLocalInputValue(eventStartTime(event));
  els.eventEndTime.value = toLocalInputValue(eventEndTime(event));
  els.eventLocation.value = event.location;
  els.eventFormat.value = event.format;
  els.scoreMode.value = event.scoreMode;
  els.scoreTarget.value = event.scoreTarget;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearEventForm() {
  els.eventForm.reset();
  els.eventId.value = "";
  els.scoreTarget.value = 21;
}

function saveEventFromForm() {
  const id = els.eventId.value;
  const existing = state.events.find((event) => event.id === id);
  const startTime = new Date(els.eventStartTime.value);
  const endTime = new Date(els.eventEndTime.value);
  if (endTime <= startTime) {
    alert("结束时间需要晚于开始时间。");
    return;
  }
  const payload = {
    id: id || uid("event"),
    name: els.eventName.value.trim(),
    size: Number(els.eventSize.value),
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    time: startTime.toISOString(),
    location: els.eventLocation.value.trim(),
    format: els.eventFormat.value,
    scoreMode: els.scoreMode.value,
    scoreTarget: Number(els.scoreTarget.value),
    players: existing?.players || [],
    matches: existing?.matches || [],
    createdAt: existing?.createdAt || new Date().toISOString(),
    startedAt: existing?.startedAt || null,
  };
  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.events.push(payload);
  }
  persist();
  clearEventForm();
  showEventDetail(payload.id);
  render();
}

function deleteEvent(id) {
  if (!confirm("确定删除这个活动吗？")) return;
  const index = state.events.findIndex((event) => event.id === id);
  if (index >= 0) state.events.splice(index, 1);
  persist();
  if (currentEventId === id) {
    showEventList();
  }
  render();
}

function addPlayer(eventId, id, gender) {
  const event = state.events.find((item) => item.id === eventId);
  if (!event || !id) return;
  if (event.players.some((player) => player.id === id)) {
    alert("这个球员姓名已经报名。");
    return;
  }
  if (event.players.length >= event.size) {
    alert("人数已满。");
    return;
  }
  event.players.push({ id, gender });
  persist();
  render();
}

function removePlayer(eventId, playerId) {
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return;
  if (!confirm(`确定删除球员「${playerId}」吗？`)) return;
  event.players = event.players.filter((player) => player.id !== playerId);
  persist();
  render();
}

function actionButton(text, handler, disabled = false, className = "") {
  const button = el("button", className, text);
  button.type = "button";
  button.disabled = disabled;
  button.addEventListener("click", handler);
  return button;
}

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toLocalInputValue(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

els.adminToggle.addEventListener("click", () => {
  if (isAdmin) {
    logoutAdmin();
    render();
  } else {
    els.adminPanel.classList.toggle("hidden");
  }
});
els.adminLogin.addEventListener("click", () => {
  if (isAdmin) {
    logoutAdmin();
  } else if (els.adminPassword.value === ADMIN_PASSWORD) {
    isAdmin = true;
    localStorage.setItem(ADMIN_KEY, "true");
    els.adminPassword.value = "";
    els.adminPanel.classList.add("hidden");
  } else {
    alert("管理员密码不正确。");
  }
  render();
});

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((item) => item.classList.toggle("active", item === tab));
    Object.entries(els.views).forEach(([key, view]) => view.classList.toggle("hidden", key !== tab.dataset.view));
    if (tab.dataset.view === "events") showEventList();
    renderGlobalLeaderboard();
  });
});

els.eventForm.addEventListener("submit", (e) => {
  e.preventDefault();
  saveEventFromForm();
});
els.newEventButton.addEventListener("click", () => showEventForm());
els.backToEventsFromForm.addEventListener("click", showEventList);
els.backToEventsFromDetail.addEventListener("click", showEventList);
els.resetEventForm.addEventListener("click", clearEventForm);
els.scoreMode.addEventListener("change", applyScoreModeDefault);
els.globalSort.addEventListener("change", renderGlobalLeaderboard);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

render();

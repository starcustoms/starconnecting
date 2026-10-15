if (location.protocol !== "file:") {
const listElement = document.querySelector("#server-list");
const searchInput = document.querySelector("#search");
const typeFilter = document.querySelector("#type-filter");
const sortFilter = document.querySelector("#sort-filter");
const submitDialog = document.querySelector("#submit-dialog");
const detailDialog = document.querySelector("#detail-dialog");
let servers = [];
let toastTimer;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function formatMembers(value) {
  const number = Number(value) || 0;
  return number >= 1000 ? `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}k` : String(number);
}

function formatDate(value) {
  if (!value) return "Not yet bumped";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not yet bumped" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function renderServers() {
  const query = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;
  const sort = sortFilter.value;
  const filtered = servers.filter((server) => {
    const searchable = `${server.name} ${server.type} ${server.description} ${server.language} ${(server.tags || []).join(" ")}`.toLowerCase();
    return (!query || searchable.includes(query)) && (type === "all" || server.type === type);
  });
  filtered.sort((a, b) => sort === "members" ? b.members - a.members : sort === "name" ? a.name.localeCompare(b.name) : Date.parse(b.lastBump || 0) - Date.parse(a.lastBump || 0));
  document.querySelector("#server-count").textContent = String(servers.length).padStart(2, "0");
  document.querySelector("#result-count").textContent = `${filtered.length} ${filtered.length === 1 ? "COMMUNITY" : "COMMUNITIES"}`;
  document.querySelector("#empty-state").hidden = filtered.length > 0;
  listElement.innerHTML = filtered.map((server, index) => `
    <article class="server-card" data-server-id="${escapeHtml(server.id)}" style="animation-delay:${Math.min(index * 45, 250)}ms" tabindex="0" aria-label="View ${escapeHtml(server.name)}">
      <div class="server-avatar" aria-hidden="true">${escapeHtml(initials(server.name))}</div>
      <div class="server-main"><div class="server-name-line"><span class="server-name">${escapeHtml(server.name)}</span>${server.verified ? '<span class="verified" title="Verified listing" aria-label="Verified listing">✓</span>' : ""}</div>
        <p class="server-description">${escapeHtml(server.description)}</p><div class="server-tags">${[server.type, ...(server.tags || []).slice(0, 1)].map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div></div>
      <div class="server-members"><span class="member-count">${formatMembers(server.members)}</span><span class="member-label">MEMBERS</span></div><div class="server-action"><button class="view-button" type="button">View ↗</button></div>
    </article>`).join("");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3200);
}

function openDetails(id) {
  const server = servers.find((entry) => entry.id === id);
  if (!server) return;
  const invite = typeof server.invite === "string" && /^https:\/\//i.test(server.invite) ? server.invite : "";
  document.querySelector("#detail-content").innerHTML = `
    <p class="eyebrow">COMMUNITY LISTING</p><div class="detail-avatar" aria-hidden="true">${escapeHtml(initials(server.name))}</div>
    <h2 class="detail-title">${escapeHtml(server.name)}${server.verified ? ' <span class="verified" title="Verified listing">✓</span>' : ""}</h2><p class="detail-desc">${escapeHtml(server.description)}</p>
    <div class="detail-facts"><div class="detail-fact"><span>CATEGORY</span><strong>${escapeHtml(server.type)}</strong></div><div class="detail-fact"><span>LANGUAGE</span><strong>${escapeHtml(server.language || "English")}</strong></div><div class="detail-fact"><span>COMMUNITY</span><strong>${formatMembers(server.members)} members</strong></div><div class="detail-fact"><span>LAST BUMP</span><strong>${formatDate(server.lastBump)}</strong></div></div>
    <div class="copy-id"><span>LISTING ID · ${escapeHtml(server.id)}</span><button type="button" data-copy-id="${escapeHtml(server.id)}">COPY</button></div>
    <div class="detail-actions"><a class="button button-light ${invite ? "" : "disabled-link"}" ${invite ? `href="${escapeHtml(invite)}" target="_blank" rel="noopener noreferrer"` : 'aria-disabled="true"'}>${invite ? "Join Discord ↗" : "No invite available"}</a><button class="button button-quiet" type="button" data-detail-close>Close</button></div>`;
  detailDialog.showModal();
}

async function loadServers() {
  try {
    const response = await fetch("/api/servers");
    if (!response.ok) throw new Error("Could not load directory.");
    const data = await response.json();
    servers = Array.isArray(data.servers) ? data.servers : [];
    renderServers();
  } catch {
    document.querySelector("#result-count").textContent = "DIRECTORY UNAVAILABLE";
    document.querySelector("#empty-state").hidden = false;
    document.querySelector("#empty-state h3").textContent = "Could not load communities";
    document.querySelector("#empty-state p").textContent = "Check that the directory service is running.";
  }
}

document.querySelectorAll("[data-open-submit]").forEach((button) => button.addEventListener("click", () => submitDialog.showModal()));
document.querySelector("[data-close-dialog]").addEventListener("click", () => submitDialog.close());
document.querySelector("[data-close-detail]").addEventListener("click", () => detailDialog.close());
listElement.addEventListener("click", (event) => {
  const card = event.target.closest("[data-server-id]");
  if (card) openDetails(card.dataset.serverId);
});
listElement.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-server-id]")) {
    event.preventDefault();
    openDetails(event.target.dataset.serverId);
  }
});
detailDialog.addEventListener("click", async (event) => {
  if (event.target.closest("[data-detail-close]")) detailDialog.close();
  const copyButton = event.target.closest("[data-copy-id]");
  if (copyButton) {
    try { await navigator.clipboard.writeText(copyButton.dataset.copyId); showToast("Listing ID copied."); }
    catch { showToast(`Listing ID: ${copyButton.dataset.copyId}`); }
  }
});
searchInput.addEventListener("input", renderServers);
typeFilter.addEventListener("change", renderServers);
sortFilter.addEventListener("change", renderServers);
document.querySelector("#clear-filters").addEventListener("click", () => { searchInput.value = ""; typeFilter.value = "all"; renderServers(); });
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInput.focus(); }
  if (event.key === "Escape") { submitDialog.close(); detailDialog.close(); }
});

document.querySelector("#listing-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.querySelector("#form-error");
  error.textContent = "";
  const listing = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch("/api/servers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(listing) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not submit listing.");
    servers = data.servers;
    form.reset();
    form.elements.language.value = "English";
    submitDialog.close();
    renderServers();
    openDetails(data.listing.id);
    showToast("Listing added to the directory.");
  } catch (cause) {
    error.textContent = cause.message || "Directory service is unavailable.";
  }
});

loadServers();
}
(() => {
  "use strict";

  const config = window.STARCONNECTING_CONFIG || {};
  const API_URL = String(config.API_URL || window.STARCONNECTING_API_URL || "").replace(/\/+$/, "");
  const API_ENDPOINT = API_URL ? `${API_URL}/api/servers` : "";

  const $ = (selector, root = document) => root.querySelector(selector);
  const listElement = $("#server-list");
  const searchInput = $("#search");
  const typeFilter = $("#type-filter");
  const sortFilter = $("#sort-filter");
  const resultCount = $("#result-count");
  const serverCount = $("#server-count");
  const emptyState = $("#empty-state");
  const submitDialog = $("#submit-dialog");
  const detailDialog = $("#detail-dialog");
  const listingForm = $("#listing-form");
  const submitButton = $("#submit-button");
  const formError = $("#form-error");
  const toast = $("#toast");
  let servers = [];
  let toastTimer = null;
  let submitting = false;

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  function showToast(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = isError ? "#321e1d" : "#e8f7d7";
    toast.style.color = isError ? "#ffb6ad" : "#171715";
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 3600);
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = !message;
  }

  function normalizeServer(item) {
    return {
      id: String(item.id || ""),
      name: String(item.name || "Unnamed server"),
      type: String(item.type || "other").toLowerCase(),
      description: String(item.description || ""),
      invite: String(item.invite || ""),
      language: String(item.language || "English"),
      discordGuildId: String(item.discordGuildId || ""),
      createdAt: String(item.createdAt || ""),
      memberCount: item.memberCount == null ? "" : String(item.memberCount),
      iconUrl: String(item.iconUrl || "")
    };
  }

  function getTypeLabel(type) {
    const labels = { roleplay: "Roleplay", realism: "Realism", community: "Community", training: "Training", other: "Other" };
    return labels[type] || (type ? type[0].toUpperCase() + type.slice(1) : "Other");
  }

  function safeInvite(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return "";
      if (url.hostname !== "discord.gg" && url.hostname !== "www.discord.gg" &&
          url.hostname !== "discord.com" && url.hostname !== "www.discord.com") return "";
      if (url.hostname.includes("discord.com") && !url.pathname.startsWith("/invite/")) return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function filteredServers() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedType = typeFilter.value;
    let result = servers.filter((server) => {
      const matchesType = selectedType === "all" || server.type === selectedType;
      const haystack = `${server.name} ${server.description} ${server.type} ${server.language}`.toLowerCase();
      return matchesType && (!query || haystack.includes(query));
    });
    if (sortFilter.value === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      result.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    }
    return result;
  }

  function serverCard(server, index) {
    const initial = escapeHTML((server.name.trim()[0] || "S").toUpperCase());
    const avatar = server.iconUrl
      ? `<img src="${escapeHTML(server.iconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : initial;
    const member = server.memberCount
      ? `<div class="member-count">${escapeHTML(server.memberCount)}<span class="member-label">MEMBERS</span></div>`
      : "";
    return `<article class="server-card" style="animation-delay:${Math.min(index * 35, 280)}ms">
      <div class="server-avatar">${avatar}</div>
      <div class="server-main">
        <div class="server-name-line"><h3 class="server-name">${escapeHTML(server.name)}</h3></div>
        <p class="server-description">${escapeHTML(server.description)}</p>
        <div class="server-tags"><span class="tag">${escapeHTML(getTypeLabel(server.type))}</span><span class="tag">${escapeHTML(server.language || "English")}</span></div>
      </div>
      <div class="server-members">${member}<button class="view-button" type="button" data-view-server="${escapeHTML(server.id)}">View server ↗</button></div>
    </article>`;
  }

  function renderServers() {
    const filtered = filteredServers();
    serverCount.textContent = String(servers.length);
    resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "community" : "communities"} found`;
    listElement.innerHTML = filtered.map(serverCard).join("");
    emptyState.hidden = filtered.length !== 0;
    listElement.hidden = filtered.length === 0;
  }

  async function loadServers({ quiet = false } = {}) {
    if (!API_ENDPOINT) {
      listElement.innerHTML = `<div class="loading-state">API URL is not configured. Check <code>config.js</code>.</div>`;
      resultCount.textContent = "API not configured";
      serverCount.textContent = "—";
      return false;
    }
    if (!quiet) {
      listElement.hidden = false;
      listElement.innerHTML = `<div class="loading-state"><span class="spinner"></span> Loading the directory…</div>`;
    }
    try {
      const response = await fetch(API_ENDPOINT, {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `API returned HTTP ${response.status}`);
      const rows = Array.isArray(data) ? data : (data.servers || data.data || data.results);
      if (!Array.isArray(rows)) throw new Error("The API response did not contain a servers list.");
      servers = rows.map(normalizeServer);
      renderServers();
      return true;
    } catch (error) {
      if (!quiet) {
        listElement.hidden = false;
        listElement.innerHTML = `<div class="loading-state">Couldn't load servers. ${escapeHTML(error.message || "Check the API URL and database setup.")}</div>`;
        resultCount.textContent = "Directory unavailable";
        serverCount.textContent = "—";
      }
      return false;
    }
  }

  function openSubmitDialog() {
    showFormError("");
    if (typeof submitDialog.showModal === "function") submitDialog.showModal();
    else submitDialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function openDetails(id) {
    const server = servers.find((item) => item.id === id);
    if (!server) return;
    const initial = escapeHTML((server.name.trim()[0] || "S").toUpperCase());
    const avatar = server.iconUrl
      ? `<img src="${escapeHTML(server.iconUrl)}" alt="">`
      : initial;
    const invite = safeInvite(server.invite);
    const created = server.createdAt && !Number.isNaN(Date.parse(server.createdAt))
      ? new Date(server.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : "Not provided";
    $("#detail-content").innerHTML = `
      <div class="detail-content-head"><div class="detail-avatar">${avatar}</div><div><p class="eyebrow">SERVER DETAILS</p><h2 class="detail-title">${escapeHTML(server.name)}</h2><span class="tag">${escapeHTML(getTypeLabel(server.type))}</span></div></div>
      <p class="detail-desc">${escapeHTML(server.description)}</p>
      <div class="detail-facts">
        <div class="detail-fact"><span>LANGUAGE</span><strong>${escapeHTML(server.language || "English")}</strong></div>
        <div class="detail-fact"><span>LISTED</span><strong>${escapeHTML(created)}</strong></div>
      </div>
      <div class="detail-actions">
        ${invite ? `<a class="button button-light" href="${escapeHTML(invite)}" target="_blank" rel="noopener noreferrer">Join Discord ↗</a>` : `<span class="form-hint">This listing has no valid invite URL.</span>`}
        ${server.discordGuildId ? `<button class="button button-quiet copy-id" type="button" data-copy-id="${escapeHTML(server.discordGuildId)}">Copy server ID</button>` : ""}
      </div>`;
    if (typeof detailDialog.showModal === "function") detailDialog.showModal();
    else detailDialog.setAttribute("open", "");
  }

  document.querySelectorAll("[data-open-submit]").forEach((button) => button.addEventListener("click", openSubmitDialog));
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => closeDialog(submitDialog)));
  document.querySelectorAll("[data-close-detail]").forEach((button) => button.addEventListener("click", () => closeDialog(detailDialog)));
  [submitDialog, detailDialog].forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog(dialog);
  }));

  searchInput.addEventListener("input", renderServers);
  typeFilter.addEventListener("change", renderServers);
  sortFilter.addEventListener("change", renderServers);
  $("#clear-filters").addEventListener("click", () => {
    searchInput.value = "";
    typeFilter.value = "all";
    sortFilter.value = "newest";
    renderServers();
  });
  listElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view-server]");
    if (button) openDetails(button.dataset.viewServer);
  });

  $("#detail-content").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy-id]");
    if (!button) return;
    try {
      await navigator.clipboard.writeText(button.dataset.copyId);
      showToast("Server ID copied.");
    } catch {
      showToast("Couldn't copy the ID. Please copy it manually.", true);
    }
  });

  listingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    showFormError("");

    if (!API_ENDPOINT) {
      showFormError("The API URL is missing. Please check config.js.");
      return;
    }

    const formData = new FormData(listingForm);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      type: String(formData.get("type") || "").trim().toLowerCase(),
      language: String(formData.get("language") || "English").trim(),
      description: String(formData.get("description") || "").trim(),
      invite: String(formData.get("invite") || "").trim(),
      discordGuildId: String(formData.get("discordGuildId") || "").trim()
    };

    if (payload.name.length < 2 || !payload.type || payload.description.length < 20) {
      showFormError("Please enter a server name, server type, and a description of at least 20 characters.");
      return;
    }
    if (!safeInvite(payload.invite)) {
      showFormError("Enter a valid Discord invite, such as https://discord.gg/yourinvite.");
      return;
    }
    if (payload.discordGuildId && !/^\d{15,25}$/.test(payload.discordGuildId)) {
      showFormError("The Discord server ID should contain 15–25 digits, or leave it blank.");
      return;
    }

    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Submission failed (HTTP ${response.status}).`);
      listingForm.reset();
      closeDialog(submitDialog);
      showToast("Listing submitted successfully.");
      const loaded = await loadServers({ quiet: true });
      if (!loaded) showToast("Submitted, but the directory could not refresh. Reload in a moment.", true);
    } catch (error) {
      showFormError(`${error.message || "Could not submit your listing."} Check the API deployment and database.`);
    } finally {
      submitting = false;
      submitButton.disabled = false;
      submitButton.innerHTML = 'Submit listing <span>↗</span>';
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      searchInput.focus();
    }
  });

  loadServers();
})();

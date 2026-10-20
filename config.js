/*
 * StarConnecting frontend configuration.
 * Replace API_URL with the exact URL shown on the Cloudflare Worker overview.
 * Do not include /api/servers at the end.
 */
window.STARCONNECTING_CONFIG = {
  API_URL: "https://starconnecting-api.zizo0419mc.workers.dev"
};
window.STARCONNECTING_API_URL = window.STARCONNECTING_CONFIG.API_URL;

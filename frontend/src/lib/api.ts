const configuredUrl = import.meta.env.VITE_API_URL?.trim();
if (import.meta.env.PROD && !configuredUrl) {
  throw new Error("VITE_API_URL must point to the deployed backend.");
}
if (configuredUrl && !/^https:\/\/[^/]+$/i.test(configuredUrl.replace(/\/$/, "")) && import.meta.env.PROD) {
  throw new Error("VITE_API_URL must be an HTTPS origin without a path.");
}
export const API_BASE_URL = (configuredUrl || "").replace(/\/$/, "");

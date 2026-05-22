import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9000";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// --- IP Addresses ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const d = (r: { data: any }) => r.data;

export const getIPs = () => api.get("/api/ips/").then(d);
export const createIP = (data: object) => api.post("/api/ips/", data).then(d);
export const updateIP = (id: number, data: object) => api.patch(`/api/ips/${id}`, data).then(d);
export const deleteIP = (id: number) => api.delete(`/api/ips/${id}`).then(d);
export const getIPRules = (id: number) => api.get(`/api/ips/${id}/rules`).then(d);
export const addIPRule = (id: number, data: object) => api.post(`/api/ips/${id}/rules`, data).then(d);
export const deleteIPRule = (ipId: number, ruleId: number) =>
  api.delete(`/api/ips/${ipId}/rules/${ruleId}`).then(d);

// --- Domain Rules ---
export const getDomains = () => api.get("/api/domains/").then(d);
export const getPresets = () => api.get("/api/domains/presets").then(d);
export const createDomain = (data: object) => api.post("/api/domains/", data).then(d);
export const createFromPreset = (domain: string) => api.post(`/api/domains/preset/${domain}`).then(d);
export const updateDomain = (id: number, data: object) => api.patch(`/api/domains/${id}`, data).then(d);
export const deleteDomain = (id: number) => api.delete(`/api/domains/${id}`).then(d);

// --- DKIM ---
export const getDKIMKeys = () => api.get("/api/dkim/").then(d);
export const generateDKIM = (data: object) => api.post("/api/dkim/generate", data).then(d);
export const deleteDKIM = (id: number) => api.delete(`/api/dkim/${id}`).then(d);

// --- Config ---
export const previewInitLua = () => api.get("/api/config/preview/init-lua").then(d);
export const previewShapingToml = () => api.get("/api/config/preview/shaping-toml").then(d);
export const exportConfig = () => api.get("/api/config/export").then(d);

// --- Stats ---
export const getOverview = () => api.get("/api/stats/overview").then(d);
export const getQueues = () => api.get("/api/stats/queues").then(d);

// --- Settings ---
export const getSettings = () => api.get("/api/settings/").then(d);
export const updateSettings = (data: object) => api.post("/api/settings/", data).then(d);

// --- Deploy ---
export const deployConfig = () => api.post("/api/deploy/config").then(d);
export const getDeployStatus = () => api.get("/api/deploy/status").then(d);

// --- Auto-deploy (silent background deploy after any config change) ---
export const autoDeploy = () => api.post("/api/deploy/config").then(d).catch(() => null);
export const testSmtp = () => api.post("/api/deploy/test-smtp").then(d);
export const clearQueue = () => api.post("/api/deploy/clear-queue").then(d);

// --- DB Info ---
export const getDatabaseInfo = () => api.get("/api/settings/database-info").then(d);

// --- Suppressions ---
export const getSuppressions = () => api.get("/api/suppressions").then(d);
export const addSuppression = (email: string, reason?: string) => api.post("/api/suppressions", { email, reason }).then(d);
export const deleteSuppression = (id: number) => api.delete(`/api/suppressions/${id}`).then(d);

// --- Logs ---
export const getKumoLogs = (lines = 100) => api.get(`/api/logs/kumomta?lines=${lines}`).then(d);
export const getBackendLogs = (lines = 100) => api.get(`/api/logs/backend?lines=${lines}`).then(d);
export const getFrontendLogs = (lines = 50) => api.get(`/api/logs/frontend?lines=${lines}`).then(d);
export const getEmailLogs = (lines = 200) => api.get(`/api/logs/email?lines=${lines}`).then(d);
export const getEmailLogsRealtime = (limit = 200) => api.get(`/api/logs/email/realtime?limit=${limit}`).then(d);

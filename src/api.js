/**
 * EHS DNA — API client.
 * Token persists in localStorage; applyServerConfig() mutates the shared
 * BRAND/SITES/DEPARTMENTS objects in place so every screen that statically
 * imports them picks up DB-backed values after login.
 */
import { BRAND, SITES, DEPARTMENTS } from "./constants.js";

const TOKEN_KEY = "ehs_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

async function req(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) { setToken(null); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

export function applyServerConfig(cfg) {
  BRAND.company  = cfg.company  ?? BRAND.company;
  BRAND.short    = cfg.shortName ?? BRAND.short;
  BRAND.industry = cfg.industry ?? BRAND.industry;
  BRAND.tagline  = cfg.tagline  ?? BRAND.tagline;
  BRAND.triage   = cfg.triage   ?? BRAND.triage;
  if (Array.isArray(cfg.sites) && cfg.sites.length) {
    SITES.length = 0; cfg.sites.forEach(s => SITES.push(s.name));
    BRAND.siteRecords = cfg.sites;                 // [{id,name,location}]
  }
  if (Array.isArray(cfg.departments) && cfg.departments.length) {
    DEPARTMENTS.length = 0; cfg.departments.forEach(d => DEPARTMENTS.push(d.name));
    BRAND.departmentRecords = cfg.departments;
  }
}

export const api = {
  // auth
  login: async (email, password) => {
    const out = await req("/auth/login", { method: "POST", body: { email, password } });
    setToken(out.token);
    return out.user;
  },
  logout: () => setToken(null),
  changePassword: (current, next) => req("/auth/change-password", { method: "POST", body: { current, next } }),

  // config
  fetchConfig: async () => { const cfg = await req("/config"); applyServerConfig(cfg); return cfg; },
  updateConfig: (patch) => req("/config", { method: "PUT", body: patch }),

  // org
  listUsers: () => req("/users"),
  createUser: (u) => req("/users", { method: "POST", body: u }),
  updateUser: (id, patch) => req(`/users/${id}`, { method: "PUT", body: patch }),
  createSite: (s) => req("/sites", { method: "POST", body: s }),
  updateSite: (id, patch) => req(`/sites/${id}`, { method: "PUT", body: patch }),
  createDepartment: (d) => req("/departments", { method: "POST", body: d }),
  updateDepartment: (id, patch) => req(`/departments/${id}`, { method: "PUT", body: patch }),

  // incidents & CAs
  listIncidents: () => req("/incidents"),
  createIncident: (i) => req("/incidents", { method: "POST", body: i }),
  updateIncident: (id, patch) => req(`/incidents/${id}`, { method: "PUT", body: patch }),
  listCAs: () => req("/cas"),
  createCA: (c) => req("/cas", { method: "POST", body: c }),
  updateCA: (id, patch) => req(`/cas/${id}`, { method: "PUT", body: patch }),

  // inspections & findings
  listChecklists: () => req("/checklists"),
  createChecklist: (c) => req("/checklists", { method: "POST", body: c }),
  listInspections: () => req("/inspections"),
  createInspection: (i) => req("/inspections", { method: "POST", body: i }),
  updateInspection: (id, patch) => req(`/inspections/${id}`, { method: "PUT", body: patch }),
  listFindings: () => req("/findings"),
  createFinding: (f) => req("/findings", { method: "POST", body: f }),
  updateFinding: (id, patch) => req(`/findings/${id}`, { method: "PUT", body: patch }),

  // trainings
  listTrainings: () => req("/trainings"),
  createTraining: (t) => req("/trainings", { method: "POST", body: t }),
  listCompletions: () => req("/completions"),
  logCompletion: (c) => req("/completions", { method: "POST", body: c }),

  // triage
  listTriage: () => req("/triage"),
  createTriage: (t) => req("/triage", { method: "POST", body: t }),
};

// ─────────────────────────────────────────────────────────────────────────────
// security.js — Camada de segurança interna
// Proteções: rate limit, sanitização, detecção de tentativas suspeitas,
// bloqueio de XSS, session timeout, e log de atividade
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "./firebase.js";
import { signOut } from "firebase/auth";

// ── 1. RATE LIMIT de login (máx 5 tentativas em 15 min) ──────────────────────
const RATE_KEY = "sec:loginAttempts";
const RATE_WIN = 15 * 60 * 1000; // 15 minutos
const MAX_TRIES = 5;

export function registrarTentativa() {
  const raw  = localStorage.getItem(RATE_KEY);
  const data = raw ? JSON.parse(raw) : { count: 0, since: Date.now() };
  const agora = Date.now();

  // Reseta a janela se passou 15 min
  if (agora - data.since > RATE_WIN) {
    localStorage.setItem(RATE_KEY, JSON.stringify({ count: 1, since: agora }));
    return { bloqueado: false, restante: 0 };
  }

  data.count++;
  localStorage.setItem(RATE_KEY, JSON.stringify(data));

  if (data.count >= MAX_TRIES) {
    const restante = Math.ceil((RATE_WIN - (agora - data.since)) / 60000);
    return { bloqueado: true, restante };
  }
  return { bloqueado: false, restante: 0, tentativas: data.count };
}

export function verificarBloqueio() {
  const raw = localStorage.getItem(RATE_KEY);
  if (!raw) return { bloqueado: false };
  const data = JSON.parse(raw);
  const agora = Date.now();
  if (agora - data.since > RATE_WIN) return { bloqueado: false };
  if (data.count >= MAX_TRIES) {
    const restante = Math.ceil((RATE_WIN - (agora - data.since)) / 60000);
    return { bloqueado: true, restante };
  }
  return { bloqueado: false };
}

export function resetarTentativas() {
  localStorage.removeItem(RATE_KEY);
}

// ── 2. SANITIZAÇÃO de inputs (previne XSS) ───────────────────────────────────
export function sanitizar(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();
}

// Remove scripts e html tags de qualquer string
export function limparInput(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim()
    .slice(0, 2000); // limite de tamanho
}

// ── 3. SESSION TIMEOUT (30 min inativo → logout automático) ──────────────────
const TIMEOUT_MS  = 30 * 60 * 1000; // 30 min
const LAST_ACT_KEY = "sec:lastActivity";
let timeoutTimer = null;

function atualizarAtividade() {
  localStorage.setItem(LAST_ACT_KEY, String(Date.now()));
  if (timeoutTimer) clearTimeout(timeoutTimer);
  timeoutTimer = setTimeout(async () => {
    const user = auth.currentUser;
    if (user) {
      console.warn("[Security] Sessão expirada por inatividade");
      await signOut(auth);
      window.location.reload();
    }
  }, TIMEOUT_MS);
}

export function iniciarSessionGuard() {
  // Verifica se já estava inativo antes de reabrir
  const last = Number(localStorage.getItem(LAST_ACT_KEY) || 0);
  if (last > 0 && Date.now() - last > TIMEOUT_MS) {
    const user = auth.currentUser;
    if (user) {
      signOut(auth).then(() => window.location.reload());
      return;
    }
  }

  // Monitora atividade do usuário
  const eventos = ["mousemove", "keydown", "click", "touchstart", "scroll"];
  eventos.forEach(ev => window.addEventListener(ev, atualizarAtividade, { passive: true }));
  atualizarAtividade();

  return () => {
    eventos.forEach(ev => window.removeEventListener(ev, atualizarAtividade));
    if (timeoutTimer) clearTimeout(timeoutTimer);
  };
}

// ── 4. DETECÇÃO de DevTools aberto (alerta discreto) ─────────────────────────
export function monitorarDevTools() {
  let devtools = false;
  const threshold = 160;
  const check = () => {
    if (
      window.outerWidth - window.innerWidth > threshold ||
      window.outerHeight - window.innerHeight > threshold
    ) {
      if (!devtools) {
        devtools = true;
        // Apenas loga — não bloqueia (seria agressivo demais)
        console.warn("[Security] DevTools detectado");
      }
    } else {
      devtools = false;
    }
  };
  window.addEventListener("resize", check);
  return () => window.removeEventListener("resize", check);
}

// ── 5. PROTEÇÃO de dados sensíveis no localStorage ───────────────────────────
// Ofusca a API key da IA antes de salvar (não é criptografia forte,
// mas evita exposição direta em texto plano)
export function ofuscar(str) {
  if (!str) return "";
  return btoa(str.split("").reverse().join("")).replace(/=/g, "");
}

export function desofuscar(str) {
  if (!str) return "";
  try {
    // Adiciona padding se necessário
    const pad = str.length % 4 === 0 ? str : str + "=".repeat(4 - (str.length % 4));
    return atob(pad).split("").reverse().join("");
  } catch { return ""; }
}

// ── 6. VALIDAÇÃO de dados antes de salvar no Firestore ───────────────────────
export function validarDado(key, value) {
  // Rejeita valores muito grandes (>1MB)
  const json = JSON.stringify(value);
  if (json.length > 1_000_000) {
    console.error(`[Security] Dado muito grande para a chave: ${key}`);
    return false;
  }
  // Rejeita se contém scripts
  if (json.includes("<script") || json.includes("javascript:")) {
    console.error(`[Security] Conteúdo suspeito detectado na chave: ${key}`);
    return false;
  }
  return true;
}

// ── 7. HEADERS de segurança (via meta tags no HTML) ───────────────────────────
export function injetarMetaSeguranca() {
  const metas = [
    { httpEquiv: "X-Content-Type-Options", content: "nosniff" },
    { httpEquiv: "X-Frame-Options",        content: "DENY" },
    { httpEquiv: "Referrer-Policy",        content: "strict-origin-when-cross-origin" },
  ];
  metas.forEach(({ httpEquiv, content }) => {
    if (!document.querySelector(`meta[http-equiv="${httpEquiv}"]`)) {
      const m = document.createElement("meta");
      m.setAttribute("http-equiv", httpEquiv);
      m.setAttribute("content", content);
      document.head.appendChild(m);
    }
  });
}

// ── 8. LOG de eventos de segurança (apenas em memória, não persiste) ──────────
const secLog = [];
export function logSeguranca(evento, detalhe = "") {
  const entry = { ts: new Date().toISOString(), evento, detalhe };
  secLog.push(entry);
  if (secLog.length > 50) secLog.shift(); // mantém só os últimos 50
}
export function getSecLog() { return [...secLog]; }

// ── 9. INICIALIZAÇÃO completa ────────────────────────────────────────────────
export function inicializarSeguranca() {
  injetarMetaSeguranca();
  monitorarDevTools();
  logSeguranca("app_init", window.location.hostname);
  return iniciarSessionGuard();
}

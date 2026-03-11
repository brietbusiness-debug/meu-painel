// ─────────────────────────────────────────────────────────────────────────────
// useCloudStorage.js — Sincronização em tempo real via onSnapshot
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { db, auth } from "./firebase.js";
import {
  doc, setDoc, onSnapshot,
  collection, getDocs
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export const ALL_KEYS = [
  "fin:transactions", "fin:dividas", "fin:investimentos",
  "fin:assinaturas", "fin:mensal-extras",
  "tasks:list", "tasks:rotina",
  "habits:list", "habits:checks",
  "goals:list",
  "treino:log", "treino:exercicios", "treino:dieta",
  "treino:medidas", "treino:metas", "treino:meta-cal", "treino:meta-prot",
  "treino:split", "treino:grupos",
  "treino:split2", "treino:pesos", "treino:metaPeso", "treino:altura",
  "ia:apikey",
  "livros:list", "livros:cats", "livros:highlights",
  "agenda:events",
];

const toDocId   = (key) => key.replace(/:/g, "_");
const fromDocId = (id)  => id.replace(/_/g, ":");

// ── Hook principal com tempo real ─────────────────────────────────────────────
export function useCloudStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : initial;
    } catch { return initial; }
  });

  const debounce = useRef(null);
  const isSaving = useRef(false);
  const unsubSnap = useRef(null);

  useEffect(() => {
    // Escuta evento storage disparado por restoreBackup para forçar re-render
    const handleStorage = () => {
      try {
        const s = localStorage.getItem(key);
        if (s) {
          const parsed = JSON.parse(s);
          setVal(parsed);
        }
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]);

  useEffect(() => {
    let unsubAuth = null;

    // Aguarda o usuário estar autenticado antes de ouvir o Firestore
    unsubAuth = onAuthStateChanged(auth, (user) => {
      // Para listener anterior se existir
      if (unsubSnap.current) {
        unsubSnap.current();
        unsubSnap.current = null;
      }

      if (!user) return; // não logado, nada a fazer

      const ref = doc(db, "users", user.uid, "data", toDocId(key));

      // Inicia listener em tempo real
      unsubSnap.current = onSnapshot(ref, (snap) => {
        if (isSaving.current) return; // ignora echo da própria escrita
        if (snap.exists()) {
          const v = snap.data().value;
          // Só atualiza se o valor realmente mudou (evita re-renders desnecessários)
          const current = localStorage.getItem(key);
          const incoming = JSON.stringify(v);
          if (current !== incoming) {
            setVal(v);
            localStorage.setItem(key, incoming);
          }
        }
      }, (err) => {
        console.warn("onSnapshot erro:", key, err.code);
      });
    });

    return () => {
      if (unsubAuth) unsubAuth();
      if (unsubSnap.current) unsubSnap.current();
    };
  }, [key]);

  // ── Salvar ────────────────────────────────────────────────────────────────
  const save = (v) => {
    setVal(v);
    localStorage.setItem(key, JSON.stringify(v));

    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const user = auth.currentUser;
      if (!user) return;
      isSaving.current = true;
      try {
        await setDoc(
          doc(db, "users", user.uid, "data", toDocId(key)),
          { value: v, updatedAt: new Date().toISOString() }
        );
        setTimeout(() => { isSaving.current = false; }, 500);
      } catch (e) {
        isSaving.current = false;
        console.warn("Erro ao salvar:", key, e.code);
      }
    }, 800);
  };

  return [val, save];
}

// ── Backup JSON ───────────────────────────────────────────────────────────────
export function runBackup() {
  try {
    const data = {};
    ALL_KEYS.forEach((k) => {
      const v = localStorage.getItem(k);
      if (v) data[k] = JSON.parse(v);
    });
    const json = JSON.stringify({ version:"1.0", date: new Date().toISOString(), data }, null, 2);
    const url  = URL.createObjectURL(new Blob([json], { type:"application/json" }));
    const a    = Object.assign(document.createElement("a"), {
      href: url,
      download: `painel-backup-${new Date().toLocaleDateString("pt-BR").replace(/\//g,"-")}.json`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch { return false; }
}

export function checkWeeklyBackup() {
  const now  = Date.now();
  const last = Number(localStorage.getItem("backup:lastRun") || 0);
  if (now - last >= 7 * 24 * 60 * 60 * 1000) {
    setTimeout(() => {
      runBackup();
      localStorage.setItem("backup:lastRun", String(now));
    }, 4000);
  }
}

// ── Restaurar backup ──────────────────────────────────────────────────────────
export async function restoreBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        if (!backup?.data) throw new Error("Arquivo inválido");
        Object.entries(backup.data).forEach(([k,v]) => localStorage.setItem(k, JSON.stringify(v)));
        // Dispara evento storage para forçar re-render dos hooks useStorage
        window.dispatchEvent(new Event("storage"));
        const user = auth.currentUser;
        if (user) {
          for (const [k,v] of Object.entries(backup.data)) {
            await setDoc(
              doc(db, "users", user.uid, "data", toDocId(k)),
              { value: v, updatedAt: new Date().toISOString() }
            );
          }
        }
        resolve(new Date(backup.date).toLocaleDateString("pt-BR"));
      } catch(err) { reject(err); }
    };
    reader.readAsText(file);
  });
}

// ── Forçar sync nuvem → local ─────────────────────────────────────────────────
export async function syncFromCloud() {
  const user = auth.currentUser;
  if (!user) throw new Error("Não autenticado");
  const snap = await getDocs(collection(db, "users", user.uid, "data"));
  snap.forEach((d) => {
    const v = d.data().value;
    if (v !== undefined) localStorage.setItem(fromDocId(d.id), JSON.stringify(v));
  });
  return snap.size;
}

// ── getUID (compatibilidade) ──────────────────────────────────────────────────
export async function getUID() {
  const user = auth.currentUser;
  if (user) return user.uid;
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      if (u) resolve(u.uid);
      else reject(new Error("Não autenticado"));
    });
  });
}

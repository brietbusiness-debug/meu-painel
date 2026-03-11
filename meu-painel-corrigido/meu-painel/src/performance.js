// ─────────────────────────────────────────────────────────────────────────────
// performance.js — Otimizações de PC e celular
// Lazy loading, debounce, cache inteligente, detecção de dispositivo
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useRef, useCallback } from "react";

// ── 1. DETECÇÃO de dispositivo ────────────────────────────────────────────────
export function detectarDispositivo() {
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua);
  const isTablet = /ipad|tablet/i.test(ua) || (isMobile && window.innerWidth >= 768);
  const isDesktop = !isMobile && !isTablet;
  const conexao = navigator.connection?.effectiveType || "4g"; // 4g, 3g, 2g, slow-2g
  const memoriaFraca = (navigator.deviceMemory || 4) < 2; // menos de 2GB RAM
  return { isMobile, isTablet, isDesktop, conexao, memoriaFraca };
}

// ── 2. DEBOUNCE hook (evita re-renders excessivos em inputs) ──────────────────
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── 3. THROTTLE para eventos de scroll/resize ─────────────────────────────────
export function useThrottle(fn, delay = 200) {
  const last = useRef(0);
  return useCallback((...args) => {
    const now = Date.now();
    if (now - last.current >= delay) {
      last.current = now;
      fn(...args);
    }
  }, [fn, delay]);
}

// ── 4. LAZY LOAD de componentes pesados ──────────────────────────────────────
// Só renderiza quando a aba está visível
export function useVisivel(ref) {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisivel(true); },
      { threshold: 0.1 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return visivel;
}

// ── 5. CACHE de cálculos pesados ─────────────────────────────────────────────
const calcCache = new Map();
export function cachear(key, fn) {
  if (calcCache.has(key)) return calcCache.get(key);
  const result = fn();
  calcCache.set(key, result);
  // Limpa cache após 5 segundos
  setTimeout(() => calcCache.delete(key), 5000);
  return result;
}

// ── 6. VIRTUAL LIST — só renderiza itens visíveis (para listas longas) ────────
export function useVirtualList(items, itemHeight = 60, containerHeight = 400) {
  const [scrollTop, setScrollTop] = useState(0);
  const start  = Math.floor(scrollTop / itemHeight);
  const end    = Math.min(items.length, start + Math.ceil(containerHeight / itemHeight) + 2);
  const slice  = items.slice(start, end);
  const offset = start * itemHeight;
  const total  = items.length * itemHeight;
  return { slice, offset, total, start, onScroll: e => setScrollTop(e.target.scrollTop) };
}

// ── 7. PREFETCH de dados ao hover em abas ────────────────────────────────────
const prefetchCache = new Set();
export function prefetchTab(tabName) {
  if (prefetchCache.has(tabName)) return;
  prefetchCache.add(tabName);
  // Marca que esta aba já foi "aquecida" — o useStorage vai buscar do cache
  requestIdleCallback
    ? requestIdleCallback(() => { /* dados já no localStorage */ })
    : setTimeout(() => {}, 0);
}

// ── 8. IMAGEM lazy com placeholder ───────────────────────────────────────────
export function ImgLazy({ src, alt, style = {}, fallback = "📷" }) {
  const [loaded, setLoaded] = useState(false);
  const [erro,   setErro]   = useState(false);
  if (!src || erro) return <span style={{fontSize:"24px"}}>{fallback}</span>;
  return (
    <>
      {!loaded && <div style={{...style, background:"rgba(255,255,255,0.04)", display:"flex", alignItems:"center", justifyContent:"center"}}><span style={{color:"#333"}}>⟳</span></div>}
      <img
        src={src} alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setErro(true)}
        style={{...style, display: loaded ? "block" : "none"}}
      />
    </>
  );
}

// ── 9. PREVENÇÃO de re-render em listas ───────────────────────────────────────
export function useMemoList(list, deps) {
  const ref = useRef(list);
  const depsRef = useRef(deps);
  const changed = deps.some((d, i) => d !== depsRef.current[i]);
  if (changed) { ref.current = list; depsRef.current = deps; }
  return ref.current;
}

// ── 10. OTIMIZAÇÃO de animações (respeita prefers-reduced-motion) ────────────
export function usePodeAnimar() {
  const [pode, setPode] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPode(!mq.matches);
    const handler = () => setPode(!mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return pode;
}

// ── 11. OTIMIZAÇÃO para celular: reduz gráficos em conexão lenta ─────────────
export function useModoEconomia() {
  const [economia, setEconomia] = useState(false);
  useEffect(() => {
    const conn = navigator.connection;
    if (!conn) return;
    const check = () => {
      setEconomia(conn.effectiveType === "2g" || conn.effectiveType === "slow-2g" || conn.saveData);
    };
    check();
    conn.addEventListener("change", check);
    return () => conn.removeEventListener("change", check);
  }, []);
  return economia;
}

// ── 12. SCROLL TO TOP ao trocar de aba ───────────────────────────────────────
export function useScrollTop(dep) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [dep]);
}

// ── 13. MEDIÇÃO de performance (desenvolvimento) ─────────────────────────────
export function medirRender(nome) {
  if (process.env.NODE_ENV !== "production") {
    const start = performance.now();
    return () => {
      const dur = performance.now() - start;
      if (dur > 16) console.warn(`[Perf] ${nome} demorou ${dur.toFixed(1)}ms`);
    };
  }
  return () => {};
}

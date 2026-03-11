// CloudStatus.jsx — Indicador de nuvem + controles de backup
import React, { useState, useEffect, useRef } from "react";
import { runBackup, restoreBackup, syncFromCloud, checkWeeklyBackup } from "./useCloudStorage.js";
import { getUID } from "./firebase.js";

export default function CloudStatus({ compact = false }) {
  const [status,   setStatus]   = useState("checking");
  const [msg,      setMsg]      = useState("");
  const [uid,      setUid]      = useState("");
  const [open,     setOpen]     = useState(false);
  const [lastBkp,  setLastBkp]  = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    // Verifica backup semanal
    checkWeeklyBackup();

    // Conecta ao Firebase
    getUID()
      .then((id) => { setUid(id.slice(0,8)); setStatus("online"); })
      .catch(()  => setStatus("offline"));

    // Última data de backup
    const last = localStorage.getItem("backup:lastRun");
    if (last) setLastBkp(new Date(Number(last)).toLocaleDateString("pt-BR"));

    // Fecha menu ao clicar fora
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const flash = (m, s) => { setMsg(m); if (s) setStatus(s); setTimeout(() => setMsg(""), 3000); };

  const handleBackup = () => {
    const ok = runBackup();
    const now = new Date().toLocaleDateString("pt-BR");
    localStorage.setItem("backup:lastRun", String(Date.now()));
    setLastBkp(now);
    flash(ok ? "✓ Backup baixado!" : "✗ Erro no backup");
    setOpen(false);
  };

  const handleSync = async () => {
    setStatus("syncing"); setOpen(false);
    try {
      const n = await syncFromCloud();
      flash(`✓ ${n} itens sincronizados`, "online");
      setTimeout(() => window.location.reload(), 1000);
    } catch(e) { flash("✗ " + e.message, "offline"); }
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMsg("Restaurando..."); setOpen(false);
    try {
      const date = await restoreBackup(file);
      flash(`✓ Restaurado (${date})`, "online");
      setTimeout(() => window.location.reload(), 1500);
    } catch { flash("✗ Arquivo inválido"); }
    e.target.value = "";
  };

  const colors = { checking:"#555", online:"#34d399", offline:"#f87171", syncing:"#a78bfa" };
  const labels  = { checking:"verificando…", online:`☁ ${uid}`, offline:"sem conexão", syncing:"sincronizando…" };

  if (compact) return (
    <div ref={menuRef} style={{position:"relative"}}>
      <button onClick={()=>setOpen(!open)} title={status==="online"?"Nuvem conectada":status==="offline"?"Sem conexão":"Sincronizando..."} className="nav-btn" style={{
        width:"44px",height:"44px",borderRadius:"10px",border:"none",cursor:"pointer",
        background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",
      }}>
        <span style={{
          width:"8px",height:"8px",borderRadius:"50%",display:"block",
          background:colors[status],
          boxShadow:status==="online"?`0 0 6px ${colors[status]}`:"none",
        }}/>
      </button>
      {open && (
        <div style={{
          position:"absolute",left:"56px",bottom:0,zIndex:200,
          background:"#111",border:"1px solid #2a2a2a",borderRadius:"14px",
          padding:"8px",minWidth:"200px",
          boxShadow:"0 12px 40px rgba(0,0,0,0.7)",
        }}>
          <div style={{padding:"8px 12px 10px",borderBottom:"1px solid #1f1f1f",marginBottom:"6px"}}>
            <div style={{fontSize:"10px",color:"#555",letterSpacing:"0.06em",marginBottom:"4px"}}>NUVEM</div>
            <div style={{fontSize:"12px",color:"#d0d0d0"}}>{status==="online"?"✓ Conectado":status==="offline"?"✗ Offline":"Sincronizando..."}</div>
            {lastBkp && <div style={{fontSize:"10px",color:"#555",marginTop:"4px"}}>Backup: {lastBkp}</div>}
          </div>
          <Item icon="🔄" label="Sincronizar" onClick={handleSync}/>
          <Item icon="💾" label="Baixar backup" onClick={handleBackup}/>
          <label style={{display:"block",cursor:"pointer"}}>
            <Item icon="📂" label="Restaurar backup" onClick={()=>{}}/>
            <input type="file" accept=".json" onChange={handleRestore} style={{display:"none"}}/>
          </label>
        </div>
      )}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
    </div>
  );

  return (
    <div ref={menuRef} style={{ position:"relative", userSelect:"none" }}>
      {/* Pill de status */}
      <button onClick={() => setOpen(!open)} style={{
        display:"flex", alignItems:"center", gap:"6px",
        background:"#111", border:"1px solid #2a2a2a", borderRadius:"20px",
        padding:"5px 12px", cursor:"pointer",
      }}>
        <span style={{
          width:"6px", height:"6px", borderRadius:"50%", flexShrink:0,
          background: colors[status],
          boxShadow: status==="online" ? `0 0 5px ${colors[status]}` : "none",
          animation: status==="syncing" ? "blink 1s infinite" : "none",
        }}/>
        <span style={{ fontSize:"10px", color:"#555", whiteSpace:"nowrap" }}>
          {msg || labels[status]}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:"absolute", right:0, top:"calc(100% + 10px)", zIndex:200,
          background:"#111", border:"1px solid #2a2a2a", borderRadius:"14px",
          padding:"8px", minWidth:"220px",
          boxShadow:"0 12px 40px rgba(0,0,0,0.7)",
        }}>
          {/* Status info */}
          <div style={{ padding:"8px 12px 10px", borderBottom:"1px solid #1f1f1f", marginBottom:"6px" }}>
            <div style={{ fontSize:"10px", color:"#555", letterSpacing:"0.06em", marginBottom:"4px" }}>STATUS DA NUVEM</div>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:colors[status], flexShrink:0 }}/>
              <span style={{ fontSize:"12px", color:"#d0d0d0" }}>
                {status==="online" ? "Conectado" : status==="offline" ? "Offline" : "Aguardando…"}
              </span>
            </div>
            {lastBkp && <div style={{ fontSize:"10px", color:"#555", marginTop:"4px" }}>Último backup: {lastBkp}</div>}
          </div>

          <Item icon="🔄" label="Sincronizar da nuvem" onClick={handleSync}/>
          <Item icon="💾" label="Baixar backup agora" onClick={handleBackup}/>

          <label style={{ display:"block", cursor:"pointer" }}>
            <Item icon="📂" label="Restaurar backup (.json)" onClick={()=>{}}/>
            <input type="file" accept=".json" onChange={handleRestore} style={{ display:"none" }}/>
          </label>

          <div style={{ margin:"8px 0 4px", padding:"0 12px", fontSize:"9px", color:"#333", letterSpacing:"0.08em" }}>
            BACKUP AUTOMÁTICO: TODA SEMANA
          </div>
        </div>
      )}

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
    </div>
  );
}

function Item({ icon, label, onClick }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ display:"flex", alignItems:"center", gap:"10px", padding:"9px 12px",
        borderRadius:"8px", cursor:"pointer", transition:"background 0.12s",
        background: h ? "#1a1a1a" : "transparent",
        fontSize:"12px", color:"#d0d0d0" }}>
      <span style={{ fontSize:"15px" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

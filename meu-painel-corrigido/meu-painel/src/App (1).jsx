import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, ReferenceLine
} from "recharts";
import { useCloudStorage as useStorage } from "./useCloudStorage.js";
import CloudStatus from "./CloudStatus.jsx";
import Login from "./Login.jsx";
import { onUsuario, logout, checkRedirectResult, db, getUID } from "./firebase.js";
import { doc, setDoc, getDoc } from "firebase/firestore";

const TABS = ["Home", "Finanças", "Tarefas", "Hábitos", "Metas", "Treino", "Livros", "Agenda"];
const TabIcon = ({ name, active }) => {
  const c = active ? "#fff" : "#555";
  const s = { width:"15px", height:"15px" };
  if (name==="Home")     return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  if (name==="Finanças") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;
  if (name==="Tarefas")  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>;
  if (name==="Hábitos")  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
  if (name==="Metas")    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill={c}/></svg>;
  if (name==="Treino")   return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><path d="M6 4v16M18 4v16M6 12h12M2 7h4M18 7h4M2 17h4M18 17h4"/></svg>;
  if (name==="Livros")   return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>;
  if (name==="Agenda")   return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>;
  return null;
};
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
// today é recalculado a cada render para garantir que nunca fica desatualizado
const getToday = () => new Date();
// DEPRECATED: use getToday() inline para evitar data congelada se app ficar aberto por dias
const today = getToday();

// ── DESIGN SYSTEM ─────────────────────────────────────────────────────────────
const card  = { background:"#111", borderRadius:"16px", border:"1px solid rgba(255,255,255,0.06)" };
const inp   = { border:"1px solid rgba(255,255,255,0.08)", borderRadius:"10px", padding:"11px 14px", fontSize:"14px", background:"rgba(255,255,255,0.04)", outline:"none", color:"#e8e8e8", width:"100%", transition:"border-color 0.2s" };
const btnPurple = { background:"linear-gradient(135deg,#7c3aed,#6d28d9)", color:"#fff", border:"none", borderRadius:"10px", padding:"9px 20px", fontSize:"13px", cursor:"pointer", letterSpacing:"0.02em", transition:"opacity 0.15s" };
const btnGhost  = { background:"transparent", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"8px", padding:"5px 12px", fontSize:"12px", cursor:"pointer", color:"#666", transition:"all 0.15s" };
const lbl   = { fontSize:"11px", letterSpacing:"0.08em", color:"#555", textTransform:"uppercase", marginBottom:"6px", fontWeight:"600" };

function fmt(v) { return Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2}); }

// Tooltip customizado dark
const DarkTooltip = ({ active, payload, label, prefix="R$" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"#111",border:"1px solid #2a2a2a",borderRadius:"8px",padding:"8px 12px",fontSize:"12px"}}>
      {label && <div style={{color:"#555",marginBottom:"4px"}}>{label}</div>}
      {payload.map((p,i) => (
        <div key={i} style={{color:p.color||"#f0f0f0",fontWeight:"600"}}>
          {p.name}: {prefix} {fmt(p.value)}
        </div>
      ))}
    </div>
  );
};

// ── IA CONTEXTUAL ─────────────────────────────────────────────────────────────
// ── API KEY MANAGER ───────────────────────────────────────────────────────────
const API_KEY_STORAGE = "ia:apikey";

function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || "";
}

async function saveApiKey(k) {
  const clean = k.trim();
  // 1. localStorage — imediato
  localStorage.setItem(API_KEY_STORAGE, clean);
  // 2. Firebase — persistente, recupera em qualquer dispositivo
  try {
    const uid = await getUID();
    await setDoc(
      doc(db, "users", uid, "data", "ia_apikey"),
      { value: clean, updatedAt: new Date().toISOString() }
    );
  } catch { /* Firebase indisponível — key salva localmente */ }
}

// Ao iniciar, tenta recuperar a key do Firebase se não estiver no localStorage
async function restoreApiKeyFromCloud() {
  if (localStorage.getItem(API_KEY_STORAGE)) return; // já tem localmente
  try {
    const uid  = await getUID();
    const snap = await getDoc(doc(db, "users", uid, "data", "ia_apikey"));
    if (snap.exists()) {
      const val = snap.data().value;
      if (val) localStorage.setItem(API_KEY_STORAGE, val);
    }
  } catch { /* offline */ }
}

function APIKeySetup({ onSave }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  return (
    <div style={{ padding:"20px", textAlign:"center" }}>
      <div style={{ fontSize:"28px", marginBottom:"12px" }}>🔑</div>
      <div style={{ fontSize:"13px", fontWeight:"600", color:"#f0f0f0", marginBottom:"6px" }}>Configure sua API Key</div>
      <div style={{ fontSize:"12px", color:"#555", marginBottom:"16px", lineHeight:1.6 }}>
        Para usar a IA fora do Claude.ai, você precisa de uma chave da Anthropic.<br/>
        Ela fica salva só no seu dispositivo.
      </div>
      <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer"
        style={{ display:"inline-block", fontSize:"11px", color:"#a78bfa", marginBottom:"16px", textDecoration:"none", border:"1px solid rgba(124,58,237,0.3)", borderRadius:"8px", padding:"5px 12px" }}>
        → Gerar chave em console.anthropic.com
      </a>
      <div style={{ display:"flex", gap:"8px", marginTop:"8px" }}>
        <div style={{ position:"relative", flex:1 }}>
          <input
            type={show ? "text" : "password"}
            placeholder="sk-ant-..."
            value={key}
            onChange={e => setKey(e.target.value)}
            style={{ ...inp, paddingRight:"40px" }}
          />
          <button onClick={() => setShow(!show)} style={{ position:"absolute", right:"10px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:"13px" }}>
            {show ? "🙈" : "👁"}
          </button>
        </div>
        <button
          onClick={async () => { if (key.startsWith("sk-ant-") || key.startsWith("sk-")) { await saveApiKey(key); onSave(); } }}
          style={{ ...btnPurple, opacity: (key.startsWith("sk-ant-") || key.startsWith("sk-")) ? 1 : 0.4 }}>
          Salvar
        </button>
      </div>
      {key && !key.startsWith("sk-") && (
        <div style={{ fontSize:"11px", color:"#f87171", marginTop:"8px" }}>A chave deve começar com "sk-ant-..."</div>
      )}    </div>
  );
}

// ── IA WIDGET ─────────────────────────────────────────────────────────────────
function IAWidget({ context, systemPrompt, placeholder = "Pergunte algo..." }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(!!getApiKey());
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const bottomRef = React.useRef(null);

  // Tenta recuperar key do Firebase se não estiver local
  useEffect(() => {
    if (!getApiKey()) {
      restoreApiKeyFromCloud().then(() => {
        if (getApiKey()) setHasKey(true);
      });
    }
  }, []);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg) return;
    const apiKey = getApiKey();
    if (!apiKey) { setShowKeySetup(true); return; }

    setInput(""); setErrMsg("");
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const contextBlock = context ? `\n\nDADOS ATUAIS DO USUÁRIO:\n${context}` : "";
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt + contextBlock,
          messages: newMessages,
        }),
      });
      const data = await response.json();
      if (data.error) {
        const msg = data.error.type === "authentication_error"
          ? "API Key inválida. Clique em ⚙ para atualizar."
          : data.error.message || "Erro da API.";
        setErrMsg(msg);
        setMessages(newMessages);
      } else {
        const reply = data.content?.[0]?.text || "Não consegui responder agora.";
        setMessages([...newMessages, { role: "assistant", content: reply }]);
      }
    } catch (e) {
      setErrMsg("Sem conexão com a internet. Verifique sua rede.");
      setMessages(newMessages);
    }
    setLoading(false);
  };

  const suggestions = context?.includes("receita") || context?.includes("despesa")
    ? ["Analise minha situação financeira", "Onde posso economizar?", "Estou no caminho certo?"]
    : context?.includes("tarefa") || context?.includes("prio")
    ? ["Quais tarefas priorizar hoje?", "Como organizar melhor meu dia?", "Dê dicas de produtividade"]
    : context?.includes("hábito")
    ? ["Como melhorar minha consistência?", "Quais hábitos devo focar?", "Me motive!"]
    : ["Analise meus dados", "Dê sugestões de melhoria", "Como estou me saindo?"];

  return (
    <div style={{ marginTop: "20px" }}>
      {/* Botão toggle */}
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "transparent",
        border: `1px solid ${open ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "12px", padding: "12px 16px", cursor: "pointer", transition: "all 0.2s",
        boxShadow: open ? "0 0 0 1px rgba(124,58,237,0.15)" : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "30px", height: "30px", borderRadius: "10px", flexShrink:0,
            background: "linear-gradient(135deg,#7c3aed,#a78bfa)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", boxShadow: "0 2px 8px rgba(124,58,237,0.4)",
          }}>✦</div>
          <div style={{ textAlign:"left" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "#f0f0f0" }}>Assistente IA</div>
            <div style={{ fontSize: "10px", color: hasKey ? "#7c3aed" : "#555", letterSpacing: "0.06em" }}>
              {hasKey ? "ANÁLISE PERSONALIZADA" : "CONFIGURAÇÃO NECESSÁRIA"}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          {hasKey && (
            <button onClick={e => { e.stopPropagation(); setShowKeySetup(!showKeySetup); setOpen(true); }}
              title="Trocar API Key"
              style={{ background:"none", border:"none", color:"#333", cursor:"pointer", fontSize:"14px", padding:"2px" }}>⚙</button>
          )}
          <span style={{ color: "#444", fontSize: "14px", transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0)" }}>⌄</span>
        </div>
      </button>

      {open && (
        <div style={{ ...card, marginTop: "8px", overflow: "hidden" }}>

          {/* Setup de API Key */}
          {(!hasKey || showKeySetup) && (
            <APIKeySetup onSave={() => { setHasKey(true); setShowKeySetup(false); }} />
          )}

          {/* Chat */}
          {hasKey && !showKeySetup && (
            <>
              <div style={{ maxHeight: "300px", overflowY: "auto", padding: "16px 16px 0" }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
                    <div style={{ fontSize: "26px", marginBottom: "8px" }}>✦</div>
                    <div style={{ fontSize: "13px", color: "#555" }}>Analiso seus dados e respondo suas dúvidas.</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", marginTop: "14px" }}>
                      {suggestions.map((s, i) => (
                        <button key={i} onClick={() => send(s)}
                          style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "20px", padding: "5px 12px", fontSize: "11px", color: "#a78bfa", cursor: "pointer" }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} style={{ display:"flex", justifyContent: m.role==="user" ? "flex-end" : "flex-start", marginBottom:"10px" }}>
                    {m.role === "assistant" && (
                      <div style={{ width:"22px", height:"22px", borderRadius:"8px", background:"linear-gradient(135deg,#7c3aed,#a78bfa)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", marginRight:"8px", flexShrink:0, marginTop:"2px" }}>✦</div>
                    )}
                    <div style={{
                      maxWidth: "82%", padding: "10px 14px",
                      borderRadius: m.role==="user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: m.role==="user" ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "rgba(255,255,255,0.05)",
                      border: m.role==="user" ? "none" : "1px solid rgba(255,255,255,0.06)",
                      fontSize: "13px", color: "#f0f0f0", lineHeight: "1.55", whiteSpace: "pre-wrap",
                    }}>
                      {m.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                    <div style={{ width:"22px", height:"22px", borderRadius:"8px", background:"linear-gradient(135deg,#7c3aed,#a78bfa)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px" }}>✦</div>
                    <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"16px", padding:"10px 14px", display:"flex", gap:"4px", alignItems:"center" }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ width:"5px", height:"5px", borderRadius:"50%", background:"#7c3aed", animation:`iapulse 1.2s ${i*0.2}s infinite ease-in-out` }}/>
                      ))}
                    </div>
                  </div>
                )}

                {/* Erro inline */}
                {errMsg && (
                  <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:"10px", padding:"10px 14px", fontSize:"12px", color:"#f87171", marginBottom:"10px" }}>
                    ⚠ {errMsg}
                    {errMsg.includes("Key") && (
                      <button onClick={() => setShowKeySetup(true)} style={{ marginLeft:"8px", background:"none", border:"1px solid rgba(248,113,113,0.4)", borderRadius:"6px", color:"#f87171", fontSize:"11px", cursor:"pointer", padding:"2px 8px" }}>
                        Atualizar key
                      </button>
                    )}
                  </div>
                )}

                <div ref={bottomRef}/>
              </div>

              {/* Input */}
              <div style={{ padding:"12px 16px", borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", gap:"8px" }}>
                <input
                  placeholder={placeholder}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && !e.shiftKey && send()}
                  style={{ ...inp, flex:1, padding:"9px 12px" }}
                />
                <button onClick={() => send()} disabled={loading || !input.trim()}
                  style={{ ...btnPurple, padding:"9px 14px", opacity: loading || !input.trim() ? 0.4 : 1 }}>
                  ↑
                </button>
              </div>

              {/* Sugestões rápidas */}
              {messages.length > 0 && (
                <div style={{ padding:"0 16px 12px", display:"flex", gap:"5px", flexWrap:"wrap" }}>
                  {suggestions.map((s,i) => (
                    <button key={i} onClick={() => send(s)}
                      style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"20px", padding:"3px 10px", fontSize:"10px", color:"#444", cursor:"pointer" }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <style>{`@keyframes iapulse { 0%,100%{transform:translateY(0);opacity:0.4} 50%{transform:translateY(-3px);opacity:1} }`}</style>
    </div>
  );
}

// ── FINANÇAS ──────────────────────────────────────────────────────────────────
function Financas() {
  const [finTab, setFinTab] = useState("visao");
  const finTabs = [
    {id:"visao",label:"Visão Geral"},{id:"lancamentos",label:"Lançamentos"},
    {id:"mensal",label:"Histórico Mensal"},{id:"dividas",label:"Dívidas"},
    {id:"investimentos",label:"Investimentos"},{id:"assinaturas",label:"Assinaturas"},
  ];
  return (
    <div>
      <div style={{display:"flex",gap:"4px",marginBottom:"24px",overflowX:"auto",paddingBottom:"2px",WebkitOverflowScrolling:"touch"}}>
        {finTabs.map(t=>(
          <button key={t.id} onClick={()=>setFinTab(t.id)}
            style={{whiteSpace:"nowrap",
              background:finTab===t.id?"rgba(124,58,237,0.15)":"transparent",
              color:finTab===t.id?"#a78bfa":"#444",
              border:`1px solid ${finTab===t.id?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.06)"}`,
              borderRadius:"8px",padding:"5px 13px",fontSize:"11px",cursor:"pointer",
              fontWeight:finTab===t.id?"600":"400",letterSpacing:"0.04em",
              transition:"all 0.15s", flexShrink:0}}>
            {t.label}
          </button>
        ))}
      </div>
      {finTab==="visao"         && <VisaoGeral/>}
      {finTab==="lancamentos"   && <Lancamentos/>}
      {finTab==="mensal"        && <HistoricoMensal/>}
      {finTab==="dividas"       && <Dividas/>}
      {finTab==="investimentos" && <Investimentos/>}
      {finTab==="assinaturas"   && <Assinaturas/>}
    </div>
  );
}

// ── VISÃO GERAL ───────────────────────────────────────────────────────────────
function VisaoGeral() {
  const [transactions] = useStorage("fin:transactions",[]);
  const [dividas]      = useStorage("fin:dividas",[]);
  const [investimentos]= useStorage("fin:investimentos",[]);
  const [assinaturas]  = useStorage("fin:assinaturas",[]);

  const thisMonth = transactions.filter(t=>{
    const d=new Date(t.ts||Date.now());
    return d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear();
  });
  const receitas   = thisMonth.filter(t=>(t.tipo||t.type)==="receita").reduce((s,t)=>s+Number(t.valor)||0,0);
  const despesas   = thisMonth.filter(t=>(t.tipo||t.type)==="despesa").reduce((s,t)=>s+Number(t.valor)||0,0);
  const saldo      = receitas-despesas;
  const totalDiv   = dividas.filter(d=>!d.quitada).reduce((s,d)=>s+(d.total-d.pago),0);
  const totalInv   = investimentos.reduce((s,i)=>s+i.valorAtual,0);
  const totalAss   = assinaturas.filter(a=>a.ativa).reduce((s,a)=>s+(a.ciclo==="anual"?a.valor/12:a.valor),0);

  // Gráfico de barras: resumo do mês
  const barData = [
    {name:"Receitas", valor:receitas, fill:"#a78bfa"},
    {name:"Despesas", valor:despesas, fill:"#f87171"},
    {name:"Saldo",    valor:Math.abs(saldo), fill:saldo>=0?"#34d399":"#f87171"},
  ];

  // Pie: distribuição do dinheiro
  const pieData = [
    {name:"Gastos",       valor:despesas,   color:"#f87171"},
    {name:"Investimentos",valor:totalInv,   color:"#34d399"},
    {name:"Assinaturas",  valor:totalAss,   color:"#60a5fa"},
    {name:"Dívidas",      valor:totalDiv,   color:"#fb923c"},
  ].filter(d=>d.valor>0);

  const cards = [
    {label:"Receitas (mês)",  val:receitas,  color:"#a78bfa"},
    {label:"Despesas (mês)",  val:despesas,  color:"#f87171"},
    {label:"Saldo (mês)",     val:saldo,     color:saldo>=0?"#a78bfa":"#f87171"},
    {label:"Em Dívidas",      val:totalDiv,  color:"#fb923c"},
    {label:"Investimentos",   val:totalInv,  color:"#34d399"},
    {label:"Assinaturas/mês", val:totalAss,  color:"#60a5fa"},
  ];

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"20px"}}>
        {cards.map(c=>(
          <div key={c.label} style={{...card,padding:"14px 18px"}}>
            <div style={lbl}>{c.label}</div>
            <div style={{fontSize:"18px",fontWeight:"700",color:c.color}}>R$ {fmt(c.val)}</div>
          </div>
        ))}
      </div>

      {/* Gráfico de barras do mês */}
      {(receitas>0||despesas>0) && (
        <div style={{...card,padding:"20px",marginBottom:"16px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"16px"}}>RESUMO DO MÊS</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barSize={40} margin={{top:0,right:0,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false}/>
              <XAxis dataKey="name" tick={{fill:"#555",fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip content={<DarkTooltip/>}/>
              <Bar dataKey="valor" radius={[6,6,0,0]}>
                {barData.map((entry,i)=><Cell key={i} fill={entry.fill}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pie distribuição */}
      {pieData.length>0 && (
        <div style={{...card,padding:"20px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"16px"}}>DISTRIBUIÇÃO FINANCEIRA</div>
          <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={pieData} dataKey="valor" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3}>
                  {pieData.map((entry,i)=><Cell key={i} fill={entry.color}/>)}
                </Pie>
                <Tooltip content={<DarkTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"grid",gap:"8px",flex:1}}>
              {pieData.map((d,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <div style={{width:"8px",height:"8px",borderRadius:"50%",background:d.color,flexShrink:0}}/>
                  <span style={{fontSize:"12px",color:"#f0f0f0",flex:1}}>{d.name}</span>
                  <span style={{fontSize:"11px",color:"#555"}}>R$ {fmt(d.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {receitas===0&&despesas===0&&totalInv===0&&(
        <div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"40px"}}>
          Adicione lançamentos, investimentos ou dívidas para ver os gráficos
        </div>
      )}

      <IAWidget
        context={`Receitas do mês: R$ ${fmt(receitas)}\nDespesas do mês: R$ ${fmt(despesas)}\nSaldo do mês: R$ ${fmt(saldo)}\nTotal em dívidas: R$ ${fmt(totalDiv)}\nInvestimentos: R$ ${fmt(totalInv)}\nAssinaturas mensais: R$ ${fmt(totalAss)}`}
        systemPrompt="Você é um assistente financeiro pessoal integrado a um painel financeiro. Responda sempre em português brasileiro de forma direta, amigável e prática. Analise os dados financeiros do usuário e dê insights, dicas e alertas concretos. Seja objetivo e use números quando relevante. Máximo 200 palavras por resposta."
        placeholder="Ex: Estou gastando muito? Como posso economizar?"
      />
    </div>
  );
}

// ── LANÇAMENTOS ───────────────────────────────────────────────────────────────
function Lancamentos() {
  const [transactions,setTransactions] = useStorage("fin:transactions",[]);
  const [form,setForm] = useState({desc:"",valor:"",tipo:"receita",cat:"Outros"});
  const [showForm,setShowForm] = useState(false);
  const [mesFilter,setMesFilter] = useState(today.getMonth());
  const [anoFilter,setAnoFilter] = useState(today.getFullYear());

  const cats = ["Alimentação","Transporte","Moradia","Saúde","Lazer","Educação","Salário","Freelance","Outros"];

  const add = () => {
    if (!form.desc||!form.valor) return;
    setTransactions([{id:Date.now(),ts:Date.now(),...form,valor:parseFloat(form.valor)},...transactions]);
    setForm({desc:"",valor:"",tipo:"receita",cat:"Outros"});
    setShowForm(false);
  };

  const filtered = transactions.filter(t=>{
    const d=new Date(t.ts||Date.now());
    return d.getMonth()===mesFilter&&d.getFullYear()===anoFilter;
  });

  const receitas = filtered.filter(t=>(t.tipo||t.type)==="receita").reduce((s,t)=>s+Number(t.valor)||0,0);
  const despesas = filtered.filter(t=>(t.tipo||t.type)==="despesa").reduce((s,t)=>s+Number(t.valor)||0,0);

  // Agrupa despesas por categoria para pie
  const catMap = {};
  filtered.filter(t=>(t.tipo||t.type)==="despesa").forEach(t=>{
    catMap[t.cat]=(catMap[t.cat]||0)+Number(t.valor)||0;
  });
  const catColors = ["#f87171","#fb923c","#fcd34d","#34d399","#60a5fa","#a78bfa","#f472b6","#818cf8","#6ee7b7"];
  const catPie = Object.entries(catMap).map(([name,valor],i)=>({name,valor,color:catColors[i%catColors.length]}));

  return (
    <div>
      <div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"20px"}}>
        <select value={mesFilter} onChange={e=>setMesFilter(Number(e.target.value))} style={{...inp,width:"auto"}}>
          {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
        </select>
        <select value={anoFilter} onChange={e=>setAnoFilter(Number(e.target.value))} style={{...inp,width:"auto"}}>
          {Array.from({length:6},(_,i)=>new Date().getFullYear()-2+i).map(a=><option key={a}>{a}</option>)}
        </select>
        <button onClick={()=>setShowForm(!showForm)} style={btnPurple}>{showForm?"✕":"+ Novo"}</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px",marginBottom:"20px"}}>
        {[{l:"Receitas",v:receitas,c:"#a78bfa"},{l:"Despesas",v:despesas,c:"#f87171"},{l:"Saldo",v:receitas-despesas,c:receitas-despesas>=0?"#a78bfa":"#f87171"}].map(x=>(
          <div key={x.l} style={{...card,padding:"12px 14px"}}>
            <div style={lbl}>{x.l}</div>
            <div style={{fontSize:"14px",fontWeight:"700",color:x.c}}>R$ {fmt(x.v)}</div>
          </div>
        ))}
      </div>

      {/* Gráfico de pizza por categoria */}
      {catPie.length>0 && (
        <div style={{...card,padding:"18px",marginBottom:"20px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"14px"}}>DESPESAS POR CATEGORIA</div>
          <div style={{display:"flex",alignItems:"center",gap:"16px"}}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={catPie} dataKey="valor" cx="50%" cy="50%" innerRadius={38} outerRadius={65} paddingAngle={3}>
                  {catPie.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip content={<DarkTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"grid",gap:"6px",flex:1}}>
              {catPie.map((d,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <div style={{width:"7px",height:"7px",borderRadius:"50%",background:d.color,flexShrink:0}}/>
                  <span style={{fontSize:"11px",color:"#f0f0f0",flex:1}}>{d.name}</span>
                  <span style={{fontSize:"10px",color:"#555"}}>R$ {fmt(d.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{...card,padding:"18px",marginBottom:"18px",display:"grid",gap:"10px"}}>
          <input placeholder="Descrição" value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} style={inp}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <input placeholder="Valor (R$)" type="number" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})} style={inp}/>
            <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} style={inp}>
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </select>
          </div>
          <select value={cats.includes(form.cat)?form.cat:"Outros"} onChange={e=>setForm({...form,cat:e.target.value==="Outros"?"Outros":e.target.value})} style={inp}>
            {cats.map(c=><option key={c}>{c}</option>)}
          </select>
          {(form.cat==="Outros"||!cats.includes(form.cat)) && (
            <input placeholder="Digite a categoria personalizada..." value={cats.includes(form.cat)?"":form.cat}
              onChange={e=>setForm({...form,cat:e.target.value})}
              style={{...inp,borderColor:"rgba(124,58,237,0.3)"}}/>
          )}
          <button onClick={add} style={{...btnPurple,padding:"10px",fontSize:"13px"}}>Adicionar</button>
        </div>
      )}

      <div style={{display:"grid",gap:"7px"}}>
        {filtered.length===0&&<div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"32px"}}>Nenhum lançamento neste mês</div>}
        {filtered.map(t=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:"12px",padding:"11px 14px",...card}}>
            <div style={{width:"5px",height:"32px",borderRadius:"3px",background:t.tipo==="receita"?"#a78bfa":"#f87171",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:"13px",fontWeight:"500",color:"#f0f0f0"}}>{t.desc}</div>
              <div style={{fontSize:"11px",color:"#555",marginTop:"2px"}}>{t.cat} · {new Date(t.ts).toLocaleDateString("pt-BR")}</div>
            </div>
            <div style={{fontWeight:"600",fontSize:"14px",color:t.tipo==="receita"?"#a78bfa":"#f87171"}}>
              {t.tipo==="receita"?"+":"-"} R$ {fmt(t.valor)}
            </div>
            <button onClick={()=>setTransactions(transactions.filter(x=>x.id!==t.id))}
              style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"16px"}}>×</button>
          </div>
        ))}
      </div>

      <IAWidget
        context={`Mês: ${MONTHS[mesFilter]}/${anoFilter}\nReceitas: R$ ${fmt(receitas)}\nDespesas: R$ ${fmt(despesas)}\nSaldo: R$ ${fmt(receitas-despesas)}\nLançamentos:\n${filtered.map(t=>`- ${t.tipo}: ${t.desc} (${t.cat}) R$ ${fmt(t.valor)}`).join("\n")}`}
        systemPrompt="Você é um assistente financeiro pessoal. Analise os lançamentos do mês do usuário e dê dicas específicas sobre onde está gastando mais, o que pode cortar e como melhorar o saldo. Responda em português brasileiro, de forma direta e amigável. Máximo 200 palavras."
        placeholder="Ex: Em que categoria estou gastando mais?"
      />
    </div>
  );
}

// ── HISTÓRICO MENSAL ──────────────────────────────────────────────────────────
function HistoricoMensal() {
  const [transactions] = useStorage("fin:transactions",[]);
  const [extras,setExtras] = useStorage("fin:mensal-extras",[]);
  const [form,setForm] = useState({mes:today.getMonth(),ano:today.getFullYear(),desc:"",valor:"",tipo:"receita"});
  const [showForm,setShowForm] = useState(false);

  const all = [...transactions,...extras];
  const grupos = {};
  all.forEach(t=>{
    const d=new Date(t.ts||Date.now());
    const k=`${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
    if(!grupos[k]) grupos[k]={ano:d.getFullYear(),mes:d.getMonth(),receitas:0,despesas:0};
    if((t.tipo||t.type)==="receita") grupos[k].receitas+=Number(t.valor)||0; else grupos[k].despesas+=Number(t.valor)||0;
  });

  const meses = Object.values(grupos).sort((a,b)=>a.ano!==b.ano?a.ano-b.ano:a.mes-b.mes);

  // Dados para o gráfico de linhas
  const lineData = meses.map(m=>({
    name:`${MONTHS[m.mes]}/${String(m.ano).slice(2)}`,
    Receitas:m.receitas,
    Despesas:m.despesas,
    Saldo:m.receitas-m.despesas,
  }));

  const add = () => {
    if(!form.desc||!form.valor) return;
    const d=new Date(form.ano,form.mes,15);
    setExtras([...extras,{id:Date.now(),ts:d.getTime(),desc:form.desc,valor:parseFloat(form.valor),tipo:form.tipo,cat:"Manual"}]);
    setShowForm(false);
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
        <div style={{fontSize:"13px",fontWeight:"600",color:"#555",letterSpacing:"0.04em"}}>HISTÓRICO POR MÊS</div>
        <button onClick={()=>setShowForm(!showForm)} style={btnPurple}>{showForm?"✕ Fechar":"+ Lançar Mês"}</button>
      </div>

      {/* Gráfico de linhas evolutivo */}
      {lineData.length>=2 && (
        <div style={{...card,padding:"20px",marginBottom:"20px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"16px"}}>EVOLUÇÃO MENSAL</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lineData} margin={{top:5,right:10,bottom:5,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false}/>
              <XAxis dataKey="name" tick={{fill:"#555",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip content={<DarkTooltip/>}/>
              <Legend wrapperStyle={{fontSize:"11px",color:"#555"}}/>
              <Line type="monotone" dataKey="Receitas" stroke="#a78bfa" strokeWidth={2} dot={{r:3,fill:"#a78bfa"}} activeDot={{r:5}}/>
              <Line type="monotone" dataKey="Despesas" stroke="#f87171" strokeWidth={2} dot={{r:3,fill:"#f87171"}} activeDot={{r:5}}/>
              <Line type="monotone" dataKey="Saldo"    stroke="#34d399" strokeWidth={2} strokeDasharray="4 2" dot={{r:3,fill:"#34d399"}} activeDot={{r:5}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráfico de barras agrupadas */}
      {lineData.length>=1 && (
        <div style={{...card,padding:"20px",marginBottom:"20px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"16px"}}>RECEITAS vs DESPESAS</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={lineData} barSize={16} margin={{top:0,right:10,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false}/>
              <XAxis dataKey="name" tick={{fill:"#555",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip content={<DarkTooltip/>}/>
              <Bar dataKey="Receitas" fill="#a78bfa" radius={[4,4,0,0]}/>
              <Bar dataKey="Despesas" fill="#f87171" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {showForm && (
        <div style={{...card,padding:"18px",marginBottom:"18px",display:"grid",gap:"10px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <select value={form.mes} onChange={e=>setForm({...form,mes:Number(e.target.value)})} style={inp}>
              {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
            </select>
            <select value={form.ano} onChange={e=>setForm({...form,ano:Number(e.target.value)})} style={inp}>
              {Array.from({length:6},(_,i)=>new Date().getFullYear()-2+i).map(a=><option key={a}>{a}</option>)}
            </select>
          </div>
          <input placeholder="Descrição" value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} style={inp}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <input placeholder="Valor (R$)" type="number" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})} style={inp}/>
            <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} style={inp}>
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </select>
          </div>
          <button onClick={add} style={{...btnPurple,padding:"10px",fontSize:"13px"}}>Salvar</button>
        </div>
      )}

      {meses.length===0&&<div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"32px"}}>Adicione lançamentos para ver o histórico</div>}
      <div style={{display:"grid",gap:"10px"}}>
        {[...meses].reverse().map(m=>{
          const saldo=m.receitas-m.despesas;
          const pctD=m.receitas>0?Math.min(100,(m.despesas/m.receitas)*100):0;
          const isCur=m.mes===today.getMonth()&&m.ano===today.getFullYear();
          return (
            <div key={`${m.ano}-${m.mes}`} style={{...card,padding:"16px 20px",borderColor:isCur?"#3d2080":"#2a2a2a"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <span style={{fontSize:"14px",fontWeight:"600",color:"#f0f0f0"}}>{MONTHS[m.mes]} {m.ano}</span>
                  {isCur&&<span style={{fontSize:"9px",background:"#3d2080",color:"#a78bfa",borderRadius:"20px",padding:"2px 8px"}}>ATUAL</span>}
                </div>
                <span style={{fontSize:"14px",fontWeight:"700",color:saldo>=0?"#a78bfa":"#f87171"}}>{saldo>=0?"+":""}R$ {fmt(saldo)}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"}}>
                <div><div style={{fontSize:"10px",color:"#555",marginBottom:"2px"}}>RECEITAS</div><div style={{fontSize:"13px",color:"#a78bfa",fontWeight:"500"}}>R$ {fmt(m.receitas)}</div></div>
                <div><div style={{fontSize:"10px",color:"#555",marginBottom:"2px"}}>DESPESAS</div><div style={{fontSize:"13px",color:"#f87171",fontWeight:"500"}}>R$ {fmt(m.despesas)}</div></div>
              </div>
              <div style={{background:"#0d0d0d",borderRadius:"100px",height:"4px",overflow:"hidden"}}>
                <div style={{background:"linear-gradient(90deg,#7c3aed,#f87171)",height:"100%",borderRadius:"100px",width:`${pctD}%`,transition:"width 0.4s"}}/>
              </div>
              <div style={{fontSize:"10px",color:"#444",marginTop:"4px"}}>Comprometimento: {Math.round(pctD)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DÍVIDAS ───────────────────────────────────────────────────────────────────
function Dividas() {
  const [dividas,setDividas] = useStorage("fin:dividas",[]);
  const [form,setForm] = useState({nome:"",total:"",pago:"",juros:"",vencimento:"",obs:""});
  const [showForm,setShowForm] = useState(false);
  const [editing,setEditing] = useState(null);
  const [pagForm,setPagForm] = useState({});

  const add = () => {
    if(!form.nome||!form.total) return;
    const d={id:editing||Date.now(),nome:form.nome,total:parseFloat(form.total),pago:parseFloat(form.pago||0),
      juros:parseFloat(form.juros||0),vencimento:form.vencimento,obs:form.obs};
    if(editing){
      setDividas(dividas.map(x=>x.id===editing?{...x,...d,id:x.id, quitada: parseFloat(form.pago||0)>=parseFloat(form.total)}:x));
      setEditing(null);
    }
    else setDividas([{...d, quitada:false},...dividas]);
    setForm({nome:"",total:"",pago:"",juros:"",vencimento:"",obs:""});
    setShowForm(false);
  };

  const pagar=(id)=>{
    const val=parseFloat(pagForm[id]||0);if(!val)return;
    setDividas(dividas.map(d=>{if(d.id!==id)return d;const np=d.pago+val;return{...d,pago:np,quitada:np>=d.total};}));
    setPagForm({...pagForm,[id]:""});
  };

  const ativas   = dividas.filter(d=>!d.quitada);
  const quitadas = dividas.filter(d=>d.quitada);
  const totalRestante = ativas.reduce((s,d)=>s+(d.total-d.pago),0);

  // Dados gráfico barras dívidas
  const barData = ativas.map(d=>({name:d.nome.length>12?d.nome.slice(0,12)+"…":d.nome,Restante:d.total-d.pago,Pago:d.pago}));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
        <div>
          <div style={lbl}>Total em aberto</div>
          <div style={{fontSize:"22px",fontWeight:"700",color:"#fb923c"}}>R$ {fmt(totalRestante)}</div>
        </div>
        <button onClick={()=>{setShowForm(!showForm);setEditing(null);setForm({nome:"",total:"",pago:"",juros:"",vencimento:"",obs:""}); }} style={btnPurple}>
          {showForm&&!editing?"✕ Fechar":"+ Nova Dívida"}
        </button>
      </div>

      {/* Gráfico barras dívidas */}
      {barData.length>0 && (
        <div style={{...card,padding:"18px",marginBottom:"20px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"14px"}}>PAGO vs RESTANTE POR DÍVIDA</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} layout="vertical" barSize={14} margin={{top:0,right:10,bottom:0,left:0}}>
              <XAxis type="number" hide/>
              <YAxis type="category" dataKey="name" tick={{fill:"#555",fontSize:10}} axisLine={false} tickLine={false} width={80}/>
              <Tooltip content={<DarkTooltip/>}/>
              <Bar dataKey="Pago"     fill="#34d399" radius={[0,4,4,0]} stackId="a"/>
              <Bar dataKey="Restante" fill="#fb923c" radius={[0,4,4,0]} stackId="a"/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:"16px",marginTop:"8px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}><div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#34d399"}}/><span style={{fontSize:"10px",color:"#555"}}>Pago</span></div>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}><div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#fb923c"}}/><span style={{fontSize:"10px",color:"#555"}}>Restante</span></div>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{...card,padding:"18px",marginBottom:"18px",display:"grid",gap:"10px"}}>
          <input placeholder="Nome da dívida" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} style={inp}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <input placeholder="Valor total R$" type="number" value={form.total} onChange={e=>setForm({...form,total:e.target.value})} style={inp}/>
            <input placeholder="Já pago R$" type="number" value={form.pago} onChange={e=>setForm({...form,pago:e.target.value})} style={inp}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <input placeholder="Juros % a.m." type="number" value={form.juros} onChange={e=>setForm({...form,juros:e.target.value})} style={inp}/>
            <input type="date" value={form.vencimento} onChange={e=>setForm({...form,vencimento:e.target.value})} style={{...inp,colorScheme:"dark"}}/>
          </div>
          <input placeholder="Observações" value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})} style={inp}/>
          <button onClick={add} style={{...btnPurple,padding:"10px",fontSize:"13px"}}>{editing?"Salvar":"Adicionar Dívida"}</button>
        </div>
      )}

      {ativas.length===0&&<div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"24px"}}>Nenhuma dívida ativa 🎉</div>}
      <div style={{display:"grid",gap:"12px",marginBottom:"20px"}}>
        {ativas.map(d=>{
          const restante=d.total-d.pago;
          const pct=Math.min(100,Math.round((d.pago/d.total)*100));
          return (
            <div key={d.id} style={{...card,padding:"16px 18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
                <div>
                  <div style={{fontSize:"14px",fontWeight:"600",color:"#f0f0f0"}}>{d.nome}</div>
                  <div style={{fontSize:"11px",color:"#555",marginTop:"2px"}}>{d.juros>0?`${d.juros}% a.m.`:"Sem juros"}{d.vencimento?` · Vence ${new Date(d.vencimento+"T12:00").toLocaleDateString("pt-BR")}`:""}</div>
                </div>
                <div style={{display:"flex",gap:"6px"}}>
                  <button onClick={()=>{setForm({nome:d.nome,total:d.total,pago:d.pago,juros:d.juros||"",vencimento:d.vencimento||"",obs:d.obs||""});setEditing(d.id);setShowForm(true);}} style={btnGhost}>editar</button>
                  <button onClick={()=>setDividas(dividas.map(x=>x.id===d.id?{...x,quitada:true,pago:x.total}:x))} style={{...btnGhost,color:"#34d399",borderColor:"#1a4a3a"}}>quitar</button>
                  <button onClick={()=>setDividas(dividas.filter(x=>x.id!==d.id))} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"16px"}}>×</button>
                </div>
              </div>
              <div style={{background:"#0d0d0d",borderRadius:"100px",height:"5px",overflow:"hidden",marginBottom:"8px"}}>
                <div style={{background:"linear-gradient(90deg,#fb923c,#fcd34d)",height:"100%",borderRadius:"100px",width:`${pct}%`,transition:"width 0.4s",boxShadow:"0 0 6px rgba(251,146,60,0.4)"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:"#555",marginBottom:"12px"}}>
                <span>Pago: R$ {fmt(d.pago)} ({pct}%)</span>
                <span style={{color:"#fb923c",fontWeight:"600"}}>Restante: R$ {fmt(restante)}</span>
              </div>
              <div style={{display:"flex",gap:"8px"}}>
                <input placeholder="Registrar pagamento R$" type="number" value={pagForm[d.id]||""} onChange={e=>setPagForm({...pagForm,[d.id]:e.target.value})} style={{...inp,flex:1,padding:"7px 10px",fontSize:"12px"}}/>
                <button onClick={()=>pagar(d.id)} style={{...btnPurple,padding:"7px 14px",fontSize:"12px"}}>Pagar</button>
              </div>
              {d.obs&&<div style={{fontSize:"11px",color:"#444",marginTop:"8px"}}>📝 {d.obs}</div>}
            </div>
          );
        })}
      </div>
      {quitadas.length>0&&(
        <>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"10px"}}>QUITADAS</div>
          <div style={{display:"grid",gap:"8px"}}>
            {quitadas.map(d=>(
              <div key={d.id} style={{...card,padding:"12px 16px",opacity:0.45,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:"13px",color:"#f0f0f0"}}>✓ {d.nome} <span style={{color:"#555",fontSize:"11px"}}>R$ {fmt(d.total)}</span></span>
                <button onClick={()=>setDividas(dividas.filter(x=>x.id!==d.id))} style={{background:"none",border:"none",color:"#333",cursor:"pointer"}}>×</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── INVESTIMENTOS ─────────────────────────────────────────────────────────────
function Investimentos() {
  const [investimentos,setInvestimentos] = useStorage("fin:investimentos",[]);
  const [form,setForm] = useState({nome:"",tipo:"Renda Fixa",valorInicial:"",valorAtual:""});
  const [showForm,setShowForm] = useState(false);
  const [editId,setEditId] = useState(null);

  const tipos = ["Renda Fixa","Tesouro Direto","Ações","FIIs","Criptomoedas","Poupança","CDB","LCI/LCA","Outros"];
  const tipoCores = {"Renda Fixa":"#a78bfa","Tesouro Direto":"#60a5fa","Ações":"#34d399","FIIs":"#fb923c","Criptomoedas":"#fcd34d","Poupança":"#6ee7b7","CDB":"#f472b6","LCI/LCA":"#818cf8","Outros":"#555"};

  const add = () => {
    if(!form.nome||!form.valorInicial) return;
    const inv={id:editId||Date.now(),nome:form.nome,tipo:form.tipo,
      valorInicial:parseFloat(form.valorInicial),valorAtual:parseFloat(form.valorAtual||form.valorInicial),
      data:new Date().toLocaleDateString("pt-BR")};
    if(editId){setInvestimentos(investimentos.map(i=>i.id===editId?inv:i));setEditId(null);}
    else setInvestimentos([inv,...investimentos]);
    setForm({nome:"",tipo:"Renda Fixa",valorInicial:"",valorAtual:""});
    setShowForm(false);
  };

  const totalInicial = investimentos.reduce((s,i)=>s+i.valorInicial,0);
  const totalAtual   = investimentos.reduce((s,i)=>s+i.valorAtual,0);
  const rendimento   = totalAtual-totalInicial;
  const rendPct      = totalInicial>0?((rendimento/totalInicial)*100).toFixed(2):0;

  const porTipo = {};
  investimentos.forEach(i=>{porTipo[i.tipo]=(porTipo[i.tipo]||0)+i.valorAtual;});
  const pieData = Object.entries(porTipo).map(([name,valor])=>({name,valor,color:tipoCores[name]||"#555"}));

  // Gráfico barras: investido vs atual por ativo
  const barData = investimentos.map(i=>({
    name:i.nome.length>10?i.nome.slice(0,10)+"…":i.nome,
    Investido:i.valorInicial,
    Atual:i.valorAtual,
  }));

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px",marginBottom:"20px"}}>
        {[{l:"Investido",v:totalInicial,c:"#f0f0f0"},{l:"Valor Atual",v:totalAtual,c:"#34d399"},{l:`Rendimento ${rendPct}%`,v:rendimento,c:rendimento>=0?"#34d399":"#f87171"}].map(x=>(
          <div key={x.l} style={{...card,padding:"14px 16px"}}>
            <div style={lbl}>{x.l}</div>
            <div style={{fontSize:"15px",fontWeight:"700",color:x.c}}>R$ {fmt(x.v)}</div>
          </div>
        ))}
      </div>

      {/* Pie distribuição por tipo */}
      {pieData.length>0 && (
        <div style={{...card,padding:"18px",marginBottom:"16px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"14px"}}>DISTRIBUIÇÃO DA CARTEIRA</div>
          <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
            <ResponsiveContainer width={150} height={150}>
              <PieChart>
                <Pie data={pieData} dataKey="valor" cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3}>
                  {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip content={<DarkTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"grid",gap:"7px",flex:1}}>
              {pieData.map((d,i)=>{
                const pct=totalAtual>0?Math.round((d.valor/totalAtual)*100):0;
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                    <div style={{width:"7px",height:"7px",borderRadius:"50%",background:d.color,flexShrink:0}}/>
                    <span style={{fontSize:"11px",color:"#f0f0f0",flex:1}}>{d.name}</span>
                    <span style={{fontSize:"10px",color:"#555"}}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Barras: investido vs atual */}
      {barData.length>0 && (
        <div style={{...card,padding:"18px",marginBottom:"16px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"14px"}}>INVESTIDO vs ATUAL</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} barSize={14} margin={{top:0,right:10,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false}/>
              <XAxis dataKey="name" tick={{fill:"#555",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip content={<DarkTooltip/>}/>
              <Bar dataKey="Investido" fill="#3d2080" radius={[4,4,0,0]}/>
              <Bar dataKey="Atual"     fill="#34d399" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"16px"}}>
        <button onClick={()=>{setShowForm(!showForm);setEditId(null);setForm({nome:"",tipo:"Renda Fixa",valorInicial:"",valorAtual:""});}} style={btnPurple}>
          {showForm&&!editId?"✕ Fechar":"+ Novo Investimento"}
        </button>
      </div>

      {showForm && (
        <div style={{...card,padding:"18px",marginBottom:"18px",display:"grid",gap:"10px"}}>
          <input placeholder="Nome (ex: Tesouro Selic 2029)" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} style={inp}/>
          <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} style={inp}>
            {tipos.map(t=><option key={t}>{t}</option>)}
          </select>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <input placeholder="Valor investido R$" type="number" value={form.valorInicial} onChange={e=>setForm({...form,valorInicial:e.target.value})} style={inp}/>
            <input placeholder="Valor atual R$" type="number" value={form.valorAtual} onChange={e=>setForm({...form,valorAtual:e.target.value})} style={inp}/>
          </div>
          <button onClick={add} style={{...btnPurple,padding:"10px",fontSize:"13px"}}>{editId?"Salvar":"Adicionar"}</button>
        </div>
      )}

      <div style={{display:"grid",gap:"8px"}}>
        {investimentos.length===0&&<div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"32px"}}>Nenhum investimento cadastrado</div>}
        {investimentos.map(i=>{
          const rend=i.valorAtual-i.valorInicial;
          const rendP=i.valorInicial>0?((rend/i.valorInicial)*100).toFixed(1):0;
          return (
            <div key={i.id} style={{...card,padding:"14px 16px",display:"flex",alignItems:"center",gap:"12px"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:tipoCores[i.tipo]||"#555",flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0"}}>{i.nome}</div>
                <div style={{fontSize:"11px",color:"#555",marginTop:"2px"}}>{i.tipo} · desde {i.data}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"14px",fontWeight:"600",color:"#34d399"}}>R$ {fmt(i.valorAtual)}</div>
                <div style={{fontSize:"11px",color:rend>=0?"#34d399":"#f87171"}}>{rend>=0?"+":""}R$ {fmt(rend)} ({rendP}%)</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                <button onClick={()=>{setForm({nome:i.nome,tipo:i.tipo,valorInicial:i.valorInicial,valorAtual:i.valorAtual});setEditId(i.id);setShowForm(true);}} style={btnGhost}>editar</button>
                <button onClick={()=>setInvestimentos(investimentos.filter(x=>x.id!==i.id))} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"14px"}}>×</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ASSINATURAS ───────────────────────────────────────────────────────────────
function Assinaturas() {
  const [assinaturas,setAssinaturas] = useStorage("fin:assinaturas",[]);
  const [form,setForm] = useState({nome:"",valor:"",ciclo:"mensal",cat:"Streaming",vencDia:"",obs:""});
  const [showForm,setShowForm] = useState(false);

  const cats = ["Streaming","Música","Software","Cloud","Saúde","Educação","Notícias","Games","Outros"];
  const catColors = {Streaming:"#a78bfa",Música:"#f472b6",Software:"#60a5fa",Cloud:"#34d399",Saúde:"#fb923c",Educação:"#fcd34d",Notícias:"#f0f0f0",Games:"#f87171",Outros:"#555"};

  const add = () => {
    if(!form.nome||!form.valor) return;
    setAssinaturas([...assinaturas,{id:Date.now(),...form,valor:parseFloat(form.valor),ativa:true}]);
    setForm({nome:"",valor:"",ciclo:"mensal",cat:"Streaming",vencDia:"",obs:""});
    setShowForm(false);
  };

  const toggle=(id)=>setAssinaturas(assinaturas.map(a=>a.id===id?{...a,ativa:!a.ativa}:a));
  const ativas   = assinaturas.filter(a=>a.ativa);
  const inativas = assinaturas.filter(a=>!a.ativa);
  const mensalEfetivo=(a)=>a.ciclo==="anual"?a.valor/12:a.valor;
  const totalMes = ativas.reduce((s,a)=>s+mensalEfetivo(a),0);
  const totalAno = ativas.reduce((s,a)=>s+(a.ciclo==="anual"?a.valor:a.valor*12),0);

  // Pie por categoria
  const catMap = {};
  ativas.forEach(a=>{catMap[a.cat]=(catMap[a.cat]||0)+mensalEfetivo(a);});
  const pieData = Object.entries(catMap).map(([name,valor])=>({name,valor,color:catColors[name]||"#555"}));

  // Barras por assinatura
  const barData = ativas.map(a=>({name:a.nome.length>10?a.nome.slice(0,10)+"…":a.nome,valor:mensalEfetivo(a)}));

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"20px"}}>
        <div style={{...card,padding:"16px 18px"}}>
          <div style={lbl}>Gasto mensal</div>
          <div style={{fontSize:"20px",fontWeight:"700",color:"#60a5fa"}}>R$ {fmt(totalMes)}</div>
          <div style={{fontSize:"11px",color:"#444",marginTop:"4px"}}>{ativas.length} ativa{ativas.length!==1?"s":""}</div>
        </div>
        <div style={{...card,padding:"16px 18px"}}>
          <div style={lbl}>Gasto anual</div>
          <div style={{fontSize:"20px",fontWeight:"700",color:"#60a5fa"}}>R$ {fmt(totalAno)}</div>
          <div style={{fontSize:"11px",color:"#444",marginTop:"4px"}}>projeção 12 meses</div>
        </div>
      </div>

      {/* Gráficos */}
      {pieData.length>0 && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"16px"}}>
          <div style={{...card,padding:"16px"}}>
            <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"12px"}}>POR CATEGORIA</div>
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={pieData} dataKey="valor" cx="50%" cy="50%" innerRadius={32} outerRadius={56} paddingAngle={3}>
                  {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip content={<DarkTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"grid",gap:"4px",marginTop:"8px"}}>
              {pieData.map((d,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:"5px"}}>
                  <div style={{width:"6px",height:"6px",borderRadius:"50%",background:d.color}}/>
                  <span style={{fontSize:"10px",color:"#555",flex:1}}>{d.name}</span>
                  <span style={{fontSize:"10px",color:"#f0f0f0"}}>R$ {fmt(d.valor)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{...card,padding:"16px"}}>
            <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"12px"}}>CUSTO/MÊS</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={barData} layout="vertical" barSize={10} margin={{top:0,right:10,bottom:0,left:0}}>
                <XAxis type="number" hide/>
                <YAxis type="category" dataKey="name" tick={{fill:"#555",fontSize:9}} axisLine={false} tickLine={false} width={65}/>
                <Tooltip content={<DarkTooltip/>}/>
                <Bar dataKey="valor" fill="#60a5fa" radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"16px"}}>
        <button onClick={()=>setShowForm(!showForm)} style={btnPurple}>{showForm?"✕ Fechar":"+ Nova Assinatura"}</button>
      </div>

      {showForm && (
        <div style={{...card,padding:"18px",marginBottom:"18px",display:"grid",gap:"10px"}}>
          <input placeholder="Nome (ex: Netflix, Spotify)" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} style={inp}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <input placeholder="Valor R$" type="number" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})} style={inp}/>
            <select value={form.ciclo} onChange={e=>setForm({...form,ciclo:e.target.value})} style={inp}>
              <option value="mensal">Mensal</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <select value={cats.includes(form.cat)?form.cat:"Outros"} onChange={e=>setForm({...form,cat:e.target.value==="Outros"?"Outros":e.target.value})} style={inp}>
              {cats.map(c=><option key={c}>{c}</option>)}
            </select>
            <input placeholder="Dia vencimento" type="number" min="1" max="31" value={form.vencDia} onChange={e=>setForm({...form,vencDia:e.target.value})} style={inp}/>
          </div>
          {(form.cat==="Outros"||!cats.includes(form.cat)) && (
            <input placeholder="Digite a categoria personalizada..." value={cats.includes(form.cat)?"":form.cat}
              onChange={e=>setForm({...form,cat:e.target.value})}
              style={{...inp,borderColor:"rgba(124,58,237,0.3)"}}/>
          )}
          <button onClick={add} style={{...btnPurple,padding:"10px",fontSize:"13px"}}>Adicionar</button>
        </div>
      )}

      <div style={{display:"grid",gap:"8px",marginBottom:"20px"}}>
        {ativas.length===0&&<div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"24px"}}>Nenhuma assinatura ativa</div>}
        {ativas.map(a=>(
          <div key={a.id} style={{...card,padding:"13px 16px",display:"flex",alignItems:"center",gap:"12px"}}>
            <div style={{width:"10px",height:"10px",borderRadius:"50%",background:catColors[a.cat]||"#555",flexShrink:0,boxShadow:`0 0 6px ${catColors[a.cat]||"#555"}66`}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0"}}>{a.nome}</div>
              <div style={{fontSize:"11px",color:"#555",marginTop:"2px"}}>{a.cat} · {a.ciclo}{a.vencDia?` · dia ${a.vencDia}`:""}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:"13px",fontWeight:"600",color:"#60a5fa"}}>R$ {fmt(a.valor)}<span style={{fontSize:"10px",color:"#555"}}>/{a.ciclo==="anual"?"ano":"mês"}</span></div>
              {a.ciclo==="anual"&&<div style={{fontSize:"10px",color:"#555"}}>≈ R$ {fmt(a.valor/12)}/mês</div>}
            </div>
            <button onClick={()=>toggle(a.id)} style={{...btnGhost,fontSize:"10px"}}>pausar</button>
            <button onClick={()=>setAssinaturas(assinaturas.filter(x=>x.id!==a.id))} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"16px"}}>×</button>
          </div>
        ))}
      </div>

      {inativas.length>0&&(
        <>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"10px"}}>PAUSADAS</div>
          <div style={{display:"grid",gap:"8px"}}>
            {inativas.map(a=>(
              <div key={a.id} style={{...card,padding:"11px 16px",display:"flex",alignItems:"center",gap:"10px",opacity:0.45}}>
                <span style={{fontSize:"13px",color:"#f0f0f0",flex:1}}>{a.nome}</span>
                <span style={{fontSize:"12px",color:"#555"}}>R$ {fmt(a.valor)}</span>
                <button onClick={()=>toggle(a.id)} style={{...btnGhost,fontSize:"10px",color:"#a78bfa",borderColor:"#3a2a6a"}}>ativar</button>
                <button onClick={()=>setAssinaturas(assinaturas.filter(x=>x.id!==a.id))} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"14px"}}>×</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── TAREFAS ───────────────────────────────────────────────────────────────────
function Tarefas() {
  const [tasks,setTasks]     = useStorage("tasks:list",[]);
  const [rotina,setRotina]   = useStorage("tasks:rotina",[]);
  const [input,setInput]     = useState("");
  const [prio,setPrio]       = useState("normal");
  const [filter,setFilter]   = useState("todas");
  const [abaTarefa,setAbaTarefa] = useState("hoje"); // "hoje" | "rotina"
  const [rotinaInput,setRotinaInput] = useState("");
  const [rotinaPrio,setRotinaPrio]   = useState("normal");

  const add = () => {
    if (!input.trim()) return;
    setTasks([{id:Date.now(),text:input.trim(),done:false,prio,created:new Date().toLocaleDateString("pt-BR"),ts:Date.now()},...tasks]);
    setInput("");
  };

  const addRotina = () => {
    if (!rotinaInput.trim()) return;
    setRotina([...rotina, {id:Date.now(), text:rotinaInput.trim(), prio:rotinaPrio}]);
    setRotinaInput("");
  };

  // Copiar todas as tarefas da rotina para hoje (evitando duplicatas)
  const copiarRotina = () => {
    const novas = rotina
      .filter(r => !tasks.some(t => t.text===r.text && !t.done))
      .map((r, i) => ({id:Date.now()+i+1, text:r.text, done:false, prio:r.prio, created:new Date().toLocaleDateString("pt-BR"), ts:Date.now()+i, deRotina:true}));
    if (novas.length>0) setTasks([...novas,...tasks]);
  };

  const prioColor = {alta:"#f87171", normal:"#a78bfa", baixa:"#555"};
  const prioLabel = {alta:"Alta", normal:"Normal", baixa:"Baixa"};
  const prioIcon  = {alta:"🔴", normal:"🟡", baixa:"⚪"};
  const visible   = tasks.filter(t=>filter==="todas"?true:filter==="pendentes"?!t.done:t.done);
  const done      = tasks.filter(t=>t.done).length;
  const pending   = tasks.length - done;

  const statusData = [{name:"Pendentes",valor:pending,fill:"#7c3aed"},{name:"Concluídas",valor:done,fill:"#34d399"}].filter(d=>d.valor>0);

  return (
    <div>
      {/* Sub-abas Hoje / Rotina */}
      <div style={{display:"flex",gap:"6px",marginBottom:"20px"}}>
        {[{id:"hoje",label:"📋 Tarefas de Hoje"},{id:"rotina",label:"🔄 Minha Rotina"}].map(a=>(
          <button key={a.id} onClick={()=>setAbaTarefa(a.id)} style={{
            flex:1, padding:"10px", borderRadius:"10px", cursor:"pointer", fontSize:"13px", fontWeight:"600",
            background: abaTarefa===a.id ? "rgba(124,58,237,0.15)" : "transparent",
            color: abaTarefa===a.id ? "#a78bfa" : "#555",
            border: `1px solid ${abaTarefa===a.id ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.06)"}`,
            transition:"all 0.15s",
          }}>{a.label}</button>
        ))}
      </div>

      {/* ── ABA ROTINA ── */}
      {abaTarefa==="rotina" && (
        <div>
          <div style={{...card,padding:"16px",marginBottom:"16px",background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.15)"}}>
            <div style={{fontSize:"14px",color:"#a78bfa",fontWeight:"600",marginBottom:"6px"}}>💡 O que é a Rotina?</div>
            <div style={{fontSize:"13px",color:"#666",lineHeight:1.6}}>
              São tarefas que você faz <strong style={{color:"#888"}}>todo dia</strong> — como responder e-mails, fazer exercícios, tomar medicação. Salve aqui e copie para o dia com um clique.
            </div>
          </div>

          {/* Adicionar tarefa de rotina */}
          <div style={{display:"flex",gap:"8px",marginBottom:"16px"}}>
            <input placeholder="Ex: Responder e-mails, meditar 10min..." value={rotinaInput}
              onChange={e=>setRotinaInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addRotina()}
              style={{...inp,flex:1}}/>
            <select value={rotinaPrio} onChange={e=>setRotinaPrio(e.target.value)} style={{...inp,width:"auto",paddingRight:"8px"}}>
              <option value="alta">🔴 Alta</option>
              <option value="normal">🟡 Normal</option>
              <option value="baixa">⚪ Baixa</option>
            </select>
            <button onClick={addRotina} style={{...btnPurple,padding:"9px 16px"}}>+</button>
          </div>

          {rotina.length>0 && (
            <button onClick={copiarRotina} style={{
              width:"100%", padding:"12px", marginBottom:"16px", borderRadius:"12px",
              background:"linear-gradient(135deg,rgba(124,58,237,0.2),rgba(109,40,217,0.1))",
              border:"1px solid rgba(124,58,237,0.3)", color:"#a78bfa",
              fontSize:"13px", fontWeight:"600", cursor:"pointer", letterSpacing:"0.02em",
            }}>
              ▶ Copiar toda rotina para hoje ({rotina.length} tarefa{rotina.length>1?"s":""})
            </button>
          )}

          <div style={{display:"grid",gap:"6px"}}>
            {rotina.length===0 && (
              <div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"32px 0"}}>
                <div style={{fontSize:"32px",marginBottom:"10px"}}>🔄</div>
                Adicione suas tarefas de rotina acima
              </div>
            )}
            {rotina.map(r=>(
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:"10px",padding:"12px 16px",...card}}>
                <span style={{fontSize:"13px"}}>{prioIcon[r.prio]}</span>
                <span style={{flex:1,fontSize:"14px",color:"#e0e0e0"}}>{r.text}</span>
                <span style={{fontSize:"11px",color:prioColor[r.prio],background:`${prioColor[r.prio]}15`,borderRadius:"6px",padding:"2px 8px"}}>{prioLabel[r.prio]}</span>
                <button onClick={()=>setRotina(rotina.filter(x=>x.id!==r.id))}
                  style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"18px"}}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ABA HOJE ── */}
      {abaTarefa==="hoje" && (
        <div>
          {/* Input */}
          <div style={{display:"flex",gap:"8px",marginBottom:"20px"}}>
            <input placeholder="Nova tarefa..." value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&add()} style={{...inp,flex:1}}/>
            <select value={prio} onChange={e=>setPrio(e.target.value)} style={{...inp,width:"auto",paddingRight:"8px"}}>
              <option value="alta">🔴 Alta</option>
              <option value="normal">🟡 Normal</option>
              <option value="baixa">⚪ Baixa</option>
            </select>
            <button onClick={add} style={{...btnPurple,padding:"9px 16px"}}>+</button>
          </div>

          {/* Gráfico */}
          {tasks.length>0 && (
            <div style={{...card,padding:"16px",marginBottom:"20px",display:"flex",alignItems:"center",gap:"20px"}}>
              <div style={{width:"80px",height:"80px",flexShrink:0}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="valor" cx="50%" cy="50%" innerRadius={24} outerRadius={38} paddingAngle={4} startAngle={90} endAngle={-270}>
                      {statusData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:"22px",fontWeight:"700",color:"#f0f0f0",marginBottom:"2px"}}>{done}/{tasks.length}</div>
                <div style={{fontSize:"12px",color:"#555",marginBottom:"10px"}}>tarefas concluídas</div>
                <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"100px",height:"5px",overflow:"hidden"}}>
                  <div style={{background:"linear-gradient(90deg,#7c3aed,#34d399)",height:"100%",borderRadius:"100px",width:`${tasks.length>0?Math.round(done/tasks.length*100):0}%`,transition:"width 0.5s"}}/>
                </div>
              </div>
              {rotina.length>0 && (
                <button onClick={copiarRotina} title="Copiar rotina para hoje" style={{...btnGhost,flexShrink:0,padding:"8px 12px",fontSize:"12px",color:"#a78bfa",borderColor:"rgba(124,58,237,0.3)"}}>
                  🔄 Rotina
                </button>
              )}
            </div>
          )}

          {/* Filtros */}
          <div style={{display:"flex",gap:"6px",marginBottom:"16px",flexWrap:"wrap"}}>
            {["todas","pendentes","concluídas"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{
                background: filter===f ? "rgba(124,58,237,0.15)" : "transparent",
                color: filter===f ? "#a78bfa" : "#555",
                border: `1px solid ${filter===f?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.06)"}`,
                borderRadius:"20px", padding:"5px 16px", fontSize:"12px", cursor:"pointer",
                textTransform:"capitalize", fontWeight: filter===f?"600":"400", transition:"all 0.15s",
              }}>{f}</button>
            ))}
            <span style={{marginLeft:"auto",fontSize:"12px",color:"#444",alignSelf:"center"}}>{done}/{tasks.length} concluídas</span>
          </div>

          <div style={{display:"grid",gap:"6px"}}>
            {visible.length===0 && <div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"32px"}}>Nenhuma tarefa</div>}
            {visible.map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 16px",...card,opacity:t.done?0.5:1,transition:"opacity 0.2s"}}>
                <button onClick={()=>setTasks(tasks.map(x=>x.id===t.id?{...x,done:!x.done,doneAt:!x.done?Date.now():null}:x))} style={{
                  width:"20px",height:"20px",borderRadius:"50%",flexShrink:0,cursor:"pointer",
                  border:`2px solid ${t.done?"#7c3aed":"#2a2a2a"}`,
                  background:t.done?"#7c3aed":"transparent",
                  display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:"11px",
                }}>{t.done?"✓":""}</button>
                <span style={{fontSize:"14px"}}>{prioIcon[t.prio]}</span>
                <span style={{flex:1,fontSize:"14px",color:"#f0f0f0",textDecoration:t.done?"line-through":"none",lineHeight:1.4}}>{t.text}</span>
                {t.deRotina && <span style={{fontSize:"10px",color:"#555",background:"rgba(255,255,255,0.04)",borderRadius:"4px",padding:"1px 6px"}}>rotina</span>}
                <span style={{fontSize:"11px",color:"#444",flexShrink:0}}>{t.created}</span>
                <button onClick={()=>setTasks(tasks.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"18px",padding:"0 2px"}}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{marginTop:"20px"}}>
        <IAWidget
          context={`Total de tarefas: ${tasks.length}\nConcluídas: ${done}\nPendentes: ${pending}\nRotina: ${rotina.length} tarefas\nTarefas pendentes:\n${tasks.filter(t=>!t.done).map(t=>`- [${t.prio}] ${t.text}`).join("\n")}`}
          systemPrompt="Você é um assistente de produtividade pessoal. Analise as tarefas do usuário, sugira prioridades, identifique o que está acumulado e dê dicas práticas de organização e foco. Seja motivador e objetivo. Responda em português brasileiro. Máximo 200 palavras."
          placeholder="Ex: Quais tarefas devo focar hoje?"
        />
      </div>
    </div>
  );
}

// ── HÁBITOS ───────────────────────────────────────────────────────────────────
function Habitos() {
  const [habits,setHabits] = useStorage("habits:list",[]);
  const [checks,setChecks] = useStorage("habits:checks",{});
  const [form,setForm]     = useState({name:"",emoji:"⭐",meta:""});
  const [showForm,setShowForm] = useState(false);
  const [editId,setEditId] = useState(null);
  const emojis = ["⭐","💧","📚","🏋️","🧘","🍎","😴","✍️","🚶","🎯","💊","🧠","🎸","🏊","🚴","🥗","☕","🌿","💪","🏃"];

  const sugestoesMeta = {
    "💧":"Ex: 3 litros por dia",
    "🚶":"Ex: 8.000 a 10.000 passos ou 40–60 min caminhando",
    "🏃":"Ex: 5km ou 30 minutos por dia",
    "🏋️":"Ex: 3x por semana, 45 minutos",
    "📚":"Ex: 30 minutos de leitura por dia",
    "🧘":"Ex: 15 minutos de meditação pela manhã",
    "🍎":"Ex: 5 porções de frutas/legumes por dia",
    "😴":"Ex: Dormir às 22h, acordar às 6h",
    "✍️":"Ex: Escrever 1 página por dia",
    "🏊":"Ex: 1km nadando, 3x por semana",
    "🚴":"Ex: 30 minutos de bike todo dia",
    "💊":"Ex: Tomar o remédio sempre após o café",
    "☕":"Ex: Máximo 2 cafés por dia",
  };

  const days = Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-6+i);
    return {key:`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,label:["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()],isToday:i===6};
  });

  const streak=(hid)=>{let s=0;for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=`${hid}-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;if(checks[k])s++;else if(i>0)break;/* i===0 é hoje: não marcado ainda não quebra streak */}return s;};

  const addHabit=()=>{
    if(!form.name.trim()) return;
    if(editId){
      setHabits(habits.map(h=>h.id===editId?{...h,name:form.name.trim(),emoji:form.emoji,meta:form.meta}:h));
      setEditId(null);
    } else {
      setHabits([...habits,{id:Date.now(),name:form.name.trim(),emoji:form.emoji,meta:form.meta}]);
    }
    setForm({name:"",emoji:"⭐",meta:""});
    setShowForm(false);
  };

  const startEdit=(h)=>{
    setForm({name:h.name,emoji:h.emoji,meta:h.meta||""});
    setEditId(h.id);
    setShowForm(true);
  };

  // Dados gráfico: taxa de conclusão por hábito nos últimos 7 dias
  const chartData = days.map(d=>({
    name:d.label,
    concluídos: habits.filter(h=>checks[`${h.id}-${d.key}`]).length,
    total: habits.length,
  }));

  // Radar de streaks
  const streakData = habits.map(h=>({name:h.emoji+" "+h.name.slice(0,8),streak:streak(h)}));

  return (
    <div>
      {/* Botão abrir form */}
      {!showForm && (
        <button onClick={()=>{setEditId(null);setForm({name:"",emoji:"⭐",meta:""});setShowForm(true);}} style={{
          ...btnPurple,padding:"10px 20px",fontSize:"14px",marginBottom:"20px",
          display:"flex",alignItems:"center",gap:"8px",
        }}>
          <span style={{fontSize:"18px"}}>+</span> Novo hábito
        </button>
      )}

      {/* Formulário expandido */}
      {showForm && (
        <div style={{...card,padding:"20px",marginBottom:"24px",display:"grid",gap:"14px"}}>
          <div style={{fontSize:"15px",fontWeight:"700",color:"#f0f0f0",marginBottom:"2px"}}>
            {editId?"Editar hábito":"Novo hábito"}
          </div>

          {/* Emoji picker */}
          <div>
            <div style={{fontSize:"12px",color:"#555",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"8px"}}>Ícone</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
              {emojis.map(e=>(
                <button key={e} onClick={()=>setForm({...form,emoji:e})} style={{
                  width:"36px",height:"36px",borderRadius:"9px",border:"none",cursor:"pointer",
                  fontSize:"18px",background:form.emoji===e?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.04)",
                  outline:form.emoji===e?"2px solid #7c3aed":"none",transition:"all 0.12s",
                }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div>
            <div style={{fontSize:"12px",color:"#555",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"8px"}}>Nome do hábito</div>
            <input placeholder="Ex: Beber água, Caminhar, Leitura..." value={form.name}
              onChange={e=>setForm({...form,name:e.target.value})}
              onKeyDown={e=>e.key==="Enter"&&addHabit()}
              style={{...inp}}/>
          </div>

          {/* Meta personalizada */}
          <div>
            <div style={{fontSize:"12px",color:"#555",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"8px"}}>
              Meta diária <span style={{color:"#333",fontWeight:"400",textTransform:"none",letterSpacing:"0"}}>(opcional)</span>
            </div>
            <textarea
              placeholder={sugestoesMeta[form.emoji] || "Ex: 30 minutos por dia, 3x por semana..."}
              value={form.meta}
              onChange={e=>setForm({...form,meta:e.target.value})}
              rows={2}
              style={{...inp,resize:"vertical",minHeight:"60px",lineHeight:"1.5"}}
            />
            {sugestoesMeta[form.emoji] && !form.meta && (
              <div style={{marginTop:"6px",display:"flex",alignItems:"center",gap:"6px"}}>
                <span style={{fontSize:"11px",color:"#444"}}>Sugestão:</span>
                <button onClick={()=>setForm({...form,meta:sugestoesMeta[form.emoji]})} style={{
                  fontSize:"11px",color:"#7c3aed",background:"rgba(124,58,237,0.08)",
                  border:"1px solid rgba(124,58,237,0.2)",borderRadius:"6px",
                  padding:"2px 10px",cursor:"pointer",fontFamily:"inherit",
                }}>
                  Usar: {sugestoesMeta[form.emoji]}
                </button>
              </div>
            )}
          </div>

          {/* Botões */}
          <div style={{display:"flex",gap:"8px"}}>
            <button onClick={addHabit} style={{...btnPurple,padding:"10px 20px",fontSize:"14px",flex:1}}>
              {editId?"Salvar":"Criar hábito"}
            </button>
            <button onClick={()=>{setShowForm(false);setEditId(null);setForm({name:"",emoji:"⭐",meta:""});}} style={{
              ...btnGhost,padding:"10px 16px",fontSize:"14px",
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Gráfico de conclusões por dia */}
      {habits.length>0 && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
          <div style={{...card,padding:"16px"}}>
            <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"12px"}}>HÁBITOS FEITOS/DIA</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={chartData} barSize={20} margin={{top:0,right:0,bottom:0,left:0}}>
                <XAxis dataKey="name" tick={{fill:"#555",fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis hide domain={[0,Math.max(habits.length,1)]}/>
                <Tooltip content={<DarkTooltip prefix=""/>}/>
                <Bar dataKey="concluídos" fill="#7c3aed" radius={[4,4,0,0]}>
                  {chartData.map((_,i)=>(
                    <Cell key={i} fill={i===6?"#a78bfa":"#7c3aed"}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{...card,padding:"16px"}}>
            <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"12px"}}>SEQUÊNCIA ATUAL 🔥</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={streakData} layout="vertical" barSize={10} margin={{top:0,right:10,bottom:0,left:0}}>
                <XAxis type="number" hide domain={[0,7]}/>
                <YAxis type="category" dataKey="name" tick={{fill:"#555",fontSize:9}} axisLine={false} tickLine={false} width={70}/>
                <Tooltip content={<DarkTooltip prefix=""/>}/>
                <Bar dataKey="streak" fill="#e67e22" radius={[0,4,4,0]}>
                  {streakData.map((d,i)=>(
                    <Cell key={i} fill={d.streak>=7?"#fcd34d":d.streak>=3?"#fb923c":"#7c3aed"}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {habits.length>0 && (
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 6px"}}>
            <thead>
              <tr>
                <th style={{textAlign:"left",fontSize:"11px",color:"#555",fontWeight:"500",paddingBottom:"8px",paddingLeft:"4px"}}>HÁBITO</th>
                {days.map(d=><th key={d.key} style={{fontSize:"10px",color:d.isToday?"#a78bfa":"#444",fontWeight:d.isToday?"700":"400",textAlign:"center",paddingBottom:"8px",minWidth:"36px"}}>{d.label}</th>)}
                <th style={{fontSize:"10px",color:"#444",textAlign:"center",paddingBottom:"8px"}}>🔥</th><th/>
              </tr>
            </thead>
            <tbody>
              {habits.map(h=>(
                <tr key={h.id}>
                  <td style={{padding:"10px 14px 10px 4px",background:"#1a1a1a",borderRadius:"10px 0 0 10px",border:"1px solid #222",borderRight:"none"}}>
                    <div style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0",whiteSpace:"nowrap"}}>{h.emoji} {h.name}</div>
                    {h.meta && <div style={{fontSize:"11px",color:"#555",marginTop:"2px",maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={h.meta}>🎯 {h.meta}</div>}
                  </td>
                  {days.map(d=>{const k=`${h.id}-${d.key}`;const done=checks[k];return(
                    <td key={d.key} style={{background:"#1a1a1a",textAlign:"center",padding:"10px 4px",border:"1px solid #222",borderLeft:"none",borderRight:"none"}}>
                      <button onClick={()=>setChecks({...checks,[k]:!checks[k]})}
                        style={{width:"24px",height:"24px",borderRadius:"50%",border:`2px solid ${done?"#7c3aed":"#333"}`,background:done?"#7c3aed":"transparent",cursor:"pointer",fontSize:"11px",color:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",boxShadow:done?"0 1px 6px rgba(124,58,237,0.4)":"none"}}>
                        {done?"✓":""}
                      </button>
                    </td>
                  );})}
                  <td style={{background:"#1a1a1a",textAlign:"center",fontSize:"12px",fontWeight:"600",color:"#e67e22",padding:"10px 8px",border:"1px solid #222",borderLeft:"none",borderRight:"none"}}>{streak(h.id)}</td>
                  <td style={{background:"#1a1a1a",borderRadius:"0 10px 10px 0",padding:"10px 10px 10px 4px",border:"1px solid #222",borderLeft:"none"}}>
                    <div style={{display:"flex",gap:"4px"}}>
                      <button onClick={()=>startEdit(h)} style={{background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:"13px"}} title="Editar">✏️</button>
                      <button onClick={()=>setHabits(habits.filter(x=>x.id!==h.id))} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"16px"}}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {habits.length===0&&<div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"32px"}}>Adicione seus hábitos diários</div>}

      <IAWidget
        context={`Hábitos cadastrados: ${habits.length}\n${habits.map(h=>{const s=streak(h);const feitos=days.filter(d=>checks[`${h.id}-${d.key}`]).length;return `- ${h.emoji} ${h.name}: ${feitos}/7 dias esta semana, sequência atual: ${s} dias`;}).join("\n")}`}
        systemPrompt="Você é um coach de hábitos e bem-estar. Analise os hábitos do usuário, identifique quais estão indo bem e quais precisam de atenção, e dê dicas motivacionais e práticas para melhorar a consistência. Seja encorajador, específico e use os dados reais. Responda em português brasileiro. Máximo 200 palavras."
        placeholder="Ex: Como melhorar minha consistência nos hábitos?"
      />
    </div>
  );
}

// ── METAS ─────────────────────────────────────────────────────────────────────
function Metas() {
  const PRAZOS = [
    {id:"curto",  label:"Curto prazo",  desc:"Até 1 mês",   color:"#34d399", emoji:"⚡"},
    {id:"medio",  label:"Médio prazo",  desc:"1 a 6 meses", color:"#f59e0b", emoji:"🎯"},
    {id:"longo",  label:"Longo prazo",  desc:"6+ meses",    color:"#a855f7", emoji:"🚀"},
  ];

  const [goals,setGoals] = useStorage("goals:list",[]);
  const [form,setForm]   = useState({title:"",desc:"",progress:0,target:100,unit:"%",photo:"",deadline:"",checklist:[],prazo:"medio"});
  const [showForm,setShowForm] = useState(false);
  const [editing,setEditing]   = useState(null);
  const [expanded,setExpanded] = useState(null);
  const [checkInput,setCheckInput] = useState("");
  const [filtroPrazo,setFiltroPrazo] = useState("todos");

  const pct = (g) => {
    if (g.checklist?.length>0) {
      return Math.round((g.checklist.filter(c=>c.done).length/g.checklist.length)*100);
    }
    return Math.min(100, Math.round((g.progress/g.target)*100));
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({...f, photo: ev.target.result}));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const addCheckItem = () => {
    if (!checkInput.trim()) return;
    setForm(f=>({...f, checklist:[...f.checklist,{id:Date.now(),text:checkInput.trim(),done:false}]}));
    setCheckInput("");
  };

  const add = () => {
    if (!form.title) return;
    const goal = {
      ...form,
      progress: form.checklist.length>0 ? form.checklist.filter(c=>c.done).length : Number(form.progress),
      target:   form.checklist.length>0 ? form.checklist.length : Number(form.target),
    };
    if (editing !== null) {
      setGoals(goals.map(g => g.id===editing ? {...g,...goal} : g));
      setEditing(null);
    } else {
      setGoals([...goals, {id:Date.now(),...goal,created:new Date().toLocaleDateString("pt-BR")}]);
    }
    setForm({title:"",desc:"",progress:0,target:100,unit:"%",photo:"",deadline:"",checklist:[]});
    setShowForm(false);
  };

  const openEdit = (g) => {
    setForm({title:g.title,desc:g.desc||"",progress:g.progress,target:g.target,unit:g.unit,photo:g.photo||"",deadline:g.deadline||"",checklist:g.checklist||[],prazo:g.prazo||"medio"});
    setEditing(g.id);
    setShowForm(true);
  };

  const updatePhoto    = (id, photo)    => setGoals(goals.map(g => g.id===id ? {...g,photo} : g));
  const toggleCheck    = (goalId, checkId) => setGoals(goals.map(g => {
    if (g.id!==goalId) return g;
    const newList = g.checklist.map(c=>c.id===checkId?{...c,done:!c.done}:c);
    return {...g, checklist:newList, progress:newList.filter(c=>c.done).length, target:newList.length};
  }));
  const deleteCheck    = (goalId, checkId) => setGoals(goals.map(g => g.id!==goalId?g:{...g,checklist:g.checklist.filter(c=>c.id!==checkId)}));

  const totalMetas     = goals.length;
  const metasConcluidas= goals.filter(g=>pct(g)>=100).length;
  const pieData        = [
    {name:"Concluídas",valor:metasConcluidas,color:"#34d399"},
    {name:"Em andamento",valor:totalMetas-metasConcluidas,color:"#7c3aed"},
  ].filter(d=>d.valor>0);

  // Dias restantes até deadline
  const diasRestantes = (deadline) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline+"T00:00:00")-new Date())/86400000);
    return diff;
  };

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
        <div style={{fontSize:"14px",fontWeight:"600",color:"#888"}}>
          {goals.length} meta{goals.length!==1?"s":""}
          {metasConcluidas>0 && <span style={{color:"#34d399",marginLeft:"8px"}}>· {metasConcluidas} concluída{metasConcluidas!==1?"s":""}</span>}
        </div>
        <button onClick={()=>{setShowForm(!showForm);setEditing(null);setForm({title:"",desc:"",progress:0,target:100,unit:"%",photo:"",deadline:"",checklist:[],prazo:"medio"});setCheckInput("");}} style={btnPurple}>
          {showForm&&!editing?"✕ Fechar":"+ Nova Meta"}
        </button>
      </div>

      {/* Cards resumo por prazo */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"20px"}}>
        {PRAZOS.map(p=>{
          const count = goals.filter(g=>(g.prazo||"medio")===p.id).length;
          const conc  = goals.filter(g=>(g.prazo||"medio")===p.id&&pct(g)>=100).length;
          return (
            <button key={p.id} onClick={()=>setFiltroPrazo(filtroPrazo===p.id?"todos":p.id)} style={{
              ...card, padding:"12px 14px", textAlign:"left", cursor:"pointer",
              background: filtroPrazo===p.id?`${p.color}14`:"#111",
              borderColor: filtroPrazo===p.id?`${p.color}50`:"rgba(255,255,255,0.06)",
              transition:"all 0.15s",
            }}>
              <div style={{fontSize:"18px",marginBottom:"5px"}}>{p.emoji}</div>
              <div style={{fontSize:"11px",fontWeight:"700",color:p.color,marginBottom:"2px"}}>{p.label}</div>
              <div style={{fontSize:"10px",color:"#555"}}>{count} meta{count!==1?"s":""}{conc>0?` · ${conc} ✓`:""}</div>
            </button>
          );
        })}
      </div>

      {/* Form nova meta */}
      {showForm && (
        <div style={{...card,padding:"20px",marginBottom:"20px",display:"grid",gap:"14px"}}>

          {/* Photo picker */}
          <label style={{display:"block",cursor:"pointer"}}>
            <div style={{
              height: form.photo ? "190px" : "96px",
              borderRadius:"14px",
              border:`2px dashed ${form.photo?"transparent":"rgba(124,58,237,0.35)"}`,
              background: form.photo ? "#000" : "rgba(124,58,237,0.06)",
              overflow:"hidden",position:"relative",
              display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.3s",
            }}>
              {form.photo ? (
                <>
                  <img src={form.photo} alt="meta" style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.9}}/>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 50%)",display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:"14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"6px",background:"rgba(255,255,255,0.15)",backdropFilter:"blur(8px)",borderRadius:"20px",padding:"6px 14px",fontSize:"12px",color:"#fff",fontWeight:"500"}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      Trocar foto
                    </div>
                  </div>
                </>
              ) : (
                <div style={{textAlign:"center",padding:"8px"}}>
                  <div style={{width:"42px",height:"42px",borderRadius:"50%",background:"rgba(124,58,237,0.12)",border:"1px solid rgba(124,58,237,0.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                  <div style={{fontSize:"13px",color:"#a78bfa",fontWeight:"500",marginBottom:"3px"}}>Adicionar foto da meta</div>
                  <div style={{fontSize:"11px",color:"#444"}}>Toque para escolher da galeria</div>
                </div>
              )}
            </div>
            <input type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}}/>
          </label>

          {/* Meta principal */}
          <div>
            <div style={{...lbl,marginBottom:"6px"}}>🎯 Qual é sua meta?</div>
            <input placeholder="Ex: Bater 1k de seguidores, comprar um carro..." value={form.title}
              onChange={e=>setForm({...form,title:e.target.value})} style={{...inp,fontSize:"15px",fontWeight:"500"}}/>
          </div>

          <input placeholder="Descrição (opcional)" value={form.desc}
            onChange={e=>setForm({...form,desc:e.target.value})} style={inp}/>

          {/* Tipo de prazo */}
          <div>
            <div style={{...lbl,marginBottom:"10px"}}>⏱ Tipo de prazo</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
              {PRAZOS.map(p=>(
                <button key={p.id} onClick={()=>setForm({...form,prazo:p.id})}
                  style={{
                    padding:"12px 8px", borderRadius:"12px", cursor:"pointer",
                    background: form.prazo===p.id?`${p.color}18`:"rgba(255,255,255,0.03)",
                    border:`1px solid ${form.prazo===p.id?p.color+"55":"rgba(255,255,255,0.06)"}`,
                    color: form.prazo===p.id?p.color:"#555",
                    transition:"all 0.15s", display:"flex", flexDirection:"column", alignItems:"center", gap:"5px",
                  }}>
                  <span style={{fontSize:"20px"}}>{p.emoji}</span>
                  <span style={{fontSize:"12px",fontWeight:"600"}}>{p.label}</span>
                  <span style={{fontSize:"10px",opacity:0.7}}>{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Data limite */}
          <div>
            <div style={{...lbl,marginBottom:"6px"}}>📅 Data limite (opcional)</div>
            <input type="date" value={form.deadline}
              onChange={e=>setForm({...form,deadline:e.target.value})} style={inp}/>
          </div>

          {/* Checklist OU progresso numérico */}
          <div style={{...card,padding:"16px",background:"rgba(255,255,255,0.02)"}}>
            <div style={{fontSize:"13px",fontWeight:"600",color:"#e0e0e0",marginBottom:"12px"}}>📋 Checklist de etapas</div>
            <div style={{fontSize:"12px",color:"#555",marginBottom:"12px",lineHeight:1.5}}>
              Divida sua meta em etapas. O progresso será calculado automaticamente conforme você conclui cada item.
            </div>

            {/* Itens do checklist */}
            <div style={{display:"grid",gap:"6px",marginBottom:"10px"}}>
              {form.checklist.map((c,i)=>(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:"8px",background:"rgba(255,255,255,0.03)",borderRadius:"8px",padding:"8px 12px"}}>
                  <div style={{width:"16px",height:"16px",borderRadius:"50%",border:"2px solid #333",flexShrink:0}}/>
                  <span style={{flex:1,fontSize:"13px",color:"#c0c0c0"}}>{c.text}</span>
                  <button onClick={()=>setForm(f=>({...f,checklist:f.checklist.filter(x=>x.id!==c.id)}))}
                    style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"16px"}}>×</button>
                </div>
              ))}
            </div>

            <div style={{display:"flex",gap:"8px"}}>
              <input placeholder="Adicionar etapa... (ex: Postar 3x por semana)" value={checkInput}
                onChange={e=>setCheckInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&(e.preventDefault(),addCheckItem())}
                style={{...inp,flex:1,fontSize:"13px"}}/>
              <button onClick={addCheckItem} style={{...btnPurple,padding:"9px 14px"}}>+</button>
            </div>
          </div>

          {/* Progresso manual (só se não tiver checklist) */}
          {form.checklist.length===0 && (
            <div>
              <div style={{...lbl,marginBottom:"6px"}}>Progresso manual</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 80px",gap:"10px"}}>
                <input placeholder="Progresso atual" type="number" value={form.progress}
                  onChange={e=>setForm({...form,progress:e.target.value})} style={inp}/>
                <input placeholder="Meta total" type="number" value={form.target}
                  onChange={e=>setForm({...form,target:e.target.value})} style={inp}/>
                <input placeholder="Unid." value={form.unit}
                  onChange={e=>setForm({...form,unit:e.target.value})} style={inp}/>
              </div>
            </div>
          )}

          <button onClick={add} style={{...btnPurple,padding:"12px",fontSize:"14px"}}>
            {editing ? "Salvar alterações" : "Adicionar Meta"}
          </button>
        </div>
      )}

      {/* Lista de metas */}
      <div style={{display:"grid",gap:"14px"}}>
        {goals.length===0 && (
          <div style={{textAlign:"center",color:"#444",fontSize:"14px",padding:"40px 0"}}>
            <div style={{fontSize:"40px",marginBottom:"12px"}}>🎯</div>
            Defina sua primeira meta!<br/>
            <span style={{fontSize:"12px",color:"#333"}}>Use o checklist para dividir em etapas menores</span>
          </div>
        )}

        {goals.filter(g=>filtroPrazo==="todos"||(g.prazo||"medio")===filtroPrazo).map(g => {
          const p    = pct(g);
          const isOpen = expanded===g.id;
          const dias   = diasRestantes(g.deadline);
          const temChecklist = g.checklist?.length>0;
          const prazoInfo = PRAZOS.find(pr=>pr.id===(g.prazo||"medio")) || PRAZOS[1];

          return (
            <div key={g.id} style={{...card,overflow:"hidden",transition:"all 0.2s",borderColor:p>=100?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.06)"}}>

              {/* Foto de capa */}
              {g.photo && (
                <div style={{position:"relative",height:"160px",overflow:"hidden"}}>
                  <img src={g.photo} alt={g.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,0) 30%,rgba(13,6,30,0.96) 100%)"}}/>
                  {p>=100 && <div style={{position:"absolute",top:"12px",right:"12px",background:"rgba(52,211,153,0.9)",backdropFilter:"blur(8px)",borderRadius:"20px",padding:"4px 12px",fontSize:"11px",fontWeight:"700",color:"#fff",letterSpacing:"0.06em"}}>✓ CONCLUÍDA</div>}
                  <div style={{position:"absolute",top:"12px",left:"12px",background:`${prazoInfo.color}cc`,backdropFilter:"blur(8px)",borderRadius:"20px",padding:"3px 10px",fontSize:"10px",fontWeight:"600",color:"#fff"}}>
                    {prazoInfo.emoji} {prazoInfo.label}
                  </div>
                  <div style={{position:"absolute",bottom:"14px",left:"16px",right:"16px"}}>
                    <div style={{fontSize:"17px",fontWeight:"700",color:"#fff",marginBottom:"6px",textShadow:"0 1px 8px rgba(0,0,0,0.5)"}}>{g.title}</div>
                    <div style={{background:"rgba(255,255,255,0.15)",backdropFilter:"blur(4px)",borderRadius:"100px",height:"5px",overflow:"hidden"}}>
                      <div style={{background:p>=100?"#34d399":"linear-gradient(90deg,#a855f7,#c084fc)",height:"100%",borderRadius:"100px",width:`${p}%`,transition:"width 0.6s"}}/>
                    </div>
                  </div>
                </div>
              )}

              {/* Conteúdo */}
              <div style={{padding:"14px 16px"}}>
                {!g.photo && (
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"4px"}}>
                        <span style={{fontSize:"14px"}}>{prazoInfo.emoji}</span>
                        <span style={{fontSize:"10px",color:prazoInfo.color,fontWeight:"600"}}>{prazoInfo.label}</span>
                      </div>
                      <div style={{fontSize:"15px",fontWeight:"600",color:"#f0f0f0",marginBottom:"3px"}}>{g.title}</div>
                      {g.desc && <div style={{fontSize:"12px",color:"#555",marginTop:"2px"}}>{g.desc}</div>}
                    </div>
                    {p>=100 && <span style={{fontSize:"10px",background:"rgba(52,211,153,0.15)",color:"#34d399",borderRadius:"20px",padding:"3px 10px",border:"1px solid rgba(52,211,153,0.3)",flexShrink:0,marginLeft:"10px"}}>CONCLUÍDA</span>}
                  </div>
                )}

                {g.photo && g.desc && <div style={{fontSize:"12px",color:"#555",marginBottom:"10px"}}>{g.desc}</div>}

                {/* Deadline badge */}
                {dias!==null && (
                  <div style={{
                    display:"inline-flex",alignItems:"center",gap:"5px",marginBottom:"10px",
                    fontSize:"11px",fontWeight:"600",padding:"3px 10px",borderRadius:"20px",
                    background: dias<0?"rgba(248,113,113,0.1)":dias<=7?"rgba(251,146,60,0.1)":"rgba(255,255,255,0.05)",
                    color:dias<0?"#f87171":dias<=7?"#fb923c":"#555",
                    border:`1px solid ${dias<0?"rgba(248,113,113,0.2)":dias<=7?"rgba(251,146,60,0.2)":"rgba(255,255,255,0.06)"}`,
                  }}>
                    📅 {dias<0?`Prazo expirado há ${Math.abs(dias)}d`:dias===0?"Prazo hoje!":dias===1?"Amanhã é o prazo":`${dias} dias restantes`}
                  </div>
                )}

                {/* Barra de progresso */}
                {!g.photo && (
                  <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"100px",height:"5px",overflow:"hidden",marginBottom:"8px"}}>
                    <div style={{background:p>=100?"#34d399":"linear-gradient(90deg,#7c3aed,#a855f7)",height:"100%",borderRadius:"100px",width:`${p}%`,transition:"width 0.5s",boxShadow:p>0?"0 0 8px rgba(124,58,237,0.4)":"none"}}/>
                  </div>
                )}

                {/* Checklist preview */}
                {temChecklist && (
                  <div style={{display:"grid",gap:"5px",marginBottom:"10px"}}>
                    {(isOpen ? g.checklist : g.checklist.slice(0,3)).map(c=>(
                      <div key={c.id} style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer"}}
                        onClick={()=>toggleCheck(g.id,c.id)}>
                        <div style={{
                          width:"16px",height:"16px",borderRadius:"50%",flexShrink:0,
                          border:`2px solid ${c.done?"#7c3aed":"#333"}`,
                          background:c.done?"#7c3aed":"transparent",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:"9px",color:"#fff",transition:"all 0.2s",
                        }}>{c.done?"✓":""}</div>
                        <span style={{fontSize:"13px",color:c.done?"#555":"#c0c0c0",textDecoration:c.done?"line-through":"none",transition:"all 0.2s"}}>{c.text}</span>
                      </div>
                    ))}
                    {!isOpen && g.checklist.length>3 && (
                      <div style={{fontSize:"11px",color:"#555",marginLeft:"24px"}}>+{g.checklist.length-3} etapas</div>
                    )}
                  </div>
                )}

                {/* Stats + ações */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"6px"}}>
                  <div style={{fontSize:"12px",color:"#555",display:"flex",gap:"10px",alignItems:"center"}}>
                    <span style={{color:p>=100?"#34d399":p>=50?"#a78bfa":"#888",fontWeight:"700",fontSize:"14px"}}>{p}%</span>
                    {temChecklist
                      ? <span>{g.checklist.filter(c=>c.done).length}/{g.checklist.length} etapas</span>
                      : <span>{g.progress} / {g.target} {g.unit}</span>
                    }
                  </div>
                  <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                    <button onClick={()=>setExpanded(isOpen?null:g.id)}
                      style={{...btnGhost,padding:"4px 10px",fontSize:"11px",color:isOpen?"#a78bfa":"#555",borderColor:isOpen?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.06)"}}>
                      {isOpen?"▲ Menos":"▼ Mais"}
                    </button>
                    <label style={{cursor:"pointer"}}>
                      <div style={{...btnGhost,padding:"4px 10px",fontSize:"11px",display:"inline-block"}}>📷</div>
                      <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                        const file=e.target.files[0]; if(!file) return;
                        const r=new FileReader(); r.onload=ev=>updatePhoto(g.id,ev.target.result); r.readAsDataURL(file); e.target.value="";
                      }}/>
                    </label>
                    <button onClick={()=>openEdit(g)} style={{...btnGhost,padding:"4px 10px",fontSize:"11px"}}>editar</button>
                    <button onClick={()=>setGoals(goals.filter(x=>x.id!==g.id))} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"18px",padding:"0 2px"}}>×</button>
                  </div>
                </div>

                {/* Expandido */}
                {isOpen && (
                  <div style={{marginTop:"14px",paddingTop:"14px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                    {/* Todos os checks */}
                    {temChecklist && (
                      <div style={{marginBottom:"12px"}}>
                        <div style={{...lbl,marginBottom:"10px"}}>Etapas do checklist</div>
                        <div style={{display:"grid",gap:"6px"}}>
                          {g.checklist.map(c=>(
                            <div key={c.id} style={{display:"flex",alignItems:"center",gap:"8px",background:"rgba(255,255,255,0.02)",borderRadius:"8px",padding:"8px 12px"}}>
                              <div style={{width:"18px",height:"18px",borderRadius:"50%",flexShrink:0,cursor:"pointer",
                                border:`2px solid ${c.done?"#7c3aed":"#333"}`,background:c.done?"#7c3aed":"transparent",
                                display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",color:"#fff",transition:"all 0.2s",
                              }} onClick={()=>toggleCheck(g.id,c.id)}>{c.done?"✓":""}</div>
                              <span style={{flex:1,fontSize:"13px",color:c.done?"#555":"#d0d0d0",textDecoration:c.done?"line-through":"none"}}
                                onClick={()=>toggleCheck(g.id,c.id)}>{c.text}</span>
                              <button onClick={()=>deleteCheck(g.id,c.id)} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"15px"}}>×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Progresso manual quando não tem checklist */}
                    {!temChecklist && (
                      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
                        <div style={{...lbl,marginBottom:0,flexShrink:0}}>PROGRESSO</div>
                        <input type="number" value={g.progress}
                          onChange={e=>setGoals(goals.map(x=>x.id===g.id?{...x,progress:Number(e.target.value)}:x))}
                          style={{...inp,flex:1,padding:"6px 10px",fontSize:"13px"}}/>
                        <span style={{fontSize:"12px",color:"#555",flexShrink:0}}>/ {g.target} {g.unit}</span>
                      </div>
                    )}

                    {g.created && <div style={{fontSize:"11px",color:"#333"}}>Criada em {g.created}</div>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{marginTop:"20px"}}>
        <IAWidget
          context={`Metas cadastradas: ${goals.length}\n${goals.map(g=>`- "${g.title}": ${pct(g)}% ${g.deadline?`(prazo: ${g.deadline})`:""}${g.checklist?.length>0?` [checklist: ${g.checklist.filter(c=>c.done).length}/${g.checklist.length}]`:""} ${pct(g)>=100?"[CONCLUÍDA]":"[EM ANDAMENTO]"}`).join("\n")}`}
          systemPrompt="Você é um coach de metas pessoais. Analise o progresso das metas do usuário, celebre conquistas, identifique o que está travado e sugira estratégias práticas para avançar. Seja motivador e específico. Responda em português brasileiro. Máximo 200 palavras."
          placeholder="Ex: Como posso avançar mais rápido nas minhas metas?"
        />
      </div>
    </div>
  );
}

// ── TREINO SPLIT ─────────────────────────────────────────────────────────────
const DIAS_PT = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const DIAS_CURTO = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const OPCOES_TREINO = [
  {emoji:"💪", label:"Musculação",      cor:"#a855f7"},
  {emoji:"🏃", label:"Cardio",          cor:"#f97316"},
  {emoji:"🔥", label:"HIIT",            cor:"#ef4444"},
  {emoji:"🧘", label:"Yoga",            cor:"#34d399"},
  {emoji:"🚴", label:"Bike",            cor:"#60a5fa"},
  {emoji:"🏊", label:"Natação",         cor:"#06b6d4"},
  {emoji:"⚽", label:"Esporte",         cor:"#f59e0b"},
  {emoji:"🛋️", label:"Descanso",        cor:"#333"},
];
const MUSCULOS = ["Peito","Costas","Ombros","Bíceps","Tríceps","Pernas","Glúteos","Abdômen","Full Body"];
const COR_TIPO = (t) => OPCOES_TREINO.find(o=>o.label===t)?.cor || "#7c3aed";
const EMOJI_TIPO = (t) => OPCOES_TREINO.find(o=>o.label===t)?.emoji || "💪";

// Estrutura de um bloco de treino:
// { id, tipo, musculo, detalhe, exercicios:[] }

function TreinoSplit() {
  // split[diaIndex] = [bloco, bloco, ...]
  const [split,  setSplit]  = useStorage("treino:split2", {});
  const [pesos,  setPesos]  = useStorage("treino:pesos",  []);
  const [metaPeso,  setMetaPeso]  = useStorage("treino:metaPeso", null);
  const [alturaUser, setAlturaUser] = useStorage("treino:altura", null); // em cm
  const [editando,  setEditando]  = useState(null);
  const [novoExerc, setNovoExerc] = useState({});
  const [novoPeso,     setNovoPeso]     = useState("");
  const [novaMetaPeso, setNovaMetaPeso] = useState("");
  const [novaAltura,   setNovaAltura]   = useState("");
  const [editMeta,    setEditMeta]    = useState(false);
  const [editAltura,  setEditAltura]  = useState(false);
  const diaHoje = new Date().getDay();

  const blocosDia = (i) => split[i] || [];

  const addBloco = (i) => {
    const novo = {id: Date.now(), tipo:"", musculo:"", detalhe:"", exercicios:[]};
    setSplit(s=>({...s, [i]: [...(s[i]||[]), novo]}));
  };
  const delBloco = (i, blocoId) =>
    setSplit(s=>({...s, [i]: (s[i]||[]).filter(b=>b.id!==blocoId)}));
  const updateBloco = (i, blocoId, campo, val) =>
    setSplit(s=>({...s, [i]: (s[i]||[]).map(b=>b.id===blocoId?{...b,[campo]:val}:b)}));
  const addExerc = (i, blocoId) => {
    const txt = (novoExerc[blocoId]||"").trim();
    if (!txt) return;
    setSplit(s=>({...s, [i]: (s[i]||[]).map(b=>
      b.id===blocoId ? {...b, exercicios:[...(b.exercicios||[]),{id:Date.now(),nome:txt}]} : b
    )}));
    setNovoExerc(n=>({...n,[blocoId]:""}));
  };
  const delExerc = (i, blocoId, exercId) =>
    setSplit(s=>({...s, [i]: (s[i]||[]).map(b=>
      b.id===blocoId ? {...b, exercicios:(b.exercicios||[]).filter(e=>e.id!==exercId)} : b
    )}));

  const registrarPeso = () => {
    const kg = parseFloat(novoPeso);
    if (isNaN(kg) || kg < 20 || kg > 300) return;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const semHoje = pesos.filter(p=>p.data!==hoje);
    setPesos([...semHoje, {data:hoje, kg, ts:Date.now()}].sort((a,b)=>a.ts-b.ts));
    setNovoPeso("");
  };

  const salvarMeta = () => {
    const kg = parseFloat(novaMetaPeso);
    if (isNaN(kg) || kg < 20 || kg > 300) return;
    setMetaPeso(kg);
    setNovaMetaPeso("");
    setEditMeta(false);
  };

  const salvarAltura = () => {
    // usa novaAltura se preenchido, senão mantém alturaUser (usuário só clicou calcular sem mudar)
    const raw = novaAltura !== "" ? novaAltura : (alturaUser ? String(alturaUser) : "");
    const cm = parseFloat(raw);
    if (isNaN(cm) || cm < 100 || cm > 250) return;
    setAlturaUser(cm);
    setNovaAltura("");
    setEditAltura(false);
  };

  // ── Dados gráfico ──
  const pesoData    = pesos.slice(-20).map(p=>({name:p.data.slice(0,5), Peso:p.kg}));
  const pesoAtual   = pesos.length>0 ? pesos[pesos.length-1].kg : null;
  const pesoAnterior = pesos.length>1 ? pesos[pesos.length-2].kg : null;
  const diffPeso    = pesoAtual && pesoAnterior ? (pesoAtual-pesoAnterior).toFixed(1) : null;

  // ── IMC ──
  const alturaM     = alturaUser ? alturaUser/100 : null;
  const imcAtual    = pesoAtual && alturaM ? +(pesoAtual/(alturaM*alturaM)).toFixed(1) : null;
  const imcFaixa    = (imc) => {
    if (!imc) return null;
    if (imc < 18.5) return {label:"Abaixo do peso", cor:"#60a5fa"};
    if (imc < 25)   return {label:"Peso normal ✓",  cor:"#34d399"};
    if (imc < 30)   return {label:"Sobrepeso",       cor:"#f59e0b"};
    if (imc < 35)   return {label:"Obesidade I",     cor:"#f97316"};
    return           {label:"Obesidade II+",         cor:"#ef4444"};
  };
  const faixaAtual  = imcFaixa(imcAtual);
  // Peso ideal = IMC 22 (centro da faixa normal) para a altura do usuário
  const pesoIdeal   = alturaM ? +(22 * alturaM * alturaM).toFixed(1) : null;
  // Faixa saudável: IMC 18.5 a 24.9
  const pesoMinSaude = alturaM ? +(18.5 * alturaM * alturaM).toFixed(1) : null;
  const pesoMaxSaude = alturaM ? +(24.9 * alturaM * alturaM).toFixed(1) : null;
  const faltaIdeal  = pesoAtual && pesoIdeal ? (pesoAtual - pesoIdeal).toFixed(1) : null;

  // ── Meta manual ──
  const faltaMeta   = pesoAtual && metaPeso ? (pesoAtual - metaPeso).toFixed(1) : null;
  const atingiuMeta = faltaMeta !== null && Number(faltaMeta) <= 0;
  const progressoMeta = (() => {
    if (!pesoAtual || !metaPeso || pesos.length < 2) return 0;
    const inicio = pesos[0].kg;
    const total  = Math.abs(inicio - metaPeso);
    const feito  = Math.abs(inicio - pesoAtual);
    if (total === 0) return 100;
    return Math.min(100, Math.max(0, Math.round((feito / total) * 100)));
  })();

  // Card "Hoje"
  const blocosHoje  = blocosDia(diaHoje).filter(b=>b.tipo && b.tipo!=="Descanso");
  const temDescanso = blocosDia(diaHoje).some(b=>b.tipo==="Descanso");

  return (
    <div style={{display:"grid",gap:"20px"}}>

      {/* ── Card Hoje ── */}
      <div style={{
        background:"linear-gradient(135deg,rgba(124,58,237,0.12),rgba(168,85,247,0.05))",
        border:"1px solid rgba(124,58,237,0.2)", borderRadius:"18px", padding:"20px",
      }}>
        <div style={{fontSize:"11px",color:"#7c3aed",fontWeight:"600",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"12px"}}>
          Hoje · {DIAS_PT[diaHoje]}
        </div>

        {blocosHoje.length>0 ? (
          <div style={{display:"grid",gap:"10px"}}>
            {blocosHoje.map(b=>(
              <div key={b.id} style={{display:"flex",alignItems:"flex-start",gap:"12px"}}>
                <span style={{fontSize:"26px",flexShrink:0}}>{EMOJI_TIPO(b.tipo)}</span>
                <div>
                  <div style={{fontSize:"16px",fontWeight:"700",color:"#f0f0f0"}}>
                    {b.tipo}{b.musculo ? <span style={{fontSize:"13px",color:COR_TIPO(b.tipo),fontWeight:"500"}}> · {b.musculo}</span> : ""}
                  </div>
                  {b.detalhe && <div style={{fontSize:"12px",color:"#666",marginTop:"2px"}}>{b.detalhe}</div>}
                  {b.exercicios?.length>0 && (
                    <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginTop:"6px"}}>
                      {b.exercicios.map(e=>(
                        <span key={e.id} style={{fontSize:"11px",color:"#888",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"20px",padding:"2px 9px"}}>{e.nome}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : temDescanso ? (
          <div style={{fontSize:"22px"}}>🛋️ <span style={{fontSize:"16px",color:"#555",fontWeight:"500"}}>Dia de descanso</span></div>
        ) : (
          <div style={{fontSize:"13px",color:"#444",fontStyle:"italic"}}>
            Toque em <strong style={{color:"#666"}}>{DIAS_CURTO[diaHoje]}</strong> abaixo para montar seu treino de hoje
          </div>
        )}
      </div>


      {/* ── Card Peso + IMC + Meta ── */}
      <div style={{...card,padding:"20px",display:"grid",gap:"18px"}}>

        {/* ── Linha 1: Peso atual + botão registrar ── */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:"11px",color:"#555",fontWeight:"600",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"6px"}}>⚖️ Meu Peso</div>
            {pesoAtual ? (
              <div style={{display:"flex",alignItems:"baseline",gap:"10px",flexWrap:"wrap"}}>
                <span style={{fontSize:"34px",fontWeight:"800",color:"#f0f0f0",letterSpacing:"-0.03em"}}>
                  {pesoAtual}<span style={{fontSize:"16px",fontWeight:"400",color:"#444",marginLeft:"4px"}}>kg</span>
                </span>
                {diffPeso && Number(diffPeso)!==0 && (
                  <div style={{
                    fontSize:"13px",fontWeight:"700",
                    color:Number(diffPeso)>0?"#f87171":"#34d399",
                    background:Number(diffPeso)>0?"rgba(248,113,113,0.1)":"rgba(52,211,153,0.1)",
                    border:`1px solid ${Number(diffPeso)>0?"rgba(248,113,113,0.25)":"rgba(52,211,153,0.25)"}`,
                    borderRadius:"20px",padding:"3px 10px",
                  }}>
                    {Number(diffPeso)>0?"↑":"↓"} {Math.abs(Number(diffPeso))} kg
                  </div>
                )}
              </div>
            ) : (
              <div style={{fontSize:"14px",color:"#444",fontStyle:"italic"}}>Nenhum registro ainda</div>
            )}
          </div>
          <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
            <input type="number" step="0.1" min="20" max="300" placeholder="Ex: 74.5"
              value={novoPeso} onChange={e=>setNovoPeso(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&registrarPeso()}
              style={{...inp,width:"115px",padding:"8px 12px",fontSize:"14px",textAlign:"center"}}/>
            <button onClick={registrarPeso} style={{...btnPurple,padding:"9px 16px",fontSize:"13px",fontWeight:"700",boxShadow:"0 4px 12px rgba(124,58,237,0.35)"}}>
              ✓ Registrar
            </button>
          </div>
        </div>

        {/* ── IMC ── */}
        <div style={{borderRadius:"16px",padding:"18px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{fontSize:"11px",fontWeight:"700",color:"#555",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"16px"}}>
            📏 IMC — Índice de Massa Corporal
          </div>

          {/* Inputs de altura + peso lado a lado */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"14px"}}>
            <div>
              <div style={{fontSize:"11px",color:"#555",marginBottom:"6px",fontWeight:"600"}}>Altura (cm)</div>
              <div style={{display:"flex",gap:"6px"}}>
                <input
                  type="number" placeholder="Ex: 175"
                  value={novaAltura !== "" ? novaAltura : (alturaUser ? String(alturaUser) : "")}
                  onChange={e=>setNovaAltura(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&salvarAltura()}
                  style={{...inp,padding:"8px 12px",fontSize:"14px",textAlign:"center"}}
                />
              </div>
            </div>
            <div>
              <div style={{fontSize:"11px",color:"#555",marginBottom:"6px",fontWeight:"600"}}>Peso atual (kg)</div>
              <div style={{fontSize:"14px",fontWeight:"700",color:"#f0f0f0",
                background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:"10px",padding:"8px 12px",textAlign:"center"}}>
                {pesoAtual ? `${pesoAtual} kg` : <span style={{color:"#333",fontSize:"12px"}}>Sem registro</span>}
              </div>
            </div>
          </div>

          <button onClick={salvarAltura} style={{...btnPurple,width:"100%",padding:"10px",fontSize:"13px",marginBottom:"16px"}}>
            Calcular IMC
          </button>

          {/* Resultado */}
          {!alturaUser ? (
            <div style={{textAlign:"center",padding:"8px 0",color:"#444",fontSize:"13px"}}>
              Digite sua altura e clique em Calcular IMC
            </div>
          ) : !pesoAtual ? (
            <div style={{textAlign:"center",padding:"8px 0",color:"#444",fontSize:"13px"}}>
              Registre um peso acima para ver o IMC
            </div>
          ) : (
            <div style={{display:"grid",gap:"14px"}}>
              {/* Resultado destacado */}
              <div style={{display:"flex",alignItems:"center",gap:"16px"}}>
                <div style={{
                  width:"76px",height:"76px",borderRadius:"50%",flexShrink:0,
                  background:`${faixaAtual.cor}18`,border:`2px solid ${faixaAtual.cor}60`,
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                }}>
                  <div style={{fontSize:"22px",fontWeight:"900",color:faixaAtual.cor,lineHeight:1}}>{imcAtual}</div>
                  <div style={{fontSize:"9px",color:faixaAtual.cor,fontWeight:"600",marginTop:"2px"}}>IMC</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:"16px",fontWeight:"700",color:faixaAtual.cor,marginBottom:"5px"}}>{faixaAtual.label}</div>
                  <div style={{fontSize:"12px",color:"#666"}}>
                    Faixa saudável: <strong style={{color:"#34d399"}}>{pesoMinSaude}–{pesoMaxSaude} kg</strong>
                  </div>
                  <div style={{fontSize:"12px",color:"#555",marginTop:"3px"}}>
                    Altura registrada: <strong style={{color:"#a78bfa"}}>{alturaUser} cm</strong>
                    <button onClick={()=>{setNovaAltura(String(alturaUser));}} style={{background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:"10px",marginLeft:"6px",padding:0}}>✎ editar</button>
                  </div>
                  {faltaIdeal && Number(faltaIdeal)!==0 && (
                    <div style={{fontSize:"12px",color:"#888",marginTop:"3px"}}>
                      Peso ideal: <strong style={{color:"#a78bfa"}}>{pesoIdeal} kg</strong>
                      {" — "}
                      <span style={{color:Number(faltaIdeal)>0?"#f87171":"#34d399",fontWeight:"600"}}>
                        {Number(faltaIdeal)>0?"perder":"ganhar"} {Math.abs(Number(faltaIdeal))} kg
                      </span>
                    </div>
                  )}
                  {Number(faltaIdeal)===0&&<div style={{fontSize:"12px",color:"#34d399",marginTop:"3px",fontWeight:"600"}}>🎉 Você está no peso ideal!</div>}
                </div>
              </div>

              {/* Régua */}
              <div>
                <div style={{position:"relative",height:"10px",borderRadius:"100px",overflow:"visible",
                  background:"linear-gradient(90deg,#60a5fa 0%,#34d399 25%,#34d399 50%,#f59e0b 65%,#f97316 80%,#ef4444 100%)",
                  marginBottom:"8px"}}>
                  <div style={{
                    position:"absolute",
                    left:`${Math.min(98,Math.max(1,((imcAtual-14)/(42-14))*100))}%`,
                    top:"-5px",transform:"translateX(-50%)",
                    width:"20px",height:"20px",borderRadius:"50%",
                    background:"#fff",border:`3px solid ${faixaAtual.cor}`,
                    boxShadow:`0 0 10px ${faixaAtual.cor}`,transition:"left 0.5s ease",
                  }}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"9px",color:"#333"}}>
                  {["14","18.5","25","30","35","42+"].map(v=><span key={v}>{v}</span>)}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"8px",color:"#2a2a2a",marginTop:"2px"}}>
                  {["Baixo","Normal","Sobrep.","Ob. I","Ob. II",""].map((v,i)=><span key={i}>{v}</span>)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Peso Ideal ── */}
        <div style={{
          borderRadius:"16px", padding:"16px 18px", marginBottom:"4px",
          background: atingiuMeta ? "linear-gradient(135deg,rgba(52,211,153,0.1),rgba(52,211,153,0.04))"
                                  : "rgba(255,255,255,0.025)",
          border:`1px solid ${atingiuMeta?"rgba(52,211,153,0.3)":"rgba(255,255,255,0.07)"}`,
        }}>

          {/* Linha 1: label + botão editar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
            <div style={{fontSize:"11px",fontWeight:"700",color:"#555",letterSpacing:"0.08em",textTransform:"uppercase"}}>
              🎯 Peso ideal
            </div>
            {metaPeso && !editMeta && (
              <button onClick={()=>{setEditMeta(true);setNovaMetaPeso(String(metaPeso));}}
                style={{...btnGhost,fontSize:"11px",padding:"3px 10px"}}>alterar</button>
            )}
          </div>

          {!metaPeso || editMeta ? (
            /* ── Formulário para definir peso ideal ── */
            <div style={{display:"grid",gap:"10px"}}>
              <div style={{fontSize:"13px",color:"#666"}}>
                Qual é o peso que você quer chegar?
              </div>
              <div style={{display:"flex",gap:"8px"}}>
                <input
                  type="number" step="0.1" min="20" max="300"
                  placeholder="Ex: 70.0 kg"
                  value={novaMetaPeso}
                  onChange={e=>setNovaMetaPeso(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&salvarMeta()}
                  style={{...inp,flex:1,fontSize:"15px",textAlign:"center",fontWeight:"600"}}
                  autoFocus={editMeta}
                />
                <button onClick={salvarMeta} style={{...btnPurple,padding:"10px 18px",fontSize:"13px",fontWeight:"700"}}>
                  ✓ Salvar
                </button>
                {metaPeso && (
                  <button onClick={()=>setEditMeta(false)} style={{...btnGhost,padding:"10px 12px"}}>✕</button>
                )}
              </div>
              {/* Preview do quanto falta enquanto digita */}
              {pesoAtual && novaMetaPeso && !isNaN(parseFloat(novaMetaPeso)) && (() => {
                const diff = (pesoAtual - parseFloat(novaMetaPeso)).toFixed(1);
                return Number(diff) !== 0 ? (
                  <div style={{
                    textAlign:"center",padding:"8px",borderRadius:"10px",
                    background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.15)",
                    fontSize:"13px",color:"#a78bfa",
                  }}>
                    Você precisará{" "}
                    <strong>{Number(diff)>0?"perder":"ganhar"} {Math.abs(diff)} kg</strong>
                  </div>
                ) : null;
              })()}
            </div>

          ) : atingiuMeta ? (
            /* ── Meta atingida ── */
            <div style={{textAlign:"center",padding:"8px 0"}}>
              <div style={{fontSize:"36px",marginBottom:"6px"}}>🎉</div>
              <div style={{fontSize:"18px",fontWeight:"700",color:"#34d399",marginBottom:"4px"}}>Você chegou lá!</div>
              <div style={{fontSize:"13px",color:"#666"}}>Peso atual <strong style={{color:"#34d399"}}>{pesoAtual} kg</strong> = meta <strong style={{color:"#34d399"}}>{metaPeso} kg</strong></div>
            </div>

          ) : (
            /* ── Progresso — o principal ── */
            <div>
              {/* Destaque: "Falta X kg" */}
              <div style={{
                display:"flex",alignItems:"center",justifyContent:"center",
                gap:"16px",marginBottom:"16px",
              }}>
                {/* Atual */}
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:"26px",fontWeight:"800",color:"#c084fc",letterSpacing:"-0.03em"}}>{pesoAtual}</div>
                  <div style={{fontSize:"10px",color:"#666",marginTop:"2px",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.06em"}}>agora</div>
                </div>

                {/* Seta + quanto falta — bem destacado */}
                <div style={{
                  flex:1,textAlign:"center",
                  background: Number(faltaMeta)>0 ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.1)",
                  border:`1px solid ${Number(faltaMeta)>0?"rgba(248,113,113,0.25)":"rgba(52,211,153,0.25)"}`,
                  borderRadius:"14px",padding:"10px 8px",
                }}>
                  <div style={{
                    fontSize:"22px",fontWeight:"900",letterSpacing:"-0.03em",
                    color: Number(faltaMeta)>0 ? "#f87171" : "#34d399",
                  }}>
                    {Number(faltaMeta)>0 ? "−" : "+"}{Math.abs(Number(faltaMeta))} kg
                  </div>
                  <div style={{fontSize:"11px",color:Number(faltaMeta)>0?"#f87171":"#34d399",fontWeight:"600",marginTop:"2px"}}>
                    {Number(faltaMeta)>0 ? "faltam perder" : "faltam ganhar"}
                  </div>
                </div>

                {/* Meta */}
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:"26px",fontWeight:"800",color:"#888",letterSpacing:"-0.03em"}}>{metaPeso}</div>
                  <div style={{fontSize:"10px",color:"#555",marginTop:"2px",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.06em"}}>meta</div>
                </div>
              </div>

              {/* Barra de progresso */}
              {pesos.length >= 2 && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                    <span style={{fontSize:"11px",color:"#555"}}>
                      Progresso desde {pesos[0].data.slice(0,5)}
                    </span>
                    <span style={{
                      fontSize:"12px",fontWeight:"800",
                      color: progressoMeta>=100?"#34d399":progressoMeta>=50?"#a78bfa":"#666",
                    }}>{progressoMeta}%</span>
                  </div>
                  <div style={{height:"10px",background:"rgba(255,255,255,0.06)",borderRadius:"100px",overflow:"hidden"}}>
                    <div style={{
                      height:"100%",borderRadius:"100px",
                      width:`${Math.max(2,progressoMeta)}%`,
                      background:"linear-gradient(90deg,#6d28d9,#a855f7,#c084fc)",
                      boxShadow:"0 0 10px rgba(168,85,247,0.4)",
                      transition:"width 0.7s cubic-bezier(0.34,1.56,0.64,1)",
                    }}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:"5px"}}>
                    <span style={{fontSize:"10px",color:"#333"}}>início {pesos[0].kg} kg</span>
                    <span style={{fontSize:"10px",color:"#333"}}>meta {metaPeso} kg</span>
                  </div>
                </div>
              )}

              {/* Linha abaixo: variação desde início */}
              {pesos.length >= 2 && (() => {
                const totalVarDesdeinicio = (pesoAtual - pesos[0].kg).toFixed(1);
                return (
                  <div style={{
                    marginTop:"10px",paddingTop:"10px",
                    borderTop:"1px solid rgba(255,255,255,0.05)",
                    fontSize:"12px",color:"#555",textAlign:"center",
                  }}>
                    Desde o início: {" "}
                    <span style={{fontWeight:"700",color:Number(totalVarDesdeinicio)<0?"#34d399":Number(totalVarDesdeinicio)>0?"#f87171":"#888"}}>
                      {Number(totalVarDesdeinicio)>0?"+":""}{totalVarDesdeinicio} kg
                    </span>
                    {" "}em {pesos.length} registro{pesos.length>1?"s":""}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Gráfico de evolução — sempre visível ── */}
        <div>
          <div style={{fontSize:"11px",fontWeight:"600",color:"#444",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>
            📈 Evolução do peso
          </div>
          <div style={{position:"relative"}}>
            <ResponsiveContainer width="100%" height={170}>
              {pesoData.length>=2 ? (
                <AreaChart data={pesoData} margin={{top:8,right:12,bottom:0,left:0}}>
                  <defs>
                    <linearGradient id="pesoGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35}/>
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                  <XAxis dataKey="name" tick={{fill:"#444",fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                  <YAxis domain={["auto","auto"]} tick={{fill:"#444",fontSize:9}} axisLine={false} tickLine={false} width={36} tickFormatter={v=>`${v}kg`}/>
                  <Tooltip content={({active,payload,label})=>{
                    if(!active||!payload?.length) return null;
                    const val=payload[0].value;
                    const idx=pesoData.findIndex(p=>p.name===label);
                    const prev=idx>0?pesoData[idx-1].Peso:null;
                    const diff=prev?(val-prev).toFixed(1):null;
                    const distIdeal=pesoIdeal?(val-pesoIdeal).toFixed(1):null;
                    const distMeta=metaPeso?(val-metaPeso).toFixed(1):null;
                    return (
                      <div style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:"10px",padding:"10px 14px",fontSize:"12px",minWidth:"160px"}}>
                        <div style={{color:"#555",marginBottom:"5px"}}>{label}</div>
                        <div style={{fontSize:"18px",fontWeight:"700",color:"#f0f0f0",marginBottom:"5px"}}>{val} kg</div>
                        {diff&&Number(diff)!==0&&<div style={{color:Number(diff)>0?"#f87171":"#34d399",marginBottom:"3px"}}>{Number(diff)>0?"↑":"↓"} {Math.abs(Number(diff))} kg vs anterior</div>}
                        {distIdeal!=null&&<div style={{color:Number(distIdeal)<=0?"#34d399":"#a78bfa",marginBottom:"2px"}}>
                          {Number(distIdeal)<=0?"✓ No peso ideal":"Falta "+Math.abs(Number(distIdeal))+" kg p/ ideal"}
                        </div>}
                        {distMeta!=null&&metaPeso!==pesoIdeal&&<div style={{color:Number(distMeta)<=0?"#34d399":"#f59e0b"}}>
                          {Number(distMeta)<=0?"✓ Meta atingida":"Falta "+Math.abs(Number(distMeta))+" kg p/ meta"}
                        </div>}
                      </div>
                    );
                  }}/>
                  {/* Linha do peso ideal (verde) */}
                  {pesoIdeal && (
                    <ReferenceLine y={pesoIdeal} stroke="#34d399" strokeDasharray="5 4" strokeWidth={1.5}
                      label={{value:`Ideal ${pesoIdeal}kg`,position:"insideTopRight",fill:"#34d399",fontSize:9,fontWeight:"700"}}/>
                  )}
                  {/* Linha da meta (amarela) — só se diferente do ideal */}
                  {metaPeso && metaPeso!==pesoIdeal && (
                    <ReferenceLine y={metaPeso} stroke={atingiuMeta?"#34d399":"#f59e0b"} strokeDasharray="5 4" strokeWidth={1.5}
                      label={{value:`Meta ${metaPeso}kg`,position:"insideBottomRight",fill:atingiuMeta?"#34d399":"#f59e0b",fontSize:9,fontWeight:"700"}}/>
                  )}
                  <Area type="monotone" dataKey="Peso" stroke="#a855f7" strokeWidth={2.5} fill="url(#pesoGrad2)"
                    dot={(props)=>{const{cx,cy,index}=props;const isLast=index===pesoData.length-1;return<circle key={index} cx={cx} cy={cy} r={isLast?5:3} fill={isLast?"#c084fc":"#7c3aed"} stroke={isLast?"rgba(192,132,252,0.4)":""} strokeWidth={isLast?4:0}/>;}}
                    activeDot={{r:6,fill:"#c084fc",stroke:"rgba(192,132,252,0.4)",strokeWidth:4}}/>
                </AreaChart>
              ) : (
                <AreaChart data={[{name:"",Peso:0}]} margin={{top:8,right:8,bottom:0,left:0}}>
                  <defs><linearGradient id="pgEmpty" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c3aed" stopOpacity={0.08}/><stop offset="100%" stopColor="#7c3aed" stopOpacity={0.01}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                  <XAxis tick={false} axisLine={false} tickLine={false}/>
                  <YAxis tick={false} axisLine={false} tickLine={false} width={36}/>
                  <Area type="monotone" dataKey="Peso" stroke="rgba(124,58,237,0.15)" strokeWidth={1.5} fill="url(#pgEmpty)" strokeDasharray="6 4"/>
                </AreaChart>
              )}
            </ResponsiveContainer>
            {pesoData.length<2&&(
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"6px"}}>
                <div style={{fontSize:"26px"}}>📈</div>
                <div style={{fontSize:"13px",color:"#555"}}>{pesoData.length===0?"Registre seu primeiro peso":"Mais 1 registro para ver o gráfico"}</div>
              </div>
            )}
          </div>

          {/* Legenda das linhas */}
          {(pesoIdeal||metaPeso) && pesoData.length>=2 && (
            <div style={{display:"flex",gap:"14px",marginTop:"8px",flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                <div style={{width:"16px",height:"2px",background:"#a855f7",borderRadius:"2px"}}/>
                <span style={{fontSize:"10px",color:"#555"}}>Seu peso</span>
              </div>
              {pesoIdeal&&<div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                <div style={{width:"16px",height:"2px",background:"#34d399",borderRadius:"2px",borderTop:"2px dashed #34d399"}}/>
                <span style={{fontSize:"10px",color:"#555"}}>Peso ideal (IMC 22)</span>
              </div>}
              {metaPeso&&metaPeso!==pesoIdeal&&<div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                <div style={{width:"16px",height:"2px",background:atingiuMeta?"#34d399":"#f59e0b",borderRadius:"2px"}}/>
                <span style={{fontSize:"10px",color:"#555"}}>Minha meta</span>
              </div>}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{display:"flex",paddingTop:"14px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
          {[
            {label:"Menor",   val:pesos.length?`${Math.min(...pesos.map(p=>p.kg))} kg`:"—",  color:"#34d399"},
            {label:"Maior",   val:pesos.length?`${Math.max(...pesos.map(p=>p.kg))} kg`:"—",  color:"#f87171"},
            {label:"Total",   val:pesos.length?`${pesos.length} reg.`:"0",                   color:"#a78bfa"},
            {label:"Variação",val:pesos.length>=2?`${(pesos[pesos.length-1].kg-pesos[0].kg).toFixed(1)} kg`:"—",color:"#60a5fa"},
          ].map((s,i)=>(
            <div key={s.label} style={{flex:1,textAlign:"center",borderRight:i<3?"1px solid rgba(255,255,255,0.05)":"none",padding:"0 8px"}}>
              <div style={{fontSize:"13px",fontWeight:"700",color:s.color}}>{s.val}</div>
              <div style={{fontSize:"10px",color:"#444",marginTop:"2px"}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Histórico com barrinhas */}
        {pesos.length>0&&(()=>{
          const sorted=[...pesos].sort((a,b)=>a.ts-b.ts);
          const minKg=Math.min(...sorted.map(p=>p.kg));
          const maxKg=Math.max(...sorted.map(p=>p.kg));
          const range=maxKg-minKg||1;
          const rows=[...sorted].reverse().map((p,revIdx)=>{
            const absIdx=sorted.findIndex(x=>x.ts===p.ts);
            const prev=absIdx>0?sorted[absIdx-1].kg:null;
            const d=prev!=null?(p.kg-prev).toFixed(1):null;
            const pct=Math.max(8,Math.round(((p.kg-minKg)/range)*100));
            const isLast=revIdx===0;
            const corBarra=d==null?"#7c3aed":Number(d)>0?"#f87171":Number(d)<0?"#34d399":"#555";
            const distI=metaPeso?(p.kg-metaPeso).toFixed(1):null;
            return {p,d,pct,isLast,corBarra,distI,minKg,maxKg};
          });
          return (
            <div>
              <div style={{fontSize:"10px",fontWeight:"700",color:"#333",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"10px"}}>Histórico completo</div>
              <div style={{display:"grid",gap:"6px",maxHeight:"260px",overflowY:"auto",paddingRight:"4px"}}>
                {rows.map(({p,d,pct,isLast,corBarra,distI,minKg,maxKg})=>(
                  <div key={p.ts} style={{borderRadius:"12px",background:isLast?"rgba(124,58,237,0.07)":"rgba(255,255,255,0.02)",border:`1px solid ${isLast?"rgba(124,58,237,0.2)":"rgba(255,255,255,0.04)"}`,padding:"10px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}>
                      <div style={{width:"7px",height:"7px",borderRadius:"50%",flexShrink:0,background:isLast?"#a855f7":"rgba(255,255,255,0.12)",boxShadow:isLast?"0 0 6px #a855f7":"none"}}/>
                      <span style={{fontSize:"12px",color:"#666",flex:1}}>{p.data}</span>
                      <span style={{fontSize:"16px",fontWeight:"700",color:isLast?"#f0f0f0":"#aaa"}}>{p.kg} kg</span>
                      {d!=null&&Number(d)!==0&&(
                        <span style={{fontSize:"11px",fontWeight:"700",color:Number(d)>0?"#f87171":"#34d399",background:Number(d)>0?"rgba(248,113,113,0.1)":"rgba(52,211,153,0.1)",borderRadius:"20px",padding:"2px 8px",flexShrink:0}}>
                          {Number(d)>0?"↑":"↓"} {Math.abs(Number(d))} kg
                        </span>
                      )}
                      {distI!=null&&(
                        <span style={{fontSize:"10px",color:Number(distI)<=0?"#34d399":"#888",flexShrink:0}}>
                          {Number(distI)<=0?"✓ meta":`${Math.abs(Number(distI))}kg p/ meta`}
                        </span>
                      )}
                      <button onClick={()=>setPesos(pesos.filter(x=>x.ts!==p.ts))}
                        style={{background:"none",border:"none",color:"#2a2a2a",cursor:"pointer",fontSize:"16px",lineHeight:1,padding:"0"}}>×</button>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <span style={{fontSize:"9px",color:"#2a2a2a",width:"28px",textAlign:"right",flexShrink:0}}>{minKg}kg</span>
                      <div style={{flex:1,height:"6px",background:"rgba(255,255,255,0.05)",borderRadius:"100px",overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:"100px",width:`${pct}%`,background:`linear-gradient(90deg,${corBarra}88,${corBarra})`,boxShadow:isLast?`0 0 8px ${corBarra}60`:"none",transition:"width 0.5s ease"}}/>
                      </div>
                      <span style={{fontSize:"9px",color:"#2a2a2a",width:"28px",flexShrink:0}}>{maxKg}kg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Semana ── */}
      <div>
        <div style={{fontSize:"11px",fontWeight:"600",color:"#555",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"12px"}}>
          Semana de Treinos
        </div>

        <div style={{display:"grid",gap:"8px"}}>
          {DIAS_CURTO.map((dia,i)=>{
            const blocos   = blocosDia(i);
            const isHoje   = i===diaHoje;
            const isEdit   = editando===i;
            const temReal  = blocos.some(b=>b.tipo && b.tipo!=="Descanso");
            const temDesc  = blocos.some(b=>b.tipo==="Descanso");
            const primCor  = temReal ? COR_TIPO(blocos.find(b=>b.tipo&&b.tipo!=="Descanso")?.tipo) : "#333";

            return (
              <div key={i} style={{
                ...card, overflow:"hidden",
                borderColor: isHoje?"rgba(124,58,237,0.4)":temReal?`${primCor}28`:"rgba(255,255,255,0.06)",
                boxShadow: isHoje?"0 0 0 1px rgba(124,58,237,0.15)":"none",
                transition:"all 0.2s",
              }}>
                {/* Linha resumo do dia */}
                <div onClick={()=>setEditando(isEdit?null:i)}
                  style={{display:"flex",alignItems:"center",gap:"12px",padding:"13px 16px",cursor:"pointer"}}>

                  <div style={{
                    width:"38px",height:"38px",borderRadius:"50%",flexShrink:0,
                    background:isHoje?"#7c3aed":temReal?`${primCor}18`:"rgba(255,255,255,0.04)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:temReal&&!isHoje?"16px":"13px",fontWeight:"700",
                    color:isHoje?"#fff":temReal?primCor:"#444",
                  }}>
                    {isHoje?"●":temDesc&&!temReal?"🛋️":temReal?EMOJI_TIPO(blocos.find(b=>b.tipo&&b.tipo!=="Descanso")?.tipo):dia[0]}
                  </div>

                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"14px",fontWeight:"600",color:isHoje?"#f0f0f0":"#c0c0c0"}}>
                      {dia} {isHoje && <span style={{fontSize:"11px",color:"#7c3aed",fontWeight:"500"}}>· hoje</span>}
                    </div>
                    <div style={{fontSize:"12px",color:"#555",marginTop:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {blocos.length===0 ? "Não definido" :
                       blocos.map(b=>`${EMOJI_TIPO(b.tipo)} ${b.tipo}${b.musculo?` (${b.musculo})`:""}`).join("  +  ")}
                    </div>
                  </div>

                  {/* Dots coloridos dos blocos */}
                  {temReal && (
                    <div style={{display:"flex",gap:"4px",flexShrink:0}}>
                      {blocos.filter(b=>b.tipo&&b.tipo!=="Descanso").slice(0,3).map(b=>(
                        <div key={b.id} style={{width:"7px",height:"7px",borderRadius:"50%",background:COR_TIPO(b.tipo),boxShadow:`0 0 5px ${COR_TIPO(b.tipo)}`}}/>
                      ))}
                    </div>
                  )}
                  <div style={{color:"#333",fontSize:"16px",flexShrink:0,transform:isEdit?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▾</div>
                </div>

                {/* Painel de edição */}
                {isEdit && (
                  <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",padding:"16px",display:"grid",gap:"16px"}}>

                    {/* Blocos existentes */}
                    {blocos.map((bloco,bi)=>(
                      <div key={bloco.id} style={{
                        background:"rgba(255,255,255,0.025)",borderRadius:"14px",
                        border:`1px solid ${bloco.tipo?COR_TIPO(bloco.tipo)+"30":"rgba(255,255,255,0.06)"}`,
                        padding:"14px", display:"grid", gap:"12px",
                        position:"relative",
                      }}>
                        {/* Label bloco + delete */}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div style={{fontSize:"11px",fontWeight:"700",color:"#555",letterSpacing:"0.08em",textTransform:"uppercase"}}>
                            Bloco {bi+1}{bloco.tipo ? ` · ${EMOJI_TIPO(bloco.tipo)} ${bloco.tipo}` : ""}
                          </div>
                          <button onClick={()=>delBloco(i,bloco.id)}
                            style={{background:"none",border:"1px solid rgba(248,113,113,0.2)",borderRadius:"6px",color:"#f87171",cursor:"pointer",fontSize:"11px",padding:"2px 8px"}}>
                            remover
                          </button>
                        </div>

                        {/* Tipo */}
                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"5px"}}>
                          {OPCOES_TREINO.map(op=>(
                            <button key={op.label} onClick={()=>updateBloco(i,bloco.id,"tipo",op.label)}
                              style={{
                                padding:"9px 4px",borderRadius:"10px",cursor:"pointer",
                                background:bloco.tipo===op.label?`${op.cor}22`:"rgba(255,255,255,0.03)",
                                border:`1px solid ${bloco.tipo===op.label?op.cor+"60":"rgba(255,255,255,0.06)"}`,
                                color:bloco.tipo===op.label?op.cor:"#555",
                                fontSize:"11px",fontWeight:bloco.tipo===op.label?"600":"400",
                                display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",
                                transition:"all 0.12s",
                              }}>
                              <span style={{fontSize:"17px"}}>{op.emoji}</span>
                              <span>{op.label.split(" ")[0]}</span>
                            </button>
                          ))}
                        </div>

                        {/* Músculo (musculação) */}
                        {bloco.tipo==="Musculação" && (
                          <div>
                            <div style={{...lbl,marginBottom:"8px"}}>Músculo</div>
                            <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                              {MUSCULOS.map(m=>(
                                <button key={m} onClick={()=>updateBloco(i,bloco.id,"musculo",bloco.musculo===m?"":m)}
                                  style={{
                                    padding:"4px 11px",borderRadius:"20px",cursor:"pointer",fontSize:"12px",
                                    background:bloco.musculo===m?"rgba(168,85,247,0.18)":"rgba(255,255,255,0.04)",
                                    border:`1px solid ${bloco.musculo===m?"rgba(168,85,247,0.5)":"rgba(255,255,255,0.06)"}`,
                                    color:bloco.musculo===m?"#a78bfa":"#555",fontWeight:bloco.musculo===m?"600":"400",
                                    transition:"all 0.12s",
                                  }}>{m}</button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Detalhe cardio/outros */}
                        {bloco.tipo && bloco.tipo!=="Musculação" && bloco.tipo!=="Descanso" && (
                          <input
                            placeholder={bloco.tipo==="Cardio"||bloco.tipo==="Bike"?"Ex: 30min, 5km, ritmo leve...":
                                         bloco.tipo==="HIIT"?"Ex: Tabata 20min, 8 rounds...":
                                         bloco.tipo==="Natação"?"Ex: 1km crawl...":"Ex: 45min..."}
                            value={bloco.detalhe||""}
                            onChange={e=>updateBloco(i,bloco.id,"detalhe",e.target.value)}
                            style={inp}/>
                        )}

                        {/* Exercícios (musculação/HIIT) */}
                        {(bloco.tipo==="Musculação"||bloco.tipo==="HIIT") && (
                          <div>
                            <div style={{...lbl,marginBottom:"8px"}}>Exercícios</div>
                            <div style={{display:"grid",gap:"4px",marginBottom:"8px"}}>
                              {(bloco.exercicios||[]).length===0 && (
                                <div style={{fontSize:"12px",color:"#333",fontStyle:"italic"}}>Nenhum ainda</div>
                              )}
                              {(bloco.exercicios||[]).map(e=>(
                                <div key={e.id} style={{display:"flex",alignItems:"center",gap:"8px",background:"rgba(255,255,255,0.03)",borderRadius:"8px",padding:"7px 12px"}}>
                                  <div style={{width:"5px",height:"5px",borderRadius:"50%",background:COR_TIPO(bloco.tipo),flexShrink:0}}/>
                                  <span style={{flex:1,fontSize:"13px",color:"#c0c0c0"}}>{e.nome}</span>
                                  <button onClick={()=>delExerc(i,bloco.id,e.id)}
                                    style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"16px"}}>×</button>
                                </div>
                              ))}
                            </div>
                            <div style={{display:"flex",gap:"8px"}}>
                              <input
                                placeholder="Ex: Supino 4x12, Rosca 3x15..."
                                value={novoExerc[bloco.id]||""}
                                onChange={e=>setNovoExerc(n=>({...n,[bloco.id]:e.target.value}))}
                                onKeyDown={e=>e.key==="Enter"&&addExerc(i,bloco.id)}
                                style={{...inp,flex:1,fontSize:"13px"}}/>
                              <button onClick={()=>addExerc(i,bloco.id)} style={{...btnPurple,padding:"9px 14px"}}>+</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Botão adicionar bloco */}
                    <button onClick={()=>addBloco(i)} style={{
                      width:"100%", padding:"11px", borderRadius:"12px", cursor:"pointer",
                      background:"rgba(124,58,237,0.07)",
                      border:"1px dashed rgba(124,58,237,0.3)",
                      color:"#7c3aed", fontSize:"13px", fontWeight:"600",
                      transition:"all 0.15s",
                    }}>
                      + Adicionar {blocos.length===0?"treino":"outro treino"} neste dia
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── TREINO ────────────────────────────────────────────────────────────────────
function Treino() {
  const [treinoTab, setTreinoTab] = useState("split");
  const treinoTabs = [
    {id:"split",   label:"🗓 Meu Split"},
    {id:"visao",   label:"Visão Geral"},
    {id:"treinos", label:"Treinos"},
    {id:"dieta",   label:"Dieta"},
    {id:"medidas", label:"Medidas & Metas"},
  ];
  return (
    <div>
      <div style={{display:"flex",gap:"4px",marginBottom:"24px",overflowX:"auto",paddingBottom:"2px",WebkitOverflowScrolling:"touch"}}>
        {treinoTabs.map(t=>(
          <button key={t.id} onClick={()=>setTreinoTab(t.id)}
            style={{whiteSpace:"nowrap",
              background:treinoTab===t.id?"rgba(124,58,237,0.15)":"transparent",
              color:treinoTab===t.id?"#a78bfa":"#555",
              border:`1px solid ${treinoTab===t.id?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.06)"}`,
              borderRadius:"8px",padding:"6px 14px",fontSize:"12px",cursor:"pointer",
              fontWeight:treinoTab===t.id?"600":"400",letterSpacing:"0.03em",
              transition:"all 0.15s", flexShrink:0}}>
            {t.label}
          </button>
        ))}
      </div>
      {treinoTab==="split"   && <TreinoSplit/>}
      {treinoTab==="visao"   && <TreinoVisao/>}
      {treinoTab==="treinos" && <TreinoLog/>}
      {treinoTab==="dieta"   && <Dieta/>}
      {treinoTab==="medidas" && <MedidasMetas/>}
    </div>
  );
}

// ── TREINO VISÃO GERAL ────────────────────────────────────────────────────────
function TreinoVisao() {
  const [treinos]  = useStorage("treino:log",[]);
  const [medidas]  = useStorage("treino:medidas",[]);
  const [metas]    = useStorage("treino:metas",[]);
  const [refeicoes]= useStorage("treino:dieta",[]);

  const hoje = today.toLocaleDateString("pt-BR");
  const semana = treinos.filter(t=>{ const d=new Date(t.ts); const diff=(today-d)/(1000*60*60*24); return diff<=7; });
  const caloHoje = refeicoes.filter(r=>r.data===hoje).reduce((s,r)=>s+r.calorias,0);
  const protHoje  = refeicoes.filter(r=>r.data===hoje).reduce((s,r)=>s+r.proteina,0);

  // Evolução de peso
  const pesoData = medidas.filter(m=>m.peso).slice(-10).map(m=>({name:m.data.slice(0,5),Peso:m.peso}));

  // Treinos por dia da semana (últimos 30 dias)
  const diasSemana = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const treinosPorDia = diasSemana.map(d=>({name:d,treinos:0}));
  treinos.slice(-30).forEach(t=>{ const d=new Date(t.ts); treinosPorDia[d.getDay()].treinos++; });

  const cards = [
    {label:"Treinos esta semana", val:semana.length,        unit:"sessões",  color:"#a78bfa"},
    {label:"Calorias hoje",       val:caloHoje,              unit:"kcal",     color:"#fb923c"},
    {label:"Proteína hoje",       val:protHoje,              unit:"g",        color:"#34d399"},
    {label:"Total de treinos",    val:treinos.length,        unit:"registros",color:"#60a5fa"},
  ];

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"20px"}}>
        {cards.map(c=>(
          <div key={c.label} style={{...card,padding:"14px 18px"}}>
            <div style={lbl}>{c.label}</div>
            <div style={{fontSize:"20px",fontWeight:"700",color:c.color}}>{c.val} <span style={{fontSize:"12px",color:"#555",fontWeight:"400"}}>{c.unit}</span></div>
          </div>
        ))}
      </div>

      {pesoData.length>=2 && (
        <div style={{...card,padding:"18px",marginBottom:"16px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"14px"}}>EVOLUÇÃO DO PESO (kg)</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={pesoData} margin={{top:5,right:10,bottom:5,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false}/>
              <XAxis dataKey="name" tick={{fill:"#555",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis hide domain={["auto","auto"]}/>
              <Tooltip content={<DarkTooltip prefix=""/>}/>
              <Line type="monotone" dataKey="Peso" stroke="#a78bfa" strokeWidth={2} dot={{r:4,fill:"#a78bfa"}} activeDot={{r:6}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {treinos.length>0 && (
        <div style={{...card,padding:"18px",marginBottom:"16px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"14px"}}>TREINOS POR DIA DA SEMANA</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={treinosPorDia} barSize={26} margin={{top:0,right:0,bottom:0,left:0}}>
              <XAxis dataKey="name" tick={{fill:"#555",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip content={<DarkTooltip prefix=""/>}/>
              <Bar dataKey="treinos" radius={[6,6,0,0]}>
                {treinosPorDia.map((_,i)=><Cell key={i} fill={i===today.getDay()?"#a78bfa":"#3d2080"}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <IAWidget
        context={`Treinos na última semana: ${semana.length}\nTotal de treinos registrados: ${treinos.length}\nCalorias consumidas hoje: ${caloHoje} kcal\nProteína hoje: ${protHoje}g\nÚltimos treinos: ${treinos.slice(0,5).map(t=>`${t.tipo} (${t.data})`).join(", ")}\nMedidas recentes: ${medidas.slice(-1).map(m=>`Peso: ${m.peso}kg, Gordura: ${m.gordura}%`).join("")}`}
        systemPrompt="Você é um personal trainer e nutricionista virtual. Analise os dados de treino e dieta do usuário e dê feedback sobre frequência de treino, recuperação, nutrição e evolução física. Seja motivador, direto e use os dados reais. Responda em português brasileiro. Máximo 200 palavras."
        placeholder="Ex: Estou treinando o suficiente? Como melhorar?"
      />
    </div>
  );
}

// ── TREINO LOG ────────────────────────────────────────────────────────────────
function TreinoLog() {
  const [treinos,setTreinos] = useStorage("treino:log",[]);
  const [exercicios,setExercicios] = useStorage("treino:exercicios",[]);
  const [showForm,setShowForm] = useState(false);
  const [showExForm,setShowExForm] = useState(null); // id do treino expandido
  const [form,setForm] = useState({tipo:"Musculação",data:today.toISOString().slice(0,10),duracao:"",obs:""});
  const [exForm,setExForm] = useState({nome:"",series:"",reps:"",carga:""});

  const TIPOS = ["Musculação","Cardio","Funcional","CrossFit","Yoga","Pilates","Natação","Corrida","Ciclismo","Outro"];
  const tipoColor = {"Musculação":"#a78bfa","Cardio":"#f87171","Funcional":"#fb923c","CrossFit":"#fcd34d","Yoga":"#34d399","Pilates":"#f472b6","Natação":"#60a5fa","Corrida":"#f87171","Ciclismo":"#34d399","Outro":"#555"};

  const addTreino = () => {
    if (!form.tipo) return;
    setTreinos([{id:Date.now(),ts:new Date(form.data + "T12:00:00").getTime(),...form},
      ...treinos]);
    setForm({tipo:"Musculação",data:today.toISOString().slice(0,10),duracao:"",obs:""});
    setShowForm(false);
  };

  const addExercicio = (treinoId) => {
    if (!exForm.nome) return;
    setExercicios([...exercicios,{id:Date.now(),treinoId,...exForm}]);
    setExForm({nome:"",series:"",reps:"",carga:""});
  };

  const getExercicios = (treinoId) => exercicios.filter(e=>e.treinoId===treinoId);

  // Volume por tipo para gráfico
  const volData = TIPOS.map(t=>({name:t.slice(0,6),qtd:treinos.filter(x=>x.tipo===t).length})).filter(d=>d.qtd>0);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
        <div style={{fontSize:"13px",fontWeight:"600",color:"#555",letterSpacing:"0.04em"}}>{treinos.length} TREINO{treinos.length!==1?"S":""} REGISTRADO{treinos.length!==1?"S":""}</div>
        <button onClick={()=>setShowForm(!showForm)} style={btnPurple}>{showForm?"✕ Fechar":"+ Novo Treino"}</button>
      </div>

      {volData.length>0 && (
        <div style={{...card,padding:"16px",marginBottom:"20px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"12px"}}>TREINOS POR MODALIDADE</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={volData} barSize={22} margin={{top:0,right:0,bottom:0,left:0}}>
              <XAxis dataKey="name" tick={{fill:"#555",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip content={<DarkTooltip prefix=""/>}/>
              <Bar dataKey="qtd" radius={[5,5,0,0]}>
                {volData.map((d,i)=><Cell key={i} fill={tipoColor[TIPOS.find(t=>t.startsWith(d.name))]||"#7c3aed"}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {showForm && (
        <div style={{...card,padding:"18px",marginBottom:"18px",display:"grid",gap:"10px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} style={inp}>
              {TIPOS.map(t=><option key={t}>{t}</option>)}
            </select>
            <input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} style={{...inp,colorScheme:"dark"}}/>
          </div>
          <input placeholder="Duração (ex: 60 min)" value={form.duracao} onChange={e=>setForm({...form,duracao:e.target.value})} style={inp}/>
          <input placeholder="Observações (ex: foco em peito e tríceps)" value={form.obs} onChange={e=>setForm({...form,obs:e.target.value})} style={inp}/>
          <button onClick={addTreino} style={{...btnPurple,padding:"10px",fontSize:"13px"}}>Registrar Treino</button>
        </div>
      )}

      <div style={{display:"grid",gap:"10px"}}>
        {treinos.length===0&&<div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"32px"}}>Nenhum treino registrado ainda</div>}
        {treinos.map(t=>{
          const exs = getExercicios(t.id);
          const isOpen = showExForm===t.id;
          return (
            <div key={t.id} style={{...card,padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom: isOpen||exs.length>0?"12px":"0"}}>
                <div style={{width:"8px",height:"8px",borderRadius:"50%",background:tipoColor[t.tipo]||"#7c3aed",flexShrink:0,boxShadow:`0 0 6px ${tipoColor[t.tipo]||"#7c3aed"}88`}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0"}}>{t.tipo}</div>
                  <div style={{fontSize:"11px",color:"#555",marginTop:"2px"}}>{t.data}{t.duracao?` · ${t.duracao}`:""}</div>
                </div>
                <button onClick={()=>setShowExForm(isOpen?null:t.id)} style={{...btnGhost,fontSize:"10px",color:"#a78bfa",borderColor:"#3d2080"}}>
                  {isOpen?"fechar":"+ exercício"}
                </button>
                <button onClick={()=>setTreinos(treinos.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"16px"}}>×</button>
              </div>

              {t.obs && <div style={{fontSize:"11px",color:"#555",marginBottom:"10px",paddingLeft:"18px"}}>📝 {t.obs}</div>}

              {/* Exercícios do treino */}
              {exs.length>0 && (
                <div style={{display:"grid",gap:"5px",marginBottom:"10px",paddingLeft:"18px"}}>
                  {exs.map(e=>(
                    <div key={e.id} style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"12px",color:"#f0f0f0",background:"#111",padding:"7px 10px",borderRadius:"8px"}}>
                      <span style={{color:"#7c3aed",fontWeight:"700"}}>▸</span>
                      <span style={{flex:1}}>{e.nome}</span>
                      {e.series&&<span style={{color:"#555"}}>{e.series}x{e.reps}</span>}
                      {e.carga&&<span style={{color:"#a78bfa",fontWeight:"600"}}>{e.carga}kg</span>}
                      <button onClick={()=>setExercicios(exercicios.filter(x=>x.id!==e.id))} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"13px"}}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Form adicionar exercício */}
              {isOpen && (
                <div style={{paddingLeft:"18px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:"6px",marginBottom:"6px"}}>
                    <input placeholder="Exercício" value={exForm.nome} onChange={e=>setExForm({...exForm,nome:e.target.value})} style={{...inp,padding:"7px 10px",fontSize:"12px"}}/>
                    <input placeholder="Séries" type="number" value={exForm.series} onChange={e=>setExForm({...exForm,series:e.target.value})} style={{...inp,padding:"7px 8px",fontSize:"12px"}}/>
                    <input placeholder="Reps" type="number" value={exForm.reps} onChange={e=>setExForm({...exForm,reps:e.target.value})} style={{...inp,padding:"7px 8px",fontSize:"12px"}}/>
                    <input placeholder="Carga" type="number" value={exForm.carga} onChange={e=>setExForm({...exForm,carga:e.target.value})} style={{...inp,padding:"7px 8px",fontSize:"12px"}}/>
                  </div>
                  <button onClick={()=>addExercicio(t.id)} style={{...btnPurple,padding:"6px 14px",fontSize:"11px",width:"100%"}}>Adicionar Exercício</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DIETA ─────────────────────────────────────────────────────────────────────
function Dieta() {
  const [refeicoes,setRefeicoes] = useStorage("treino:dieta",[]);
  const [form,setForm] = useState({nome:"",tipo:"Café da manhã",calorias:"",proteina:"",carbo:"",gordura:"",data:today.toLocaleDateString("pt-BR")});
  const [showForm,setShowForm] = useState(false);
  const [diaFilter,setDiaFilter] = useState(today.toLocaleDateString("pt-BR"));
  const [metaCal,setMetaCal] = useStorage("treino:meta-cal",2000);
  const [metaProt,setMetaProt] = useStorage("treino:meta-prot",150);

  const TIPOS = ["Café da manhã","Lanche da manhã","Almoço","Lanche da tarde","Jantar","Ceia","Pré-treino","Pós-treino"];

  const add = () => {
    if (!form.nome) return;
    setRefeicoes([...refeicoes,{id:Date.now(),...form,calorias:Number(form.calorias||0),proteina:Number(form.proteina||0),carbo:Number(form.carbo||0),gordura:Number(form.gordura||0)}]);
    setForm({nome:"",tipo:"Café da manhã",calorias:"",proteina:"",carbo:"",gordura:"",data:diaFilter});
    setShowForm(false);
  };

  const doDia = refeicoes.filter(r=>r.data===diaFilter);
  const totCal  = doDia.reduce((s,r)=>s+r.calorias,0);
  const totProt = doDia.reduce((s,r)=>s+r.proteina,0);
  const totCarb = doDia.reduce((s,r)=>s+r.carbo,0);
  const totGord = doDia.reduce((s,r)=>s+r.gordura,0);

  const macrosPie = [
    {name:"Proteína",valor:totProt,color:"#34d399"},
    {name:"Carboidrato",valor:totCarb,color:"#60a5fa"},
    {name:"Gordura",valor:totGord,color:"#fb923c"},
  ].filter(d=>d.valor>0);

  const pctCal  = metaCal  >0?Math.min(100,Math.round((totCal/metaCal)*100)):0;
  const pctProt = metaProt >0?Math.min(100,Math.round((totProt/metaProt)*100)):0;

  // Evolução calórica últimos 7 dias
  const last7 = Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-6+i);
    const label=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()];
    const dataStr=d.toLocaleDateString("pt-BR");
    const cal=refeicoes.filter(r=>r.data===dataStr).reduce((s,r)=>s+r.calorias,0);
    return {name:label,Calorias:cal,isToday:i===6};
  });

  return (
    <div>
      {/* Metas rápidas */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"20px"}}>
        <div style={{...card,padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
            <div style={lbl}>Calorias hoje</div>
            <span style={{fontSize:"10px",color:"#555"}}>{totCal}/{metaCal} kcal</span>
          </div>
          <div style={{background:"#0d0d0d",borderRadius:"100px",height:"6px",overflow:"hidden",marginBottom:"6px"}}>
            <div style={{background:`linear-gradient(90deg,${pctCal>100?"#f87171":"#fb923c"},${pctCal>100?"#f87171":"#fcd34d"})`,height:"100%",borderRadius:"100px",width:`${pctCal}%`,transition:"width 0.4s",boxShadow:"0 0 6px rgba(251,146,60,0.4)"}}/>
          </div>
          <div style={{fontSize:"18px",fontWeight:"700",color:pctCal>100?"#f87171":"#fb923c"}}>{totCal} <span style={{fontSize:"11px",color:"#555",fontWeight:"400"}}>kcal</span></div>
        </div>
        <div style={{...card,padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
            <div style={lbl}>Proteína hoje</div>
            <span style={{fontSize:"10px",color:"#555"}}>{totProt}/{metaProt}g</span>
          </div>
          <div style={{background:"#0d0d0d",borderRadius:"100px",height:"6px",overflow:"hidden",marginBottom:"6px"}}>
            <div style={{background:"linear-gradient(90deg,#34d399,#6ee7b7)",height:"100%",borderRadius:"100px",width:`${pctProt}%`,transition:"width 0.4s",boxShadow:"0 0 6px rgba(52,211,153,0.4)"}}/>
          </div>
          <div style={{fontSize:"18px",fontWeight:"700",color:"#34d399"}}>{totProt}g <span style={{fontSize:"11px",color:"#555",fontWeight:"400"}}>proteína</span></div>
        </div>
      </div>

      {/* Metas config */}
      <div style={{...card,padding:"14px 16px",marginBottom:"16px",display:"flex",gap:"12px",alignItems:"center"}}>
        <span style={{fontSize:"11px",color:"#555",flexShrink:0}}>META DIÁRIA:</span>
        <div style={{display:"flex",alignItems:"center",gap:"6px",flex:1}}>
          <input type="number" value={metaCal} onChange={e=>setMetaCal(Number(e.target.value))} style={{...inp,width:"80px",padding:"5px 8px",fontSize:"12px",textAlign:"center"}}/>
          <span style={{fontSize:"11px",color:"#555"}}>kcal</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"6px",flex:1}}>
          <input type="number" value={metaProt} onChange={e=>setMetaProt(Number(e.target.value))} style={{...inp,width:"70px",padding:"5px 8px",fontSize:"12px",textAlign:"center"}}/>
          <span style={{fontSize:"11px",color:"#555"}}>g prot</span>
        </div>
      </div>

      {/* Gráficos */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
        {macrosPie.length>0 && (
          <div style={{...card,padding:"16px"}}>
            <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"12px"}}>MACROS HOJE</div>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={macrosPie} dataKey="valor" cx="50%" cy="50%" innerRadius={30} outerRadius={52} paddingAngle={4}>
                  {macrosPie.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip content={<DarkTooltip prefix=""/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"grid",gap:"3px",marginTop:"6px"}}>
              {macrosPie.map((d,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:"5px"}}>
                  <div style={{width:"6px",height:"6px",borderRadius:"50%",background:d.color}}/>
                  <span style={{fontSize:"10px",color:"#555",flex:1}}>{d.name}</span>
                  <span style={{fontSize:"10px",color:"#f0f0f0"}}>{d.valor}g</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{...card,padding:"16px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"12px"}}>CALORIAS/DIA</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={last7} barSize={18} margin={{top:0,right:0,bottom:0,left:0}}>
              <XAxis dataKey="name" tick={{fill:"#555",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip content={<DarkTooltip prefix=""/>}/>
              <Bar dataKey="Calorias" radius={[4,4,0,0]}>
                {last7.map((d,i)=><Cell key={i} fill={d.isToday?"#fb923c":"#3d2080"}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filtro por dia */}
      <div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"16px"}}>
        <input type="date" value={diaFilter.split("/").reverse().join("-")}
          onChange={e=>{const p=e.target.value.split("-");setDiaFilter(`${p[2]}/${p[1]}/${p[0]}`);}}
          style={{...inp,width:"auto",colorScheme:"dark"}}/>
        <button onClick={()=>setShowForm(!showForm)} style={btnPurple}>{showForm?"✕":"+ Refeição"}</button>
      </div>

      {showForm && (
        <div style={{...card,padding:"18px",marginBottom:"18px",display:"grid",gap:"10px"}}>
          <input placeholder="Nome do alimento/refeição" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} style={inp}/>
          <select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} style={inp}>
            {TIPOS.map(t=><option key={t}>{t}</option>)}
          </select>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <input placeholder="Calorias (kcal)" type="number" value={form.calorias} onChange={e=>setForm({...form,calorias:e.target.value})} style={inp}/>
            <input placeholder="Proteína (g)" type="number" value={form.proteina} onChange={e=>setForm({...form,proteina:e.target.value})} style={inp}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <input placeholder="Carboidrato (g)" type="number" value={form.carbo} onChange={e=>setForm({...form,carbo:e.target.value})} style={inp}/>
            <input placeholder="Gordura (g)" type="number" value={form.gordura} onChange={e=>setForm({...form,gordura:e.target.value})} style={inp}/>
          </div>
          <button onClick={add} style={{...btnPurple,padding:"10px",fontSize:"13px"}}>Adicionar Refeição</button>
        </div>
      )}

      <div style={{display:"grid",gap:"7px",marginBottom:"20px"}}>
        {doDia.length===0&&<div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"24px"}}>Nenhuma refeição registrada hoje</div>}
        {doDia.map(r=>(
          <div key={r.id} style={{...card,padding:"12px 14px",display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:"13px",fontWeight:"500",color:"#f0f0f0"}}>{r.nome}</div>
              <div style={{fontSize:"11px",color:"#555",marginTop:"2px"}}>{r.tipo}</div>
            </div>
            <div style={{display:"flex",gap:"10px",fontSize:"11px"}}>
              {r.calorias>0&&<span style={{color:"#fb923c",fontWeight:"600"}}>{r.calorias}kcal</span>}
              {r.proteina>0&&<span style={{color:"#34d399"}}>{r.proteina}g prot</span>}
              {r.carbo>0   &&<span style={{color:"#60a5fa"}}>{r.carbo}g carb</span>}
            </div>
            <button onClick={()=>setRefeicoes(refeicoes.filter(x=>x.id!==r.id))} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"16px"}}>×</button>
          </div>
        ))}
      </div>

      <IAWidget
        context={`Data: ${diaFilter}\nCalorias consumidas: ${totCal} / meta ${metaCal} kcal (${pctCal}%)\nProteína: ${totProt}g / meta ${metaProt}g (${pctProt}%)\nCarboidratos: ${totCarb}g\nGorduras: ${totGord}g\nRefeições do dia:\n${doDia.map(r=>`- ${r.tipo}: ${r.nome} (${r.calorias}kcal, ${r.proteina}g prot)`).join("\n")}`}
        systemPrompt="Você é um nutricionista esportivo virtual. Analise a dieta do dia do usuário, verifique se está atingindo as metas calóricas e de macros, identifique o que falta e dê sugestões de refeições ou ajustes. Seja específico e prático. Responda em português brasileiro. Máximo 200 palavras."
        placeholder="Ex: Estou comendo proteína suficiente? O que falta?"
      />
    </div>
  );
}

// ── MEDIDAS & METAS FÍSICAS ───────────────────────────────────────────────────
function MedidasMetas() {
  const [medidas,setMedidas]   = useStorage("treino:medidas",[]);
  const [metas,setMetas]       = useStorage("treino:metas",[]);
  const [showMed,setShowMed]   = useState(false);
  const [showMeta,setShowMeta] = useState(false);
  const [medForm,setMedForm]   = useState({data:today.toLocaleDateString("pt-BR"),peso:"",gordura:"",musculo:"",peito:"",cintura:"",quadril:"",braco:"",coxa:""});
  const [metaForm,setMetaForm] = useState({nome:"",valor:"",unit:"kg",prazo:""});

  const addMedida = () => {
    if (!medForm.peso && !medForm.gordura && !medForm.musculo) return;
    setMedidas([...medidas,{id:Date.now(),...medForm,peso:Number(medForm.peso||0),gordura:Number(medForm.gordura||0),musculo:Number(medForm.musculo||0)}]);
    setMedForm({data:today.toLocaleDateString("pt-BR"),peso:"",gordura:"",musculo:"",peito:"",cintura:"",quadril:"",braco:"",coxa:""});
    setShowMed(false);
  };

  const addMeta = () => {
    if (!metaForm.nome) return;
    setMetas([...metas,{id:Date.now(),...metaForm,valor:Number(metaForm.valor||0),atual:0}]);
    setMetaForm({nome:"",valor:"",unit:"kg",prazo:""});
    setShowMeta(false);
  };

  const updateMeta = (id, atual) => setMetas(metas.map(m=>m.id===id?{...m,atual:Number(atual)}:m));

  const lastMedida = medidas.slice(-1)[0];
  const prevMedida = medidas.slice(-2,-1)[0];

  // Evolução peso
  const pesoData = medidas.filter(m=>m.peso>0).slice(-12).map(m=>({name:m.data.slice(0,5),Peso:m.peso}));
  const gordData = medidas.filter(m=>m.gordura>0).slice(-12).map(m=>({name:m.data.slice(0,5),"Gordura%":m.gordura}));

  const diff = (campo) => {
    if (!lastMedida||!prevMedida) return null;
    const d = (lastMedida[campo]||0)-(prevMedida[campo]||0);
    return d;
  };

  return (
    <div>
      {/* Última medida */}
      {lastMedida && (
        <div style={{...card,padding:"16px 18px",marginBottom:"20px",borderColor:"#3d2080"}}>
          <div style={{fontSize:"11px",color:"#7c3aed",letterSpacing:"0.06em",marginBottom:"12px"}}>ÚLTIMA MEDIÇÃO — {lastMedida.data}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px"}}>
            {[
              {l:"Peso",v:lastMedida.peso,u:"kg",campo:"peso",pos:false},
              {l:"Gordura",v:lastMedida.gordura,u:"%",campo:"gordura",pos:false},
              {l:"Músculo",v:lastMedida.musculo,u:"%",campo:"musculo",pos:true},
            ].filter(x=>x.v>0).map(x=>{
              const d=diff(x.campo);
              return (
                <div key={x.l}>
                  <div style={lbl}>{x.l}</div>
                  <div style={{fontSize:"18px",fontWeight:"700",color:"#f0f0f0"}}>{x.v}<span style={{fontSize:"11px",color:"#555",fontWeight:"400"}}>{x.u}</span></div>
                  {d!==null&&d!==0&&<div style={{fontSize:"10px",color:(x.pos?d>0:d<0)?"#34d399":"#f87171",marginTop:"2px"}}>{d>0?"+":""}{d.toFixed(1)}{x.u} vs anterior</div>}
                </div>
              );
            })}
          </div>
          {(lastMedida.cintura||lastMedida.peito||lastMedida.braco) && (
            <div style={{display:"flex",gap:"16px",marginTop:"12px",paddingTop:"12px",borderTop:"1px solid #2a2a2a",flexWrap:"wrap"}}>
              {[["Peito",lastMedida.peito],["Cintura",lastMedida.cintura],["Quadril",lastMedida.quadril],["Braço",lastMedida.braco],["Coxa",lastMedida.coxa]].filter(([,v])=>v).map(([l,v])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontSize:"9px",color:"#555",letterSpacing:"0.06em"}}>{l}</div>
                  <div style={{fontSize:"13px",fontWeight:"600",color:"#a78bfa"}}>{v}<span style={{fontSize:"9px",color:"#555"}}>cm</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gráficos evolução */}
      {pesoData.length>=2 && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"20px"}}>
          <div style={{...card,padding:"14px"}}>
            <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"10px"}}>PESO (kg)</div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={pesoData} margin={{top:5,right:5,bottom:0,left:0}}>
                <XAxis dataKey="name" tick={{fill:"#555",fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis hide domain={["auto","auto"]}/>
                <Tooltip content={<DarkTooltip prefix=""/>}/>
                <Line type="monotone" dataKey="Peso" stroke="#a78bfa" strokeWidth={2} dot={{r:3,fill:"#a78bfa"}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          {gordData.length>=2 && (
            <div style={{...card,padding:"14px"}}>
              <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"10px"}}>GORDURA (%)</div>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={gordData} margin={{top:5,right:5,bottom:0,left:0}}>
                  <XAxis dataKey="name" tick={{fill:"#555",fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis hide domain={["auto","auto"]}/>
                  <Tooltip content={<DarkTooltip prefix=""/>}/>
                  <Line type="monotone" dataKey="Gordura%" stroke="#f87171" strokeWidth={2} dot={{r:3,fill:"#f87171"}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Botões */}
      <div style={{display:"flex",gap:"8px",marginBottom:"20px"}}>
        <button onClick={()=>{setShowMed(!showMed);setShowMeta(false);}} style={{...btnPurple,flex:1}}>{showMed?"✕ Fechar":"+ Nova Medição"}</button>
        <button onClick={()=>{setShowMeta(!showMeta);setShowMed(false);}} style={{...btnPurple,flex:1,background:"#3d2080",boxShadow:"none"}}>{showMeta?"✕ Fechar":"+ Meta Física"}</button>
      </div>

      {/* Form medição */}
      {showMed && (
        <div style={{...card,padding:"18px",marginBottom:"18px",display:"grid",gap:"10px"}}>
          <input type="date" value={medForm.data.split("/").reverse().join("-")}
            onChange={e=>{const p=e.target.value.split("-");setMedForm({...medForm,data:`${p[2]}/${p[1]}/${p[0]}`});}}
            style={{...inp,colorScheme:"dark"}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px"}}>
            <input placeholder="Peso (kg)" type="number" value={medForm.peso} onChange={e=>setMedForm({...medForm,peso:e.target.value})} style={inp}/>
            <input placeholder="Gordura %" type="number" value={medForm.gordura} onChange={e=>setMedForm({...medForm,gordura:e.target.value})} style={inp}/>
            <input placeholder="Músculo %" type="number" value={medForm.musculo} onChange={e=>setMedForm({...medForm,musculo:e.target.value})} style={inp}/>
          </div>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em"}}>CIRCUNFERÊNCIAS (cm) — opcional</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <input placeholder="Peito" type="number" value={medForm.peito} onChange={e=>setMedForm({...medForm,peito:e.target.value})} style={inp}/>
            <input placeholder="Cintura" type="number" value={medForm.cintura} onChange={e=>setMedForm({...medForm,cintura:e.target.value})} style={inp}/>
            <input placeholder="Quadril" type="number" value={medForm.quadril} onChange={e=>setMedForm({...medForm,quadril:e.target.value})} style={inp}/>
            <input placeholder="Braço" type="number" value={medForm.braco} onChange={e=>setMedForm({...medForm,braco:e.target.value})} style={inp}/>
          </div>
          <button onClick={addMedida} style={{...btnPurple,padding:"10px",fontSize:"13px"}}>Salvar Medição</button>
        </div>
      )}

      {/* Form meta */}
      {showMeta && (
        <div style={{...card,padding:"18px",marginBottom:"18px",display:"grid",gap:"10px"}}>
          <input placeholder="Meta (ex: Chegar a 10% gordura)" value={metaForm.nome} onChange={e=>setMetaForm({...metaForm,nome:e.target.value})} style={inp}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px"}}>
            <input placeholder="Valor alvo" type="number" value={metaForm.valor} onChange={e=>setMetaForm({...metaForm,valor:e.target.value})} style={inp}/>
            <input placeholder="Unidade" value={metaForm.unit} onChange={e=>setMetaForm({...metaForm,unit:e.target.value})} style={inp}/>
            <input type="date" value={metaForm.prazo} onChange={e=>setMetaForm({...metaForm,prazo:e.target.value})} style={{...inp,colorScheme:"dark"}}/>
          </div>
          <button onClick={addMeta} style={{...btnPurple,padding:"10px",fontSize:"13px"}}>Adicionar Meta</button>
        </div>
      )}

      {/* Metas físicas */}
      {metas.length>0 && (
        <>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.06em",marginBottom:"12px"}}>METAS FÍSICAS</div>
          <div style={{display:"grid",gap:"10px",marginBottom:"20px"}}>
            {metas.map(m=>{
              const pct = m.valor>0?Math.min(100,Math.round((m.atual/m.valor)*100)):0;
              return (
                <div key={m.id} style={{...card,padding:"14px 16px",borderColor:pct>=100?"#1a4a3a":"#2a2a2a"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                    <div>
                      <div style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0"}}>{m.nome}</div>
                      {m.prazo&&<div style={{fontSize:"10px",color:"#555",marginTop:"2px"}}>Prazo: {new Date(m.prazo+"T12:00").toLocaleDateString("pt-BR")}</div>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <span style={{fontSize:"12px",fontWeight:"700",color:pct>=100?"#34d399":"#a78bfa"}}>{pct}%</span>
                      <button onClick={()=>setMetas(metas.filter(x=>x.id!==m.id))} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"14px"}}>×</button>
                    </div>
                  </div>
                  <div style={{background:"#0d0d0d",borderRadius:"100px",height:"5px",overflow:"hidden",marginBottom:"8px"}}>
                    <div style={{background:pct>=100?"#34d399":"linear-gradient(90deg,#7c3aed,#a78bfa)",height:"100%",borderRadius:"100px",width:`${pct}%`,transition:"width 0.4s",boxShadow:"0 0 6px rgba(124,58,237,0.4)"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:"11px",color:"#555"}}>
                    <span>Atual: {m.atual} {m.unit}</span>
                    <span>Meta: {m.valor} {m.unit}</span>
                    <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                      <input type="number" placeholder="atualizar" value={m.atual||""}
                        onChange={e=>updateMeta(m.id,e.target.value)}
                        style={{...inp,width:"80px",padding:"4px 8px",fontSize:"11px"}}/>
                      <span style={{color:"#555"}}>{m.unit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {medidas.length===0&&metas.length===0&&(
        <div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"32px"}}>Registre suas medidas e defina metas físicas</div>
      )}

      <IAWidget
        context={`Última medição: ${lastMedida?`Peso ${lastMedida.peso}kg, Gordura ${lastMedida.gordura}%, Músculo ${lastMedida.musculo}%`:"nenhuma"}\nTotal de medições: ${medidas.length}\nMetas físicas:\n${metas.map(m=>`- ${m.nome}: ${m.atual}/${m.valor}${m.unit} (${m.valor>0?Math.round((m.atual/m.valor)*100):0}%)`).join("\n")}\nEvolução de peso: ${pesoData.map(p=>`${p.name}:${p.Peso}kg`).join(", ")}`}
        systemPrompt="Você é um personal trainer e especialista em composição corporal. Analise as medidas e metas físicas do usuário, identifique tendências, celebre progressos e dê orientações práticas sobre treino e nutrição para atingir os objetivos. Seja motivador e específico. Responda em português brasileiro. Máximo 200 palavras."
        placeholder="Ex: Estou evoluindo bem? Como acelerar meus resultados?"
      />
    </div>
  );
}

// ── FECHAMENTO MENSAL ─────────────────────────────────────────────────────────
function MonthCloseModal({ onDismiss }) {
  // Mês anterior
  const prevMonth  = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
  const prevYear   = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
  const prevLabel  = `${MONTHS[prevMonth]} ${prevYear}`;

  // Dados do mês anterior
  const [transactions] = useStorage("fin:transactions", []);
  const [tasks]        = useStorage("tasks:list", []);
  const [habits]       = useStorage("habits:list", []);
  const [checks]       = useStorage("habits:checks", {});
  const [goals]        = useStorage("goals:list", []);
  const [treinos]      = useStorage("treino:log", []);
  const [refeicoes]    = useStorage("treino:dieta", []);

  const prevTx = transactions.filter(t => {
    const d = new Date(t.ts || 0);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });
  const receitas = prevTx.filter(t => (t.tipo||t.type) === "receita").reduce((s, t) => s + Number(t.valor)||0, 0);
  const despesas = prevTx.filter(t => (t.tipo||t.type) === "despesa").reduce((s, t) => s + Number(t.valor)||0, 0);
  const saldo    = receitas - despesas;

  // Hábitos: % de dias cumpridos no mês anterior
  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
  let habitChecks = 0, habitTotal = 0;
  habits.forEach(h => {
    for (let d = 1; d <= daysInPrevMonth; d++) {
      const dk = `${prevYear}-${prevMonth}-${d}`;
      habitTotal++;
      if (checks[`${h.id}-${dk}`]) habitChecks++;
    }
  });
  const habitPct = habitTotal > 0 ? Math.round((habitChecks / habitTotal) * 100) : 0;

  // Tarefas concluídas no mês
  const tasksDone = tasks.filter(t => t.done).length;

  // Treinos no mês anterior
  const treinosMes = treinos.filter(t => {
    const d = new Date(t.ts || 0);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  }).length;

  // Calorias média do mês
  const diasComComida = [...new Set(refeicoes.filter(r => {
    const parts = r.data?.split("/");
    if (!parts || parts.length < 3) return false;
    return Number(parts[1]) - 1 === prevMonth && Number(parts[2]) === prevYear;
  }).map(r => r.data))];
  const calTotal = diasComComida.reduce((s, data) =>
    s + refeicoes.filter(r => r.data === data).reduce((ss, r) => ss + r.calorias, 0), 0);
  const calMedia = diasComComida.length > 0 ? Math.round(calTotal / diasComComida.length) : 0;

  // Metas com progresso
  const metasAtivas = goals.filter(g => {
    const p = Math.min(100, Math.round((g.progress / g.target) * 100));
    return p > 0;
  });

  const sections = [
    {
      emoji: "💰", title: "Finanças",
      items: [
        { label: "Receitas",  val: `R$ ${fmt(receitas)}`,  color: "#a78bfa" },
        { label: "Despesas",  val: `R$ ${fmt(despesas)}`,  color: "#f87171" },
        { label: "Saldo",     val: `${saldo >= 0 ? "+" : ""}R$ ${fmt(saldo)}`, color: saldo >= 0 ? "#34d399" : "#f87171" },
      ],
    },
    {
      emoji: "🔥", title: "Hábitos",
      items: [
        { label: "Consistência", val: `${habitPct}%`, color: habitPct >= 70 ? "#34d399" : habitPct >= 40 ? "#a78bfa" : "#f87171" },
        { label: "Hábitos ativos", val: habits.length, color: "#f0f0f0" },
      ],
    },
    {
      emoji: "✅", title: "Tarefas",
      items: [
        { label: "Concluídas",  val: tasksDone, color: "#34d399" },
        { label: "Pendentes",   val: tasks.filter(t => !t.done).length, color: "#f87171" },
      ],
    },
    {
      emoji: "💪", title: "Treino",
      items: [
        { label: "Sessões",       val: treinosMes, color: "#a78bfa" },
        { label: "Cal. média/dia", val: calMedia > 0 ? `${calMedia} kcal` : "—", color: "#fb923c" },
      ],
    },
  ];

  // Barra de progresso de metas
  const pct = g => Math.min(100, Math.round((g.progress / g.target) * 100));

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      backdropFilter: "blur(4px)",
      animation: "fadeIn 0.25s ease",
    }}>
      <div style={{
        width: "100%", maxWidth: "600px",
        background: "#0d0d0d", borderRadius: "20px 20px 0 0",
        border: "1px solid #2a2a2a", borderBottom: "none",
        padding: "28px 24px 40px",
        maxHeight: "90vh", overflowY: "auto",
        animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}>
        {/* Handle bar */}
        <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "#2a2a2a", margin: "0 auto 24px" }}/>

        {/* Título */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>📅</div>
          <div style={{ fontSize: "11px", color: "#7c3aed", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>
            Fechamento automático
          </div>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "300", color: "#f0f0f0" }}>
            {prevLabel}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#555" }}>
            O mês acabou — aqui está um resumo completo do seu desempenho
          </p>
        </div>

        {/* Saldo destaque */}
        <div style={{
          background: saldo >= 0 ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
          border: `1px solid ${saldo >= 0 ? "#1a4a3a" : "#4a1a1a"}`,
          borderRadius: "14px", padding: "18px 20px", marginBottom: "20px", textAlign: "center",
        }}>
          <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.08em", marginBottom: "6px" }}>
            RESULTADO DO MÊS
          </div>
          <div style={{ fontSize: "32px", fontWeight: "700", color: saldo >= 0 ? "#34d399" : "#f87171" }}>
            {saldo >= 0 ? "+" : ""}R$ {fmt(saldo)}
          </div>
          <div style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>
            {saldo >= 0 ? "✦ Mês positivo! Bom trabalho." : "⚠ Mês negativo. Analise os gastos."}
          </div>
        </div>

        {/* Grid de seções */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
          {sections.map(s => (
            <div key={s.title} style={{ background: "#1a1a1a", borderRadius: "12px", padding: "14px 16px", border: "1px solid #2a2a2a" }}>
              <div style={{ fontSize: "13px", marginBottom: "10px" }}>
                {s.emoji} <span style={{ color: "#f0f0f0", fontWeight: "600", fontSize: "12px" }}>{s.title}</span>
              </div>
              {s.items.map(item => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <span style={{ fontSize: "11px", color: "#555" }}>{item.label}</span>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: item.color }}>{item.val}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Metas */}
        {metasAtivas.length > 0 && (
          <div style={{ background: "#1a1a1a", borderRadius: "12px", padding: "16px", marginBottom: "20px", border: "1px solid #2a2a2a" }}>
            <div style={{ fontSize: "12px", color: "#f0f0f0", marginBottom: "12px", fontWeight: "600" }}>🎯 Metas</div>
            {metasAtivas.map(g => (
              <div key={g.id} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#f0f0f0", marginBottom: "4px" }}>
                  <span>{g.title}</span>
                  <span style={{ color: pct(g) >= 100 ? "#34d399" : "#a78bfa", fontWeight: "700" }}>{pct(g)}%</span>
                </div>
                <div style={{ background: "#0d0d0d", borderRadius: "100px", height: "4px", overflow: "hidden" }}>
                  <div style={{ background: pct(g) >= 100 ? "#34d399" : "linear-gradient(90deg,#7c3aed,#a78bfa)", height: "100%", borderRadius: "100px", width: `${pct(g)}%`, transition: "width 0.5s" }}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Frase motivacional baseada no saldo */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "12px", color: "#555", fontStyle: "italic", lineHeight: 1.6 }}>
            {habitPct >= 70
              ? `Você manteve ${habitPct}% de consistência nos hábitos — excelente disciplina!`
              : habitPct >= 40
              ? `${habitPct}% de consistência nos hábitos. Próximo mês pode ser melhor!`
              : habits.length === 0
              ? "Adicione hábitos para acompanhar sua consistência mês a mês."
              : `Hábitos precisam de atenção — apenas ${habitPct}% de consistência este mês.`
            }
          </div>
        </div>

        {/* Botão fechar */}
        <button onClick={onDismiss} style={{
          width: "100%", background: "#7c3aed", color: "#fff", border: "none",
          borderRadius: "12px", padding: "14px", fontSize: "14px", fontWeight: "600",
          cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
          fontFamily: "inherit",
        }}>
          Entendido — começar {MONTHS[today.getMonth()]}! 🚀
        </button>
      </div>

      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }

        /* ── Otimizações mobile ── */
        @media (max-width:899px) {
          * { -webkit-tap-highlight-color: transparent; }
          input, select, textarea { font-size:16px !important; } /* previne zoom no iOS */
          button { min-height:44px; } /* área de toque mínima */
          .tab-content { padding-bottom:80px !important; }
        }
        /* ── Otimizações gerais ── */
        img { content-visibility: auto; }
        * { will-change: auto; }
        /* Scroll suave nativo */
        html { scroll-behavior: smooth; }
        /* Previne seleção acidental em botões */
        button { user-select: none; -webkit-user-select: none; }
        /* GPU acceleration para animações */
        .tab-content { transform: translateZ(0); backface-visibility: hidden; }
      `}</style>
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function Home({ onNav }) {
  const [transactions] = useStorage("fin:transactions", []);
  const [tasks]        = useStorage("tasks:list", []);
  const [habits]       = useStorage("habits:list", []);
  const [checks]       = useStorage("habits:checks", {});
  const [goals]        = useStorage("goals:list", []);
  const [events]       = useStorage("agenda:events", []);
  const [livros]       = useStorage("livros:list", []);
  const [treinoLog]    = useStorage("treino:log", []);
  const [pesos]        = useStorage("treino:pesos", []);

  const now      = new Date();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();
  const fmtDate  = (y,m,d) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const txMes    = transactions.filter(t=>{ const d=new Date(t.ts||0); return d.getMonth()===mesAtual&&d.getFullYear()===anoAtual; });
  const receitas = txMes.filter(t=>(t.tipo||t.type)==="receita").reduce((s,t)=>s+Number(t.valor),0);
  const despesas = txMes.filter(t=>(t.tipo||t.type)==="despesa").reduce((s,t)=>s+Number(t.valor),0);
  const saldo    = receitas - despesas;

  // ── Mês anterior ──────────────────────────────────────────────────────────
  const mesAnt = mesAtual===0?11:mesAtual-1;
  const anoAnt = mesAtual===0?anoAtual-1:anoAtual;
  const txAnt     = transactions.filter(t=>{ const d=new Date(t.ts||0); return d.getMonth()===mesAnt&&d.getFullYear()===anoAnt; });
  const recAnt    = txAnt.filter(t=>(t.tipo||t.type)==="receita").reduce((s,t)=>s+Number(t.valor),0);
  const despAnt   = txAnt.filter(t=>(t.tipo||t.type)==="despesa").reduce((s,t)=>s+Number(t.valor),0);
  const saldoAnt  = recAnt - despAnt;
  const diffSaldo = saldoAnt!==0 ? Math.round(((saldo-saldoAnt)/Math.abs(saldoAnt))*100) : null;
  const diffDesp  = despAnt!==0  ? Math.round(((despesas-despAnt)/despAnt)*100) : null;

  // ── Previsão até fim do mês ───────────────────────────────────────────────
  const diasPassados   = now.getDate();
  const diasNoMes      = new Date(anoAtual, mesAtual+1, 0).getDate();
  const diasRestantes  = diasNoMes - diasPassados;
  const gastoDiario    = diasPassados>0 ? despesas/diasPassados : 0;
  const despPrevista   = despesas + (gastoDiario * diasRestantes);
  const saldoPrevisto  = receitas - despPrevista;

  // ── Alerta de ritmo ───────────────────────────────────────────────────────
  const pctGasto = receitas>0 ? (despesas/receitas)*100 : (despesas>0?101:0);
  const ritmoNivel = pctGasto>100?"perigo":pctGasto>=80?"alerta":pctGasto>=60?"aviso":"ok";
  const ritmoCor   = {ok:"#34d399",aviso:"#fbbf24",alerta:"#fb923c",perigo:"#f87171"}[ritmoNivel];
  const ritmoMsg   = {
    ok:`✅ Gastos saudáveis (${Math.round(pctGasto)}% da receita)`,
    aviso:`⚠️ Atenção: ${Math.round(pctGasto)}% da receita já gasta`,
    alerta:`🔶 Ritmo alto! ${Math.round(pctGasto)}% da receita gasta`,
    perigo:`🔥 Você já gastou mais do que recebeu este mês!`,
  }[ritmoNivel];

  const tarefasPend  = tasks.filter(t=>!t.done);
  const tarefasDone  = tasks.filter(t=>t.done).length;

  const hojeKey    = fmtDate(anoAtual, mesAtual, now.getDate());
  // Hábitos usa chave "habitId-ano-mes-dia" (0-indexed month)
  const hjY = anoAtual, hjM = mesAtual, hjD = now.getDate();
  const habitsDone = habits.filter(h => checks[`${h.id}-${hjY}-${hjM}-${hjD}`]).length;
  const habitsTotal= habits.length;
  const habitPct   = habitsTotal>0 ? Math.round((habitsDone/habitsTotal)*100) : 0;

  const metasAtivas = goals.filter(g=>Math.round(((g.progress||0)/(g.target||1))*100)<100);
  const eventosHoje = events.filter(e=>e.dia===hojeKey).sort((a,b)=>(a.hora||"").localeCompare(b.hora||""));
  const proxEventos = events.filter(e=>{ const diff=Math.floor((new Date(e.dia+"T00:00:00")-new Date(anoAtual,mesAtual,now.getDate()))/86400000); return diff>0&&diff<=7; });
  const lendo       = livros.filter(l=>l.status==="lendo");
  const startWeek   = new Date(now); startWeek.setDate(now.getDate()-now.getDay());
  const treinosSem  = treinoLog.filter(t=>{ const d=new Date(t.ts||0); return d>=startWeek&&d<=now; }).length;
  const pesoAtual   = pesos.length>0 ? [...pesos].sort((a,b)=>a.ts-b.ts).slice(-1)[0].kg : null;

  const hora      = now.getHours();
  const saudacao  = hora<12?"Bom dia":hora<18?"Boa tarde":"Boa noite";
  const emoji     = hora<12?"☀️":hora<18?"🌤️":"🌙";
  const diaSemana = now.toLocaleDateString("pt-BR",{weekday:"long"});
  const dataFmt   = now.toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"});

  const modulos = [
    {
      key:"Finanças", icon:"💰", titulo:"Finanças",
      cor:ritmoCor, bg:`${ritmoCor}11`, border:`${ritmoCor}30`,
      valor:`${saldo>=0?"+":""}R$ ${fmt(saldo)}`, valorCor:saldo>=0?"#34d399":"#f87171",
      desc:saldo>=0?"Saldo positivo este mês":"Saldo negativo este mês",
      sub:`Receitas R$ ${fmt(receitas)}  ·  Despesas R$ ${fmt(despesas)}`,
      badge:saldo>=0?"✓ Positivo":"⚠ Negativo",
      badgeCor:saldo>=0?"#34d399":"#f87171", badgeBg:saldo>=0?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)",
      diffSaldo, diffDesp, saldoPrevisto, diasRestantes, pctGasto, ritmoNivel, ritmoCor, ritmoMsg, receitas, despesas,
    },
    {
      key:"Tarefas", icon:"✅", titulo:"Tarefas",
      cor:"#60a5fa", bg:"rgba(96,165,250,0.07)", border:"rgba(96,165,250,0.18)",
      valor:String(tarefasPend.length), valorCor:"#f0f0f0",
      desc:tarefasPend.length===0?"Tudo concluído hoje! 🎉":"Tarefas pendentes",
      sub:tarefasPend.slice(0,2).map(t=>t.text).join("  ·  ") || (tarefasDone>0?`${tarefasDone} tarefa${tarefasDone!==1?"s":""} concluída${tarefasDone!==1?"s":""}`:"-"),
      badge:`${tarefasDone} concluída${tarefasDone!==1?"s":""}`,
      badgeCor:"#60a5fa", badgeBg:"rgba(96,165,250,0.1)",
    },
    {
      key:"Hábitos", icon:"🔥", titulo:"Hábitos",
      cor:habitPct>=70?"#34d399":habitPct>=40?"#a78bfa":"#f87171",
      bg:habitPct>=70?"rgba(52,211,153,0.07)":habitPct>=40?"rgba(124,58,237,0.07)":"rgba(248,113,113,0.07)",
      border:habitPct>=70?"rgba(52,211,153,0.18)":habitPct>=40?"rgba(124,58,237,0.18)":"rgba(248,113,113,0.18)",
      valor:`${habitPct}%`, valorCor:habitPct>=70?"#34d399":habitPct>=40?"#a78bfa":"#f87171",
      desc:`${habitsDone} de ${habitsTotal} hábitos concluídos`,
      sub:habits.slice(0,3).map(h=>`${checks[`${h.id}-${hjY}-${hjM}-${hjD}`]?"✓":"○"} ${h.name}`).join("  ·  ")||"Nenhum hábito cadastrado",
      badge:habitPct>=70?"Ótimo dia! 🔥":habitPct>=40?"Em progresso":"Vamos lá!",
      badgeCor:habitPct>=70?"#34d399":habitPct>=40?"#a78bfa":"#f87171",
      badgeBg:habitPct>=70?"rgba(52,211,153,0.1)":habitPct>=40?"rgba(124,58,237,0.1)":"rgba(248,113,113,0.1)",
    },
    {
      key:"Metas", icon:"🎯", titulo:"Metas",
      cor:"#f472b6", bg:"rgba(244,114,182,0.07)", border:"rgba(244,114,182,0.18)",
      valor:String(metasAtivas.length), valorCor:"#f472b6",
      desc:metasAtivas.length===0?"Nenhuma meta ativa":"Metas em andamento",
      sub:metasAtivas.slice(0,2).map(g=>g.title).join("  ·  ")||"Crie sua primeira meta",
      badge:`${goals.length-metasAtivas.length} concluída${goals.length-metasAtivas.length!==1?"s":""}`,
      badgeCor:"#f472b6", badgeBg:"rgba(244,114,182,0.1)",
    },
    {
      key:"Treino", icon:"💪", titulo:"Treino",
      cor:"#a78bfa", bg:"rgba(167,139,250,0.07)", border:"rgba(167,139,250,0.18)",
      valor:String(treinosSem), valorCor:"#a78bfa",
      desc:"Treinos esta semana",
      sub:pesoAtual?`Peso atual: ${pesoAtual} kg`:"Nenhum peso registrado ainda",
      badge:treinosSem>=3?"Consistente 💪":treinosSem>0?"Em progresso":"Comece hoje",
      badgeCor:"#a78bfa", badgeBg:"rgba(167,139,250,0.1)",
    },
    {
      key:"Livros", icon:"📚", titulo:"Livros",
      cor:"#fb923c", bg:"rgba(251,146,60,0.07)", border:"rgba(251,146,60,0.18)",
      valor:String(lendo.length), valorCor:"#fb923c",
      desc:lendo.length===0?"Nenhum livro em leitura":"Livros sendo lidos",
      sub:lendo[0]?lendo[0].titulo:"Adicione um livro para começar",
      badge:`${livros.filter(l=>l.status==="lido").length} lido${livros.filter(l=>l.status==="lido").length!==1?"s":""}`,
      badgeCor:"#fb923c", badgeBg:"rgba(251,146,60,0.1)",
    },
    {
      key:"Agenda", icon:"📅", titulo:"Agenda",
      cor:"#38bdf8", bg:"rgba(56,189,248,0.07)", border:"rgba(56,189,248,0.18)",
      valor:String(eventosHoje.length), valorCor:"#38bdf8",
      desc:eventosHoje.length===0?"Nenhum evento hoje":"Eventos hoje",
      sub:eventosHoje[0]?`${eventosHoje[0].hora?eventosHoje[0].hora+" · ":""}${eventosHoje[0].titulo}`:proxEventos.length>0?`${proxEventos.length} eventos nos próximos 7 dias`:"Agenda livre",
      badge:proxEventos.length>0?`+${proxEventos.length} em breve`:"Livre",
      badgeCor:"#38bdf8", badgeBg:"rgba(56,189,248,0.1)",
    },
  ];

  return (
    <div style={{display:"grid",gap:"24px"}}>
      <style>{`
        .hmod { transition: all 0.18s ease !important; }
        .hmod:hover { transform: translateY(-3px) !important; box-shadow: 0 16px 40px rgba(0,0,0,0.45) !important; }
        .hmod:hover .hmod-arr { opacity:1 !important; transform:translateX(4px) !important; }
        .hmod-arr { opacity:0; transition:all 0.18s ease; display:inline-block; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── HERO ── */}
      <div style={{
        background:"linear-gradient(135deg,rgba(124,58,237,0.22) 0%,rgba(79,31,184,0.1) 60%,transparent 100%)",
        border:"1px solid rgba(124,58,237,0.22)", borderRadius:"26px",
        padding:"36px 32px", position:"relative", overflow:"hidden",
        animation:"fadeUp 0.4s ease both",
      }}>
        <div style={{position:"absolute",top:"-80px",right:"-60px",width:"300px",height:"300px",borderRadius:"50%",background:"radial-gradient(circle,rgba(124,58,237,0.18),transparent 65%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:"-50px",left:"25%",width:"180px",height:"180px",borderRadius:"50%",background:"radial-gradient(circle,rgba(168,85,247,0.1),transparent 65%)",pointerEvents:"none"}}/>

        <div style={{position:"relative"}}>
          <div style={{fontSize:"13px",fontWeight:"600",color:"#7c3aed",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"12px"}}>
            {diaSemana} · {dataFmt}
          </div>
          <div style={{fontSize:"42px",fontWeight:"800",color:"#f0f0f0",letterSpacing:"-0.03em",lineHeight:1.1,marginBottom:"10px"}}>
            {saudacao} {emoji}
          </div>
          <div style={{fontSize:"17px",color:"#666",marginBottom:"32px",fontWeight:"400",lineHeight:1.5}}>
            {habitsTotal>0
              ? habitPct===100 ? "Todos os hábitos concluídos hoje! Incrível 🎉"
              : `${habitsDone} de ${habitsTotal} hábitos concluídos hoje`
              : "Bem-vindo ao GOAT — Greatest Of All Time 🐐"}
          </div>

          {/* 4 stats rápidos */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"14px"}}>
            {[
              {label:"Saldo do mês",   val:`R$ ${fmt(Math.abs(saldo))}`, cor:saldo>=0?"#34d399":"#f87171", icon:"💰"},
              {label:"Pendentes",       val:`${tarefasPend.length} tarefas`,  cor:"#60a5fa", icon:"✅"},
              {label:"Hábitos hoje",    val:`${habitsDone}/${habitsTotal}`,    cor:habitPct>=70?"#34d399":"#a78bfa", icon:"🔥"},
              {label:"Eventos hoje",    val:`${eventosHoje.length} evento${eventosHoje.length!==1?"s":""}`, cor:"#38bdf8", icon:"📅"},
            ].map((s,i)=>(
              <div key={i} style={{
                background:"rgba(0,0,0,0.4)",
                border:"1px solid rgba(255,255,255,0.07)",
                borderRadius:"18px", padding:"18px 16px",
                backdropFilter:"blur(12px)",
              }}>
                <div style={{fontSize:"22px",marginBottom:"8px"}}>{s.icon}</div>
                <div style={{fontSize:"18px",fontWeight:"800",color:s.cor,lineHeight:1,marginBottom:"5px"}}>{s.val}</div>
                <div style={{fontSize:"12px",color:"#555",fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
        <div style={{flex:1,height:"1px",background:"rgba(255,255,255,0.05)"}}/>
        <span style={{fontSize:"11px",fontWeight:"700",color:"#333",letterSpacing:"0.14em",textTransform:"uppercase"}}>Seus módulos</span>
        <div style={{flex:1,height:"1px",background:"rgba(255,255,255,0.05)"}}/>
      </div>

      {/* ── CARDS ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
        {modulos.map((m,i)=>(
          <div key={m.key} className="hmod" onClick={()=>onNav(m.key)} style={{
            background:m.bg, border:`1px solid ${m.border}`,
            borderRadius:"22px", padding:"24px",
            cursor:"pointer", position:"relative", overflow:"hidden",
            animation:`fadeUp 0.35s ease both`,
            animationDelay:`${0.05+i*0.055}s`,
          }}>
            {/* Glow */}
            <div style={{position:"absolute",top:"-40px",right:"-40px",width:"120px",height:"120px",borderRadius:"50%",background:`radial-gradient(circle,${m.cor}20,transparent 70%)`,pointerEvents:"none"}}/>

            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"18px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                <div style={{
                  width:"42px",height:"42px",borderRadius:"13px",
                  background:`${m.cor}15`,border:`1px solid ${m.cor}25`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",
                }}>
                  {m.icon}
                </div>
                <span style={{fontSize:"14px",fontWeight:"700",color:"#777",textTransform:"uppercase",letterSpacing:"0.07em"}}>
                  {m.titulo}
                </span>
              </div>
              <span className="hmod-arr" style={{fontSize:"20px",color:m.cor}}>→</span>
            </div>

            {/* Valor */}
            <div style={{fontSize:"36px",fontWeight:"900",color:m.valorCor,letterSpacing:"-0.04em",lineHeight:1,marginBottom:"8px"}}>
              {m.valor}
            </div>

            {/* Desc */}
            <div style={{fontSize:"15px",color:"#999",fontWeight:"500",marginBottom:"10px"}}>
              {m.desc}
            </div>

            {/* ── EXTRAS FINANÇAS ── */}
            {m.key==="Finanças" && (
              <div style={{display:"grid",gap:"8px",marginBottom:"12px"}}>
                {m.diffSaldo!==null && (
                  <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                    <span style={{
                      fontSize:"12px",fontWeight:"700",
                      color:m.diffSaldo>=0?"#34d399":"#f87171",
                      background:m.diffSaldo>=0?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)",
                      border:`1px solid ${m.diffSaldo>=0?"rgba(52,211,153,0.25)":"rgba(248,113,113,0.25)"}`,
                      padding:"3px 9px",borderRadius:"20px",
                    }}>
                      {m.diffSaldo>=0?"↑":"↓"} {Math.abs(m.diffSaldo)}% vs mês passado
                    </span>
                  </div>
                )}
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                    <span style={{fontSize:"12px",color:"#555"}}>Receitas R$ {fmt(m.receitas)}</span>
                    <span style={{fontSize:"12px",color:"#555"}}>Despesas R$ {fmt(m.despesas)}</span>
                  </div>
                  <div style={{height:"6px",background:"rgba(255,255,255,0.06)",borderRadius:"100px",overflow:"hidden"}}>
                    <div style={{
                      height:"100%",borderRadius:"100px",
                      width:`${Math.min(100,m.pctGasto)}%`,
                      background:m.pctGasto>100?"#f87171":m.pctGasto>=80?"linear-gradient(90deg,#fb923c,#f87171)":m.pctGasto>=60?"linear-gradient(90deg,#fbbf24,#fb923c)":"linear-gradient(90deg,#34d399,#6ee7b7)",
                      transition:"width 0.8s",
                    }}/>
                  </div>
                </div>
                <div style={{
                  fontSize:"12px",fontWeight:"600",color:m.ritmoCor,
                  background:`${m.ritmoCor}12`,border:`1px solid ${m.ritmoCor}30`,
                  borderRadius:"10px",padding:"7px 12px",lineHeight:1.4,
                }}>
                  {m.ritmoMsg}
                </div>
                <div style={{
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  background:"rgba(255,255,255,0.04)",borderRadius:"10px",padding:"8px 12px",
                }}>
                  <span style={{fontSize:"12px",color:"#555"}}>📊 Previsão fim do mês</span>
                  <span style={{fontSize:"13px",fontWeight:"700",color:m.saldoPrevisto>=0?"#34d399":"#f87171"}}>
                    {m.saldoPrevisto>=0?"+":""}R$ {fmt(m.saldoPrevisto)}
                  </span>
                </div>
              </div>
            )}

            {/* Sub (outros cards) */}
            {m.key!=="Finanças" && (
              <div style={{fontSize:"13px",color:"#555",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:"16px"}}>
                {m.sub}
              </div>
            )}

            {/* Badge */}
            <span style={{
              display:"inline-flex",alignItems:"center",
              fontSize:"12px",fontWeight:"600",
              color:m.badgeCor,background:m.badgeBg,
              border:`1px solid ${m.badgeCor}35`,
              padding:"5px 12px",borderRadius:"20px",
            }}>
              {m.badge}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── POMODORO ──────────────────────────────────────────────────────────────────
function Pomodoro() {
  const [focoMin, setFocoMin]   = useState(25);
  const [pausaMin, setPausaMin] = useState(5);
  const [segundos, setSegundos] = useState(25*60);
  const [rodando, setRodando]   = useState(false);
  const [fase, setFase]         = useState("foco");
  const [ciclos, setCiclos]     = useState(0);
  const [editando, setEditando] = useState(false);
  const intervalRef = React.useRef(null);

  // Som suave usando Web Audio API — bowl tibetano sintético
  const tocarSom = (tipo="fim") => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const tocar = (freq, delay, dur, vol=0.18) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type      = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + dur + 0.1);
      };
      if (tipo==="fim") {
        // 3 notas suaves em sequência — estilo bowl tibetano
        tocar(432,  0,   2.5, 0.15);
        tocar(528,  0.6, 2.2, 0.12);
        tocar(396,  1.2, 2.8, 0.10);
        tocar(432,  2.0, 3.0, 0.08);
      } else {
        // Pausa — nota única mais suave
        tocar(396, 0, 2.0, 0.10);
      }
    } catch(e) { /* silêncio se browser não suportar */ }
  };

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (rodando) {
      intervalRef.current = setInterval(() => {
        setSegundos(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRodando(false);
            if (fase==="foco") {
              tocarSom("fim");
              setCiclos(c=>c+1);
              setFase("pausa");
              setSegundos(pausaMin*60);
            } else {
              tocarSom("pausa");
              setFase("foco");
              setSegundos(focoMin*60);
            }
            return 0;
          }
          return s-1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [rodando, fase, focoMin, pausaMin]);

  const resetar = () => {
    clearInterval(intervalRef.current);
    setRodando(false);
    setFase("foco");
    setSegundos(focoMin*60);
  };

  const total   = fase==="foco" ? focoMin*60 : pausaMin*60;
  const progPct = Math.round(((total-segundos)/total)*100);
  const minutos = Math.floor(segundos/60);
  const segs    = segundos%60;
  const timeStr = `${String(minutos).padStart(2,"0")}:${String(segs).padStart(2,"0")}`;
  const R = 54; const CIRC = 2*Math.PI*R;
  const offset  = CIRC - (progPct/100)*CIRC;
  const corFase = fase==="foco" ? "#a855f7" : "#34d399";

  return (
    <div style={{...card,padding:"20px",marginBottom:"20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
        <div style={{fontSize:"13px",fontWeight:"600",color:"#e0e0e0"}}>
          🍅 Pomodoro
          {ciclos>0 && <span style={{fontSize:"11px",color:"#555",marginLeft:"8px"}}>{ciclos} ciclo{ciclos>1?"s":""} hoje</span>}
        </div>
        <button onClick={()=>setEditando(!editando)} style={{...btnGhost,fontSize:"11px"}}>
          {editando?"✕ Fechar":"⚙ Tempo"}
        </button>
      </div>

      {/* Config de tempo */}
      {editando && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"16px",padding:"14px",background:"rgba(255,255,255,0.03)",borderRadius:"12px",border:"1px solid rgba(255,255,255,0.06)"}}>
          <div>
            <div style={{...lbl,marginBottom:"6px"}}>Foco (min)</div>
            <input type="number" min="1" max="120" value={focoMin}
              onChange={e=>{const v=Number(e.target.value); setFocoMin(v); if(!rodando&&fase==="foco") setSegundos(v*60);}}
              style={{...inp,textAlign:"center"}}/>
          </div>
          <div>
            <div style={{...lbl,marginBottom:"6px"}}>Pausa (min)</div>
            <input type="number" min="1" max="60" value={pausaMin}
              onChange={e=>{const v=Number(e.target.value); setPausaMin(v); if(!rodando&&fase==="pausa") setSegundos(v*60);}}
              style={{...inp,textAlign:"center"}}/>
          </div>
        </div>
      )}

      {/* Timer circular */}
      <div style={{display:"flex",alignItems:"center",gap:"24px"}}>
        <div style={{flexShrink:0,position:"relative",width:"128px",height:"128px"}}>
          <svg width="128" height="128" style={{transform:"rotate(-90deg)"}}>
            <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8"/>
            <circle cx="64" cy="64" r={R} fill="none" stroke={corFase} strokeWidth="8"
              strokeDasharray={CIRC} strokeDashoffset={offset}
              strokeLinecap="round" style={{transition:"stroke-dashoffset 0.8s linear, stroke 0.3s"}}/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:"26px",fontWeight:"700",color:"#f0f0f0",letterSpacing:"-0.03em",fontVariantNumeric:"tabular-nums"}}>{timeStr}</div>
            <div style={{fontSize:"10px",fontWeight:"600",letterSpacing:"0.1em",color:corFase,textTransform:"uppercase",marginTop:"2px"}}>
              {fase==="foco"?"Foco":"Pausa"}
            </div>
          </div>
        </div>

        <div style={{flex:1,display:"grid",gap:"8px"}}>
          <button onClick={()=>setRodando(r=>!r)} style={{
            ...btnPurple, padding:"12px",fontSize:"15px",
            background: rodando ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#7c3aed,#6d28d9)",
            letterSpacing:"0.04em",
          }}>
            {rodando ? "⏸ Pausar" : "▶ Iniciar"}
          </button>
          <button onClick={resetar} style={{...btnGhost,padding:"10px",textAlign:"center",fontSize:"12px"}}>
            ↺ Reiniciar
          </button>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",fontSize:"11px",color:"#555",textAlign:"center"}}>
            <div style={{background:"rgba(168,85,247,0.08)",borderRadius:"8px",padding:"6px"}}>
              <div style={{fontSize:"14px",fontWeight:"700",color:"#a855f7"}}>{focoMin}m</div>
              <div>foco</div>
            </div>
            <div style={{background:"rgba(52,211,153,0.08)",borderRadius:"8px",padding:"6px"}}>
              <div style={{fontSize:"14px",fontWeight:"700",color:"#34d399"}}>{pausaMin}m</div>
              <div>pausa</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LIVROS ────────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { id:"lendo",     label:"Lendo",        color:"#a78bfa", icon:"📖" },
  { id:"quero",     label:"Quero ler",    color:"#60a5fa", icon:"🔖" },
  { id:"lido",      label:"Lido",         color:"#34d399", icon:"✓"  },
  { id:"pausado",   label:"Pausado",      color:"#fb923c", icon:"⏸"  },
  { id:"abandonei", label:"Abandonei",    color:"#f87171", icon:"✕"  },
];

function StarRating({ value, onChange, readonly=false }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{display:"flex",gap:"3px",alignItems:"center"}}>
      {[1,2,3,4,5].map(n => (
        <span key={n}
          onClick={() => !readonly && onChange(n === value ? 0 : n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          style={{
            fontSize: readonly ? "13px" : "18px",
            cursor: readonly ? "default" : "pointer",
            color: n <= (hover || value) ? "#f59e0b" : "#2a2a2a",
            transition:"color 0.1s",
            lineHeight:1,
          }}>★</span>
      ))}
      {readonly && value > 0 && <span style={{fontSize:"11px",color:"#555",marginLeft:"4px"}}>{value}/5</span>}
    </div>
  );
}

// ── CATEGORIAS DE DESTAQUE padrão ───────────────────────────────────────────
// ── CATEGORIAS DE DESTAQUE padrão ────────────────────────────────────────────
const CATS_DESTAQUE_DEFAULT = [
  { id:"aplicar",  cor:"#a855f7", titulo:"Aplicar na minha vida", icone:"🟣", desc:"Algo que quero colocar em prática" },
  { id:"ideia",    cor:"#f87171", titulo:"Ideia importante",       icone:"🔴", desc:"Conceito ou ideia relevante" },
  { id:"frase",    cor:"#fbbf24", titulo:"Frase marcante",         icone:"🟡", desc:"Citação ou trecho impactante" },
  { id:"conceito", cor:"#60a5fa", titulo:"Conceito novo",          icone:"🔵", desc:"Aprendi algo novo" },
  { id:"acao",     cor:"#34d399", titulo:"Ação prática",           icone:"🟢", desc:"Algo concreto para fazer" },
];

function Livros() {
  const [livros, setLivros]             = useStorage("livros:list", []);
  const [catsDestaque, setCatsDestaque] = useStorage("livros:cats", CATS_DESTAQUE_DEFAULT);
  const [highlights, setHighlights]     = useStorage("livros:highlights", []);
  const [showForm, setShowForm]         = useState(false);
  const [filtro, setFiltro]             = useState("todos");
  const [expanded, setExpanded]         = useState(null);
  const [novaAnotacao, setNovaAnotacao] = useState({});
  const [catSelecionada, setCatSelecionada] = useState({});
  const [showCatMenu, setShowCatMenu]   = useState({});
  const [showGerenciar, setShowGerenciar] = useState(false);
  const [showRevisao, setShowRevisao]   = useState(false);
  const [formCat, setFormCat]           = useState({titulo:"", cor:"#a855f7", icone:"🟣", desc:""});
  const [editingCat, setEditingCat]     = useState(null);
  const [showFormCat, setShowFormCat]   = useState(false);
  const [form, setForm] = useState({titulo:"", autor:"", photo:"", status:"quero", nota:0, paginas:"", pagAtual:"", sinopse:""});
  const [editing, setEditing] = useState(null);

  const CORES_CAT  = ["#a855f7","#f87171","#fbbf24","#60a5fa","#34d399","#fb923c","#f472b6","#38bdf8","#818cf8","#e879f9"];
  const ICONES_CAT = ["🟣","🔴","🟡","🔵","🟢","🟠","🩷","⭐","💡","🎯","❤️","🔖","💎","🧠","✨"];

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCat   = (id) => catsDestaque.find(c=>c.id===id) || catsDestaque[0];
  const statusObj= (id) => STATUS_OPTIONS.find(s=>s.id===id) || STATUS_OPTIONS[0];

  // ── CRUD livros ───────────────────────────────────────────────────────────
  const handlePhoto = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({...f, photo: ev.target.result}));
    reader.readAsDataURL(file); e.target.value = "";
  };

  const salvar = () => {
    if (!form.titulo.trim()) return;
    const livro = {...form, paginas:Number(form.paginas)||0, pagAtual:Number(form.pagAtual)||0,
      anotacoes: editing ? (livros.find(l=>l.id===editing)?.anotacoes||[]) : []};
    if (editing) {
      setLivros(livros.map(l => l.id===editing ? {...l,...livro} : l));
      setEditing(null);
    } else {
      setLivros([...livros, {id:Date.now(), ...livro, adicionado:new Date().toLocaleDateString("pt-BR")}]);
    }
    setForm({titulo:"",autor:"",photo:"",status:"quero",nota:0,paginas:"",pagAtual:"",sinopse:""});
    setShowForm(false);
  };

  const abrirEditar = (l) => {
    setForm({titulo:l.titulo,autor:l.autor||"",photo:l.photo||"",status:l.status,nota:l.nota||0,paginas:l.paginas||"",pagAtual:l.pagAtual||"",sinopse:l.sinopse||""});
    setEditing(l.id); setShowForm(true); setExpanded(null);
  };

  const deletar = (id) => {
    setLivros(livros.filter(l=>l.id!==id));
    setHighlights(highlights.filter(h=>h.bookId!==id));
  };

  // ── CRUD anotações (simples, sem categoria) ──────────────────────────────
  const addAnotacao = (id) => {
    const texto = novaAnotacao[id]?.trim(); if (!texto) return;
    const cat = catSelecionada[id] || catsDestaque[0]?.id;
    const catObj = getCat(cat);
    // salva como highlight estruturado
    const hl = {
      id: Date.now(),
      text: texto,
      color: catObj?.cor || "#fbbf24",
      category: catObj?.id || cat,
      bookId: id,
      page: null,
      date: new Date().toISOString().split("T")[0],
    };
    setHighlights([...highlights, hl]);
    // também salva em anotacoes do livro para compatibilidade
    setLivros(livros.map(l => l.id===id
      ? {...l, anotacoes:[...(l.anotacoes||[]), {id:hl.id, texto, data:new Date().toLocaleDateString("pt-BR"), catId:cat}]}
      : l
    ));
    setNovaAnotacao(n=>({...n,[id]:""}));
    setShowCatMenu(m=>({...m,[id]:false}));
  };

  const delAnotacao = (livroId, anotId) => {
    setLivros(livros.map(l => l.id===livroId
      ? {...l, anotacoes:(l.anotacoes||[]).filter(a=>a.id!==anotId)} : l));
    setHighlights(highlights.filter(h=>h.id!==anotId));
  };

  const updateStatus = (id, status) => setLivros(livros.map(l => l.id===id ? {...l,status} : l));
  const updateNota   = (id, nota)   => setLivros(livros.map(l => l.id===id ? {...l,nota}   : l));
  const updatePag    = (id, p)      => setLivros(livros.map(l => l.id===id ? {...l,pagAtual:Number(p)} : l));

  // ── CRUD categorias ───────────────────────────────────────────────────────
  const salvarCat = () => {
    if (!formCat.titulo.trim()) return;
    if (editingCat) {
      setCatsDestaque(catsDestaque.map(c => c.id===editingCat ? {...c,...formCat} : c));
      // atualiza cor nos highlights já existentes
      setHighlights(highlights.map(h => h.category===editingCat ? {...h, color:formCat.cor} : h));
      setEditingCat(null);
    } else {
      setCatsDestaque([...catsDestaque, {id:Date.now().toString(), ...formCat}]);
    }
    setFormCat({titulo:"", cor:"#a855f7", icone:"🟣", desc:""}); setShowFormCat(false);
  };

  const deletarCat = (id) => {
    setCatsDestaque(catsDestaque.filter(c=>c.id!==id));
    // highlights dessa categoria ficam sem categoria (não deleta o conteúdo)
  };

  const iniciarEditCat = (c) => {
    setFormCat({titulo:c.titulo, cor:c.cor, icone:c.icone, desc:c.desc||""});
    setEditingCat(c.id); setShowFormCat(true);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const livrosFiltrados = filtro==="todos" ? livros : livros.filter(l=>l.status===filtro);
  const stats = {
    lendo:   livros.filter(l=>l.status==="lendo").length,
    lido:    livros.filter(l=>l.status==="lido").length,
    quero:   livros.filter(l=>l.status==="quero").length,
    highlights: highlights.length,
  };

  // Revisão: highlights da última semana
  const umaSemanaAtras = new Date(); umaSemanaAtras.setDate(umaSemanaAtras.getDate()-7);
  const hlSemana = highlights.filter(h=>new Date(h.date)>=umaSemanaAtras);
  const hlMes    = highlights.filter(h=>{ const d=new Date(h.date); return d.getMonth()===new Date().getMonth(); });

  return (
    <div>
      <Pomodoro/>

      {/* ── Stats ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px",marginBottom:"20px"}}>
        {[
          {label:"Lendo",      val:stats.lendo,      color:"#a78bfa"},
          {label:"Lidos",      val:stats.lido,       color:"#34d399"},
          {label:"Quero",      val:stats.quero,      color:"#60a5fa"},
          {label:"Destaques",  val:stats.highlights, color:"#fbbf24"},
        ].map(s=>(
          <div key={s.label} style={{...card,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:"20px",fontWeight:"700",color:s.color,marginBottom:"2px"}}>{s.val}</div>
            <div style={{fontSize:"9px",color:"#444",letterSpacing:"0.08em",textTransform:"uppercase"}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Barra de ações ── */}
      <div style={{display:"flex",gap:"6px",marginBottom:"20px",flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:"4px",flex:1,overflowX:"auto"}}>
          {[{id:"todos",label:"Todos"},...STATUS_OPTIONS].map(s=>(
            <button key={s.id} onClick={()=>setFiltro(s.id)} style={{
              whiteSpace:"nowrap",flexShrink:0,
              background:filtro===s.id?"rgba(124,58,237,0.15)":"transparent",
              color:filtro===s.id?"#a78bfa":"#444",
              border:`1px solid ${filtro===s.id?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.06)"}`,
              borderRadius:"8px",padding:"5px 12px",fontSize:"11px",cursor:"pointer",
              fontWeight:filtro===s.id?"600":"400",transition:"all 0.15s",
            }}>{s.label||"Todos"}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:"6px",flexShrink:0}}>
          <button onClick={()=>setShowRevisao(!showRevisao)} style={{
            ...btnGhost, padding:"5px 10px", fontSize:"11px",
            color:showRevisao?"#fbbf24":"#555",
            borderColor:showRevisao?"rgba(251,191,36,0.3)":"rgba(255,255,255,0.06)",
          }}>📖 Revisão</button>
          <button onClick={()=>setShowGerenciar(!showGerenciar)} style={{
            ...btnGhost, padding:"5px 10px", fontSize:"11px",
            color:showGerenciar?"#a78bfa":"#555",
            borderColor:showGerenciar?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.06)",
          }}>🎨 Destaques</button>
          <button onClick={()=>{setShowForm(!showForm);setEditing(null);setForm({titulo:"",autor:"",photo:"",status:"quero",nota:0,paginas:"",pagAtual:"",sinopse:""}); }}
            style={{...btnPurple,flexShrink:0,padding:"5px 14px",fontSize:"12px"}}>
            {showForm&&!editing?"✕":"+ Livro"}
          </button>
        </div>
      </div>

      {/* ── PAINEL: GERENCIAR CATEGORIAS ── */}
      {showGerenciar && (
        <div style={{...card,padding:"20px",marginBottom:"20px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px"}}>
            <div style={{fontSize:"14px",fontWeight:"700",color:"#f0f0f0"}}>🎨 Categorias de destaque</div>
            <button onClick={()=>{setShowFormCat(true);setEditingCat(null);setFormCat({titulo:"",cor:"#a855f7",icone:"🟣",desc:""}); }}
              style={{...btnPurple,padding:"5px 12px",fontSize:"11px"}}>+ Nova</button>
          </div>

          {/* Lista de categorias */}
          <div style={{display:"grid",gap:"8px",marginBottom:showFormCat?"16px":"0"}}>
            {catsDestaque.map(c=>(
              <div key={c.id} style={{
                display:"flex",alignItems:"center",gap:"10px",
                padding:"10px 14px",borderRadius:"12px",
                background:`${c.cor}0f`,border:`1px solid ${c.cor}30`,
              }}>
                <div style={{
                  width:"36px",height:"36px",borderRadius:"10px",flexShrink:0,
                  background:`${c.cor}20`,border:`1px solid ${c.cor}40`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",
                }}>{c.icone}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"13px",fontWeight:"600",color:c.cor}}>{c.titulo}</div>
                  {c.desc&&<div style={{fontSize:"11px",color:"#555",marginTop:"1px"}}>{c.desc}</div>}
                </div>
                <div style={{display:"flex",gap:"6px",flexShrink:0}}>
                  <div style={{
                    fontSize:"10px",color:"#555",
                    background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",
                    borderRadius:"20px",padding:"2px 8px",
                  }}>{highlights.filter(h=>h.category===c.id).length} usos</div>
                  <button onClick={()=>iniciarEditCat(c)} style={{...btnGhost,padding:"3px 8px",fontSize:"10px"}}>editar</button>
                  <button onClick={()=>deletarCat(c.id)} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"15px",padding:"0 2px"}}>×</button>
                </div>
              </div>
            ))}
          </div>

          {/* Formulário nova/editar categoria */}
          {showFormCat && (
            <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:"16px",display:"grid",gap:"12px"}}>
              <div style={{fontSize:"13px",fontWeight:"600",color:"#888"}}>{editingCat?"Editar categoria":"Nova categoria"}</div>

              {/* Ícone picker */}
              <div>
                <div style={{fontSize:"11px",color:"#555",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"8px"}}>Ícone</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                  {ICONES_CAT.map(ic=>(
                    <button key={ic} onClick={()=>setFormCat({...formCat,icone:ic})} style={{
                      width:"34px",height:"34px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"16px",
                      background:formCat.icone===ic?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.04)",
                      outline:formCat.icone===ic?"2px solid #7c3aed":"none",
                    }}>{ic}</button>
                  ))}
                </div>
              </div>

              {/* Cor picker */}
              <div>
                <div style={{fontSize:"11px",color:"#555",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"8px"}}>Cor</div>
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
                  {CORES_CAT.map(cor=>(
                    <button key={cor} onClick={()=>setFormCat({...formCat,cor})} style={{
                      width:"28px",height:"28px",borderRadius:"50%",background:cor,border:"none",cursor:"pointer",
                      outline:formCat.cor===cor?"3px solid #fff":"3px solid transparent",
                      outlineOffset:"2px",transition:"all 0.12s",
                    }}/>
                  ))}
                  <input type="color" value={formCat.cor} onChange={e=>setFormCat({...formCat,cor:e.target.value})}
                    style={{width:"28px",height:"28px",padding:0,border:"none",borderRadius:"50%",cursor:"pointer",background:"none"}}/>
                </div>
              </div>

              {/* Título */}
              <input placeholder="Nome da categoria (ex: Aplicar na minha vida)" value={formCat.titulo}
                onChange={e=>setFormCat({...formCat,titulo:e.target.value})} style={inp}/>

              {/* Descrição */}
              <input placeholder="Descrição curta (opcional)" value={formCat.desc}
                onChange={e=>setFormCat({...formCat,desc:e.target.value})} style={inp}/>

              {/* Preview */}
              <div style={{
                display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",borderRadius:"10px",
                background:`${formCat.cor}0f`,border:`1px solid ${formCat.cor}30`,
              }}>
                <span style={{fontSize:"16px"}}>{formCat.icone}</span>
                <span style={{fontSize:"13px",fontWeight:"600",color:formCat.cor}}>{formCat.titulo||"Prévia da categoria"}</span>
              </div>

              <div style={{display:"flex",gap:"8px"}}>
                <button onClick={salvarCat} style={{...btnPurple,flex:1,padding:"9px"}}>
                  {editingCat?"Salvar":"Criar categoria"}
                </button>
                <button onClick={()=>{setShowFormCat(false);setEditingCat(null);}} style={{...btnGhost,padding:"9px 14px"}}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PAINEL: REVISÃO DE APRENDIZADOS ── */}
      {showRevisao && (
        <div style={{...card,padding:"20px",marginBottom:"20px"}}>
          <div style={{fontSize:"14px",fontWeight:"700",color:"#f0f0f0",marginBottom:"4px"}}>📖 Revisão de aprendizados</div>
          <div style={{fontSize:"12px",color:"#555",marginBottom:"16px"}}>Relembre o que você marcou recentemente</div>

          {/* Resumo rápido */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"16px"}}>
            <div style={{background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:"12px",padding:"12px",textAlign:"center"}}>
              <div style={{fontSize:"22px",fontWeight:"800",color:"#fbbf24"}}>{hlSemana.length}</div>
              <div style={{fontSize:"11px",color:"#555"}}>destaques esta semana</div>
            </div>
            <div style={{background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:"12px",padding:"12px",textAlign:"center"}}>
              <div style={{fontSize:"22px",fontWeight:"800",color:"#a78bfa"}}>{hlMes.length}</div>
              <div style={{fontSize:"11px",color:"#555"}}>destaques este mês</div>
            </div>
          </div>

          {/* Breakdown por categoria */}
          {catsDestaque.map(cat=>{
            const hlCat = highlights.filter(h=>h.category===cat.id);
            if(hlCat.length===0) return null;
            return (
              <div key={cat.id} style={{marginBottom:"16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                  <span style={{fontSize:"14px"}}>{cat.icone}</span>
                  <span style={{fontSize:"12px",fontWeight:"700",color:cat.cor}}>{cat.titulo}</span>
                  <span style={{fontSize:"11px",color:"#444",marginLeft:"auto"}}>{hlCat.length} destaque{hlCat.length!==1?"s":""}</span>
                </div>
                <div style={{display:"grid",gap:"6px"}}>
                  {hlCat.slice(-3).reverse().map(h=>{
                    const livro = livros.find(l=>l.id===h.bookId);
                    return (
                      <div key={h.id} style={{
                        borderLeft:`3px solid ${cat.cor}`,borderRadius:"0 10px 10px 0",
                        background:`${cat.cor}08`,padding:"10px 14px",
                      }}>
                        <div style={{fontSize:"12px",color:"#e0e0e0",lineHeight:1.6}}>"{h.text}"</div>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:"5px"}}>
                          {livro&&<span style={{fontSize:"10px",color:"#555"}}>📚 {livro.titulo}</span>}
                          <span style={{fontSize:"10px",color:"#444"}}>{h.date}</span>
                        </div>
                      </div>
                    );
                  })}
                  {hlCat.length>3&&<div style={{fontSize:"11px",color:"#444",textAlign:"center",padding:"4px"}}>+ {hlCat.length-3} mais destaques</div>}
                </div>
              </div>
            );
          })}

          {highlights.length===0&&(
            <div style={{textAlign:"center",color:"#444",fontSize:"12px",padding:"20px",fontStyle:"italic"}}>
              Nenhum destaque ainda. Comece marcando trechos dos livros!
            </div>
          )}
        </div>
      )}

      {/* ── Formulário adicionar livro ── */}
      {showForm && (
        <div style={{...card,padding:"20px",marginBottom:"20px",display:"grid",gap:"12px"}}>
          <label style={{display:"block",cursor:"pointer"}}>
            <div style={{
              height:form.photo?"200px":"100px",borderRadius:"12px",
              border:`2px dashed ${form.photo?"transparent":"rgba(124,58,237,0.3)"}`,
              background:form.photo?"#000":"rgba(124,58,237,0.05)",
              overflow:"hidden",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.3s",
            }}>
              {form.photo ? (
                <>
                  <img src={form.photo} alt="capa" style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.85}}/>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 50%)",display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:"14px"}}>
                    <div style={{background:"rgba(255,255,255,0.15)",backdropFilter:"blur(8px)",borderRadius:"20px",padding:"5px 14px",fontSize:"12px",color:"#fff",fontWeight:"500"}}>📷 Trocar capa</div>
                  </div>
                </>
              ) : (
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:"28px",marginBottom:"6px"}}>📚</div>
                  <div style={{fontSize:"12px",color:"#a78bfa",fontWeight:"500"}}>Adicionar capa do livro</div>
                  <div style={{fontSize:"10px",color:"#444",marginTop:"2px"}}>Toque para escolher da galeria</div>
                </div>
              )}
            </div>
            <input type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}}/>
          </label>
          <input placeholder="Título do livro *" value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} style={inp}/>
          <input placeholder="Autor" value={form.autor} onChange={e=>setForm({...form,autor:e.target.value})} style={inp}/>
          <textarea placeholder="Sinopse / notas gerais (opcional)" value={form.sinopse} onChange={e=>setForm({...form,sinopse:e.target.value})} rows={2} style={{...inp,resize:"vertical",lineHeight:1.5}}/>
          <div>
            <div style={{...lbl,marginBottom:"8px"}}>Status</div>
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
              {STATUS_OPTIONS.map(s=>(
                <button key={s.id} onClick={()=>setForm({...form,status:s.id})} style={{
                  background:form.status===s.id?`${s.color}22`:"transparent",
                  border:`1px solid ${form.status===s.id?s.color+"66":"rgba(255,255,255,0.08)"}`,
                  borderRadius:"8px",padding:"5px 12px",fontSize:"11px",cursor:"pointer",
                  color:form.status===s.id?s.color:"#555",fontWeight:form.status===s.id?"600":"400",transition:"all 0.15s",
                }}>{s.icon} {s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{...lbl,marginBottom:"8px"}}>Nota</div>
            <StarRating value={form.nota} onChange={n=>setForm({...form,nota:n})}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <div>
              <div style={{...lbl,marginBottom:"6px"}}>Total de páginas</div>
              <input type="number" placeholder="Ex: 320" value={form.paginas} onChange={e=>setForm({...form,paginas:e.target.value})} style={inp}/>
            </div>
            <div>
              <div style={{...lbl,marginBottom:"6px"}}>Página atual</div>
              <input type="number" placeholder="Ex: 120" value={form.pagAtual} onChange={e=>setForm({...form,pagAtual:e.target.value})} style={inp}/>
            </div>
          </div>
          <button onClick={salvar} style={{...btnPurple,padding:"11px",fontSize:"13px"}}>
            {editing?"Salvar alterações":"Adicionar à Biblioteca"}
          </button>
        </div>
      )}

      {/* ── Lista de livros ── */}
      {livrosFiltrados.length===0 && (
        <div style={{textAlign:"center",color:"#444",fontSize:"13px",padding:"48px 0"}}>
          <div style={{fontSize:"40px",marginBottom:"12px"}}>📚</div>
          {filtro==="todos"?"Adicione seu primeiro livro!":`Nenhum livro com status "${statusObj(filtro).label}"`}
        </div>
      )}

      <div style={{display:"grid",gap:"12px"}}>
        {livrosFiltrados.map(l => {
          const isOpen  = expanded===l.id;
          const st      = statusObj(l.status);
          const progPct = l.paginas>0 ? Math.min(100,Math.round((l.pagAtual/l.paginas)*100)) : 0;
          const hlLivro = highlights.filter(h=>h.bookId===l.id);
          const catAtual = catSelecionada[l.id] || catsDestaque[0]?.id;
          const catObj   = getCat(catAtual);

          return (
            <div key={l.id} style={{...card,overflow:"hidden",transition:"all 0.2s"}}>
              <div style={{display:"flex",gap:"0"}}>
                {/* Capa */}
                <div style={{width:l.photo?"90px":"0px",flexShrink:0,overflow:"hidden",transition:"width 0.3s"}}>
                  {l.photo&&<img src={l.photo} alt={l.titulo} style={{width:"90px",height:"100%",minHeight:"130px",objectFit:"cover",display:"block"}}/>}
                </div>
                {/* Info */}
                <div style={{flex:1,padding:"14px 16px",minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px",marginBottom:"6px"}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:"14px",fontWeight:"600",color:"#f0f0f0",lineHeight:1.3,marginBottom:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.titulo}</div>
                      {l.autor&&<div style={{fontSize:"11px",color:"#555"}}>{l.autor}</div>}
                    </div>
                    <div style={{flexShrink:0,fontSize:"9px",fontWeight:"700",letterSpacing:"0.06em",color:st.color,background:`${st.color}18`,border:`1px solid ${st.color}33`,borderRadius:"20px",padding:"3px 9px",whiteSpace:"nowrap"}}>
                      {st.icon} {st.label.toUpperCase()}
                    </div>
                  </div>
                  {l.nota>0&&<div style={{marginBottom:"8px"}}><StarRating value={l.nota} readonly/></div>}
                  {l.paginas>0&&(
                    <div style={{marginBottom:"8px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:"10px",color:"#444",marginBottom:"4px"}}>
                        <span>Pág. {l.pagAtual||0} de {l.paginas}</span>
                        <span style={{color:progPct===100?"#34d399":"#a78bfa"}}>{progPct}%</span>
                      </div>
                      <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"100px",height:"4px",overflow:"hidden"}}>
                        <div style={{background:progPct===100?"#34d399":"linear-gradient(90deg,#7c3aed,#a78bfa)",height:"100%",borderRadius:"100px",width:`${progPct}%`,transition:"width 0.5s"}}/>
                      </div>
                    </div>
                  )}
                  <div style={{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"}}>
                    <button onClick={()=>setExpanded(isOpen?null:l.id)} style={{
                      ...btnGhost,padding:"3px 10px",fontSize:"10px",
                      color:isOpen?"#a78bfa":"#555",
                      borderColor:isOpen?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.06)",
                    }}>
                      {hlLivro.length>0?`📌 ${hlLivro.length}`:"📌"} Marcações
                    </button>
                    <button onClick={()=>abrirEditar(l)} style={{...btnGhost,padding:"3px 10px",fontSize:"10px"}}>editar</button>
                    <button onClick={()=>deletar(l.id)} style={{background:"none",border:"none",color:"#2a2a2a",cursor:"pointer",fontSize:"15px",padding:"0 2px",marginLeft:"auto"}}>×</button>
                  </div>
                </div>
              </div>

              {/* ── Painel expandido — igual ao print ── */}
              {isOpen && (
                <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",padding:"16px",display:"grid",gap:"16px"}}>

                  {/* STATUS */}
                  <div>
                    <div style={{...lbl,marginBottom:"8px"}}>STATUS</div>
                    <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                      {STATUS_OPTIONS.map(s=>(
                        <button key={s.id} onClick={()=>updateStatus(l.id,s.id)} style={{
                          background:l.status===s.id?`${s.color}20`:"transparent",
                          border:`1px solid ${l.status===s.id?s.color+"55":"rgba(255,255,255,0.06)"}`,
                          borderRadius:"8px",padding:"5px 12px",fontSize:"11px",cursor:"pointer",
                          color:l.status===s.id?s.color:"#555",transition:"all 0.15s",fontWeight:l.status===s.id?"600":"400",
                        }}>{s.icon} {s.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* NOTA */}
                  <div>
                    <div style={{...lbl,marginBottom:"8px"}}>NOTA</div>
                    <StarRating value={l.nota||0} onChange={n=>updateNota(l.id,n)}/>
                  </div>

                  {/* PÁGINA ATUAL */}
                  {l.paginas>0&&(
                    <div>
                      <div style={{...lbl,marginBottom:"8px"}}>PÁGINA ATUAL</div>
                      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                        <input type="number" value={l.pagAtual||0} onChange={e=>updatePag(l.id,e.target.value)}
                          style={{...inp,width:"100px",padding:"7px 12px",fontSize:"13px"}}/>
                        <span style={{fontSize:"12px",color:"#444"}}>/ {l.paginas}</span>
                      </div>
                    </div>
                  )}

                  {/* SINOPSE */}
                  {l.sinopse&&(
                    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:"10px",padding:"14px",fontSize:"12px",color:"#777",lineHeight:1.7,fontStyle:"italic"}}>
                      "{l.sinopse}"
                    </div>
                  )}

                  {/* ── MARCAÇÕES ── */}
                  <div>
                    <div style={{...lbl,marginBottom:"12px"}}>
                      📌 MARCAÇÕES
                      {hlLivro.length>0&&<span style={{color:"#a78bfa",marginLeft:"6px",fontWeight:"700"}}>{hlLivro.length}</span>}
                    </div>

                    {/* Lista agrupada por categoria */}
                    {hlLivro.length===0 && (
                      <div style={{fontSize:"12px",color:"#333",textAlign:"center",padding:"16px 0",fontStyle:"italic"}}>
                        Nenhuma marcação ainda. Anote frases, insights ou páginas importantes!
                      </div>
                    )}
                    {catsDestaque.map(cat=>{
                      const hlCat = hlLivro.filter(h=>h.category===cat.id);
                      if(hlCat.length===0) return null;
                      return (
                        <div key={cat.id} style={{marginBottom:"14px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"7px",marginBottom:"8px"}}>
                            <span style={{fontSize:"13px"}}>{cat.icone}</span>
                            <span style={{fontSize:"11px",fontWeight:"700",color:cat.cor,textTransform:"uppercase",letterSpacing:"0.06em"}}>{cat.titulo}</span>
                            <span style={{fontSize:"10px",color:"#444",marginLeft:"2px"}}>({hlCat.length})</span>
                          </div>
                          <div style={{display:"grid",gap:"7px"}}>
                            {hlCat.map(h=>(
                              <div key={h.id} style={{
                                background:`${cat.cor}0a`,border:`1px solid ${cat.cor}22`,
                                borderLeft:`3px solid ${cat.cor}`,borderRadius:"0 10px 10px 0",
                                padding:"10px 14px",position:"relative",
                              }}>
                                <div style={{fontSize:"13px",color:"#e0e0e0",lineHeight:1.65,paddingRight:"24px"}}>"{h.text}"</div>
                                <div style={{fontSize:"10px",color:"#444",marginTop:"5px"}}>{h.date}</div>
                                <button onClick={()=>delAnotacao(l.id,h.id)} style={{position:"absolute",top:"8px",right:"10px",background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"14px"}}>×</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* ── Selecionar cor/categoria ── */}
                    <div style={{marginTop:"4px",marginBottom:"10px"}}>
                      <div style={{fontSize:"11px",color:"#555",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"10px"}}>Selecionar cor</div>
                      <div style={{display:"grid",gap:"6px"}}>
                        {catsDestaque.map(cat=>(
                          <button key={cat.id} onClick={()=>setCatSelecionada(cs=>({...cs,[l.id]:cat.id}))} style={{
                            display:"flex",alignItems:"center",gap:"10px",
                            padding:"10px 14px",borderRadius:"12px",textAlign:"left",
                            border:`1px solid ${catAtual===cat.id?cat.cor+"80":"rgba(255,255,255,0.06)"}`,
                            background:catAtual===cat.id?`${cat.cor}18`:"rgba(255,255,255,0.02)",
                            cursor:"pointer",transition:"all 0.15s",width:"100%",
                          }}>
                            <div style={{
                              width:"10px",height:"10px",borderRadius:"50%",flexShrink:0,
                              background:cat.cor,
                              boxShadow:catAtual===cat.id?`0 0 8px ${cat.cor}80`:"none",
                            }}/>
                            <span style={{fontSize:"13px",color:catAtual===cat.id?cat.cor:"#888",fontWeight:catAtual===cat.id?"600":"400"}}>
                              {cat.icone} {cat.titulo}
                            </span>
                            {catAtual===cat.id&&<span style={{marginLeft:"auto",fontSize:"12px",color:cat.cor}}>✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Input + botão */}
                    <div style={{display:"flex",gap:"8px",alignItems:"flex-end"}}>
                      <textarea
                        placeholder="Anote uma frase, trecho ou insight do livro..."
                        value={novaAnotacao[l.id]||""}
                        onChange={e=>setNovaAnotacao(n=>({...n,[l.id]:e.target.value}))}
                        onKeyDown={e=>{if(e.key==="Enter"&&e.ctrlKey) addAnotacao(l.id);}}
                        rows={2}
                        style={{
                          ...inp,flex:1,resize:"none",lineHeight:1.5,fontSize:"13px",padding:"10px 14px",
                          borderColor:`${catObj?.cor||"#a78bfa"}40`,
                        }}
                      />
                      <button onClick={()=>addAnotacao(l.id)} style={{
                        width:"46px",height:"46px",borderRadius:"12px",border:"none",
                        background:`linear-gradient(135deg,${catObj?.cor||"#a78bfa"},${catObj?.cor||"#7c3aed"})`,
                        cursor:"pointer",fontSize:"20px",flexShrink:0,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        boxShadow:`0 4px 14px ${catObj?.cor||"#a78bfa"}50`,
                      }}>📌</button>
                    </div>
                    <div style={{fontSize:"10px",color:"#333",marginTop:"5px"}}>Ctrl+Enter para salvar</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* IA */}
      <div style={{marginTop:"20px"}}>
        <IAWidget
          context={`Biblioteca: ${livros.length} livros\nLendo: ${stats.lendo} | Lidos: ${stats.lido} | Quero ler: ${stats.quero}\nDestaques: ${highlights.length} total\nLivros:\n${livros.map(l=>`- "${l.titulo}"${l.autor?` (${l.autor})`:""}  [${statusObj(l.status).label}] nota:${l.nota||0}/5 destaques:${highlights.filter(h=>h.bookId===l.id).length}`).join("\n")}`}
          systemPrompt="Você é um consultor literário apaixonado. Analise a biblioteca do usuário, sugira próximas leituras baseadas nos livros que ele leu, comente sobre os padrões de leitura, faça perguntas sobre os livros em andamento. Seja entusiasmado e específico. Responda em português brasileiro. Máximo 200 palavras."
          placeholder="Ex: Me recomenda algo parecido com o que estou lendo?"
        />
      </div>
    </div>
  );
}

// ── AGENDA ────────────────────────────────────────────────────────────────────
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const CORES_EVENTO = [
  { id:"roxo",   hex:"#a855f7" },
  { id:"azul",   hex:"#60a5fa" },
  { id:"verde",  hex:"#34d399" },
  { id:"laranja",hex:"#fb923c" },
  { id:"rosa",   hex:"#f472b6" },
  { id:"vermelho",hex:"#f87171"},
];

function Agenda() {
  const [events, setEvents] = useStorage("agenda:events", []);
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ titulo:"", tipo:"compromisso", hora:"", cor:"roxo", desc:"", dia:"", lembrete:false });

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Dias do calendário
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calDays     = [];
  for (let i = 0; i < firstDow; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d);

  const fmtDate = (y, m, d) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const eventsForDay = (d) => {
    if (!d) return [];
    const key = fmtDate(year, month, d);
    return events.filter(e => e.dia === key).sort((a,b)=> (a.hora||"99:99").localeCompare(b.hora||"99:99"));
  };

  const selectedDateKey = fmtDate(selectedYear, selectedMonth, selectedDay);
  const selectedEvents  = events.filter(e => e.dia === selectedDateKey)
    .sort((a,b)=>(a.hora||"99:99").localeCompare(b.hora||"99:99"));

  // Próximos eventos (7 dias a partir de hoje)
  const upcoming = events.filter(e => {
    const d = new Date(e.dia + "T00:00:00");
    const diff = Math.floor((d - today) / 86400000);
    return diff >= 0 && diff <= 30;
  }).sort((a,b)=>a.dia.localeCompare(b.dia)||(a.hora||"").localeCompare(b.hora||""));

  const openNewForm = (dateKey) => {
    setForm({ titulo:"", tipo:"compromisso", hora:"", cor:"roxo", desc:"", dia:dateKey, lembrete:false });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (ev) => {
    setForm({ titulo:ev.titulo, tipo:ev.tipo, hora:ev.hora||"", cor:ev.cor||"roxo", desc:ev.desc||"", dia:ev.dia, lembrete:ev.lembrete||false });
    setEditing(ev.id);
    setShowForm(true);
  };

  const salvar = () => {
    if (!form.titulo.trim() || !form.dia) return;
    if (editing) {
      setEvents(events.map(e => e.id===editing ? {...e,...form} : e));
    } else {
      setEvents([...events, { id: Date.now(), ...form }]);
    }
    setShowForm(false);
    setEditing(null);
  };

  const deletar = (id) => setEvents(events.filter(e => e.id !== id));

  const corHex = (id) => CORES_EVENTO.find(c=>c.id===id)?.hex || "#a855f7";
  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (d) => d === selectedDay && month === selectedMonth && year === selectedYear;

  const navMonth = (dir) => {
    const d = new Date(year, month + dir, 1);
    setViewDate(d);
  };

  const fmtDateLabel = (key) => {
    const [y,m,d] = key.split("-").map(Number);
    const dt = new Date(y, m-1, d);
    return dt.toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"});
  };

  const selectedLabel = new Date(selectedYear, selectedMonth, selectedDay)
    .toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});

  return (
    <div>
      {/* ── Calendário ── */}
      <div style={{...card, padding:"16px", marginBottom:"16px"}}>

        {/* Nav mês */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
          <button onClick={()=>navMonth(-1)} style={{...btnGhost,padding:"4px 12px",fontSize:"16px"}}>‹</button>
          <div style={{fontSize:"14px",fontWeight:"600",color:"#f0f0f0",letterSpacing:"0.02em"}}>
            {MONTHS[month]} {year}
          </div>
          <button onClick={()=>navMonth(1)} style={{...btnGhost,padding:"4px 12px",fontSize:"16px"}}>›</button>
        </div>

        {/* Cabeçalho dias da semana */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"2px",marginBottom:"4px"}}>
          {DIAS_SEMANA.map(d=>(
            <div key={d} style={{textAlign:"center",fontSize:"9px",color:"#444",fontWeight:"600",letterSpacing:"0.08em",padding:"4px 0"}}>{d}</div>
          ))}
        </div>

        {/* Grid de dias */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"2px"}}>
          {calDays.map((d,i)=>{
            const dayEvents = eventsForDay(d);
            const todayFlag = isToday(d);
            const selFlag   = isSelected(d);
            return (
              <div key={i} onClick={()=>{
                if(!d) return;
                setSelectedDay(d); setSelectedMonth(month); setSelectedYear(year);
              }} style={{
                minHeight:"42px", borderRadius:"10px", padding:"4px 2px",
                cursor: d ? "pointer" : "default",
                background: selFlag ? "rgba(124,58,237,0.25)" : todayFlag ? "rgba(124,58,237,0.08)" : "transparent",
                border: selFlag ? "1px solid rgba(124,58,237,0.5)" : "1px solid transparent",
                transition:"all 0.12s",
                display:"flex", flexDirection:"column", alignItems:"center", gap:"3px",
              }}>
                {d && <>
                  <span style={{
                    fontSize:"12px", fontWeight: todayFlag ? "700" : "400",
                    color: selFlag ? "#c084fc" : todayFlag ? "#a855f7" : "#888",
                    width:"22px", height:"22px", display:"flex", alignItems:"center", justifyContent:"center",
                    borderRadius:"50%",
                    background: todayFlag && !selFlag ? "rgba(124,58,237,0.15)" : "transparent",
                  }}>{d}</span>
                  {/* Pontos de eventos */}
                  <div style={{display:"flex",gap:"2px",flexWrap:"wrap",justifyContent:"center",maxWidth:"32px"}}>
                    {dayEvents.slice(0,3).map(ev=>(
                      <div key={ev.id} style={{width:"5px",height:"5px",borderRadius:"50%",background:corHex(ev.cor),flexShrink:0}}/>
                    ))}
                    {dayEvents.length>3 && <div style={{fontSize:"8px",color:"#555"}}>+{dayEvents.length-3}</div>}
                  </div>
                </>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Dia selecionado ── */}
      <div style={{...card, padding:"16px", marginBottom:"16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
          <div>
            <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.08em",textTransform:"capitalize",marginBottom:"2px"}}>
              {selectedLabel}
            </div>
            <div style={{fontSize:"13px",color: selectedEvents.length>0?"#a78bfa":"#444"}}>
              {selectedEvents.length===0 ? "Nenhum evento" : `${selectedEvents.length} evento${selectedEvents.length>1?"s":""}`}
            </div>
          </div>
          <button onClick={()=>openNewForm(selectedDateKey)} style={btnPurple}>+ Evento</button>
        </div>

        {/* Form novo/editar evento */}
        {showForm && (
          <div style={{background:"rgba(255,255,255,0.03)",borderRadius:"12px",padding:"16px",marginBottom:"14px",border:"1px solid rgba(255,255,255,0.06)",display:"grid",gap:"10px"}}>
            <input placeholder="Título do evento *" value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} style={inp}/>

            {/* Tipo */}
            <div style={{display:"flex",gap:"6px"}}>
              {[{id:"compromisso",icon:"📅",label:"Compromisso"},{id:"lembrete",icon:"🔔",label:"Lembrete"}].map(t=>(
                <button key={t.id} onClick={()=>setForm({...form,tipo:t.id})}
                  style={{
                    flex:1, padding:"7px", borderRadius:"8px", cursor:"pointer",
                    background:form.tipo===t.id?"rgba(124,58,237,0.15)":"transparent",
                    border:`1px solid ${form.tipo===t.id?"rgba(124,58,237,0.4)":"rgba(255,255,255,0.06)"}`,
                    color:form.tipo===t.id?"#a78bfa":"#555",
                    fontSize:"12px", fontWeight:form.tipo===t.id?"600":"400",
                    transition:"all 0.15s",
                  }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Data + Hora */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
              <div>
                <div style={{...lbl,marginBottom:"5px"}}>Data</div>
                <input type="date" value={form.dia} onChange={e=>setForm({...form,dia:e.target.value})} style={inp}/>
              </div>
              {form.tipo==="compromisso" && (
                <div>
                  <div style={{...lbl,marginBottom:"5px"}}>Horário</div>
                  <input type="time" value={form.hora} onChange={e=>setForm({...form,hora:e.target.value})} style={inp}/>
                </div>
              )}
            </div>

            <input placeholder="Descrição (opcional)" value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} style={inp}/>

            {/* Cor */}
            <div>
              <div style={{...lbl,marginBottom:"8px"}}>Cor</div>
              <div style={{display:"flex",gap:"8px"}}>
                {CORES_EVENTO.map(c=>(
                  <button key={c.id} onClick={()=>setForm({...form,cor:c.id})}
                    style={{
                      width:"26px",height:"26px",borderRadius:"50%",
                      background:c.hex, border:`3px solid ${form.cor===c.id?"#fff":"transparent"}`,
                      cursor:"pointer",transition:"all 0.15s",
                      boxShadow:form.cor===c.id?`0 0 0 1px ${c.hex}`:"none",
                    }}/>
                ))}
              </div>
            </div>

            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={salvar} style={{...btnPurple,flex:1,padding:"10px",fontSize:"13px"}}>
                {editing ? "Salvar" : "Adicionar"}
              </button>
              <button onClick={()=>{setShowForm(false);setEditing(null);}} style={{...btnGhost,padding:"10px 16px",fontSize:"13px"}}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista eventos do dia */}
        <div style={{display:"grid",gap:"8px"}}>
          {selectedEvents.length===0 && !showForm && (
            <div style={{textAlign:"center",padding:"20px 0",color:"#333",fontSize:"12px"}}>
              Dia livre — clique em "+ Evento" para agendar algo
            </div>
          )}
          {selectedEvents.map(ev=>(
            <div key={ev.id} style={{
              display:"flex",alignItems:"flex-start",gap:"12px",
              background:"rgba(255,255,255,0.03)",
              border:`1px solid rgba(255,255,255,0.05)`,
              borderLeft:`3px solid ${corHex(ev.cor)}`,
              borderRadius:"0 10px 10px 0",
              padding:"10px 14px",
            }}>
              <div style={{flexShrink:0,marginTop:"1px"}}>
                <div style={{fontSize:"15px"}}>{ev.tipo==="lembrete"?"🔔":"📅"}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"13px",fontWeight:"600",color:"#f0f0f0",marginBottom:"2px"}}>{ev.titulo}</div>
                {ev.hora && <div style={{fontSize:"11px",color:corHex(ev.cor),marginBottom:"2px"}}>⏰ {ev.hora}</div>}
                {ev.desc && <div style={{fontSize:"11px",color:"#555",lineHeight:1.5}}>{ev.desc}</div>}
              </div>
              <div style={{display:"flex",gap:"4px",flexShrink:0}}>
                <button onClick={()=>openEdit(ev)} style={{...btnGhost,padding:"3px 8px",fontSize:"10px"}}>editar</button>
                <button onClick={()=>deletar(ev.id)} style={{background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:"15px",padding:"0 2px"}}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Próximos eventos ── */}
      {upcoming.length > 0 && (
        <div style={{...card,padding:"16px",marginBottom:"16px"}}>
          <div style={{fontSize:"11px",color:"#555",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"14px"}}>
            Próximos 30 dias
          </div>
          <div style={{display:"grid",gap:"6px"}}>
            {upcoming.slice(0,10).map(ev=>{
              const [y,m,d] = ev.dia.split("-").map(Number);
              const diff = Math.floor((new Date(y,m-1,d) - new Date(today.getFullYear(),today.getMonth(),today.getDate())) / 86400000);
              return (
                <div key={ev.id} style={{
                  display:"flex",alignItems:"center",gap:"12px",
                  padding:"8px 12px",borderRadius:"10px",
                  background:"rgba(255,255,255,0.02)",
                  border:"1px solid rgba(255,255,255,0.04)",
                }}>
                  {/* Dot cor */}
                  <div style={{width:"8px",height:"8px",borderRadius:"50%",background:corHex(ev.cor),flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"12px",color:"#e0e0e0",fontWeight:"500",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.titulo}</div>
                    <div style={{fontSize:"10px",color:"#555",marginTop:"1px",textTransform:"capitalize"}}>
                      {fmtDateLabel(ev.dia)}{ev.hora ? ` · ${ev.hora}` : ""}
                    </div>
                  </div>
                  <div style={{
                    fontSize:"10px",fontWeight:"600",flexShrink:0,
                    color: diff===0?"#34d399":diff===1?"#fb923c":"#555",
                    background: diff===0?"rgba(52,211,153,0.1)":diff===1?"rgba(251,146,60,0.1)":"transparent",
                    borderRadius:"6px",padding:"2px 7px",
                  }}>
                    {diff===0?"Hoje":diff===1?"Amanhã":`+${diff}d`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* IA */}
      <IAWidget
        context={`Hoje: ${today.toLocaleDateString("pt-BR")}\nEventos próximos 30 dias: ${upcoming.length}\n${upcoming.slice(0,8).map(e=>`- ${e.dia}${e.hora?" "+e.hora:""}: ${e.titulo} [${e.tipo}]`).join("\n")}`}
        systemPrompt="Você é um assistente de agenda pessoal. Analise os eventos do usuário, ajude a organizar o tempo, sugira como se preparar para compromissos importantes e lembre de prioridades. Seja prático e objetivo. Responda em português brasileiro. Máximo 150 palavras."
        placeholder="Ex: Tenho muita coisa essa semana, me ajuda a organizar"
      />
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("Home");
  const [showMonthClose, setShowMonthClose] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" && window.innerWidth >= 900);
  const [usuario, setUsuario] = useState(undefined);

  // ── Auth: captura redirect do Google + observa estado ──
  useEffect(() => {
    // Verifica redirect result do Google
    checkRedirectResult()
      .then(u => { if (u) console.log("✅ Redirect Google OK:", u.email); })
      .catch(e => console.error("❌ Redirect error:", e));

    // onAuthStateChanged — fonte da verdade
    const unsub = onUsuario(u => {
      console.log("🔑 onAuthStateChanged:", u ? u.email : "null");
      setUsuario(u ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);


  useEffect(() => {
    if (!usuario) return;
    const CLOSE_KEY = `monthclose:${today.getFullYear()}-${today.getMonth()}`;
    const seen = localStorage.getItem(CLOSE_KEY);
    if (!seen) {
      const prevMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
      const prevYear  = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
      const txRaw = localStorage.getItem("fin:transactions");
      const tx = txRaw ? JSON.parse(txRaw) : [];
      const hasPrevData = tx.some(t => {
        const d = new Date(t.ts || 0);
        return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
      });
      if (hasPrevData) {
        setTimeout(() => setShowMonthClose(true), 800);
      } else {
        localStorage.setItem(CLOSE_KEY, "1");
      }
    }
  }, [usuario]);

  const dismissMonthClose = () => {
    const CLOSE_KEY = `monthclose:${today.getFullYear()}-${today.getMonth()}`;
    localStorage.setItem(CLOSE_KEY, "1");
    setShowMonthClose(false);
  };

  // ── Guards de auth (depois de todos os hooks) ──
  if (usuario === undefined) {
    return (
      <div style={{minHeight:"100vh",background:"#080808",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{textAlign:"center"}}>
          <div style={{margin:"0 auto 16px",textAlign:"center"}}>
            <img src="/goat-logo.png" alt="GOAT" style={{width:"64px",height:"auto",display:"block",margin:"0 auto 6px"}}/>
            <span style={{fontSize:"13px",fontWeight:"900",color:"#fff",letterSpacing:"0.25em"}}>GOAT</span>
          </div>
          <div style={{width:"20px",height:"20px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.1)",borderTopColor:"#a78bfa",animation:"spin 0.8s linear infinite",margin:"0 auto"}}/>
        </div>
      </div>
    );
  }

  if (!usuario) return <Login />;

  const content = {"Home":<Home onNav={setTab}/>,"Finanças":<Financas/>,"Tarefas":<Tarefas/>,"Hábitos":<Habitos/>,"Metas":<Metas/>,"Treino":<Treino/>,"Livros":<Livros/>,"Agenda":<Agenda/>};

  return (
    <div style={{minHeight:"100vh", background:"#080808", fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&display=swap');
        * { box-sizing:border-box; margin:0; }
        body { font-family:'DM Sans',sans-serif; background:#080808; }
        input,select,button,textarea { font-family:'DM Sans',sans-serif; }
        input:focus,select:focus { border-color:rgba(124,58,237,0.6) !important; box-shadow:0 0 0 3px rgba(124,58,237,0.1) !important; outline:none; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#1e1e1e; border-radius:10px; }
        option { background:#111; color:#e8e8e8; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter:invert(0.4) brightness(0.8); cursor:pointer; }
        input[type="number"]::-webkit-inner-spin-button { opacity:0.3; }
        .recharts-legend-item-text { color:#444 !important; font-size:10px !important; }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .tab-content { animation: fadeSlideIn 0.22s ease; }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }

        /* Sidebar tooltip */
        .nav-btn { position:relative; }
        .nav-btn::after {
          content: attr(title);
          position:absolute; left:56px; top:50%; transform:translateY(-50%);
          background:#1a1a1a; color:#e0e0e0; font-size:12px; font-weight:500;
          padding:5px 10px; border-radius:8px; white-space:nowrap;
          border:1px solid rgba(255,255,255,0.08);
          pointer-events:none; opacity:0; transition:opacity 0.15s;
          z-index:100; font-family:'DM Sans',sans-serif;
        }
        .nav-btn:hover::after { opacity:1; }
        .nav-btn:hover { background:rgba(255,255,255,0.06) !important; }
      `}</style>

      {showMonthClose && <MonthCloseModal onDismiss={dismissMonthClose}/>}

      {isDesktop ? (
        /* ════════════════════════════════════════════════════════════════
           DESKTOP — Sidebar + Main
        ════════════════════════════════════════════════════════════════ */
        <div style={{display:"flex", minHeight:"100vh"}}>

          {/* ── Sidebar minimalista ── */}
          <aside style={{
            width:"68px", flexShrink:0,
            background:"#080808",
            borderRight:"1px solid rgba(255,255,255,0.04)",
            display:"flex", flexDirection:"column",
            alignItems:"center",
            padding:"20px 0",
            position:"sticky", top:0, height:"100vh",
          }}>
            {/* Logo GOAT */}
            <div style={{marginBottom:"28px",flexShrink:0,textAlign:"center"}}>
              <img src="/goat-logo.png" alt="GOAT" style={{width:"38px",height:"auto",display:"block",margin:"0 auto 3px"}}/>
              <span style={{fontSize:"7px",fontWeight:"900",color:"rgba(255,255,255,0.5)",letterSpacing:"0.2em"}}>GOAT</span>
            </div>

            {/* Nav icons */}
            <nav style={{flex:1, display:"flex", flexDirection:"column", gap:"4px", width:"100%", padding:"0 10px"}}>
              {TABS.map(t => {
                const active = tab === t;
                return (
                  <div key={t} style={{position:"relative", group:"true"}}>
                    <button onClick={() => setTab(t)} title={t} className="nav-btn" style={{
                      width:"100%", height:"44px",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      background: active ? "rgba(124,58,237,0.18)" : "transparent",
                      border:"none", borderRadius:"10px",
                      cursor:"pointer",
                      transition:"all 0.15s",
                      position:"relative",
                    }}>
                      {active && (
                        <div style={{
                          position:"absolute", left:"-10px", top:"25%", bottom:"25%",
                          width:"3px", background:"#7c3aed", borderRadius:"0 3px 3px 0",
                        }}/>
                      )}
                      <div style={{
                        opacity: active ? 1 : 0.35,
                        transition:"opacity 0.15s",
                        transform: active ? "scale(1.1)" : "scale(1)",
                      }}>
                        <TabIcon name={t} active={active}/>
                      </div>
                    </button>
                  </div>
                );
              })}
            </nav>

            {/* Usuário + logout + cloud */}
            <div style={{padding:"12px 10px 8px",borderTop:"1px solid rgba(255,255,255,0.04)",display:"flex",flexDirection:"column",alignItems:"center",gap:"8px"}}>
              <CloudStatus compact/>
              {/* Avatar do usuário */}
              {usuario?.photoURL ? (
                <img src={usuario.photoURL} alt="" title={usuario.displayName||usuario.email||""}
                  style={{width:"32px",height:"32px",borderRadius:"50%",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer"}}
                  onClick={()=>{if(window.confirm("Sair da conta?")) logout();}}/>
              ) : (
                <button onClick={()=>{if(window.confirm("Sair da conta?")) logout();}}
                  title="Sair" className="nav-btn"
                  style={{width:"36px",height:"36px",borderRadius:"10px",border:"none",background:"rgba(255,255,255,0.04)",cursor:"pointer",color:"#444",fontSize:"16px"}}>
                  ⏻
                </button>
              )}
            </div>
          </aside>

          {/* ── Main content ── */}
          <main style={{flex:1, minWidth:0, padding:"40px 56px 80px", maxWidth:"900px", margin:"0 auto", width:"100%"}}>

            {/* Top bar — nome da aba + data */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"36px"}}>
              <div>
                <div style={{fontSize:"11px",fontWeight:"600",letterSpacing:"0.12em",color:"#7c3aed",textTransform:"uppercase",marginBottom:"6px"}}>
                  {today.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}
                </div>
                <h2 style={{fontSize:"28px",fontWeight:"300",color:"#f0f0f0",letterSpacing:"-0.02em",margin:0}}>
                  {tab}
                </h2>
              </div>
              <div style={{opacity:0.5}}>
                <TabIcon name={tab} active={true}/>
              </div>
            </div>

            <div className="tab-content" key={tab}>{content[tab]}</div>
          </main>
        </div>

      ) : (
        /* ════════════════════════════════════════════════════════════════
           MOBILE — Tab bar bottom
        ════════════════════════════════════════════════════════════════ */
        <div style={{display:"flex",flexDirection:"column",minHeight:"100vh"}}>

          {/* Header mobile */}
          <div style={{padding:"52px 20px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"28px"}}>
              <div>
                <div style={{fontSize:"10px",fontWeight:"500",letterSpacing:"0.12em",color:"#7c3aed",textTransform:"uppercase",marginBottom:"6px"}}>
                  {today.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}
                </div>
                <h1 style={{fontSize:"26px",fontWeight:"300",color:"#f0f0f0",letterSpacing:"-0.03em",lineHeight:1}}>
                  Meu <span style={{fontWeight:"700"}}>Painel</span>
                </h1>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginTop:"4px"}}>
                <CloudStatus/>
                {usuario?.photoURL ? (
                  <img src={usuario.photoURL} alt="" title={usuario.displayName||""}
                    style={{width:"30px",height:"30px",borderRadius:"50%",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",flexShrink:0}}
                    onClick={()=>{if(window.confirm("Sair da conta?")) logout();}}/>
                ) : (
                  <button onClick={()=>{if(window.confirm("Sair da conta?")) logout();}}
                    style={{background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:"18px",padding:0}}>⏻</button>
                )}
              </div>
            </div>
          </div>

          {/* Content area */}
          <div style={{flex:1, padding:"0 20px 100px", overflowY:"auto"}}>
            <div className="tab-content" key={tab}>{content[tab]}</div>
          </div>

          {/* ── Bottom tab bar ── */}
          <div style={{
            position:"fixed", bottom:0, left:0, right:0, zIndex:100,
            background:"rgba(8,8,8,0.92)",
            backdropFilter:"blur(20px)",
            WebkitBackdropFilter:"blur(20px)",
            borderTop:"1px solid rgba(255,255,255,0.07)",
            padding:"8px 8px calc(8px + env(safe-area-inset-bottom))",
            display:"flex", gap:"4px",
          }}>
            {TABS.map(t => {
              const active = tab === t;
              return (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"4px",
                  background: active ? "rgba(124,58,237,0.18)" : "transparent",
                  border:"none", borderRadius:"12px",
                  padding:"8px 4px 6px", cursor:"pointer",
                  transition:"all 0.18s",
                }}>
                  <div style={{opacity: active ? 1 : 0.35, transform: active ? "scale(1.1)" : "scale(1)", transition:"all 0.18s"}}>
                    <TabIcon name={t} active={active}/>
                  </div>
                  <span style={{
                    fontSize:"9px", fontWeight: active ? "600" : "400",
                    letterSpacing:"0.05em", textTransform:"uppercase",
                    color: active ? "#a78bfa" : "#444",
                    transition:"color 0.18s",
                  }}>{t}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

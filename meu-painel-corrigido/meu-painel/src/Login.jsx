import React, { useState, useEffect } from "react";
import { loginComGoogle, checkRedirectResult, loginComEmail, criarConta, recuperarSenha } from "./firebase.js";

const inp = {
  width:"100%", padding:"12px 14px", borderRadius:"10px",
  background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
  color:"#f0f0f0", fontSize:"14px", fontFamily:"'DM Sans',sans-serif",
  outline:"none", boxSizing:"border-box",
};
const btn = {
  width:"100%", padding:"13px", borderRadius:"12px", cursor:"pointer",
  fontSize:"14px", fontWeight:"600", fontFamily:"'DM Sans',sans-serif",
  border:"none", transition:"all 0.15s",
};

// Mensagens de erro traduzidas
function traduzirErro(code) {
  const erros = {
    "auth/user-not-found":        "E-mail não encontrado.",
    "auth/wrong-password":        "Senha incorreta.",
    "auth/email-already-in-use":  "Este e-mail já está em uso.",
    "auth/weak-password":         "Senha muito fraca (mínimo 6 caracteres).",
    "auth/invalid-email":         "E-mail inválido.",
    "auth/too-many-requests":     "Muitas tentativas. Tente mais tarde.",
    "auth/popup-closed-by-user":  "Login cancelado.",
    "auth/network-request-failed":"Sem conexão. Verifique sua internet.",
    "auth/invalid-credential":    "E-mail ou senha incorretos.",
  };
  return erros[code] || "Erro ao entrar. Tente novamente.";
}

export default function Login() {
  // tela: "login" | "cadastro" | "recuperar"
  const [tela,       setTela]       = useState("login");
  const [nome,       setNome]       = useState("");
  const [email,      setEmail]      = useState("");
  const [senha,      setSenha]      = useState("");
  const [confirma,   setConfirma]   = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro,       setErro]       = useState("");
  const [sucesso,    setSucesso]    = useState("");

  // Ao carregar, verifica se voltou de redirect do Google
  useEffect(() => {
    checkRedirectResult()
      .then(user => {
        if (user) {
          // Usuário logado via redirect — App.jsx vai detectar via onAuthStateChanged
        }
      })
      .catch(() => {});
  }, []);

  const limpar = () => { setErro(""); setSucesso(""); };

  // ── Entrar com email ──────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !senha) { setErro("Preencha e-mail e senha."); return; }
    setCarregando(true); limpar();
    try {
      await loginComEmail(email, senha);
    } catch (err) {
      setErro(traduzirErro(err.code));
      setCarregando(false);
    }
  };

  // ── Criar conta ───────────────────────────────────────────────────────────
  const handleCadastro = async (e) => {
    e.preventDefault();
    if (!nome.trim())          { setErro("Digite seu nome."); return; }
    if (!email)                { setErro("Digite seu e-mail."); return; }
    if (senha.length < 6)      { setErro("Senha mínima de 6 caracteres."); return; }
    if (senha !== confirma)    { setErro("As senhas não coincidem."); return; }
    setCarregando(true); limpar();
    try {
      await criarConta(nome.trim(), email, senha);
    } catch (err) {
      setErro(traduzirErro(err.code));
      setCarregando(false);
    }
  };

  // ── Recuperar senha ───────────────────────────────────────────────────────
  const handleRecuperar = async (e) => {
    e.preventDefault();
    if (!email) { setErro("Digite seu e-mail."); return; }
    setCarregando(true); limpar();
    try {
      await recuperarSenha(email);
      setSucesso("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      setCarregando(false);
    } catch (err) {
      setErro(traduzirErro(err.code));
      setCarregando(false);
    }
  };

  // ── Login Google ──────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setCarregando(true); limpar();
    try {
      const user = await loginComGoogle();
      if (!user) {
        // redirect em andamento — página vai recarregar
        return;
      }
      // popup funcionou — onAuthStateChanged vai detectar
    } catch (err) {
      console.error("Google login error:", err.code, err.message);
      setErro("Erro ao conectar com Google: " + (err.message || err.code));
      setCarregando(false);
    }
  };

  const irPara = (t) => { setTela(t); limpar(); };

  return (
    <div style={{
      minHeight:"100vh", background:"#080808",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'DM Sans',sans-serif", padding:"24px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input::placeholder{color:#444;}
        input:focus{border-color:rgba(124,58,237,0.5)!important;background:rgba(124,58,237,0.06)!important;}
      `}</style>

      {/* Glow de fundo */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",
        background:"radial-gradient(ellipse 55% 45% at 50% 0%,rgba(124,58,237,0.13) 0%,transparent 70%)"}}/>

      <div style={{width:"100%",maxWidth:"400px",animation:"fadeUp 0.4s ease",position:"relative"}}>

        {/* Logo GOAT */}
        <div style={{textAlign:"center",marginBottom:"32px"}}>
          <img src="/goat-logo.png" alt="GOAT" style={{width:"80px",height:"auto",display:"block",margin:"0 auto 10px"}}/>
          <h1 style={{fontSize:"30px",fontWeight:"900",color:"#f0f0f0",letterSpacing:"0.12em",marginBottom:"6px"}}>
            GOAT
          </h1>
          <p style={{fontSize:"13px",color:"#555"}}>Greatest Of All Time 🐐</p>
        </div>

        {/* Card */}
        <div style={{background:"#111",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"24px",padding:"28px 28px 24px"}}>

          {/* ── TELA: LOGIN ─────────────────────────────────────────── */}
          {tela === "login" && (
            <form onSubmit={handleLogin} style={{display:"grid",gap:"14px"}}>
              <div>
                <div style={{fontSize:"18px",fontWeight:"700",color:"#f0f0f0",marginBottom:"4px"}}>Entrar</div>
                <div style={{fontSize:"13px",color:"#555"}}>
                  Não tem conta?{" "}
                  <button type="button" onClick={()=>irPara("cadastro")}
                    style={{background:"none",border:"none",color:"#a78bfa",cursor:"pointer",fontSize:"13px",fontWeight:"600",padding:0}}>
                    Criar conta
                  </button>
                </div>
              </div>

              <input type="email" placeholder="E-mail" value={email}
                onChange={e=>setEmail(e.target.value)} style={inp} required/>

              <div style={{position:"relative"}}>
                <input type={mostrarSenha?"text":"password"} placeholder="Senha"
                  value={senha} onChange={e=>setSenha(e.target.value)}
                  style={{...inp,paddingRight:"44px"}} required/>
                <button type="button" onClick={()=>setMostrarSenha(v=>!v)}
                  style={{position:"absolute",right:"12px",top:"50%",transform:"translateY(-50%)",
                    background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:"16px"}}>
                  {mostrarSenha?"🙈":"👁"}
                </button>
              </div>

              <div style={{textAlign:"right",marginTop:"-6px"}}>
                <button type="button" onClick={()=>irPara("recuperar")}
                  style={{background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:"12px",padding:0}}>
                  Esqueci minha senha
                </button>
              </div>

              {erro && <MsgErro>{erro}</MsgErro>}

              <button type="submit" disabled={carregando} style={{
                ...btn,
                background: carregando?"rgba(124,58,237,0.4)":"linear-gradient(135deg,#7c3aed,#6d28d9)",
                color:"#fff", boxShadow: carregando?"none":"0 4px 14px rgba(124,58,237,0.4)",
              }}>
                {carregando ? <Spinner/> : "Entrar"}
              </button>

              <Divisor/>

              <BtnGoogle onClick={handleGoogle} carregando={carregando}/>
            </form>
          )}

          {/* ── TELA: CADASTRO ──────────────────────────────────────── */}
          {tela === "cadastro" && (
            <form onSubmit={handleCadastro} style={{display:"grid",gap:"14px"}}>
              <div>
                <div style={{fontSize:"18px",fontWeight:"700",color:"#f0f0f0",marginBottom:"4px"}}>Criar conta</div>
                <div style={{fontSize:"13px",color:"#555"}}>
                  Já tem conta?{" "}
                  <button type="button" onClick={()=>irPara("login")}
                    style={{background:"none",border:"none",color:"#a78bfa",cursor:"pointer",fontSize:"13px",fontWeight:"600",padding:0}}>
                    Entrar
                  </button>
                </div>
              </div>

              <input type="text" placeholder="Seu nome" value={nome}
                onChange={e=>setNome(e.target.value)} style={inp} required/>

              <input type="email" placeholder="E-mail" value={email}
                onChange={e=>setEmail(e.target.value)} style={inp} required/>

              <div style={{position:"relative"}}>
                <input type={mostrarSenha?"text":"password"} placeholder="Senha (mínimo 6 caracteres)"
                  value={senha} onChange={e=>setSenha(e.target.value)}
                  style={{...inp,paddingRight:"44px"}} required/>
                <button type="button" onClick={()=>setMostrarSenha(v=>!v)}
                  style={{position:"absolute",right:"12px",top:"50%",transform:"translateY(-50%)",
                    background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:"16px"}}>
                  {mostrarSenha?"🙈":"👁"}
                </button>
              </div>

              <input type={mostrarSenha?"text":"password"} placeholder="Confirmar senha"
                value={confirma} onChange={e=>setConfirma(e.target.value)} style={inp} required/>

              {/* Indicador de força da senha */}
              {senha.length > 0 && <ForcaSenha senha={senha}/>}

              {erro && <MsgErro>{erro}</MsgErro>}

              <button type="submit" disabled={carregando} style={{
                ...btn,
                background: carregando?"rgba(124,58,237,0.4)":"linear-gradient(135deg,#7c3aed,#6d28d9)",
                color:"#fff", boxShadow: carregando?"none":"0 4px 14px rgba(124,58,237,0.4)",
              }}>
                {carregando ? <Spinner/> : "Criar conta"}
              </button>

              <Divisor/>

              <BtnGoogle onClick={handleGoogle} carregando={carregando}/>
            </form>
          )}

          {/* ── TELA: RECUPERAR SENHA ────────────────────────────────── */}
          {tela === "recuperar" && (
            <form onSubmit={handleRecuperar} style={{display:"grid",gap:"14px"}}>
              <div>
                <button type="button" onClick={()=>irPara("login")}
                  style={{background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:"13px",padding:0,marginBottom:"8px",display:"flex",alignItems:"center",gap:"4px"}}>
                  ← Voltar
                </button>
                <div style={{fontSize:"18px",fontWeight:"700",color:"#f0f0f0",marginBottom:"4px"}}>Recuperar senha</div>
                <div style={{fontSize:"13px",color:"#555"}}>Enviaremos um link para seu e-mail</div>
              </div>

              <input type="email" placeholder="Seu e-mail" value={email}
                onChange={e=>setEmail(e.target.value)} style={inp} required/>

              {erro    && <MsgErro>{erro}</MsgErro>}
              {sucesso && <MsgSucesso>{sucesso}</MsgSucesso>}

              {!sucesso && (
                <button type="submit" disabled={carregando} style={{
                  ...btn,
                  background: carregando?"rgba(124,58,237,0.4)":"linear-gradient(135deg,#7c3aed,#6d28d9)",
                  color:"#fff", boxShadow: carregando?"none":"0 4px 14px rgba(124,58,237,0.4)",
                }}>
                  {carregando ? <Spinner/> : "Enviar link de recuperação"}
                </button>
              )}

              {sucesso && (
                <button type="button" onClick={()=>irPara("login")} style={{
                  ...btn, background:"rgba(52,211,153,0.1)",
                  border:"1px solid rgba(52,211,153,0.3)", color:"#34d399",
                }}>
                  Voltar ao login
                </button>
              )}
            </form>
          )}
        </div>

        {/* Rodapé */}
        <div style={{textAlign:"center",marginTop:"20px",fontSize:"11px",color:"#2a2a2a"}}>
          Seus dados são privados e sincronizam entre dispositivos
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
      <span style={{width:"16px",height:"16px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.2)",borderTopColor:"#fff",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>
      Aguarde...
    </span>
  );
}

function MsgErro({ children }) {
  return (
    <div style={{padding:"10px 14px",background:"rgba(248,113,113,0.09)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:"10px",fontSize:"13px",color:"#f87171"}}>
      ⚠️ {children}
    </div>
  );
}

function MsgSucesso({ children }) {
  return (
    <div style={{padding:"10px 14px",background:"rgba(52,211,153,0.09)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:"10px",fontSize:"13px",color:"#34d399"}}>
      ✅ {children}
    </div>
  );
}

function Divisor() {
  return (
    <div style={{display:"flex",alignItems:"center",gap:"10px",margin:"2px 0"}}>
      <div style={{flex:1,height:"1px",background:"rgba(255,255,255,0.07)"}}/>
      <span style={{fontSize:"11px",color:"#333",flexShrink:0}}>ou continue com</span>
      <div style={{flex:1,height:"1px",background:"rgba(255,255,255,0.07)"}}/>
    </div>
  );
}

function BtnGoogle({ onClick, carregando }) {
  return (
    <button type="button" onClick={onClick} disabled={carregando}
      style={{
        ...{width:"100%",padding:"12px",borderRadius:"12px",cursor:carregando?"not-allowed":"pointer",
          background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
          color:"#e0e0e0",fontSize:"14px",fontWeight:"600",fontFamily:"'DM Sans',sans-serif",
          display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",transition:"all 0.15s",
          opacity:carregando?0.6:1},
      }}
      onMouseEnter={e=>{if(!carregando)e.currentTarget.style.background="rgba(255,255,255,0.1)";}}
      onMouseLeave={e=>{if(!carregando)e.currentTarget.style.background="rgba(255,255,255,0.06)";}}>
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Entrar com Google
    </button>
  );
}

function ForcaSenha({ senha }) {
  const forca = senha.length >= 10 && /[A-Z]/.test(senha) && /[0-9]/.test(senha) ? 3
              : senha.length >= 8 ? 2
              : senha.length >= 6 ? 1 : 0;
  const labels = ["Muito fraca","Fraca","Boa","Forte"];
  const cores  = ["#ef4444","#f97316","#f59e0b","#34d399"];
  return (
    <div>
      <div style={{display:"flex",gap:"4px",marginBottom:"4px"}}>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{flex:1,height:"3px",borderRadius:"100px",
            background:i<=forca?cores[forca]:"rgba(255,255,255,0.07)",
            transition:"background 0.2s"}}/>
        ))}
      </div>
      <div style={{fontSize:"11px",color:cores[forca]}}>{labels[forca]}</div>
    </div>
  );
}

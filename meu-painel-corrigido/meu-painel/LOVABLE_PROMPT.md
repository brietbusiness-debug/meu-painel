# Meu Painel — Documento para Lovable

Crie um aplicativo web chamado **Meu Painel** — um painel pessoal de produtividade com tema escuro, estilo minimalista, usando React + Firebase. O app já existe e está funcionando; este documento descreve exatamente como ele deve ser recriado/continuado.

---

## Stack Técnica

- **React 18** com Vite
- **Firebase 10** (Firestore + Authentication com Google)
- **Recharts** para gráficos
- **Google Fonts** — DM Sans (300, 400, 500, 600, 700, 800)
- **Sem CSS externo** — todos os estilos são inline via `style={{}}`
- **Sem TypeScript** — JavaScript puro

---

## Design System

### Cores
```js
background:     #080808   // fundo principal
card:           #111111   // cards
border:         rgba(255,255,255,0.07)
purple primary: #7c3aed
purple light:   #a855f7
purple text:    #a78bfa
purple glow:    #c084fc
text primary:   #f0f0f0
text secondary: #888888
text muted:     #444444
green:          #34d399   // positivo / ganho
red:            #f87171   // negativo / perda
orange:         #f97316   // cardio
yellow:         #f59e0b   // médio prazo
blue:           #60a5fa   // bike
cyan:           #06b6d4   // natação
```

### Estilos base reutilizados
```js
const card = {
  background: "#111",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "18px",
  padding: "16px",
};

const inp = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  color: "#f0f0f0",
  padding: "10px 14px",
  fontSize: "14px",
  width: "100%",
  fontFamily: "DM Sans, sans-serif",
  outline: "none",
};

const btnPurple = {
  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
  border: "none",
  borderRadius: "10px",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "DM Sans, sans-serif",
  fontWeight: "600",
};

const btnGhost = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  color: "#888",
  cursor: "pointer",
  fontFamily: "DM Sans, sans-serif",
};

const lbl = {
  fontSize: "11px",
  fontWeight: "600",
  color: "#555",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
```

---

## Estrutura de Arquivos

```
src/
  App.jsx          — app inteiro (componentes, lógica, UI)
  firebase.js      — config Firebase + auth Google
  useCloudStorage.js — hook de sincronização Firebase ↔ localStorage
  CloudStatus.jsx  — botão de status da nuvem (normal e compact)
  Login.jsx        — tela de login com Google
  main.jsx         — entry point React
```

---

## Autenticação

### firebase.js
```js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth, signInWithPopup, signOut,
  GoogleAuthProvider, onAuthStateChanged,
} from "firebase/auth";

const firebaseConfig = {
  // usuário preenche com suas credenciais
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI",
};

const app      = initializeApp(firebaseConfig);
const db       = getFirestore(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

export async function loginComGoogle() {
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logout() {
  await signOut(auth);
  window.location.reload();
}

export function onUsuario(callback) {
  return onAuthStateChanged(auth, callback);
}

let cachedUID = null;
export async function getUID() {
  if (cachedUID) return cachedUID;
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) { cachedUID = user.uid; resolve(user.uid); }
    });
  });
}

export { db, auth };
```

### Login.jsx
Tela de login simples com:
- Logo "P" roxo centralizado
- Título "Meu **Painel**"
- Card com botão "Entrar com Google" (ícone SVG do Google)
- 3 bullets: dados na nuvem, sincronização automática, seguro
- Loading spinner durante autenticação
- Mensagem de erro se falhar

### App.jsx — controle de auth
```jsx
export default function App() {
  const [usuario, setUsuario] = useState(undefined); // undefined=carregando, null=deslogado

  useEffect(() => {
    const unsub = onUsuario(u => setUsuario(u));
    return () => unsub();
  }, []);

  if (usuario === undefined) return <LoadingScreen />;
  if (!usuario) return <Login />;
  // resto do app...
}
```

---

## Sistema de Dados — useCloudStorage.js

Hook `useCloudStorage(key, initialValue)` que:
1. Lê do `localStorage` imediatamente (sem loading)
2. Busca do Firestore em background
3. Salva no `localStorage` + Firestore (debounce 1s)
4. Estrutura Firestore: `users/{uid}/data/{key}`

**Todas as chaves usadas:**
```js
// Finanças
"fin:transactions"   // [{id, tipo, descricao, valor, categoria, ts}]
"fin:dividas"        // [{id, nome, valor, pago, parcelas, parcAtual}]
"fin:investimentos"  // [{id, nome, tipo, valor, rendimento, data}]
"fin:assinaturas"    // [{id, nome, valor, dia, categoria, ativo}]
"fin:mensal-extras"  // extras do histórico mensal

// Tarefas
"tasks:list"         // [{id, texto, feita, prioridade, prazo, rotina, subtasks}]
"tasks:rotina"       // [{id, texto, dias:[0-6]}]

// Hábitos
"habits:list"        // [{id, nome, emoji, meta, cor}]
"habits:checks"      // {YYYY-MM-DD: {habitId: true/false}}

// Metas
"goals:list"         // [{id, titulo, descricao, prazo, foto, checklist, deadline, prazoCateg}]

// Treino
"treino:split2"      // {0-6: [{id, tipo, musculo, detalhe, exercicios:[]}]}
"treino:pesos"       // [{data, kg, ts}]
"treino:metaPeso"    // number (kg da meta)
"treino:altura"      // number (cm)
"treino:log"         // [{id, data, exercicios, notas, duracao}]
"treino:exercicios"  // lista de exercícios salvos
"treino:dieta"       // [{id, data, refeicoes:[{nome,cal,prot}]}]
"treino:medidas"     // [{id, data, peso, gordura, musculo, ...}]
"treino:metas"       // metas físicas
"treino:meta-cal"    // number (meta calorias)
"treino:meta-prot"   // number (meta proteína)

// Outros
"ia:apikey"          // string (OpenAI API key)
"livros:list"        // [{id, titulo, autor, paginas, lidas, status, nota, capa, genero}]
"agenda:events"      // [{id, titulo, data, hora, tipo, descricao, recorrente}]
```

---

## Layout

### Desktop (≥900px) — Sidebar esquerda
```
┌─────┬──────────────────────────────┐
│ 68px│        Main content          │
│     │      max-width: 900px        │
│ [P] │                              │
│     │  Data + nome da aba          │
│ nav │                              │
│     │  <Componente da aba>         │
│icons│                              │
│     │                              │
│ usr │                              │
└─────┴──────────────────────────────┘
```

**Sidebar (68px):**
- Fundo `#080808`
- Logo: quadrado 36×36px roxo com letra "P"
- Ícones SVG de navegação (15×15px), sem texto
- Active: background `rgba(124,58,237,0.18)` + barra esquerda 3px roxa
- Inactive: opacidade 35%
- Tooltip CSS `::after` com `attr(title)` aparece ao hover
- Bottom: CloudStatus compact + avatar do usuário (foto do Google)
- Click no avatar: `window.confirm("Sair?")` → logout

### Mobile (<900px) — Bottom tab bar
```
┌──────────────────────────────────┐
│ [data]              [cloud][foto]│  ← header
│                                  │
│         <conteúdo da aba>        │
│                                  │
│                                  │
├──────────────────────────────────┤
│ 🏠  💰  ✅  🔄  🎯  💪  📚  📅  │  ← tab bar fixo
└──────────────────────────────────┘
```

**Tab bar:**
- Position fixed bottom
- Background `rgba(8,8,8,0.92)` + blur 20px
- Ícones SVG + label 9px
- Active: fundo `rgba(124,58,237,0.18)` + cor `#a78bfa`

---

## Abas (8 no total)

`const TABS = ["Home", "Finanças", "Tarefas", "Hábitos", "Metas", "Treino", "Livros", "Agenda"]`

---

## Componentes por Aba

### 🏠 Home
Dashboard com cards resumo de todos os módulos:
- Saudação com nome do usuário e hora
- Card Finanças: saldo do mês, receitas vs despesas
- Card Tarefas: pendentes hoje, progresso
- Card Hábitos: consistência últimos 7 dias (gráfico de linha)
- Card Metas: metas ativas com progresso
- Card Treino: treino de hoje + peso atual vs meta
- Gráfico de receitas vs despesas (BarChart 6 meses)
- Gráfico de consistência de hábitos (LineChart 7 dias)
- Widget IA embarcada (OpenAI)

### 💰 Finanças
4 sub-abas: `Visão Geral | Lançamentos | Histórico | Dívidas | Investimentos | Assinaturas`

**Visão Geral:**
- Cards: Saldo, Receitas, Despesas do mês atual
- Gráfico pizza de despesas por categoria
- Lista de transações recentes

**Lançamentos:**
- Formulário: tipo (receita/despesa), descrição, valor, categoria, data
- Categorias despesa: Alimentação, Moradia, Transporte, Saúde, Lazer, Educação, Outros
- Categorias receita: Salário, Freelance, Investimentos, Outros
- Lista com filtros por mês

**Histórico Mensal:**
- Navegação por mês/ano
- Totais de receita e despesa
- Gráfico comparativo

**Dívidas:**
- Adicionar dívida: nome, valor total, parcelas, parcela atual
- Progresso de pagamento por barra
- Marcar parcela como paga

**Investimentos:**
- Adicionar: nome, tipo, valor investido, rendimento %, data
- Total investido e rendimento estimado

**Assinaturas:**
- Nome, valor mensal, dia de cobrança, categoria
- Total mensal de assinaturas

### ✅ Tarefas
- Lista de tarefas com checkbox
- Prioridade: alta (vermelho), média (amarelo), baixa (verde)
- Prazo com data
- Subtarefas expansíveis
- Sistema de Rotina: tarefas que repetem em dias da semana
- Filtros: todas / pendentes / concluídas / hoje
- Pomodoro timer integrado (25/5 min) com som ao finalizar

### 🔄 Hábitos
- Criar hábito: nome, emoji, meta diária, cor
- Grid semanal de check-ins (últimos 7 dias)
- Streak (sequência atual)
- Gráfico de consistência (últimas 4 semanas)
- Porcentagem de conclusão do dia

### 🎯 Metas
- 3 categorias por prazo:
  - ⚡ Curto prazo (até 1 mês) — verde `#34d399`
  - 🎯 Médio prazo (1-6 meses) — amarelo `#f59e0b`
  - 🚀 Longo prazo (6+ meses) — roxo `#a855f7`
- Cards de resumo clicáveis para filtrar
- Cada meta: título, descrição, foto (upload), deadline, checklist
- Formulário de criação/edição
- Badge de prazo na foto ou no título

### 💪 Treino
5 sub-abas: `Meu Split | Visão Geral | Treinos | Dieta | Medidas & Metas`

**Meu Split (TreinoSplit):**

*Card "Hoje":*
- Mostra todos os blocos de treino do dia
- Emoji + tipo + músculo/detalhe + exercícios em chips

*Card "Meu Peso":*
- Peso atual em destaque (32px bold)
- Variação vs anterior (badge verde/vermelho)
- Input + botão "✓ Salvar"
- **Card "Peso Ideal":**
  - Se não definido: pergunta o peso ideal com input
  - Se definido: mostra `[peso atual] ↔ [− X kg faltam] ↔ [meta]`
  - Barra de progresso com % do caminho percorrido
  - "Desde o início: X kg em N registros"
  - Quando atingir: "🎉 Você chegou lá!"
  - Botão "alterar" no canto
- **Gráfico AreaChart sempre visível:**
  - Linha de área roxa (pesoGrad2)
  - ReferenceLine tracejada amarela/laranja para a meta
  - Tooltip mostra valor + variação + distância da meta
  - Último ponto destacado (r=5, cor #c084fc)
  - Se <2 pontos: gráfico vazio decorativo + overlay com instrução
- **Stats:** Menor / Maior / Total registros / Variação total
- **Histórico com barrinhas:**
  - Cada registro: ponto colorido + data + peso + badge variação + "X kg p/ meta"
  - Mini barra horizontal mostrando posição no range min-max
  - Cor da barra: roxo (primeiro), vermelho (subiu), verde (desceu)
  - Botão × para deletar
  - Scroll interno max-height 260px

*Semana de Treinos:*
- 7 cards (Dom-Sáb), card do dia atual destacado em roxo
- Click abre painel de edição
- **Múltiplos blocos por dia** — cada dia pode ter vários treinos
- Botão "+ Adicionar treino neste dia"
- **Cada bloco tem:**
  - Seletor de tipo (grid 4 colunas): 💪 Musculação / 🏃 Cardio / 🔥 HIIT / 🧘 Yoga / 🚴 Bike / 🏊 Natação / ⚽ Esporte / 🛋️ Descanso
  - Se Musculação: seletor de músculo (Peito, Costas, Ombros, Bíceps, Tríceps, Pernas, Glúteos, Abdômen, Full Body)
  - Se Cardio/HIIT/Bike/Natação: campo de detalhe livre
  - Se Musculação/HIIT: lista de exercícios com add/delete
  - Botão "remover" o bloco
- Linha resumo: emoji do tipo + nome + músculo/detalhe, pontos coloridos
- Cores por tipo: Musculação=#a855f7, Cardio=#f97316, HIIT=#ef4444, Yoga=#34d399, Bike=#60a5fa, Natação=#06b6d4, Esporte=#f59e0b, Descanso=#333

**Visão Geral:**
- Gráficos de peso e medidas
- IMC calculado com altura (input persistido)
- Faixas: abaixo do peso / normal / sobrepeso / obesidade
- Peso ideal IMC 22

**Treinos (Log):**
- Registrar treino: data, exercícios, duração, notas
- Histórico de treinos realizados

**Dieta:**
- Meta de calorias e proteína (inputs)
- Registrar refeições do dia
- Progress bars de calorias e proteína

**Medidas & Metas:**
- Registrar medidas corporais (peso, gordura %, músculo %)
- Metas físicas com progresso

### 📚 Livros
- Status: 📖 Lendo / ✅ Lido / 📋 Lista
- Campos: título, autor, páginas totais, páginas lidas, nota (1-5 estrelas), gênero, capa (URL)
- Filtros por status
- Progresso de leitura (barra)
- Stats: lidos, lendo, na lista, páginas totais
- Widget IA para recomendações

### 📅 Agenda
- Criar eventos: título, data, hora, tipo, descrição, recorrente
- Tipos: 📅 Compromisso / 🏥 Saúde / 💼 Trabalho / 🎉 Pessoal / ⚠️ Importante
- Visualização por semana (calendário semanal)
- Próximos eventos em lista
- Eventos do dia destacados

---

## Pomodoro Timer (dentro de Tarefas)

```
- Modo: Foco (25 min) / Pausa (5 min)
- Display: MM:SS grande
- Botões: Iniciar / Pausar / Resetar
- Progresso circular SVG
- Som ao finalizar: Web Audio API (Tibetan bowl style)
  - Foco end: sequência 432Hz, 528Hz, 396Hz, 432Hz
  - Pausa end: 396Hz único
  - Volume suave (0.08-0.15), sine wave com fade out
```

---

## Componente IAWidget

Widget de IA embarcado em algumas telas (Home, Livros):
```jsx
function IAWidget({ context, systemPrompt, placeholder }) {
  // usa OpenAI API key salva em "ia:apikey"
  // input + botão enviar
  // resposta em markdown simples
  // histórico da conversa na sessão
}
```

---

## CloudStatus.jsx

Botão de status da nuvem com dois modos:

**Normal:** botão "☁ Conectado/Offline/Sincronizando" com dropdown:
- Sincronizar agora
- Baixar backup JSON
- Restaurar backup

**Compact (prop):** dot colorido 8px no canto de um botão 44×44px
- Dropdown posicionado à direita (left: 56px) para não sair da sidebar

---

## Modal de Fechamento de Mês

Aparece automaticamente ao abrir o app no primeiro dia do mês (uma vez por mês):
- Resumo do mês anterior: receitas, despesas, saldo
- Top 3 categorias de despesa
- Comparação com mês anterior
- Botão "Fechar mês" / "Ver depois"

---

## Regras de Segurança Firebase (Firestore)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## PWA (manifest.json)

```json
{
  "name": "Meu Painel",
  "short_name": "Painel",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#080808",
  "theme_color": "#7c3aed",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## Animações

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Aplicado em: */
.tab-content { animation: fadeUp 0.25s ease; }
```

---

## Comportamentos importantes

1. **Todos os dados persistem** via `useCloudStorage` — Firebase + localStorage offline
2. **Cada usuário logado** tem seus próprios dados isolados no Firestore
3. **Sem reload ao trocar aba** — SPA, `key={tab}` força re-mount com animação
4. **Gráficos sempre visíveis** — mostram estado vazio/decorativo antes de ter dados
5. **IIFEs no JSX** devem usar padrão `{condição && (() => { ... })()}` — nunca `{(() => {})()}` isolado (causa erro no esbuild/Vite)
6. **Tooltips da sidebar** via CSS `::after` com `attr(title)`
7. **Backup automático** semanal em JSON ao abrir o app

---

## Prioridades de implementação para o Lovable

1. `firebase.js` + `useCloudStorage.js` + `Login.jsx` — base de dados
2. Layout desktop (sidebar) + mobile (bottom tabs) + auth guard
3. Home dashboard
4. Finanças (módulo mais complexo)
5. Tarefas + Pomodoro
6. Hábitos
7. Metas
8. Treino (Split + Peso + Meta)
9. Livros
10. Agenda

# 📱 Meu Painel — PWA com Firebase + Backup Semanal

## Como configurar a nuvem (Firebase) — 10 minutos

### Passo 1 — Criar projeto
1. Acesse console.firebase.google.com (login com Google)
2. Clique em "Criar projeto" e dê um nome (ex: meu-painel)

### Passo 2 — Ativar Firestore
1. Menu lateral → "Firestore Database" → "Criar banco de dados"
2. Escolha "Modo de produção" e selecione uma região (ex: us-east1)

### Passo 3 — Ativar login anônimo
1. Menu lateral → "Authentication" → "Começar"
2. Aba "Método de login" → clique em "Anônimo" → ative

### Passo 4 — Pegar credenciais
1. Configurações do projeto (ícone ⚙️) → "Seus apps"
2. Clique em "Adicionar app" → ícone Web (</>)
3. Copie o objeto firebaseConfig

### Passo 5 — Colar em src/firebase.js
Substitua os valores "COLE_AQUI" pelas suas credenciais.

### Passo 6 — Regras do Firestore (segurança)
No Firebase Console → Firestore → Regras, cole:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}

## Deploy no Netlify
1. npm install && npm run build
2. Arraste a pasta dist/ para netlify.com
3. Você recebe uma URL pública

## Instalar no iPhone
1. Abra a URL no Safari
2. Toque em Compartilhar (ícone ↑)
3. Toque em "Adicionar à Tela de Início"

## Backup
- Automático toda semana (baixa um .json no dispositivo)
- Manual: clique no ícone ☁ no canto superior direito
- Restaurar: ☁ → "Restaurar backup" → selecione o .json

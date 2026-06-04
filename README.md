# JojoBot - Agente de Conteúdo Inteligente 🚀

O **JojoBot** é um sistema autônomo baseado em Node.js (Express + Telegram Bot API) e Python (Tweepy) projetado para simplificar e automatizar a criação de conteúdo profissional para o Twitter/X e LinkedIn a partir do Telegram.

Ele processa ideias brutas, cria redações otimizadas com IA (Gemini/OpenAI), gera uma imagem ilustrativa UGC (DALL-E 3) e fornece botões interativos no Telegram para publicar nas redes instantaneamente.

---

## 🛠️ Arquitetura do Sistema

1. **Back-end Node.js**: Express configurado para monitoramento (health checks) e execução contínua 24/7.
2. **Interface Telegram**: Integração baseada em Polling ativo (`node-telegram-bot-api`) com suporte a teclados Inline interativos.
3. **Banco de Dados Local**: Arquivo JSON (`db.json`) leve que rastreia sessões ativas e histórico de rascunhos.
4. **Módulos de IA**:
   - **Gemini 1.5/2.0** (Google Generative AI) para redação de posts virais.
   - **DALL-E 3** (OpenAI) para imagens ultra-realistas estilo UGC.
5. **Publicadores**:
   - **LinkedIn**: Requisições HTTP nativas v2 (chamadas `ugcPosts`).
   - **Twitter/X**: Script Python integrando `tweepy` (OAuth 1.0a para upload de mídia e API v2 para publicação de tweets).

---

## 🚀 Como Configurar e Rodar Localmente

### 1. Pré-requisitos
- **Node.js** v18+ instalado.
- **Python 3** instalado.

### 2. Instalação
Clone o projeto para seu workspace local. Na pasta raiz:

```bash
# Instalar dependências do Node.js
npm install

# Instalar ambiente virtual Python e tweepy
python3 -m venv venv
./venv/bin/pip install tweepy
```

### 3. Configuração do `.env`
Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:
```env
PORT=3000
TELEGRAM_BOT_TOKEN=seu_token_aqui
GEMINI_API_KEY=sua_chave_gemini
OPENAI_API_KEY=sua_chave_openai

# LinkedIn
LINKEDIN_ACCESS_TOKEN=seu_access_token_aqui
LINKEDIN_MEMBER_URN=urn:li:person:seu_id_aqui

# Twitter/X
TWITTER_CONSUMER_KEY=sua_key_aqui
TWITTER_CONSUMER_SECRET=sua_secret_aqui
TWITTER_ACCESS_TOKEN=seu_access_token_aqui
TWITTER_ACCESS_TOKEN_SECRET=seu_access_token_secret_aqui
```

### 4. Executando
```bash
npm run dev
```

---

## ☁️ Guia de Deploy no Railway

O Railway é excelente para rodar bots 24/7 pois detecta automaticamente o arquivo `package.json` e expõe a porta HTTP.

### Passo 1: Subir o código para o GitHub
1. Crie um repositório no seu GitHub.
2. Inicialize o git e suba o código:
   ```bash
   git init
   git add .
   git commit -m "feat: inicializando jojobot"
   git branch -M main
   git remote add origin https://github.com/seu-usuario/seu-repositorio.git
   git push -u origin main
   ```

### Passo 2: Criar Projeto no Railway
1. Acesse o painel do [Railway](https://railway.app/).
2. Clique em **New Project** > **Deploy from GitHub repo**.
3. Escolha o repositório do **JojoBot**.

### Passo 3: Configurar Variáveis de Ambiente no Railway
No painel do seu serviço no Railway, acesse a aba **Variables** e adicione todas as chaves contidas no `.env.example`:
- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `LINKEDIN_ACCESS_TOKEN`
- `LINKEDIN_MEMBER_URN`
- `TWITTER_CONSUMER_KEY`
- `TWITTER_CONSUMER_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`
- **Nota**: A variável `PORT` é injetada automaticamente pelo Railway, mas se desejar pode forçar `PORT=3000`.

### Passo 4: Railway Nixpacks Build (Automático)
O Railway usa `Nixpacks` por padrão. Ele instalará automaticamente o Node.js e também o interpretador de **Python** necessário para o script do Twitter/X.
Na inicialização (Deploy), o Railway rodará o script `npm start` que executa `node src/app.js`.

> [!NOTE]
> Durante o build no Railway, certifique-se de configurar o build step se necessário para instalar dependências Python, ou configure o script do Twitter/X para instalar a biblioteca tweepy em tempo de execução se o ambiente virtual local não estiver commitado (recomendado não commitar a pasta `venv` para evitar arquivos binários gigantes).
> O Railway Nixpacks instala Python automaticamente se houver um arquivo `requirements.txt` na raiz.
> Para garantir que o Railway instale o tweepy, adicionamos um arquivo `requirements.txt` com `tweepy` na raiz do projeto.

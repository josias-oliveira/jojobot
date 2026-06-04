import express from 'express';
import config, { checkConfig } from './config.js';
import { initTelegramBot } from './telegram.js';

const app = express();

app.use(express.json());

// Rota de Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Página Inicial Simples informativa
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
      <h1 style="color: #4A154B;">🤖 JojoBot está Ativo!</h1>
      <p>O back-end do seu agente de conteúdo inteligente está rodando perfeitamente.</p>
      <p>Envie mensagens no bot do Telegram cadastrado para começar.</p>
      <div style="margin-top: 20px; font-size: 0.9em; color: #666;">
        Uptime: ${Math.floor(process.uptime())} segundos
      </div>
    </div>
  `);
});

// Tratamento global de erros para evitar que o servidor caia
process.on('uncaughtException', (error) => {
  console.error('[CRITICAL] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Inicialização
const startServer = () => {
  // 1. Validar variáveis de ambiente
  const validation = checkConfig();

  if (!validation.isValid) {
    console.error('[CRITICAL] Não foi possível iniciar o JojoBot por falta de configurações essenciais no arquivo .env.');
    console.error('Certifique-se de configurar pelo menos o TELEGRAM_BOT_TOKEN.');
    process.exit(1);
  }

  // 2. Iniciar Express na porta requerida pelo Railway
  app.listen(config.port, () => {
    console.log(`[Express] Servidor HTTP rodando na porta ${config.port}`);
  });

  // 3. Iniciar Bot do Telegram
  try {
    initTelegramBot();
  } catch (botError) {
    console.error('[CRITICAL] Falha ao iniciar bot do Telegram:', botError);
  }
};

startServer();

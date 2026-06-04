import express from 'express';
import config, { checkConfig } from './config.js';
import { initTelegramBot } from './telegram.js';
import { performHealthChecks, startPeriodicHealthChecks } from './health-check.js';
import { scheduleAutomaticBackups, getBackupStats } from './backup.js';
import { metrics } from './monitoring.js';

const app = express();

app.use(express.json());

// Rota de Health Check com validação de APIs
app.get('/health', async (req, res) => {
  try {
    const health = await performHealthChecks();
    const backupStats = getBackupStats();
    const metricsData = metrics.getMetrics();

    res.status(200).json({
      status: health.allHealthy ? 'online' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: metricsData.uptime,
      apis: health,
      backup: backupStats,
      metrics: metricsData
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Página Inicial com Métricas
app.get('/', (req, res) => {
  const metricsData = metrics.getMetrics();
  const memMB = (metricsData.memory.heapUsed / 1024 / 1024).toFixed(2);

  res.send(`
    <html>
      <head>
        <title>JojoBot Dashboard</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; }
          .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
          h1 { color: #4A154B; margin: 0; }
          .status { display: flex; align-items: center; gap: 10px; margin: 20px 0; }
          .status-badge {
            padding: 8px 12px; border-radius: 4px; font-weight: bold;
            background: #10b981; color: white;
          }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
          .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .card h3 { margin-top: 0; color: #333; }
          .card-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .card-row:last-child { border-bottom: none; }
          .card-label { color: #666; font-size: 0.9em; }
          .card-value { font-weight: bold; color: #333; }
          .footer { text-align: center; margin-top: 40px; color: #999; font-size: 0.9em; }
          a { color: #4A154B; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🤖 JojoBot Dashboard</h1>

          <div class="status">
            <div class="status-badge">✓ Online</div>
            <span>Uptime: ${metricsData.uptime}</span>
          </div>

          <div class="grid">
            <div class="card">
              <h3>📊 Requisições</h3>
              <div class="card-row">
                <span class="card-label">Total</span>
                <span class="card-value">${metricsData.requests.total}</span>
              </div>
              <div class="card-row">
                <span class="card-label">Telegram</span>
                <span class="card-value">${metricsData.requests.telegram}</span>
              </div>
              <div class="card-row">
                <span class="card-label">Erros</span>
                <span class="card-value" style="color: ${metricsData.errors.total > 0 ? '#ef4444' : '#10b981'}">
                  ${metricsData.errors.total} (${metricsData.errors.error_rate}%)
                </span>
              </div>
            </div>

            <div class="card">
              <h3>📝 Posts Publicados</h3>
              <div class="card-row">
                <span class="card-label">Total</span>
                <span class="card-value">${metricsData.posts.total}</span>
              </div>
              <div class="card-row">
                <span class="card-label">Twitter</span>
                <span class="card-value">${metricsData.posts.twitter}</span>
              </div>
              <div class="card-row">
                <span class="card-label">LinkedIn</span>
                <span class="card-value">${metricsData.posts.linkedin}</span>
              </div>
            </div>

            <div class="card">
              <h3>⚡ Performance</h3>
              <div class="card-row">
                <span class="card-label">Geração IA</span>
                <span class="card-value">${metricsData.performance.avg_generation_ms}ms</span>
              </div>
              <div class="card-row">
                <span class="card-label">Publicação</span>
                <span class="card-value">${metricsData.performance.avg_publication_ms}ms</span>
              </div>
              <div class="card-row">
                <span class="card-label">Memory</span>
                <span class="card-value">${memMB}MB</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>
              <a href="/health">Ver Health Check Completo</a> •
              Última atualização: ${metricsData.timestamp}
            </p>
          </div>
        </div>
      </body>
    </html>
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
const startServer = async () => {
  // 1. Validar variáveis de ambiente
  const validation = checkConfig();

  if (!validation.isValid) {
    console.error('[CRITICAL] Não foi possível iniciar o JojoBot por falta de configurações essenciais no arquivo .env.');
    console.error('Certifique-se de configurar pelo menos o TELEGRAM_BOT_TOKEN.');
    process.exit(1);
  }

  // 2. ✅ Validar APIs na inicialização
  console.log('[Startup] Validando APIs...');
  try {
    const health = await performHealthChecks();
    if (!health.allHealthy) {
      console.warn('[Startup] ⚠️ Algumas APIs têm problemas, continuando mesmo assim...');
      if (health.details.errors.length > 0) {
        console.error('[Startup] Erros detectados:', health.details.errors);
      }
    }
  } catch (healthError) {
    console.error('[Startup] Erro ao validar APIs:', healthError.message);
  }

  // 3. ✅ Agendar health checks periódicos (a cada 6 horas)
  startPeriodicHealthChecks(6);

  // 4. ✅ Agendar backups automáticos (diários)
  scheduleAutomaticBackups();

  // 5. Iniciar Express na porta requerida pelo Railway
  app.listen(config.port, () => {
    console.log(`[Express] Servidor HTTP rodando na porta ${config.port}`);
    console.log(`[Express] Dashboard: http://localhost:${config.port}/`);
    console.log(`[Express] Health Check: http://localhost:${config.port}/health`);
  });

  // 6. Iniciar Bot do Telegram
  try {
    initTelegramBot();
  } catch (botError) {
    console.error('[CRITICAL] Falha ao iniciar bot do Telegram:', botError);
  }

  console.log('[Startup] JojoBot iniciado com sucesso!');
};

startServer().catch(error => {
  console.error('[CRITICAL] Erro fatal na inicialização:', error);
  process.exit(1);
});

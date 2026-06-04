/**
 * Monitoring - Coleta métricas e logs estruturados
 * Permite ver status e performance do bot
 */

import fs from 'fs';
import path from 'path';

/**
 * Classe para coleta de métricas
 */
class MetricsCollector {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      requests: {
        total: 0,
        telegram: 0,
        twitter: 0,
        linkedin: 0,
        dalle: 0
      },
      errors: {
        total: 0,
        telegram: 0,
        twitter: 0,
        linkedin: 0,
        dalle: 0
      },
      posts: {
        total: 0,
        twitter: 0,
        linkedin: 0
      },
      latency: {
        avg_generation_ms: 0,
        avg_publication_ms: 0
      }
    };

    this.timers = new Map(); // Para rastrear latência
  }

  /**
   * Registrar requisição
   * @param {string} type Tipo: telegram, twitter, linkedin, dalle
   */
  recordRequest(type) {
    this.metrics.requests.total++;
    if (this.metrics.requests[type] !== undefined) {
      this.metrics.requests[type]++;
    }
  }

  /**
   * Registrar erro
   * @param {string} type Tipo: telegram, twitter, linkedin, dalle
   */
  recordError(type) {
    this.metrics.errors.total++;
    if (this.metrics.errors[type] !== undefined) {
      this.metrics.errors[type]++;
    }
  }

  /**
   * Registrar post publicado
   * @param {string} platform twitter ou linkedin
   */
  recordPost(platform) {
    this.metrics.posts.total++;
    if (this.metrics.posts[platform] !== undefined) {
      this.metrics.posts[platform]++;
    }
  }

  /**
   * Iniciar timer para latência
   * @param {string} label Identificador único
   */
  startTimer(label) {
    this.timers.set(label, Date.now());
  }

  /**
   * Parar timer e registrar latência
   * @param {string} label Identificador único
   * @param {string} type Tipo de operação (generation ou publication)
   * @returns {number} Tempo em ms
   */
  endTimer(label, type = 'generation') {
    if (!this.timers.has(label)) return 0;

    const elapsed = Date.now() - this.timers.get(label);
    this.timers.delete(label);

    // Atualizar média (simples: última 100 operações)
    const key = type === 'generation' ? 'avg_generation_ms' : 'avg_publication_ms';
    if (this.metrics.latency[key] === 0) {
      this.metrics.latency[key] = elapsed;
    } else {
      this.metrics.latency[key] = Math.round((this.metrics.latency[key] + elapsed) / 2);
    }

    return elapsed;
  }

  /**
   * Obter métricas formatadas
   */
  getMetrics() {
    const uptime = Math.floor((Date.now() - this.metrics.startTime) / 1000);
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    const errorRate = this.metrics.requests.total > 0
      ? ((this.metrics.errors.total / this.metrics.requests.total) * 100).toFixed(2)
      : '0.00';

    return {
      uptime: `${uptimeHours}h ${uptimeMinutes}m`,
      uptime_seconds: uptime,
      requests: this.metrics.requests,
      errors: {
        ...this.metrics.errors,
        error_rate: `${errorRate}%`
      },
      posts: this.metrics.posts,
      performance: {
        avg_generation_ms: this.metrics.latency.avg_generation_ms,
        avg_publication_ms: this.metrics.latency.avg_publication_ms
      },
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset de métricas
   */
  reset() {
    this.metrics = {
      startTime: Date.now(),
      requests: { total: 0, telegram: 0, twitter: 0, linkedin: 0, dalle: 0 },
      errors: { total: 0, telegram: 0, twitter: 0, linkedin: 0, dalle: 0 },
      posts: { total: 0, twitter: 0, linkedin: 0 },
      latency: { avg_generation_ms: 0, avg_publication_ms: 0 }
    };
    this.timers.clear();
  }
}

/**
 * Logger estruturado com níveis
 */
class StructuredLogger {
  constructor() {
    this.logsDir = path.resolve('logs');
    this.ensureLogsDir();
  }

  ensureLogsDir() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Log estruturado com contexto
   */
  log(level, module, message, context = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      module,
      message,
      context,
      pid: process.pid
    };

    // Console
    const consoleMsg = `[${timestamp}] [${module}] [${level}] ${message}`;
    if (level === 'ERROR') {
      console.error(consoleMsg, context);
    } else if (level === 'WARN') {
      console.warn(consoleMsg, context);
    } else {
      console.log(consoleMsg);
    }

    // Arquivo (diário)
    this.writeLogFile(logEntry);
  }

  /**
   * Escrever log em arquivo
   */
  writeLogFile(logEntry) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logsDir, `jojobot_${today}.log`);

      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf-8');

      // Manter apenas últimos 7 dias de logs
      this.cleanupOldLogs();
    } catch (error) {
      console.error('Erro ao escrever log:', error.message);
    }
  }

  /**
   * Limpar logs antigos (> 7 dias)
   */
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logsDir)
        .filter(f => f.startsWith('jojobot_') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.logsDir, f),
          time: fs.statSync(path.join(this.logsDir, f)).mtime.getTime()
        }));

      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      files.forEach(f => {
        if (f.time < sevenDaysAgo) {
          fs.unlinkSync(f.path);
        }
      });
    } catch (error) {
      // Silenciosamente ignorar erros de cleanup
    }
  }
}

// Instâncias globais
export const metrics = new MetricsCollector();
export const logger = new StructuredLogger();

export default {
  metrics,
  logger,
  MetricsCollector,
  StructuredLogger
};

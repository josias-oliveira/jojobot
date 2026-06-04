/**
 * Health Check - Valida todas as APIs na inicialização e periodicamente
 * Previne bot iniciar com credenciais inválidas
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import axios from 'axios';
import config from './config.js';
import { safeLog } from './security.js';

/**
 * Validar Gemini API Key
 */
async function validateGemini() {
  try {
    if (!config.geminiApiKey) {
      return { service: 'Gemini', status: 'MISSING', message: 'Chave não configurada' };
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    // Fazer uma chamada mínima para testar
    const result = await model.generateContent('test');
    if (result.response) {
      return { service: 'Gemini', status: 'OK', message: 'API funcionando' };
    }
  } catch (error) {
    return { service: 'Gemini', status: 'ERROR', message: error.message };
  }
}

/**
 * Validar OpenAI API Key
 */
async function validateOpenAI() {
  try {
    if (!config.openaiApiKey) {
      return { service: 'OpenAI', status: 'MISSING', message: 'Chave não configurada' };
    }

    const openai = new OpenAI({ apiKey: config.openaiApiKey });

    // Testar modelos disponíveis
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5
    });

    if (response.choices) {
      return { service: 'OpenAI', status: 'OK', message: 'API funcionando' };
    }
  } catch (error) {
    return { service: 'OpenAI', status: 'ERROR', message: error.message };
  }
}

/**
 * Validar LinkedIn API
 */
async function validateLinkedIn() {
  try {
    if (!config.linkedin.accessToken || !config.linkedin.memberUrn) {
      return { service: 'LinkedIn', status: 'MISSING', message: 'Credenciais não configuradas' };
    }

    // Teste simples: fazer requisição para API do LinkedIn
    const response = await axios.get('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${config.linkedin.accessToken}`
      },
      timeout: 5000
    });

    if (response.status === 200) {
      return { service: 'LinkedIn', status: 'OK', message: 'API funcionando' };
    }
  } catch (error) {
    // 401/403 = credencial inválida, outras = problema de rede
    if (error.response?.status === 401 || error.response?.status === 403) {
      return { service: 'LinkedIn', status: 'ERROR', message: 'Credenciais inválidas (401/403)' };
    }
    return { service: 'LinkedIn', status: 'WARN', message: `Aviso: ${error.message}` };
  }
}

/**
 * Validar Twitter API
 */
async function validateTwitter() {
  try {
    if (!config.twitter.consumerKey || !config.twitter.accessToken) {
      return { service: 'Twitter', status: 'MISSING', message: 'Credenciais não configuradas' };
    }

    // Para Twitter, não conseguimos testar fácil sem tweepy
    // Apenas verificamos se as chaves existem
    const keysPresent = [
      config.twitter.consumerKey,
      config.twitter.consumerSecret,
      config.twitter.accessToken,
      config.twitter.accessTokenSecret
    ].every(key => key && key.trim());

    if (keysPresent) {
      return { service: 'Twitter', status: 'OK', message: 'Credenciais configuradas' };
    } else {
      return { service: 'Twitter', status: 'ERROR', message: 'Credenciais incompletas' };
    }
  } catch (error) {
    return { service: 'Twitter', status: 'ERROR', message: error.message };
  }
}

/**
 * Executar todos os health checks
 * @returns {Promise<{allHealthy: boolean, results: Array}>}
 */
export async function performHealthChecks() {
  safeLog('HealthCheck', 'info', 'Iniciando validação de APIs...');

  const results = await Promise.all([
    validateGemini(),
    validateOpenAI(),
    validateLinkedIn(),
    validateTwitter()
  ]);

  const allHealthy = results.every(r => r.status === 'OK' || r.status === 'WARN');
  const errors = results.filter(r => r.status === 'ERROR');
  const warnings = results.filter(r => r.status === 'WARN');
  const missing = results.filter(r => r.status === 'MISSING');

  // Log detalhado
  results.forEach(r => {
    const level = r.status === 'ERROR' ? 'error' : r.status === 'MISSING' ? 'warn' : 'info';
    safeLog('HealthCheck', level, `${r.service}: ${r.status} - ${r.message}`);
  });

  // Retornar resumo
  return {
    allHealthy,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      ok: results.filter(r => r.status === 'OK').length,
      warnings: warnings.length,
      missing: missing.length,
      errors: errors.length
    },
    details: {
      errors: errors.map(e => `${e.service}: ${e.message}`),
      warnings: warnings.map(w => `${w.service}: ${w.message}`),
      missing: missing.map(m => `${m.service}`)
    }
  };
}

/**
 * Rodap health check periodicamente (a cada 6 horas)
 */
export function startPeriodicHealthChecks(intervalHours = 6) {
  const intervalMs = intervalHours * 60 * 60 * 1000;

  safeLog('HealthCheck', 'info', `Agendando health check a cada ${intervalHours} horas`);

  setInterval(async () => {
    try {
      const health = await performHealthChecks();

      // Se há erros, fazer log destacado
      if (health.details.errors.length > 0) {
        safeLog('HealthCheck', 'error', `⚠️ PROBLEMAS DETECTADOS: ${health.details.errors.join(', ')}`);
      }
    } catch (error) {
      safeLog('HealthCheck', 'error', `Erro ao executar health check: ${error.message}`);
    }
  }, intervalMs);

  safeLog('HealthCheck', 'info', 'Health check periódico iniciado');
}

export default {
  performHealthChecks,
  startPeriodicHealthChecks
};

/**
 * Utilitários de Segurança para JojoBot
 * - Mascaramento de credenciais
 * - Validação de inputs
 * - Sanitização de logs
 */

/**
 * Mascarar dados sensíveis antes de logar
 * @param {string|object} data Dados a serem mascarados
 * @returns {string} Dados mascarados
 */
export function maskSensitiveData(data) {
  let text = typeof data === 'string' ? data : JSON.stringify(data);

  return text
    // Bearer tokens
    .replace(/Bearer\s+[\w\-_.]+/g, 'Bearer [REDACTED]')
    // OpenAI keys
    .replace(/sk-[\w\-_.]+/g, '[SK-REDACTED]')
    // Google API keys
    .replace(/AIza[\w\-_.]+/g, '[GOOGLE-KEY-REDACTED]')
    // LinkedIn tokens
    .replace(/urn:li:person:[\w]+/g, '[URN-REDACTED]')
    // URLs com credenciais
    .replace(/https?:\/\/[\w:]+@/g, 'https://[CREDENTIALS-REDACTED]@')
    // Variáveis de ambiente de credenciais
    .replace(/TWITTER_ACCESS_TOKEN\s*=\s*[\w\-_.]+/g, '[TOKEN-REDACTED]')
    .replace(/LINKEDIN_ACCESS_TOKEN\s*=\s*[\w\-_.]+/g, '[TOKEN-REDACTED]')
    .replace(/GEMINI_API_KEY\s*=\s*[\w\-_.]+/g, '[KEY-REDACTED]')
    .replace(/OPENAI_API_KEY\s*=\s*[\w\-_.]+/g, '[KEY-REDACTED]');
}

/**
 * Validar texto de tweet para prevenir command/prompt injection
 * @param {string} text Texto do tweet
 * @returns {string} Texto validado
 * @throws {Error} Se validação falhar
 */
export function validateTweetText(text) {
  // Máximo 280 caracteres (limite do Twitter/X)
  if (text.length > 280) {
    throw new Error('Tweet muito longo (máximo 280 caracteres)');
  }

  if (text.length === 0) {
    throw new Error('Tweet não pode estar vazio');
  }

  // Detectar caracteres de controle perigosos
  // Permitir apenas: \n, \t, \r (formatação normal)
  const dangerousChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
  if (dangerousChars.test(text)) {
    throw new Error('Tweet contém caracteres de controle não permitidos');
  }

  // Prevenir null bytes
  if (text.includes('\0')) {
    throw new Error('Null bytes não são permitidos');
  }

  return text;
}

/**
 * Validar caminho de arquivo para prevenir path traversal
 * @param {string} filePath Caminho do arquivo
 * @returns {string} Caminho validado
 * @throws {Error} Se validação falhar
 */
export function validateImagePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Caminho de arquivo inválido');
  }

  // Prevenir path traversal
  const normalized = filePath.replace(/\.\./g, '');
  if (normalized !== filePath) {
    throw new Error('Path traversal detectado');
  }

  // Apenas extensões de imagem permitidas
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const ext = filePath.toLowerCase().slice(-4);

  if (!allowedExtensions.some(e => filePath.toLowerCase().endsWith(e))) {
    throw new Error('Tipo de arquivo não permitido');
  }

  return filePath;
}

/**
 * Validar texto de post do LinkedIn para prevenir prompt injection
 * @param {string} text Texto do post
 * @returns {string} Texto validado
 * @throws {Error} Se validação falhar
 */
export function validateLinkedinText(text) {
  // Máximo ~3000 caracteres (limite prático do LinkedIn)
  const MAX_LENGTH = 3000;
  if (text.length > MAX_LENGTH) {
    throw new Error(`Post LinkedIn muito longo (máximo ${MAX_LENGTH} caracteres)`);
  }

  if (text.length === 0) {
    throw new Error('Post não pode estar vazio');
  }

  // Mesma validação de caracteres de controle
  const dangerousChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
  if (dangerousChars.test(text)) {
    throw new Error('Post contém caracteres de controle não permitidos');
  }

  return text;
}

/**
 * Safe logger que mascarae credenciais automaticamente
 * @param {string} module Nome do módulo
 * @param {string} level Nível (error, warn, info, debug)
 * @param {any} message Mensagem
 */
export function safeLog(module, level, message) {
  const timestamp = new Date().toISOString();
  const maskedMsg = maskSensitiveData(message);
  const logLine = `[${timestamp}] [${module}] [${level.toUpperCase()}] ${maskedMsg}`;

  if (level === 'error') {
    console.error(logLine);
  } else if (level === 'warn') {
    console.warn(logLine);
  } else if (level === 'info') {
    console.log(logLine);
  } else {
    console.log(logLine);
  }
}

export default {
  maskSensitiveData,
  validateTweetText,
  validateImagePath,
  validateLinkedinText,
  safeLog
};

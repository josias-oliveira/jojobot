/**
 * Extrai URLs do texto do usuário
 * Separa o texto da URL para processamento
 */

/**
 * Padrão para detectar URLs
 * Excludes common trailing punctuation: . , ; : ! ? ) etc.
 */
const URL_REGEX = /(https?:\/\/[^\s).,;:!?]+)/g;

/**
 * Extrair URLs do texto
 * @param {string} text Texto que pode conter URLs
 * @returns {object} { cleanText: string, urls: string[] }
 */
export function extractUrls(text) {
  const urls = [];
  let match;

  // Encontrar todas as URLs
  while ((match = URL_REGEX.exec(text)) !== null) {
    urls.push(match[1]);
  }

  // Remover URLs do texto
  const cleanText = text.replace(URL_REGEX, '').trim();

  return {
    cleanText,
    urls,
    hasUrls: urls.length > 0
  };
}

/**
 * Formatar URLs para adicionar no final do post
 * @param {string[]} urls Array de URLs
 * @returns {string} Texto formatado com URLs
 */
export function formatUrlsForPost(urls) {
  if (!urls || urls.length === 0) return '';

  if (urls.length === 1) {
    return `\n\n🔗 ${urls[0]}`;
  }

  // Múltiplas URLs
  const urlList = urls.map((url, i) => `🔗 ${url}`).join('\n');
  return `\n\n${urlList}`;
}

export default {
  extractUrls,
  formatUrlsForPost
};

import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  huggingfaceToken: process.env.HUGGINGFACE_API_KEY,
  linkedin: {
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
    memberUrn: process.env.LINKEDIN_MEMBER_URN,
  },
  twitter: {
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  }
};

// Validar credenciais críticas e exibir avisos estruturados
export function checkConfig() {
  const missing = [];
  if (!config.telegramBotToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (!config.huggingfaceToken) missing.push('HUGGINGFACE_API_KEY');

  const missingLinkedin = [];
  if (!config.linkedin.accessToken) missingLinkedin.push('LINKEDIN_ACCESS_TOKEN');
  if (!config.linkedin.memberUrn) missingLinkedin.push('LINKEDIN_MEMBER_URN');

  const missingTwitter = [];
  if (!config.twitter.consumerKey) missingTwitter.push('TWITTER_CONSUMER_KEY');
  if (!config.twitter.consumerSecret) missingTwitter.push('TWITTER_CONSUMER_SECRET');
  if (!config.twitter.accessToken) missingTwitter.push('TWITTER_ACCESS_TOKEN');
  if (!config.twitter.accessTokenSecret) missingTwitter.push('TWITTER_ACCESS_TOKEN_SECRET');

  if (missing.length > 0) {
    console.warn(`\x1b[33m[AVISO CONFIG] Faltando variáveis essenciais: ${missing.join(', ')}. Alguns serviços de IA ou Telegram podem falhar.\x1b[0m`);
  }

  if (missingLinkedin.length > 0) {
    console.warn(`\x1b[33m[AVISO CONFIG] Integração com LinkedIn incompleta. Faltando: ${missingLinkedin.join(', ')}\x1b[0m`);
  }

  if (missingTwitter.length > 0) {
    console.warn(`\x1b[33m[AVISO CONFIG] Integração com Twitter/X incompleta. Faltando: ${missingTwitter.join(', ')}\x1b[0m`);
  }

  return {
    isValid: !missing.includes('TELEGRAM_BOT_TOKEN'), // O bot precisa pelo menos do Telegram para iniciar
    missingEssential: missing,
    missingLinkedin,
    missingTwitter
  };
}

export default config;

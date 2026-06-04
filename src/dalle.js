import OpenAI from 'openai';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import config from './config.js';
import { safeLog, maskSensitiveData } from './security.js';

// Inicializar cliente da OpenAI se a chave existir e não for o placeholder
let openai = null;
const hasOpenAIKey = config.openaiApiKey &&
                     !config.openaiApiKey.includes('[aqui') &&
                     config.openaiApiKey.trim() !== '';

if (hasOpenAIKey) {
  openai = new OpenAI({ apiKey: config.openaiApiKey });
}

/**
 * Limpar imagens antigas (mais de N dias) do diretório temp
 * Executar periodicamente para prevenir disk exhaustion
 * @param {number} maxAgeDays Idade máxima em dias (padrão: 7)
 */
export function cleanupOldImages(maxAgeDays = 7) {
  const tempDir = path.resolve('temp');
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  if (!fs.existsSync(tempDir)) {
    return;
  }

  try {
    const files = fs.readdirSync(tempDir);
    let deletedCount = 0;

    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      try {
        const stats = fs.statSync(filePath);

        // Se arquivo é mais velho que maxAgeDays, deletar
        if (Date.now() - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          deletedCount++;
          safeLog('DALLE', 'info', `Deletado imagem antiga: ${file}`);
        }
      } catch (error) {
        safeLog('DALLE', 'warn', `Erro ao processar arquivo ${file}: ${error.message}`);
      }
    });

    if (deletedCount > 0) {
      safeLog('DALLE', 'info', `Cleanup concluído: ${deletedCount} imagens deletadas`);
    }
  } catch (error) {
    safeLog('DALLE', 'error', `Erro no cleanup de imagens: ${error.message}`);
  }
}

// ✅ Agendar cleanup automático diariamente
setInterval(() => cleanupOldImages(7), 24 * 60 * 60 * 1000);

/**
 * Gera uma imagem realista no estilo UGC usando DALL-E 3 ou Pollinations.ai (Gratuito)
 * @param {string} postTopic Descrição do post para basear a imagem
 * @param {string} draftId ID do rascunho para nomear o arquivo
 * @returns {Promise<string>} Caminho absoluto da imagem salva localmente
 */
export async function generateUgcImage(postTopic, draftId) {
  const optimizedPrompt = `
  A realistic, authentic UGC-style (User Generated Content) photo of a successful, modern entrepreneur.
  The person should look natural, friendly, and relatable.
  Setting: A modern bright office, coworking space, or upscale cafe in the background.
  Lighting: Warm, natural daylight, looking like a high-quality smartphone photo.
  Pose: Natural action, such as working on a clean laptop, looking at the camera with an engaging smile.
  No artificial filters, no text, no logos. High details, photo-realistic texture.
  Theme connection: ${postTopic}
  `;

  // Assegurar que a pasta temporária existe
  const tempDir = path.resolve('temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const localFileName = `img_${draftId || Date.now()}.png`;
  const localFilePath = path.join(tempDir, localFileName);

  // 1. Tentar usar o DALL-E 3 se a chave da OpenAI estiver disponível
  if (openai) {
    try {
      safeLog('DALLE', 'info', `Gerando imagem com DALL-E 3...`);
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: optimizedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard"
      });

      const imageUrl = response.data[0].url;
      safeLog('DALLE', 'info', `Imagem gerada! Baixando...`);
      return await downloadImage(imageUrl, localFilePath);
    } catch (openaiError) {
      safeLog('DALLE', 'warn', `Falha na geração com DALL-E 3. Tentando fallback Pollinations.ai... Erro: ${maskSensitiveData(openaiError.message)}`);
    }
  }

  // 2. Usar o Pollinations.ai como fallback gratuito (usa o modelo Flux, que é excelente para realismo)
  try {
    safeLog('DALLE', 'info', `Gerando imagem com Pollinations.ai (Flux)...`);

    // Formatar URL do Pollinations.ai com o modelo Flux e dimensões quadradas
    const pollinationUrl = `https://image.pollinations.ai/p/${encodeURIComponent(optimizedPrompt)}?width=1024&height=1024&nologo=true&private=true&model=flux`;

    return await downloadImage(pollinationUrl, localFilePath);
  } catch (error) {
    safeLog('DALLE', 'error', `Falha em todos os provedores de imagem: ${maskSensitiveData(error.message)}`);
    throw error;
  }
}

/**
 * Função utilitária para fazer download da imagem a partir de uma URL e salvá-la em disco
 */
async function downloadImage(url, destPath) {
  const writer = fs.createWriteStream(destPath);

  try {
    const response = await axios({
      url: url,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000 // ✅ Timeout de 30 segundos
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        safeLog('DALLE', 'info', `Imagem salva com sucesso`);
        resolve(destPath);
      });
      writer.on('error', (err) => {
        safeLog('DALLE', 'error', `Erro ao salvar arquivo local: ${err.message}`);
        reject(err);
      });
    });
  } catch (error) {
    safeLog('DALLE', 'error', `Erro ao fazer download da imagem: ${maskSensitiveData(error.message)}`);
    throw error;
  }
}

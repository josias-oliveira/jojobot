import OpenAI from 'openai';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import config from './config.js';

// Inicializar cliente da OpenAI se a chave existir e não for o placeholder
let openai = null;
const hasOpenAIKey = config.openaiApiKey && 
                     !config.openaiApiKey.includes('[aqui') && 
                     config.openaiApiKey.trim() !== '';

if (hasOpenAIKey) {
  openai = new OpenAI({ apiKey: config.openaiApiKey });
}

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
      console.log(`[DALL-E 3] Gerando imagem para o tema: "${postTopic.substring(0, 50)}..."`);
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: optimizedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard"
      });

      const imageUrl = response.data[0].url;
      console.log(`[DALL-E 3] Imagem gerada! Baixando...`);
      return await downloadImage(imageUrl, localFilePath);
    } catch (openaiError) {
      console.error('[DALL-E 3] Falha na geração. Tentando fallback gratuito Pollinations.ai...', openaiError.message);
    }
  }

  // 2. Usar o Pollinations.ai como fallback gratuito (usa o modelo Flux, que é excelente para realismo)
  try {
    console.log(`[Pollinations.ai] Gerando imagem gratuita para o tema: "${postTopic.substring(0, 50)}..."`);
    
    // Formatar URL do Pollinations.ai com o modelo Flux e dimensões quadradas
    const pollinationUrl = `https://image.pollinations.ai/p/${encodeURIComponent(optimizedPrompt)}?width=1024&height=1024&nologo=true&private=true&model=flux`;

    return await downloadImage(pollinationUrl, localFilePath);
  } catch (error) {
    console.error('[Image Generator] Falha em todos os provedores de imagem:', error.message);
    throw error;
  }
}

/**
 * Função utilitária para fazer download da imagem a partir de uma URL e salvá-la em disco
 */
async function downloadImage(url, destPath) {
  const writer = fs.createWriteStream(destPath);
  
  const response = await axios({
    url: url,
    method: 'GET',
    responseType: 'stream'
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(destPath));
    writer.on('error', (err) => {
      console.error('[Download Image] Erro ao salvar arquivo local:', err);
      reject(err);
    });
  });
}

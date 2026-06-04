import axios from 'axios';
import fs from 'fs';
import path from 'path';
import config from './config.js';

/**
 * Registra o upload de uma imagem na API do LinkedIn
 * @param {string} token Access Token do LinkedIn
 * @param {string} personUrn URN do usuário (ex: urn:li:person:abcdef)
 * @returns {Promise<{uploadUrl: string, assetUrn: string}>}
 */
async function registerImageUpload(token, personUrn) {
  const url = 'https://api.linkedin.com/v2/assets?action=registerUpload';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0'
  };

  const payload = {
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: personUrn,
      supportedUploadMechanisms: ['SYNCHRONOUS_UPLOAD']
    }
  };

  const response = await axios.post(url, payload, { headers });
  
  const uploadMechanism = response.data.value.uploadMechanism;
  const uploadUrl = response.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const assetUrn = response.data.value.asset;

  return { uploadUrl, assetUrn };
}

/**
 * Faz o upload binário do arquivo para a URL fornecida pelo LinkedIn
 * @param {string} token Access Token do LinkedIn
 * @param {string} uploadUrl URL de Upload retornada pelo registro
 * @param {string} filePath Caminho local do arquivo
 */
async function uploadImageBinary(token, uploadUrl, filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/octet-stream'
  };

  await axios.put(uploadUrl, fileBuffer, { headers });
}

/**
 * Publica um post no LinkedIn (com ou sem imagem) usando a API ugcPosts
 * @param {string} text Conteúdo de texto do post
 * @param {string} [imagePath] Caminho opcional da imagem gerada localmente
 * @returns {Promise<string>} O ID da postagem criada ou URN do post
 */
export async function shareOnLinkedin(text, imagePath = null) {
  const token = config.linkedin.accessToken;
  const author = config.linkedin.memberUrn;

  if (!token || !author) {
    throw new Error('Credenciais do LinkedIn não configuradas no .env (LINKEDIN_ACCESS_TOKEN / LINKEDIN_MEMBER_URN).');
  }

  console.log('[LinkedIn] Iniciando processo de publicação...');

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0'
  };

  let mediaAssetUrn = null;

  // Se houver uma imagem, executa o fluxo de upload
  if (imagePath && fs.existsSync(imagePath)) {
    try {
      console.log(`[LinkedIn] Fazendo upload da imagem: ${imagePath}`);
      const { uploadUrl, assetUrn } = await registerImageUpload(token, author);
      await uploadImageBinary(token, uploadUrl, imagePath);
      mediaAssetUrn = assetUrn;
      console.log(`[LinkedIn] Upload concluído! URN do Asset: ${mediaAssetUrn}`);
    } catch (uploadError) {
      console.error('[LinkedIn] Falha no upload da imagem, publicando post apenas com texto...', uploadError.response?.data || uploadError.message);
    }
  }

  // Montar payload final do ugcPosts
  const url = 'https://api.linkedin.com/v2/ugcPosts';
  
  const shareContent = {
    shareCommentary: {
      text: text
    },
    shareMediaCategory: mediaAssetUrn ? 'IMAGE' : 'NONE'
  };

  if (mediaAssetUrn) {
    shareContent.media = [
      {
        status: 'READY',
        description: {
          text: 'Imagem gerada pelo JojoBot'
        },
        media: mediaAssetUrn,
        title: {
          text: 'JojoBot UGC Post'
        }
      }
    ];
  }

  const payload = {
    author: author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  try {
    const response = await axios.post(url, payload, { headers });
    const postId = response.data.id;
    console.log(`[LinkedIn] Publicação criada com sucesso! ID: ${postId}`);
    return postId;
  } catch (error) {
    console.error('[LinkedIn] Erro ao criar ugcPost:', error.response?.data || error.message);
    throw new Error(`Erro na API do LinkedIn: ${JSON.stringify(error.response?.data || error.message)}`);
  }
}

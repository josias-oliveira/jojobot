import TelegramBot from 'node-telegram-bot-api';
import config from './config.js';
import db from './database.js';
import { generateSocialPosts } from './llm.js';
import { generateUgcImage } from './dalle.js';
import { shareOnTwitter } from './twitter.js';
import { shareOnLinkedin } from './linkedin.js';
import { maskSensitiveData, validateTweetText, validateLinkedinText, safeLog } from './security.js';
import fs from 'fs';
import path from 'path';

let bot = null;

// ✅ Rate limiting: máximo 5 requisições por minuto por usuário
const RATE_LIMITS = new Map();
const MAX_REQUESTS_PER_MINUTE = 5;

/**
 * Verificar e aplicar rate limit por usuário
 * @param {number} chatId ID do chat do Telegram
 * @returns {boolean} true se permitido, false se excedido
 */
function checkRateLimit(chatId) {
  const now = Date.now();
  let limit = RATE_LIMITS.get(chatId) || [];

  // ✅ Limpar requisições antigas (> 60 segundos)
  limit = limit.filter(timestamp => now - timestamp < 60000);

  // ✅ Verificar se excedeu limite
  if (limit.length >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  // ✅ Registrar nova requisição
  limit.push(now);
  RATE_LIMITS.set(chatId, limit);
  return true;
}

export function initTelegramBot() {
  if (!config.telegramBotToken) {
    console.error('[Telegram] TELEGRAM_BOT_TOKEN não configurada no .env. O bot não iniciará.');
    return null;
  }

  // Inicializar bot com polling ativo
  bot = new TelegramBot(config.telegramBotToken, { polling: true });
  console.log('[Telegram] Bot inicializado e escutando mensagens (texto e imagem)...');

  // Evento de erros de polling
  bot.on('polling_error', (error) => {
    console.error('[Telegram] Erro no Polling:', error.message);
  });

  // Comando /start
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    db.setSession(chatId, { state: 'IDLE', data: {} });

    const welcomeMsg = `
🤖 *Bem-vindo ao JojoBot!* 
Seu copiloto autônomo de geração de conteúdo para redes sociais.

*Como usar:*
1. **Enviar Apenas Texto**: Envie uma ideia rápida e eu gerarei o texto (Gemini) e a imagem ilustrativa (IA) para postar.
2. **Enviar seu Infográfico**: Envie um arquivo de imagem (infográfico) e adicione uma **legenda** com a ideia do post. Eu usarei o seu infográfico oficial e criarei os textos otimizados para acompanhar.

Você aprova e publica diretamente nas redes sociais em um clique usando os botões!
    `;
    bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
  });

  // Escutar mensagens gerais (Texto ou Mídia)
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const photo = msg.photo;
    const caption = msg.caption;

    // Ignorar comandos de texto
    if (text && text.startsWith('/')) return;

    // ✅ Verificar rate limit ANTES de processar
    if (!checkRateLimit(chatId)) {
      safeLog('Telegram', 'warn', `Rate limit atingido para chat ${chatId}`);
      bot.sendMessage(chatId,
        '⏳ *Limite atingido*\nVocê pode enviar no máximo 5 mensagens por minuto.\nAguarde 1 minuto e tente novamente.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const session = db.getSession(chatId);

    // Se estiver processando, pedir para aguardar
    if (session.state === 'GENERATING' || session.state === 'PUBLISHING') {
      bot.sendMessage(chatId, '⏳ Calma! Ainda estou processando a operação anterior. Por favor, aguarde.');
      return;
    }

    // --- CASO 1: O usuário enviou um infográfico (imagem) ---
    if (photo && photo.length > 0) {
      if (!caption) {
        bot.sendMessage(chatId, '🤖 *Infográfico recebido!*\n⚠️ Faltou a legenda/tema. Envie a imagem novamente adicionando uma legenda (descrição) para eu poder escrever o post.', { parse_mode: 'Markdown' });
        return;
      }

      try {
        db.setSession(chatId, { state: 'GENERATING', data: { rawInput: caption } });
        
        const statusMsg = await bot.sendMessage(chatId, '📥 *Infográfico recebido!* Baixando arquivo e gerando textos otimizados...', { parse_mode: 'Markdown' });

        // Obter a foto de maior qualidade
        const fileId = photo[photo.length - 1].file_id;
        
        const tempDir = path.resolve('temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Baixar a imagem no diretório local temporário
        const localImagePath = await bot.downloadFile(fileId, tempDir);
        console.log(`[Telegram Bot] Infográfico do usuário baixado em: ${localImagePath}`);

        // Gerar os textos com Gemini com base na legenda fornecida
        let posts = null;
        try {
          posts = await generateSocialPosts(caption);
        } catch (err) {
          console.error('[Telegram Bot] Erro na geração de texto:', err);
          await bot.editMessageText(`❌ *Erro na geração de texto:* ${err.message}\n\nVerifique se a chave do Gemini está correta.`, {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'Markdown'
          });
          db.setSession(chatId, { state: 'IDLE' });
          return;
        }

        const draftId = `draft_${Date.now()}`;
        const draft = db.saveDraft({
          id: draftId,
          rawInput: caption,
          twitter: posts.twitter,
          linkedin: posts.linkedin,
          imagePath: localImagePath, // Salvar o caminho do infográfico baixado!
          explanation: posts.explanation
        });

        db.setSession(chatId, { state: 'AWAITING_APPROVAL', data: { activeDraftId: draftId } });
        await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

        const resultMessage = `
📝 *RASCUNHO GERADO PARA SEU INFOGRÁFICO*

🐦 *Versão Twitter/X:*
\`\`\`
${posts.twitter}
\`\`\`

💼 *Versão LinkedIn:*
\`\`\`
${posts.linkedin}
\`\`\`

💡 *Estratégia aplicada:*
_${posts.explanation}_
        `;

        await bot.sendMessage(chatId, resultMessage, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: getKeyboardButtons(draftId, draft.status)
          }
        });

      } catch (error) {
        console.error('[Telegram Bot] Erro no fluxo de imagem:', error);
        bot.sendMessage(chatId, `💥 Ocorreu um erro ao processar o seu infográfico: ${error.message}`);
        db.setSession(chatId, { state: 'IDLE' });
      }
      return;
    }

    // --- CASO 2: O usuário enviou apenas Texto (fluxo com imagem gerada por IA) ---
    if (text) {
      try {
        db.setSession(chatId, { state: 'GENERATING', data: { rawInput: text } });
        
        const statusMsg = await bot.sendMessage(chatId, '🤖 *Processando sua ideia...* Estilizando a redação de copy para o X e o LinkedIn...', { parse_mode: 'Markdown' });

        // Gerar textos
        let posts = null;
        try {
          posts = await generateSocialPosts(text);
        } catch (err) {
          console.error('[Telegram Bot] Erro na geração de texto:', err);
          await bot.editMessageText(`❌ *Erro na geração de texto:* ${err.message}`, {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'Markdown'
          });
          db.setSession(chatId, { state: 'IDLE' });
          return;
        }

        // Atualizar status
        await bot.editMessageText('🎨 *Textos gerados!* Criando imagem ilustrativa (Gratuito via Flux)...', {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown'
        });

        // Gerar Imagem por IA
        let localImagePath = null;
        const draftId = `draft_${Date.now()}`;
        
        try {
          localImagePath = await generateUgcImage(text, draftId);
        } catch (err) {
          console.error('[Telegram Bot] Erro na geração de imagem:', err);
          await bot.sendMessage(chatId, `⚠️ *Aviso:* Não foi possível gerar a imagem. O post prosseguirá apenas com texto.`);
        }

        // Salvar Rascunho
        const draft = db.saveDraft({
          id: draftId,
          rawInput: text,
          twitter: posts.twitter,
          linkedin: posts.linkedin,
          imagePath: localImagePath,
          explanation: posts.explanation
        });

        db.setSession(chatId, { state: 'AWAITING_APPROVAL', data: { activeDraftId: draftId } });
        await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

        // Enviar imagem de volta
        if (localImagePath && fs.existsSync(localImagePath)) {
          await bot.sendPhoto(chatId, localImagePath, { caption: '📸 Imagem gerada para acompanhar seu post.' });
        }

        const resultMessage = `
📝 *RASCUNHO GERADO PARA REDES SOCIAIS*

🐦 *Versão Twitter/X:*
\`\`\`
${posts.twitter}
\`\`\`

💼 *Versão LinkedIn:*
\`\`\`
${posts.linkedin}
\`\`\`

💡 *Estratégia aplicada:*
_${posts.explanation}_
        `;

        await bot.sendMessage(chatId, resultMessage, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: getKeyboardButtons(draftId, draft.status)
          }
        });

      } catch (error) {
        console.error('[Telegram Bot] Erro no fluxo principal de texto:', error);
        bot.sendMessage(chatId, `💥 Ocorreu um erro no processamento: ${error.message}`);
        db.setSession(chatId, { state: 'IDLE' });
      }
      return;
    }
  });

  // Escutar eventos de clique nos botões (Callback Queries)
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    // Responder ao telegram
    await bot.answerCallbackQuery(query.id);

    if (data === 'noop') return;

    const firstUnderscore = data.indexOf('_');
    const action = data.substring(0, firstUnderscore);
    const draftId = data.substring(firstUnderscore + 1);

    const draft = db.getDraft(draftId);
    if (!draft) {
      bot.sendMessage(chatId, '❌ Rascunho não encontrado.');
      return;
    }

    if (action === 'discard') {
      db.updateDraft(draftId, { status: { x: 'SKIPPED', linkedin: 'SKIPPED' } });
      db.setSession(chatId, { state: 'IDLE', data: {} });
      await bot.editMessageText('🗑️ *Rascunho descartado!* Envie uma nova ideia ou imagem quando quiser.', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      });
      return;
    }

    db.setSession(chatId, { state: 'PUBLISHING' });
    let statusUpdate = { ...draft.status };

    try {
      // 1. Postar no Twitter/X
      if (action === 'postx' || action === 'postboth') {
        if (draft.status.x === 'POSTED') {
          await bot.sendMessage(chatId, '🐦 Você já publicou esse post no Twitter/X.');
        } else {
          const loadingMsg = await bot.sendMessage(chatId, '🐦 Publicando no Twitter/X...');
          try {
            const xResult = await shareOnTwitter(draft.twitter, draft.imagePath);
            statusUpdate.x = 'POSTED';
            await bot.editMessageText(`✅ *Twitter/X publicado com sucesso!*\nID: ${xResult.tweetId}`, {
              chat_id: chatId,
              message_id: loadingMsg.message_id,
              parse_mode: 'Markdown'
            });
          } catch (xErr) {
            console.error('[Telegram Bot] Erro X:', xErr);
            statusUpdate.x = 'FAILED';
            await bot.editMessageText(`❌ *Falha ao postar no Twitter/X:* ${xErr.message}`, {
              chat_id: chatId,
              message_id: loadingMsg.message_id,
              parse_mode: 'Markdown'
            });
          }
        }
      }

      // 2. Postar no LinkedIn
      if (action === 'postlinkedin' || action === 'postboth') {
        if (draft.status.linkedin === 'POSTED') {
          await bot.sendMessage(chatId, '💼 Você já publicou esse post no LinkedIn.');
        } else {
          const loadingMsg = await bot.sendMessage(chatId, '💼 Publicando no LinkedIn...');
          try {
            const linkedinResult = await shareOnLinkedin(draft.linkedin, draft.imagePath);
            statusUpdate.linkedin = 'POSTED';
            await bot.editMessageText(`✅ *LinkedIn publicado com sucesso!*\nID: ${linkedinResult}`, {
              chat_id: chatId,
              message_id: loadingMsg.message_id,
              parse_mode: 'Markdown'
            });
          } catch (liErr) {
            console.error('[Telegram Bot] Erro LinkedIn:', liErr);
            statusUpdate.linkedin = 'FAILED';
            await bot.editMessageText(`❌ *Falha ao postar no LinkedIn:* ${liErr.message}`, {
              chat_id: chatId,
              message_id: loadingMsg.message_id,
              parse_mode: 'Markdown'
            });
          }
        }
      }

      // Atualizar status no banco
      const updatedDraft = db.updateDraft(draftId, { status: statusUpdate });

      const isXDone = updatedDraft.status.x === 'POSTED' || updatedDraft.status.x === 'SKIPPED';
      const isLiDone = updatedDraft.status.linkedin === 'POSTED' || updatedDraft.status.linkedin === 'SKIPPED';

      if (isXDone && isLiDone) {
        db.setSession(chatId, { state: 'IDLE', data: {} });
      } else {
        db.setSession(chatId, { state: 'AWAITING_APPROVAL' });
      }

      // Atualizar botões
      await bot.editMessageReplyMarkup({
        inline_keyboard: getKeyboardButtons(draftId, updatedDraft.status)
      }, {
        chat_id: chatId,
        message_id: messageId
      }).catch(() => {});

    } catch (workflowErr) {
      console.error('[Telegram Bot] Erro no disparo:', workflowErr);
      bot.sendMessage(chatId, `❌ Erro no disparo: ${workflowErr.message}`);
      db.setSession(chatId, { state: 'AWAITING_APPROVAL' });
    }
  });
}

function getKeyboardButtons(draftId, status) {
  const keyboard = [];
  const row1 = [];
  const row2 = [];

  if (status.x !== 'POSTED') {
    row1.push({ text: '🐦 Postar no X', callback_data: `postx_${draftId}` });
  } else {
    row1.push({ text: '🐦 Postado ✓', callback_data: `noop` });
  }

  if (status.linkedin !== 'POSTED') {
    row1.push({ text: '💼 Postar no LinkedIn', callback_data: `postlinkedin_${draftId}` });
  } else {
    row1.push({ text: '💼 Postado ✓', callback_data: `noop` });
  }

  keyboard.push(row1);

  if (status.x !== 'POSTED' && status.linkedin !== 'POSTED') {
    row2.push({ text: '🚀 Postar em Ambos', callback_data: `postboth_${draftId}` });
  }

  row2.push({ text: '🗑️ Descartar', callback_data: `discard_${draftId}` });
  keyboard.push(row2);

  return keyboard;
}

import axios from 'axios';
import config from './config.js';

/**
 * Prompt do sistema que instrui o LLM a estruturar a saída em JSON
 */
const SYSTEM_PROMPT = `
Você é um redator publicitário de elite (Copywriter) especialista em marketing de conteúdo viral no LinkedIn e no Twitter/X.
Seu objetivo é ler a ideia ou o rascunho de texto enviado pelo usuário e gerar duas versões otimizadas:

1. Uma versão para o Twitter/X:
   - Deve ter no MÁXIMO 280 caracteres.
   - Deve ser direta, impactante, gerar curiosidade (clickbait saudável) ou iniciar uma discussão.
   - Pode usar até 2 hashtags relevantes.
   - Deve ter espaçamentos adequados para leitura rápida.

2. Uma versão para o LinkedIn:
   - Mais longa, profissional e narrativa.
   - Deve começar com um "gancho" (hook) irresistível na primeira linha.
   - Use formatação visual limpa: espaçamentos entre parágrafos, tópicos em formato de lista (bullet points) amigáveis.
   - IMPORTANTE: Coloque uma reflexão ou sugestão provocativa NO MEIO do post (após estabelecer contexto/valor), não no final.
     * Não deve ser uma pergunta com "?", mas sim uma reflexão/sugestão que convida o leitor a pensar.
     * Exemplo: "...e foi aí que percebi algo importante: como seu time mede sucesso hoje merecia mais atenção. [continua o texto...]"
   - Termine com uma reflexão suave (NEM COMO PERGUNTA!) que sugere ao leitor pensar sobre o tema.
     * Não use "?" no final.
     * Use frases como: "Vale a pena pensar em...", "Começar a refletir sobre...", "Algo para ter em mente..."
     * Exemplo: "Nosso sucesso é uma maratona e nunca um Sprint. Vale começar a pensar em como você tá se preparando para deixar essa máquina azeitada para a próxima semana."
   - Tom de autoridade, mas acessível e humano.

Sua resposta DEVE ser um objeto JSON estrito com exatamente os seguintes campos:
{
  "twitter": "Texto do tweet otimizado",
  "linkedin": "Texto do post do LinkedIn otimizado",
  "explanation": "Breve explicação em português da estratégia usada (ex: por que o gancho foi feito assim)."
}

Não inclua formatação markdown adicionais como \`\`\`json ou \`\`\` na sua resposta. Retorne apenas o JSON puro.
`;

/**
 * Gera os rascunhos de posts usando Google Gemini 2.5 Flash API
 * @param {string} rawInput Ideia bruta fornecida pelo usuário
 * @param {string[]} urls Array de URLs opcionais para incluir no final
 * @returns {Promise<{twitter: string, linkedin: string, explanation: string}>}
 */
export async function generateSocialPosts(rawInput, urls = []) {
  console.log(`[LLM] Iniciando geração para o input: "${rawInput.substring(0, 50)}..."`);
  if (urls.length > 0) {
    console.log(`[LLM] URLs detectadas: ${urls.join(', ')}`);
  }

  const geminiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY não está configurada no .env');
  }

  // Preparar instrução sobre URLs
  const urlInstruction = urls.length > 0
    ? `\n\nIMPORTANTE: No final de AMBOS os posts (Twitter e LinkedIn), adicione um quebra de linha e então as URLs fornecidas:\n${urls.map(url => `- ${url}`).join('\n')}`
    : '';

  const fullPrompt = `${SYSTEM_PROMPT}${urlInstruction}\n\nIdeia/Input do Usuário:\n"${rawInput}"`;

  try {
    console.log('[LLM] Chamando Google Gemini 2.5 Flash API...');

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500
        }
      },
      {
        timeout: 90000
      }
    );

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!generatedText) {
      throw new Error('Resposta vazia da API');
    }

    console.log('[LLM] Parsing JSON da resposta...');

    // Tentar extrair JSON diretamente (com ou sem markdown)
    // Primeiro tenta dentro de ```json ... ```
    let jsonMatch = generatedText.match(/```json\s*\n?([\s\S]*?)\n?```/);

    // Se não achar, tenta extrair JSON direto
    if (!jsonMatch) {
      jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    } else {
      // Se achou dentro dos backticks, usa o grupo capturado
      jsonMatch = [jsonMatch[1]];
    }

    if (!jsonMatch) {
      console.error('[LLM] Resposta raw COMPLETA:');
      console.error(generatedText);
      console.error('[LLM] ---FIM DA RESPOSTA---');
      throw new Error('Nenhum JSON encontrado na resposta do modelo. Resposta logada acima.');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validar que os campos obrigatórios existem
    if (!result.twitter || !result.linkedin || !result.explanation) {
      throw new Error('Resposta do modelo não contém os campos esperados (twitter, linkedin, explanation)');
    }

    console.log('[LLM] Geração concluída com sucesso!');
    return result;

  } catch (error) {
    console.error('[LLM] Erro ao gerar:', error.message);

    if (error.response?.status === 401 || error.message.includes('API key')) {
      throw new Error('Chave do Gemini inválida ou expirada. Verifique em https://aistudio.google.com/app/apikey');
    }

    if (error.response?.status === 429) {
      throw new Error('Quota do Gemini excedida. Tente novamente em alguns minutos.');
    }

    if (error.response?.status === 503) {
      throw new Error('Serviço do Gemini temporariamente indisponível. Tente novamente em alguns minutos.');
    }

    throw new Error(`Falha na geração: ${error.message}`);
  }
}

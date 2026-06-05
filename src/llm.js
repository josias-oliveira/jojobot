import { HfInference } from '@huggingface/inference';
import config from './config.js';

// Inicializar cliente do Hugging Face
const hf = config.huggingfaceToken
  ? new HfInference(config.huggingfaceToken)
  : null;

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
 * Gera os rascunhos de posts usando Hugging Face Inference API
 * @param {string} rawInput Ideia bruta fornecida pelo usuário
 * @param {string[]} urls Array de URLs opcionais para incluir no final
 * @returns {Promise<{twitter: string, linkedin: string, explanation: string}>}
 */
export async function generateSocialPosts(rawInput, urls = []) {
  console.log(`[LLM] Iniciando geração para o input: "${rawInput.substring(0, 50)}..."`);
  if (urls.length > 0) {
    console.log(`[LLM] URLs detectadas: ${urls.join(', ')}`);
  }

  if (!hf) {
    throw new Error('HUGGINGFACE_API_KEY não está configurada no .env');
  }

  // Preparar instrução sobre URLs
  const urlInstruction = urls.length > 0
    ? `\n\nIMPORTANTE: No final de AMBOS os posts (Twitter e LinkedIn), adicione um quebra de linha e então as URLs fornecidas:\n${urls.map(url => `- ${url}`).join('\n')}`
    : '';

  const fullPrompt = `${SYSTEM_PROMPT}${urlInstruction}\n\nIdeia/Input do Usuário:\n"${rawInput}"`;

  try {
    console.log('[LLM] Chamando Hugging Face Inference API (Mistral-7B)...');

    // Usar o cliente da biblioteca oficial do HF
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      inputs: fullPrompt,
      parameters: {
        max_new_tokens: 1500,
        temperature: 0.7,
        top_p: 0.95,
        do_sample: true,
        return_full_text: false
      }
    });

    let generatedText = response.generated_text || '';

    console.log('[LLM] Parsing JSON da resposta...');

    // Tentar extrair JSON da resposta
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[LLM] Resposta raw:', generatedText.substring(0, 200));
      throw new Error('Nenhum JSON encontrado na resposta do modelo');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validar que os campos obrigatórios existem
    if (!result.twitter || !result.linkedin || !result.explanation) {
      throw new Error('Resposta do modelo não contém os campos esperados (twitter, linkedin, explanation)');
    }

    console.log('[LLM] Geração concluída com sucesso!');
    return result;

  } catch (error) {
    console.error('[LLM] Erro ao gerar com Hugging Face:', error.message);

    if (error.message.includes('overloaded')) {
      throw new Error('Modelo do Hugging Face sobrecarregado. Tente novamente em alguns minutos.');
    }

    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      throw new Error('Chave do Hugging Face inválida ou expirada.');
    }

    throw new Error(`Falha na geração: ${error.message}`);
  }
}

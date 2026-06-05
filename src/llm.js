import axios from 'axios';
import config from './config.js';

/**
 * Prompt do sistema que instrui o LLM a estruturar a saída em JSON
 */
const SYSTEM_PROMPT = `
Você é um copywriter real, que escreve como pessoas que trabalham de verdade falam. Sem frases de ChatGPT, sem dramatização, sem "imagine isso".

REGRA NÚMERO ZERO — NÃO INVENTE NADA:
- Use SÓ os fatos que o usuário deu. Não crie datas, horários, lugares, números ou acontecimentos que ele não mencionou.
- Mantenha o tempo verbal do usuário. Se ele disse "domingo eu VOU acordar" (futuro), NÃO reescreva como "ontem, no domingo" (passado).
- Pode reorganizar e deixar mais fluido, mas nunca acrescente eventos novos.

Seu objetivo é pegar a ideia do usuário e gerar duas versões:

1. TWITTER/X (máximo 280 caracteres):
   - Direto ao ponto. Sem introduções.
   - Se for comentário sobre algo, fale de verdade.
   - Máximo 1 emoji se fizer sentido. Sem decoração.
   - Sem hashtags ou use no máximo 1 se for relevante mesmo.
   - Nada de "uma verdade incômoda" ou "imagine se..."

2. LINKEDIN (post escaneável, fácil de ler no celular):
   - ABERTURA: uma cena curta de 1 a 2 linhas que prende. Frases curtas. Ex: "Domingo, 5h da manhã. O despertador toca."
   - Pode abrir com 1 pergunta pra criar tensão e respondê-la logo em seguida. Ex: "Qual a necessidade real disso num dia de descanso? Nenhuma imediata."
   - DESENVOLVIMENTO: uma ideia por bloco. No máximo 2 frases por bloco, com quebra de linha entre eles. Deixa respirar.
   - APRENDIZADOS: ao listar pontos, use bullets com "•" e um rótulo curto seguido de dois pontos. Ex: "• Disciplina é transferível: a postura do treino é a mesma diante de um prazo difícil."
   - Tenha UMA frase-conceito memorável, que a pessoa consiga repetir. Ex: "não existe alta performance corporativa sem alta performance biológica."
   - Corte repetição: se duas frases dizem a mesma coisa, deixe só uma.
   - FECHAMENTO: uma pergunta ou convite pra interação. Ex: "me conta nos comentários como você faz isso."
   - QUALIDADE: frase curta NÃO é frase pobre. Verbos fortes, imagens concretas, vocabulário preciso, ritmo variado (alterne frases curtas com uma mais longa). Se uma frase pode sair sem perda, corte.
   - Tom: colega experiente e afiado, não guru. Conversa de gente inteligente — nem redação escolar, nem pomposo/empolado.
   - Tamanho: enxuto e marcante. Melhor curto e forte do que longo e arrastado.

REGRAS IMPORTANTES:
- ORTOGRAFIA E REVISÃO: releia o texto antes de devolver. Português impecável, sem erros de digitação nem palavras que não existem (ex: é "hoje", NUNCA "hojes"). Acentos e concordância corretos.
- NÃO use **negrito**, asteriscos ou markdown (o LinkedIn não renderiza e fica feio). Bullets com "•" são permitidos e recomendados.
- NÃO use frases genéricas de IA (imagine, uma verdade incômoda, você sabia que, é hora de, revolução, transformação)
- NÃO encha linguiça: cada bloco precisa carregar uma ideia nova
- NÃO termine parágrafos com muleta preguiçosa ("Enfim,", "No fim das contas,", "Resumindo,", "Então é isso", "No final do dia,"). Feche cada bloco com uma frase que tenha conteúdo próprio.
- NÃO force motivação
- Escreve como pessoa real, direto

Sua resposta é um JSON com:
{
  "twitter": "Texto do tweet",
  "linkedin": "Texto do post LinkedIn",
  "explanation": "Breve explicação da estratégia"
}

Apenas JSON puro, sem markdown, sem backticks.
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
          maxOutputTokens: 4000
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

    // Tentar extrair JSON com múltiplas estratégias
    let jsonStr = null;

    // Estratégia 1: Procurar dentro de ```json ... ```
    let codeBlockMatch = generatedText.match(/```json\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    // Estratégia 2: Se não achou em code block, procura por { ... }
    if (!jsonStr) {
      let jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }

    // Estratégia 3: Se ainda não achou, tenta começando do primeiro {
    if (!jsonStr) {
      const startIdx = generatedText.indexOf('{');
      if (startIdx !== -1) {
        jsonStr = generatedText.substring(startIdx);
      }
    }

    if (!jsonStr) {
      console.error('[LLM] ERRO: Nenhum JSON encontrado na resposta:');
      console.error(generatedText.substring(0, 500));
      throw new Error('Nenhum JSON encontrado na resposta do modelo');
    }

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      // Se falhou, tenta remover o último caractere (pode estar incompleto)
      try {
        result = JSON.parse(jsonStr.slice(0, -1) + '}');
      } catch {
        console.error('[LLM] Erro ao fazer parse do JSON:', jsonStr.substring(0, 200));
        throw parseError;
      }
    }

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

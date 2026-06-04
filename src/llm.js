import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import config from './config.js';

// Inicializar cliente do Gemini se a chave existir
let genAI = null;
if (config.geminiApiKey) {
  genAI = new GoogleGenerativeAI(config.geminiApiKey);
}

// Inicializar cliente da OpenAI se a chave existir
let openai = null;
if (config.openaiApiKey) {
  openai = new OpenAI({ apiKey: config.openaiApiKey });
}

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
   - Conclua com uma pergunta provocativa (CTA) para gerar comentários.
   - Tom de autoridade, mas acessível.

Sua resposta DEVE ser um objeto JSON estrito com exatamente os seguintes campos:
{
  "twitter": "Texto do tweet otimizado",
  "linkedin": "Texto do post do LinkedIn otimizado",
  "explanation": "Breve explicação em português da estratégia usada (ex: por que o gancho foi feito assim)."
}

Não inclua formatação markdown adicionais como \`\`\`json ou \`\`\` na sua resposta se você estiver no modo JSON. Retorne apenas o JSON puro.
`;

/**
 * Gera os rascunhos de posts usando o Gemini (preferencial) ou OpenAI (fallback)
 * @param {string} rawInput Ideia bruta fornecida pelo usuário
 * @returns {Promise<{twitter: string, linkedin: string, explanation: string}>}
 */
export async function generateSocialPosts(rawInput) {
  console.log(`[LLM] Iniciando geração para o input: "${rawInput.substring(0, 50)}..."`);

  // 1. Tentar usar o Gemini
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-flash-latest',
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
      ${SYSTEM_PROMPT}

      Ideia/Input do Usuário:
      "${rawInput}"
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text);
    } catch (geminiError) {
      console.error('[LLM] Falha ao gerar com Gemini, tentando OpenAI como fallback...', geminiError);
    }
  }

  // 2. Fallback para OpenAI
  if (openai) {
    try {
      const prompt = `
      Ideia/Input do Usuário:
      "${rawInput}"
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      const text = response.choices[0].message.content;
      return JSON.parse(text);
    } catch (openaiError) {
      console.error('[LLM] Falha ao gerar com OpenAI...', openaiError);
      throw new Error('Nenhuma API de LLM disponível ou configurada corretamente para gerar textos.');
    }
  }

  throw new Error('Chaves da API do Gemini ou OpenAI não configuradas. Configure-as no arquivo .env.');
}

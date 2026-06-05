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
   - ABERTURA: comece pelo CONCRETO que o usuário trouxe — um fato, um número, uma cena específica, uma fala real. Ex: "Domingo, 5h da manhã. O despertador toca." JAMAIS abra com generalização vaga sobre setor/época ("A indústria de tecnologia vive uma transição", "O mercado está mudando", "Vivemos uma era de..."). Isso é a cara de IA nº 1 e o leitor pula na hora.
   - Pode abrir com 1 pergunta pra criar tensão e respondê-la logo em seguida. Ex: "Qual a necessidade real disso num dia de descanso? Nenhuma imediata."
   - ESTRUTURA QUE FUNCIONA BEM (use como esqueleto, adaptando ao conteúdo — vale tanto pra história pessoal quanto pra insight de negócio):
       1) Hook: a PERGUNTA CENTRAL do post vai AQUI, no começo (NUNCA guardada pro final), normalmente fato concreto ou cena + a pergunta afiada que o texto inteiro vai responder. Ex: "Seu time entregou 10 funcionalidades esse mês. Mas quanto faturamento isso gerou?"
       2) Nomeie o problema/armadilha, de preferência com um rótulo memorável. Ex: a armadilha da "Fábrica de Funcionalidades".
       3) A virada: a verdade incômoda ou o que você percebeu, numa frase fluida COM contraste. Ex: "o mercado não se importa com o seu esforço, mas com o valor que você gera."
       4) Quando deixar mais claro, ESTRUTURE em lista: bullets "•" pra contraste (ex: Output vs Outcome) e/ou lista numerada "1. 2. 3." pra passos práticos.
       5) Frase-conceito de fechamento, memorável, que crava a tese.
       6) Convite final LEVE e OPCIONAL, em forma de AFIRMAÇÃO (não de pergunta) e SEM emoji 👇. Ex: "se fizer sentido pra você, me conta aqui ou na DM." A pergunta de verdade já foi feita lá no começo.
   - PROSA: nos trechos em parágrafo, faça as frases PROGREDIREM (cada uma acrescenta algo novo) e misture frases curtas com pelo menos uma mais longa, de orações intercaladas. Deixe 1 linha em branco só ENTRE parágrafos, não a cada frase. O que mata é o eco: frases curtas paralelas repetindo a mesma ideia.
   - APRENDIZADOS: ao listar pontos, use bullets com "•" e um rótulo curto seguido de dois pontos. Ex: "• Disciplina é transferível: a postura do treino é a mesma diante de um prazo difícil."
   - Tenha UMA frase-conceito memorável, que a pessoa consiga repetir. Ex: "não existe alta performance corporativa sem alta performance biológica."
   - Corte repetição: se duas frases dizem a mesma coisa, deixe só uma.
   - FECHAMENTO: convite leve e opcional, em forma de afirmação. Ex: "se você se sentir à vontade, me responde aqui ou na DM." NÃO repita a pergunta central aqui — ela já abriu o post.
   - QUALIDADE: frase curta NÃO é frase pobre. Verbos fortes, imagens concretas, vocabulário preciso, ritmo variado (alterne frases curtas com uma mais longa). Se uma frase pode sair sem perda, corte.
   - Tom: colega experiente e afiado, não guru. Conversa de gente inteligente — nem redação escolar, nem pomposo/empolado.
   - Tamanho: nem muro de texto, nem picado demais. Prefira um parágrafo um pouco maior a um amontoado de frasinhas. Ritmo de quem está conversando, não de quem disfarça bullet point como frase.

REGRAS IMPORTANTES:
- ORTOGRAFIA E REVISÃO: releia o texto antes de devolver. Português impecável, sem erros de digitação nem palavras que não existem (ex: é "hoje", NUNCA "hojes"). Acentos e concordância corretos.
- PROIBIDO MARKDOWN. Nunca use asterisco (*): nada de **negrito** nem *itálico*. O LinkedIn e o X NÃO renderizam markdown, então "**Foco:**" aparece com os asteriscos visíveis e fica feio. Também não use #, _, nem qualquer marcação. Para destacar, use o rótulo seguido de dois-pontos (ex: "Foco na amplificação:") ou MAIÚSCULA pontual. Bullets só com "•".
- NÃO use frases genéricas de IA (imagine, uma verdade incômoda, você sabia que, é hora de, revolução, transformação)
- NÃO use a antítese simétrica "não é X, mas (sim) Y" / "não X, e sim Y" como muleta — esse contraste espelhado é assinatura de IA (ex RUIM: "não se importa com o esforço, mas com o valor"; "comportamento, não prazos"). No máximo 1 vez no post inteiro, e só se sair natural. Em geral, afirme direto o que importa.
- NÃO anuncie revelação dramática antes da frase ("Mas a verdade é dura:", "a verdade incômoda é", "aqui está o segredo", "deixa eu te contar uma coisa"). Corta o tambor e vai direto ao ponto.
- NÃO faça pergunta com falso binário arrumadinho ("é por A ou por B?", "qualidade ou velocidade?", "pelo volume ou pelo resultado?"). Se for perguntar, deixe aberta e genuína.
- NÃO abra nem encha o texto com abstração grandiosa/profética: "A indústria vive uma transição", "um movimento silencioso, mas profundo", "estamos vivendo uma mudança", "algo está mudando", "e isso muda tudo". Nada de fragmento dramático nem par de adjetivo vago ("silencioso, mas profundo"). Toda frase tem que falar de algo concreto, específico e real do que o usuário trouxe — não generalize sobre o setor/o mundo/a época.
- NÃO escreva em STACCATO (a maior cara de IA que existe): frases curtas espelhadas, paralelas, uma confirmando a outra. RUIM: "É a base que sustenta tudo. Quando você não tem saúde, nenhum dinheiro paga. É um ativo insubstituível." BOM: junte num parágrafo fluido, "A base de tudo é a saúde, e isso fica óbvio no dia em que ela falha: nenhum dinheiro do mundo recompra um ativo que não tem preço." Frase longa, com vírgula e oração no meio.
- NÃO termine com a clássica pergunta de engajamento seguida de 👇 (a maior cara de IA em post de LinkedIn). A pergunta que guia o post vai no COMEÇO e é desenvolvida no meio; o final é um convite leve e opcional, em forma de afirmação e sem emoji.
- NÃO encha linguiça: cada bloco precisa carregar uma ideia nova
- NÃO termine parágrafos com muleta preguiçosa ("Enfim,", "No fim das contas,", "Resumindo,", "Então é isso", "No final do dia,"). Feche cada bloco com uma frase que tenha conteúdo próprio.
- NÃO force motivação
- Escreve como pessoa real, direto

EXEMPLO DE OURO para o LinkedIn — imite o ESTILO, o ritmo e a estrutura, NUNCA o assunto (o tema vem do input do usuário). Repare: hook concreto com a pergunta logo no começo, zero abstração grandiosa, prosa que flui, bullets e lista numerada quando ajudam, frase-conceito no fim e convite leve e opcional (sem pergunta repetida, sem 👇, sem markdown):
"""
Seu time de produto entregou 10 funcionalidades este mês. Mas quanto faturamento isso gerou?

A maioria das empresas cai na armadilha da "Fábrica de Funcionalidades": mede sucesso pelo tamanho do roadmap entregue, os tais Outputs. Só que o cliente mede outra coisa completamente — se o problema dele foi resolvido.

A diferença na prática:
• Output: entregar um dashboard novo de relatórios.
• Outcome: o cliente passar a gastar 30% menos tempo analisando dados.

Pra virar essa chave, o que funciona:
1. Defina sucesso pelo comportamento que mudou no usuário, não pela data em que algo entrou no ar.
2. Leve a engenharia pra discutir qual problema do cliente vocês estão resolvendo, antes de falar de código.
3. Aprenda a dizer "não" pra demanda que não mexe em nenhum número de negócio.

Empilhar entregas é fácil. Gerar resultado é o que separa um produto que lidera de um produto que ninguém lembra.

Se você mede produto de um jeito diferente, me conta aqui ou na DM.
"""

Sua resposta é um JSON com:
{
  "twitter": "Texto do tweet",
  "linkedin": "Texto do post LinkedIn",
  "explanation": "Breve explicação da estratégia"
}

Apenas JSON puro, sem markdown, sem backticks.
`;

/**
 * Rede de segurança: remove qualquer marcação Markdown que o modelo tenha
 * gerado por engano. O LinkedIn e o X não renderizam Markdown, então
 * "**Foco:**" apareceria literalmente com os asteriscos. Garantimos aqui que
 * isso nunca chega às redes, mesmo que o prompt seja desobedecido.
 * @param {string} text
 * @returns {string}
 */
function stripMarkdownFormatting(text) {
  if (!text) return text;
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1') // ***negrito+itálico***
    .replace(/\*\*(.+?)\*\*/g, '$1')     // **negrito**
    .replace(/\*(.+?)\*/g, '$1')         // *itálico*
    .replace(/\*/g, '')                   // qualquer asterisco solto restante
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')  // títulos markdown (# ...)
    .trim();
}

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
          temperature: 0.6,
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

    // Rede de segurança: remove Markdown que o modelo possa ter gerado
    // (LinkedIn/X mostram "**texto**" com os asteriscos literais)
    result.twitter = stripMarkdownFormatting(result.twitter);
    result.linkedin = stripMarkdownFormatting(result.linkedin);

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

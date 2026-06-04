import { checkConfig } from './src/config.js';
import { generateSocialPosts } from './src/llm.js';
import { generateUgcImage } from './src/dalle.js';
import { shareOnTwitter } from './src/twitter.js';
import { shareOnLinkedin } from './src/linkedin.js';

async function runTests() {
  console.log('🔍 Iniciando testes de conexões do JojoBot...');
  
  // 1. Verificar configuração
  const configStatus = checkConfig();
  console.log('Status da Configuração:', JSON.stringify(configStatus, null, 2));

  const testTarget = process.argv[2];

  if (!testTarget) {
    console.log('\nUse um argumento para testar um serviço específico:');
    console.log('  node test_connections.js llm       - Testa geração de textos (Gemini/OpenAI)');
    console.log('  node test_connections.js dalle     - Testa geração de imagem (DALL-E 3)');
    console.log('  node test_connections.js twitter   - Testa post no X (requer Twitter API configurada)');
    console.log('  node test_connections.js linkedin  - Testa post no LinkedIn (requer LinkedIn API configurada)');
    return;
  }

  try {
    if (testTarget === 'llm') {
      console.log('\n--- Testando Geração de Textos ---');
      const sampleIdea = 'Como IA está mudando o desenvolvimento de software em 2026';
      const result = await generateSocialPosts(sampleIdea);
      console.log('Resultado:', JSON.stringify(result, null, 2));
    }
    
    else if (testTarget === 'dalle') {
      console.log('\n--- Testando Geração de Imagem DALL-E 3 ---');
      const sampleTopic = 'Sucesso profissional e liderança de tecnologia';
      const imagePath = await generateUgcImage(sampleTopic, 'test_draft');
      console.log(`Imagem gerada e salva com sucesso em: ${imagePath}`);
    }
    
    else if (testTarget === 'twitter') {
      console.log('\n--- Testando Publicação no Twitter/X ---');
      const tweetText = 'Teste automatizado de publicação via JojoBot 🤖 #DevOps #AI';
      const result = await shareOnTwitter(tweetText);
      console.log('Resultado do Tweet:', JSON.stringify(result, null, 2));
    }
    
    else if (testTarget === 'linkedin') {
      console.log('\n--- Testando Publicação no LinkedIn ---');
      const postText = 'Teste automatizado de publicação oficial via JojoBot API! 🚀🤖 #Productivity #Innovation';
      const result = await shareOnLinkedin(postText);
      console.log('Resultado do LinkedIn URN:', result);
    }
    
    else {
      console.log(`Opção de teste desconhecida: ${testTarget}`);
    }
  } catch (error) {
    console.error(`❌ Erro no teste do ${testTarget}:`, error.message);
  }
}

runTests();

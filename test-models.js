import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const geminiKey = process.env.GEMINI_API_KEY || process.env.HUGGINGFACE_API_KEY;

console.log('🔍 Testando modelos alternativos...\n');

const modelsToTest = [
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-pro'
];

for (const modelName of modelsToTest) {
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    
    console.log(`⏳ Testando ${modelName}...`);
    const result = await model.generateContent('test');
    
    console.log(`✅ ${modelName}: FUNCIONA!\n`);
    process.exit(0);
  } catch (error) {
    if (error.message.includes('429')) {
      console.log(`❌ ${modelName}: Quota esgotada`);
    } else if (error.message.includes('404')) {
      console.log(`❌ ${modelName}: Modelo não encontrado`);
    } else {
      console.log(`❌ ${modelName}: ${error.message.substring(0, 50)}...`);
    }
  }
}

console.log('\n💡 Nenhum modelo funcionou. Você precisa ATIVAR BILLING.');
process.exit(1);

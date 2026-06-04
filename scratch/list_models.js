import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Chave sendo usada:', apiKey.substring(0, 10) + '...');
  
  const modelsToTest = [
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-3.5-flash'
  ];

  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of modelsToTest) {
    try {
      console.log(`Testando geração com o modelo: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Hi, say hello back in one word.');
      console.log(`✅ Sucesso com ${modelName}:`, result.response.text().trim());
      return; // Parar no primeiro que funcionar!
    } catch (error) {
      console.error(`❌ Falha com ${modelName}:`, error.message);
    }
  }
}

main();

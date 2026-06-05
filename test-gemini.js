#!/usr/bin/env node

/**
 * Script de diagnóstico para verificar se a chave Gemini está funcionando
 * Uso: node test-gemini.js
 */

import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const geminiKey = process.env.GEMINI_API_KEY || process.env.HUGGINGFACE_API_KEY;

console.log('🔍 Testando configuração do Gemini...\n');

if (!geminiKey) {
  console.error('❌ ERRO: Nenhuma chave encontrada!');
  console.log('\nVariáveis procuradas:');
  console.log('  - GEMINI_API_KEY');
  console.log('  - HUGGINGFACE_API_KEY');
  console.log('\nConfigure uma delas no arquivo .env');
  process.exit(1);
}

console.log('✅ Chave encontrada');
console.log(`   Chave (primeiros 15 chars): ${geminiKey.substring(0, 15)}...`);
console.log('\n📡 Conectando ao Gemini...\n');

try {
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-pro'
  });

  console.log('⏳ Enviando teste ao modelo...');
  const result = await model.generateContent(
    'Responda apenas com: {"test": "ok"}'
  );

  const responseText = result.response.text();
  console.log('✅ Resposta recebida!');
  console.log(`   Tipo: ${typeof responseText}`);
  console.log(`   Conteúdo: ${responseText}`);

  try {
    const parsed = JSON.parse(responseText);
    console.log('\n✅ JSON parsing bem-sucedido!');
    console.log(`   Parsed: ${JSON.stringify(parsed)}`);
  } catch (e) {
    console.log('\n⚠️ Aviso: Resposta não é JSON válido');
    console.log(`   Erro: ${e.message}`);
  }

  console.log('\n🎉 SUCESSO! Sua chave Gemini está funcionando corretamente.\n');
  process.exit(0);

} catch (error) {
  console.error('\n❌ ERRO ao conectar ao Gemini:\n');
  console.error(`Mensagem: ${error.message}`);

  if (error.message.includes('API_KEY_INVALID')) {
    console.error('\n💡 Dica: Sua chave API é inválida ou expirou.');
    console.error('   Gere uma nova em: https://aistudio.google.com/app/apikey');
  }

  if (error.message.includes('429') || error.message.includes('quota')) {
    console.error('\n💡 Dica: Você atingiu o limite de requisições do free tier (20/dia).');
    console.error('   Ative billing em: https://console.cloud.google.com/billing');
  }

  if (error.message.includes('401')) {
    console.error('\n💡 Dica: Erro de autenticação. A chave pode ser inválida.');
    console.error('   Verifique em: https://aistudio.google.com/app/apikey');
  }

  console.error('\n');
  process.exit(1);
}

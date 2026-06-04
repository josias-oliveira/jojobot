import axios from 'axios';

async function test(url, name) {
  try {
    console.log(`Testando: ${name}...`);
    const response = await axios.get(url);
    console.log(`✅ Sucesso! Status: ${response.status}`);
    return true;
  } catch (error) {
    console.error(`❌ Falha! Status: ${error.response?.status || error.message}`);
    return false;
  }
}

async function main() {
  const prompt = 'realistic ugc photo of a successful businessman smiling';
  
  // 1. URL simples
  await test(`https://image.pollinations.ai/p/${encodeURIComponent(prompt)}`, 'URL Simples');
  
  // 2. Com dimensões e sem logo
  await test(`https://image.pollinations.ai/p/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`, 'Dimensões + NoLogo');
  
  // 3. Com modelo flux
  await test(`https://image.pollinations.ai/p/${encodeURIComponent(prompt)}?model=flux`, 'Com Model=Flux');

  // 4. Com modelo e dimensões
  await test(`https://image.pollinations.ai/p/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&model=flux`, 'Dimensões + NoLogo + Flux');
}

main();

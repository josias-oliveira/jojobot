import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 3000;
const redirectUri = `http://localhost:${port}/callback`;

const clientId = process.env.LINKEDIN_CLIENT_ID;
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

// Validar se o usuário inseriu o Client ID e Secret
if (!clientId || clientId.includes('[aqui') || !clientSecret || clientSecret.includes('[aqui')) {
  console.error('\n❌ ERRO: Você precisa preencher o LINKEDIN_CLIENT_ID e o LINKEDIN_CLIENT_SECRET no arquivo .env primeiro!');
  console.error('Depois de preenchê-los e salvar o arquivo, rode este script novamente.\n');
  process.exit(1);
}

const app = express();

// Gerar a URL de Autorização
// Permissões necessárias: w_member_social (para postar) e openid & profile (para obter o URN do usuário logado)
const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=jojobot_auth_state&scope=w_member_social%20openid%20profile`;

console.log('\n=========================================');
console.log('🤖 ASSISTENTE DE AUTENTICAÇÃO DO LINKEDIN');
console.log('=========================================');
console.log('\n⚠️ IMPORTANTE:');
console.log(`No seu painel de desenvolvedor do LinkedIn, sob a aba "Auth", garanta que você adicionou a seguinte URL de redirecionamento:`);
console.log(`👉 \x1b[36m${redirectUri}\x1b[0m\n`);
console.log('1. Clique no link abaixo (ou cole no navegador) para autorizar o bot:');
console.log(`🔗 \x1b[4m\x1b[34m${authUrl}\x1b[0m\n`);
console.log('Aguardando autorização...');

const server = app.listen(port, () => {
  // Servidor pronto
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    console.error('❌ Erro na autorização:', req.query.error_description || error);
    res.status(400).send(`Erro na autorização: ${req.query.error_description || error}`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.status(400).send('Código de autorização não encontrado.');
    return;
  }

  res.send('<h3>Autorização recebida com sucesso! Você pode fechar esta aba. Olhe o terminal para ver o resultado.</h3>');

  console.log('\n🔄 Código recebido! Solicitando Access Token ao LinkedIn...');

  try {
    // 1. Trocar o código de autorização pelo Access Token
    const tokenResponse = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Access Token obtido com sucesso!');

    // 2. Buscar o URN do usuário logado
    console.log('🔄 Obtendo identificador do usuário (URN)...');
    const userResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const memberId = userResponse.data.sub; // O sub é o ID único do usuário no OpenID Connect
    const memberUrn = `urn:li:person:${memberId}`;
    console.log(`✅ URN do usuário obtido: ${memberUrn}`);

    // 3. Atualizar o arquivo .env
    const envPath = path.resolve('.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');

      // Substituir os marcadores pelos valores reais
      // Usando regex para encontrar e substituir as linhas de ACCESS_TOKEN e MEMBER_URN
      envContent = envContent.replace(
        /LINKEDIN_ACCESS_TOKEN=.*/,
        `LINKEDIN_ACCESS_TOKEN=${accessToken}`
      );
      envContent = envContent.replace(
        /LINKEDIN_MEMBER_URN=.*/,
        `LINKEDIN_MEMBER_URN=${memberUrn}`
      );

      fs.writeFileSync(envPath, envContent, 'utf-8');
      console.log('\n🎉 O arquivo .env foi atualizado automaticamente com as credenciais do LinkedIn!');
    } else {
      console.warn('\n⚠️ Arquivo .env não encontrado. Por favor, configure manualmente:');
      console.log(`LINKEDIN_ACCESS_TOKEN=${accessToken}`);
      console.log(`LINKEDIN_MEMBER_URN=${memberUrn}`);
    }

    console.log('\nPronto! Tudo configurado. O servidor de autenticação local foi encerrado.');
    server.close();
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Erro durante o fluxo de autenticação:', err.response?.data || err.message);
    server.close();
    process.exit(1);
  }
});

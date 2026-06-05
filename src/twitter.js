import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { validateTweetText, validateImagePath, maskSensitiveData, safeLog } from './security.js';

/**
 * Executa o script Python para publicar no Twitter/X
 * @param {string} text Texto do Tweet
 * @param {string} [imagePath] Caminho local da imagem
 * @returns {Promise<{success: boolean, tweetId?: string, error?: string}>}
 */
export function shareOnTwitter(text, imagePath = null) {
  return new Promise((resolve, reject) => {
    try {
      // ✅ Validar input ANTES de passar ao Python
      const validatedText = validateTweetText(text);

      const scriptPath = path.resolve('scripts/publish_x.py');

      if (!fs.existsSync(scriptPath)) {
        return reject(new Error(`Script Python não encontrado em: ${scriptPath}`));
      }

      const args = ['--text', validatedText];

      // ✅ Validar caminho da imagem se fornecido
      if (imagePath) {
        safeLog('Twitter', 'info', `Verificando imagem: ${imagePath}`);
        safeLog('Twitter', 'info', `Arquivo existe? ${fs.existsSync(imagePath)}`);

        if (fs.existsSync(imagePath)) {
          try {
            const validatedPath = validateImagePath(imagePath);
            args.push('--image', validatedPath);
            safeLog('Twitter', 'info', `Imagem adicionada aos argumentos: ${validatedPath}`);
          } catch (pathError) {
            safeLog('Twitter', 'warn', `Imagem inválida: ${pathError.message}`);
            // Continuar sem imagem ao invés de falhar
          }
        } else {
          safeLog('Twitter', 'warn', `Arquivo de imagem não encontrado: ${imagePath}. Publicando tweet apenas com texto.`);
        }
      } else {
        safeLog('Twitter', 'info', 'Nenhuma imagem fornecida.');
      }

      safeLog('Twitter', 'info', `Spawning Python script to publish tweet...`);
    
    // Tentar localizar e usar o ambiente virtual venv/ local
    let pythonCmd = 'python3';
    const venvPythonPath = path.resolve('venv/bin/python');
    const venvPython3Path = path.resolve('venv/bin/python3');

    if (fs.existsSync(venvPythonPath)) {
      pythonCmd = venvPythonPath;
      safeLog('Twitter', 'info', `Usando Python do ambiente virtual (venv): ${pythonCmd}`);
    } else if (fs.existsSync(venvPython3Path)) {
      pythonCmd = venvPython3Path;
      safeLog('Twitter', 'info', `Usando Python3 do ambiente virtual (venv): ${pythonCmd}`);
    }

    let pyProcess = runPythonProcess(pythonCmd, scriptPath, args);

    pyProcess.on('error', (err) => {
      // Se tentou venv e falhou por algum motivo de spawn, ou se era o global python3 que não existia
      if (err.code === 'ENOENT' && pythonCmd !== 'python') {
        safeLog('Twitter', 'warn', `Comando falhou. Tentando com 'python' como fallback global...`);
        pythonCmd = 'python';
        const fallbackProcess = runPythonProcess(pythonCmd, scriptPath, args);
        handleProcessEvents(fallbackProcess, resolve, reject);
      } else {
        reject(err);
      }
    });

    // Se o processo foi spawnado sem disparar erro síncrono imediato
    if (pyProcess.listenerCount('error') > 0) {
      handleProcessEvents(pyProcess, resolve, reject);
    }
    } catch (error) {
      reject(error);
    }
  });
}

function runPythonProcess(cmd, scriptPath, args) {
  return spawn(cmd, [scriptPath, ...args], {
    env: { ...process.env } // Passar variáveis de ambiente incluindo credenciais
  });
}

function handleProcessEvents(processInstance, resolve, reject) {
  let stdoutData = '';
  let stderrData = '';

  processInstance.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  processInstance.stderr.on('data', (data) => {
    stderrData += data.toString();
  });

  processInstance.on('close', (code) => {
    safeLog('Twitter', 'info', `Processo Python encerrado com código ${code}`);

    if (stderrData) {
      // ✅ Mascarar dados sensíveis antes de logar
      safeLog('Twitter', 'warn', `Stderr: ${maskSensitiveData(stderrData)}`);
    }

    try {
      if (stdoutData.trim()) {
        const result = JSON.parse(stdoutData.trim());
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error || 'Erro desconhecido retornado pelo script Python.'));
        }
      } else {
        reject(new Error(`O script Python não retornou nenhuma saída stdout. Stderr: ${maskSensitiveData(stderrData)}`));
      }
    } catch (parseError) {
      safeLog('Twitter', 'error', `Falha ao parsear saída JSON: ${maskSensitiveData(stdoutData)}`);
      reject(new Error(`Saída inválida do script Python.`));
    }
  });
}

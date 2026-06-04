import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Executa o script Python para publicar no Twitter/X
 * @param {string} text Texto do Tweet
 * @param {string} [imagePath] Caminho local da imagem
 * @returns {Promise<{success: boolean, tweetId?: string, error?: string}>}
 */
export function shareOnTwitter(text, imagePath = null) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve('scripts/publish_x.py');

    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Script Python não encontrado em: ${scriptPath}`));
    }

    const args = ['--text', text];
    if (imagePath && fs.existsSync(imagePath)) {
      args.push('--image', imagePath);
    }

    console.log(`[Twitter Module] Spawning Python script to publish tweet...`);
    
    // Tentar localizar e usar o ambiente virtual venv/ local
    let pythonCmd = 'python3';
    const venvPythonPath = path.resolve('venv/bin/python');
    const venvPython3Path = path.resolve('venv/bin/python3');
    
    if (fs.existsSync(venvPythonPath)) {
      pythonCmd = venvPythonPath;
      console.log(`[Twitter Module] Usando Python do ambiente virtual (venv): ${pythonCmd}`);
    } else if (fs.existsSync(venvPython3Path)) {
      pythonCmd = venvPython3Path;
      console.log(`[Twitter Module] Usando Python3 do ambiente virtual (venv): ${pythonCmd}`);
    }

    let pyProcess = runPythonProcess(pythonCmd, scriptPath, args);

    pyProcess.on('error', (err) => {
      // Se tentou venv e falhou por algum motivo de spawn, ou se era o global python3 que não existia
      if (err.code === 'ENOENT' && pythonCmd !== 'python') {
        console.warn(`[Twitter Module] Comando falhou. Tentando com 'python' como fallback global...`);
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
    console.log(`[Twitter Module] Processo Python encerrado com código ${code}`);
    
    if (stderrData) {
      console.error(`[Twitter Module] Stderr: ${stderrData}`);
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
        reject(new Error(`O script Python não retornou nenhuma saída stdout. Stderr: ${stderrData}`));
      }
    } catch (parseError) {
      console.error(`[Twitter Module] Falha ao parsear saída JSON: ${stdoutData}`);
      reject(new Error(`Saída inválida do script Python: ${stdoutData || stderrData}`));
    }
  });
}

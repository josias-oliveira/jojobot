/**
 * Backup Manager - Backup automático de db.json
 * Previne perda de dados se arquivo corromper
 */

import fs from 'fs';
import path from 'path';
import { safeLog } from './security.js';

const DB_PATH = path.resolve('db.json');
const BACKUP_DIR = path.resolve('backups');
const MAX_BACKUPS = 7; // Manter últimos 7 backups

/**
 * Criar diretório de backups se não existir
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    safeLog('Backup', 'info', 'Diretório de backups criado');
  }
}

/**
 * Fazer backup do db.json
 * @returns {Promise<string>} Caminho do arquivo de backup
 */
export async function performBackup() {
  return new Promise((resolve, reject) => {
    try {
      ensureBackupDir();

      // Verificar se db.json existe
      if (!fs.existsSync(DB_PATH)) {
        safeLog('Backup', 'warn', 'db.json não encontrado, skip backup');
        return resolve(null);
      }

      // Gerar nome do backup com timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const time = new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
      const backupFileName = `db_backup_${timestamp}_${time}.json`;
      const backupPath = path.join(BACKUP_DIR, backupFileName);

      // Copiar arquivo
      fs.copyFileSync(DB_PATH, backupPath);
      safeLog('Backup', 'info', `Backup realizado: ${backupFileName}`);

      // Limpar backups antigos (manter apenas os últimos MAX_BACKUPS)
      cleanupOldBackups();

      resolve(backupPath);
    } catch (error) {
      safeLog('Backup', 'error', `Erro ao fazer backup: ${error.message}`);
      reject(error);
    }
  });
}

/**
 * Limpar backups antigos mantendo apenas os MAX_BACKUPS mais recentes
 */
function cleanupOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('db_backup_') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Mais recentes primeiro

    // Deletar arquivos antigos além do limite
    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      toDelete.forEach(f => {
        fs.unlinkSync(f.path);
        safeLog('Backup', 'info', `Backup antigo deletado: ${f.name}`);
      });
    }
  } catch (error) {
    safeLog('Backup', 'warn', `Erro ao limpar backups antigos: ${error.message}`);
  }
}

/**
 * Restaurar db.json a partir de um backup
 * @param {string} backupFileName Nome do arquivo de backup
 * @returns {Promise<boolean>} true se restaurado com sucesso
 */
export async function restoreFromBackup(backupFileName) {
  return new Promise((resolve, reject) => {
    try {
      const backupPath = path.join(BACKUP_DIR, backupFileName);

      if (!fs.existsSync(backupPath)) {
        safeLog('Backup', 'error', `Arquivo de backup não encontrado: ${backupFileName}`);
        return reject(new Error('Backup not found'));
      }

      // Fazer backup do arquivo atual antes de restaurar
      if (fs.existsSync(DB_PATH)) {
        const corruptedBackup = path.join(BACKUP_DIR, `db_corrupted_${Date.now()}.json`);
        fs.copyFileSync(DB_PATH, corruptedBackup);
        safeLog('Backup', 'warn', `Arquivo corrompido salvo como: db_corrupted_${Date.now()}.json`);
      }

      // Restaurar
      fs.copyFileSync(backupPath, DB_PATH);
      safeLog('Backup', 'info', `DB.json restaurado de: ${backupFileName}`);

      resolve(true);
    } catch (error) {
      safeLog('Backup', 'error', `Erro ao restaurar backup: ${error.message}`);
      reject(error);
    }
  });
}

/**
 * Listar todos os backups disponíveis
 */
export function listBackups() {
  try {
    ensureBackupDir();

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('db_backup_') && f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(filePath);
        return {
          name: f,
          size: Math.round(stat.size / 1024) + 'KB',
          created: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    return files;
  } catch (error) {
    safeLog('Backup', 'error', `Erro ao listar backups: ${error.message}`);
    return [];
  }
}

/**
 * Agendar backup automático (padrão: diariamente à meia-noite)
 */
export function scheduleAutomaticBackups(cronTime = '0 0 * * *') {
  // ✅ Fazer backup imediato
  performBackup().catch(e => safeLog('Backup', 'error', `Backup inicial falhou: ${e.message}`));

  // ✅ Agendar backup diário (simples: a cada 24 horas)
  const DAILY_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    performBackup().catch(e => safeLog('Backup', 'error', `Backup agendado falhou: ${e.message}`));
  }, DAILY_MS);

  safeLog('Backup', 'info', 'Backup automático agendado (diariamente)');
}

/**
 * Obter estatísticas de backup
 */
export function getBackupStats() {
  try {
    ensureBackupDir();

    const backups = listBackups();
    const dbSize = fs.existsSync(DB_PATH) ? Math.round(fs.statSync(DB_PATH).size / 1024) + 'KB' : 'N/A';
    const backupDirSize = fs.readdirSync(BACKUP_DIR)
      .reduce((sum, f) => sum + fs.statSync(path.join(BACKUP_DIR, f)).size, 0);

    return {
      current_db_size: dbSize,
      backup_directory_size: Math.round(backupDirSize / 1024) + 'KB',
      total_backups: backups.length,
      latest_backup: backups.length > 0 ? backups[0].created : 'Nenhum',
      backups_list: backups.slice(0, 5) // Últimos 5
    };
  } catch (error) {
    safeLog('Backup', 'error', `Erro ao calcular estatísticas: ${error.message}`);
    return { error: error.message };
  }
}

export default {
  performBackup,
  restoreFromBackup,
  listBackups,
  scheduleAutomaticBackups,
  getBackupStats
};

import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('db.json');

// Estrutura inicial do banco de dados
const initialData = {
  sessions: {},
  drafts: {}
};

class LocalDatabase {
  constructor() {
    this.data = this.load();
    this.writing = false; // ✅ Flag para prevenir race conditions
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(fileContent);
      }
    } catch (error) {
      console.error('Erro ao carregar o banco de dados db.json, reinicializando...', error);
    }
    this.save(initialData);
    return initialData;
  }

  save(data = this.data) {
    // ✅ Aguardar se já está escrevendo (simula lock simples)
    const waitStart = Date.now();
    const MAX_WAIT_TIME = 5000; // 5 segundos de timeout

    while (this.writing && Date.now() - waitStart < MAX_WAIT_TIME) {
      // Spin lock simples - aguarda liberação
    }

    if (this.writing) {
      console.error('[DB] Timeout aguardando escrita anterior. Abortando save.');
      return;
    }

    this.writing = true;
    try {
      const tempPath = DB_PATH + '.tmp';
      // ✅ Escrever em arquivo temporário primeiro
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      // ✅ Depois renomear atomicamente (operação atomic no filesystem)
      fs.renameSync(tempPath, DB_PATH);
      console.log('[DB] Dados salvos com sucesso');
    } catch (error) {
      console.error('Erro ao persistir o banco de dados:', error);
      // Tentar limpar arquivo temporário se houver erro
      try {
        const tempPath = DB_PATH + '.tmp';
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (e) {
        // Ignorar erro de limpeza
      }
    } finally {
      this.writing = false; // ✅ Liberar lock
    }
  }

  // --- Operações de Sessão ---
  getSession(userId) {
    const session = this.data.sessions[userId];
    if (!session) {
      return { state: 'IDLE', data: {} };
    }
    return session;
  }

  setSession(userId, sessionData) {
    const current = this.getSession(userId);
    this.data.sessions[userId] = {
      state: sessionData.state || current.state,
      data: { ...current.data, ...(sessionData.data || {}) },
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.data.sessions[userId];
  }

  clearSession(userId) {
    if (this.data.sessions[userId]) {
      delete this.data.sessions[userId];
      this.save();
    }
  }

  // --- Operações de Rascunhos ---
  saveDraft(draft) {
    const draftId = draft.id || `draft_${Date.now()}`;
    const newDraft = {
      id: draftId,
      createdAt: new Date().toISOString(),
      status: {
        x: 'PENDING', // PENDING, POSTED, FAILED, SKIPPED
        linkedin: 'PENDING'
      },
      ...draft
    };
    this.data.drafts[draftId] = newDraft;
    this.save();
    return newDraft;
  }

  getDraft(draftId) {
    return this.data.drafts[draftId] || null;
  }

  updateDraft(draftId, updates) {
    if (this.data.drafts[draftId]) {
      this.data.drafts[draftId] = {
        ...this.data.drafts[draftId],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.save();
      return this.data.drafts[draftId];
    }
    return null;
  }

  listDrafts() {
    return Object.values(this.data.drafts).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

const db = new LocalDatabase();
export default db;

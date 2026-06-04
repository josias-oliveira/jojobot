# 📊 Monitoramento, Backup e Health Check

Documentação completa dos sistemas de monitoramento, backup automático e validação de APIs do JojoBot.

---

## 🏥 Health Check - Validação de APIs

### O que faz?
Valida que todas as APIs externas (Gemini, OpenAI, LinkedIn, Twitter) estão funcionando na inicialização e periodicamente.

### Arquivo
`src/health-check.js`

### Como funciona

**Na Inicialização:**
```
1. App inicia
2. Faz health check de todas as 4 APIs
3. Se alguma falhar, loga warning mas continua
4. Agenda health checks periódicos (a cada 6 horas)
```

**Health Check Periódico:**
- Executa a cada 6 horas
- Testa Gemini, OpenAI, LinkedIn, Twitter
- Se detectar erro, loga `⚠️ PROBLEMAS DETECTADOS`

### Acessar Health Check

**Endpoint:**
```bash
curl http://localhost:3000/health
```

**Resposta:**
```json
{
  "status": "online",
  "timestamp": "2025-06-04T15:00:00.000Z",
  "apis": {
    "allHealthy": true,
    "results": [
      {
        "service": "Gemini",
        "status": "OK",
        "message": "API funcionando"
      },
      {
        "service": "OpenAI",
        "status": "OK",
        "message": "API funcionando"
      },
      {
        "service": "LinkedIn",
        "status": "OK",
        "message": "API funcionando"
      },
      {
        "service": "Twitter",
        "status": "OK",
        "message": "Credenciais configuradas"
      }
    ],
    "summary": {
      "ok": 4,
      "warnings": 0,
      "missing": 0,
      "errors": 0
    }
  },
  "backup": { ... },
  "metrics": { ... }
}
```

### Possíveis Status

| Status | Significado | Ação |
|--------|-------------|------|
| `OK` | API funcionando normalmente | ✅ Nenhuma |
| `WARN` | API com problemas menores | ⚠️ Monitorar |
| `ERROR` | API retornando erro | 🔴 Verificar credenciais |
| `MISSING` | Chave de API não configurada | 🔴 Adicionar ao .env |

---

## 💾 Backup Automático

### O que faz?
Faz backup automático de `db.json` diariamente para prevenir perda de dados.

### Arquivo
`src/backup.js`

### Como funciona

**Automaticamente:**
- Faz 1º backup na inicialização
- Faz backup diário (a cada 24 horas)
- Mantém últimos 7 backups
- Apaga backups mais antigos automaticamente

**Localização:**
```
backups/
├── db_backup_2025-06-04_15-30-45.json
├── db_backup_2025-06-03_15-30-45.json
├── db_backup_2025-06-02_15-30-45.json
└── ...
```

### Listar Backups

```javascript
// No código:
import { listBackups, getBackupStats } from './src/backup.js';

listBackups();
// Retorna: Array de backups com tamanho e data de criação

getBackupStats();
// Retorna: {
//   current_db_size: "24KB",
//   backup_directory_size: "168KB",
//   total_backups: 3,
//   latest_backup: "2025-06-04T15:30:45.000Z",
//   backups_list: [...]
// }
```

### Fazer Backup Manual

```javascript
import { performBackup } from './src/backup.js';

await performBackup();
// Cria backup imediato
```

### Restaurar de Backup

```javascript
import { restoreFromBackup } from './src/backup.js';

// Restaurar específico
await restoreFromBackup('db_backup_2025-06-04_15-30-45.json');

// Antes de restaurar:
// 1. Arquivo atual é salvo como db_corrupted_[timestamp].json
// 2. Backup é restaurado
// 3. Log é escrito
```

### Monitorar Backup

No endpoint `/health`, veja:
```json
"backup": {
  "current_db_size": "24KB",
  "backup_directory_size": "168KB",
  "total_backups": 3,
  "latest_backup": "2025-06-04T15:30:45.000Z"
}
```

---

## 📈 Monitoring - Métricas

### O que faz?
Coleta métricas de uso e performance do bot.

### Arquivo
`src/monitoring.js`

### Instâncias Globais

```javascript
import { metrics, logger } from './src/monitoring.js';

// Métricas
metrics.recordRequest('telegram');      // +1 request
metrics.recordError('dalle');           // +1 error
metrics.recordPost('twitter');          // +1 post publicado

// Latência
metrics.startTimer('gen_123');
// ... alguma operação ...
metrics.endTimer('gen_123', 'generation'); // Registra tempo

// Obter métricas
metrics.getMetrics();
// Retorna object com uptime, requests, errors, posts, latency

// Logger
logger.log('INFO', 'Telegram', 'Mensagem recebida', { userId: 123 });
logger.log('ERROR', 'LinkedIn', 'Falha ao publicar', { error: '401' });
```

### Dashboard Público

Acesse: `http://localhost:3000/` (quando rodando localmente ou no Railway)

Mostra:
- ✓ Status (Online)
- 📊 Requisições totais e por módulo
- 📝 Posts publicados (total, Twitter, LinkedIn)
- ⚡ Performance (latência IA, latência publicação, memory)
- 💾 Backup stats
- 🏥 Health das APIs

### Métricas Coletadas

```json
{
  "uptime": "5h 30m",
  "requests": {
    "total": 245,
    "telegram": 100,
    "twitter": 50,
    "linkedin": 50,
    "dalle": 45
  },
  "errors": {
    "total": 3,
    "telegram": 0,
    "twitter": 1,
    "linkedin": 1,
    "dalle": 1,
    "error_rate": "1.22%"
  },
  "posts": {
    "total": 50,
    "twitter": 25,
    "linkedin": 25
  },
  "performance": {
    "avg_generation_ms": 4200,
    "avg_publication_ms": 1500
  },
  "memory": {
    "heapUsed": 45000000,
    "heapTotal": 67000000,
    "external": 2000000,
    "rss": 120000000
  }
}
```

### Logs Estruturados

**Localização:**
```
logs/
├── jojobot_2025-06-04.log
├── jojobot_2025-06-03.log
├── jojobot_2025-06-02.log
└── ...
```

**Formato:**
```json
{
  "timestamp": "2025-06-04T15:30:45.123Z",
  "level": "INFO",
  "module": "Telegram",
  "message": "Mensagem recebida do usuário",
  "context": {
    "chatId": 123456,
    "messageId": 789
  },
  "pid": 12345
}
```

**Limpeza Automática:**
- Mantém últimos 7 dias de logs
- Logs mais antigos são deletados automaticamente

---

## 🚀 Integração com Railway

### Health Check
Railway pode fazer ping em `/health` para monitorar:
```bash
# Railway Dashboard > Settings > Health Check
https://seu-app.railway.app/health
```

### Logs
Railway exibe automaticamente:
```bash
# Railway Dashboard > Logs
[Startup] Validando APIs...
[HealthCheck] Gemini: OK
[Backup] Backup realizado: db_backup_2025-06-04_15-30-45.json
```

### Storage
- `backups/` e `logs/` ficam no storage de Railway
- Automaticamente limpos por TTL
- Você pode fazer backup do Railway storage via dashboard

---

## 🔍 Troubleshooting

### "Health Check falha para Gemini"
1. Verifique `GEMINI_API_KEY` no Railway env vars
2. Chave pode ter expirado - gere nova em console.cloud.google.com
3. Check quotas/billing

### "Backup falhando"
1. Verifique se diretório `backups/` tem permissão de escrita
2. Verifique espaço em disco disponível
3. Check logs em `logs/jojobot_[data].log`

### "Memory crescendo"
1. Verifique `/health` para memory usage
2. Railway reinicia a cada deploy - não há memória persistente
3. Se > 500MB, pode ser memory leak - abrir issue

### "Quero ver logs em tempo real"
```bash
# Railway CLI
railway logs -f

# Ou acessar arquivo local:
tail -f logs/jojobot_$(date +%Y-%m-%d).log
```

---

## 📋 Checklist Pós-Deploy

- [ ] Acessar `https://seu-app.railway.app/` e ver dashboard
- [ ] Acessar `https://seu-app.railway.app/health` e ver status de APIs
- [ ] Verificar que nenhuma API está em `ERROR` status
- [ ] Esperar 6 horas para ver periodic health check
- [ ] Esperar 24 horas para ver primeiro backup automático
- [ ] Monitorar memory no dashboard - deve estar < 300MB

---

## 📞 Suporte

Se qualquer métrica estiver anormal:
1. Verifique `/health` endpoint
2. Verifique logs em `logs/jojobot_[data].log`
3. Se houver erro persistente, backup está em `backups/`
4. Você pode restaurar manualmente com `restoreFromBackup()`

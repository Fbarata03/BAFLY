const db = require('./db');

// Corre automaticamente todos os dias
// NUNCA apaga utilizadores nem bans ativos

const runCleanup = async () => {
  const now = new Date().toISOString();
  console.log(`[CLEANUP] A iniciar limpeza automática — ${now}`);

  try {
    // 1. Remover screenshots de reports já resolvidos com mais de 7 dias
    //    (mantém o report, só apaga a foto para libertar espaço)
    const r1 = await db.query(`
      UPDATE reports
      SET screenshot = NULL
      WHERE screenshot IS NOT NULL
        AND status IN ('dismissed', 'banned')
        AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);
    console.log(`[CLEANUP] Screenshots removidos de reports antigos resolvidos`);

    // 2. Apagar reports resolvidos com mais de 6 meses (mantém pendentes para sempre)
    const r2 = await db.query(`
      DELETE FROM reports
      WHERE status IN ('dismissed', 'banned')
        AND created_at < DATE_SUB(NOW(), INTERVAL 180 DAY)
    `);
    console.log(`[CLEANUP] Reports antigos resolvidos eliminados`);

    // 3. Apagar sessões com mais de 90 dias (mantém para stats recentes)
    const r3 = await db.query(`
      DELETE FROM sessions
      WHERE started_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
    `);
    console.log(`[CLEANUP] Sessões antigas eliminadas`);

    // 4. Apagar stats_daily com mais de 1 ano
    const r4 = await db.query(`
      DELETE FROM stats_daily
      WHERE date < DATE_SUB(CURDATE(), INTERVAL 365 DAY)
    `);
    console.log(`[CLEANUP] Stats diárias antigas eliminadas`);

    // 5. Limpar bans expirados com mais de 30 dias (já não têm efeito)
    const r5 = await db.query(`
      DELETE FROM bans
      WHERE expires_at IS NOT NULL
        AND expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    console.log(`[CLEANUP] Bans expirados antigos eliminados`);

    console.log(`[CLEANUP] Limpeza concluída com sucesso`);
  } catch (err) {
    console.error('[CLEANUP] Erro durante limpeza:', err.message);
  }
};

const startCleanupScheduler = () => {
  // Correr imediatamente no arranque (após 1 minuto para deixar o servidor estabilizar)
  setTimeout(runCleanup, 60 * 1000);

  // Depois correr todos os dias (24h)
  setInterval(runCleanup, 24 * 60 * 60 * 1000);

  console.log('[CLEANUP] Agendamento de limpeza automática iniciado (diário)');
};

module.exports = { startCleanupScheduler, runCleanup };

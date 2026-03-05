const pool = require('./src/db/mysql');
(async () => {
  try {
    const [rows] = await pool.query('SELECT id,event_id FROM seats WHERE id IN (1,2,3)');
    console.log(rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
})();

const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST,
      port: process.env.MYSQLPORT,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE
    });

    console.log('✅ Connected to database!');
    const [rows] = await connection.query('SELECT NOW() AS now');
    console.log('DB time:', rows[0].now);

    await connection.end();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  }
}

testConnection();

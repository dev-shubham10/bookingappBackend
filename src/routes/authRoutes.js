const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/mysql');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  const connection = await pool.getConnection();

  try {
    const [existingUsers] = await connection.query('SELECT COUNT(*) AS cnt FROM users');
    const isFirstUser = existingUsers[0].cnt === 0;
    const role = isFirstUser ? 'ADMIN' : 'USER';

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await connection.query(
      `
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `,
      [userId, name, email, passwordHash, role]
    );

    const token = jwt.sign(
      { userId, role },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '2h' }
    );

    return res.status(201).json({
      user: { id: userId, name, email, role },
      token
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email is already registered' });
    }
    return res.status(500).json({ error: 'Failed to register user' });
  } finally {
    connection.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const [rows] = await pool.query(
      `
        SELECT id, name, email, password_hash, role
        FROM users
        WHERE email = ?
      `,
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '2h' }
    );

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to login' });
  }
});

module.exports = router;


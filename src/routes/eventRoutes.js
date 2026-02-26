const express = require('express');
const pool = require('../db/mysql');

const router = express.Router();

// GET /api/events
router.get('/events', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          e.id,
          e.name,
          e.event_datetime AS eventDateTime,
          v.name AS venueName,
          v.state_code AS venueState
        FROM events e
        JOIN venues v ON v.id = e.venue_id
        ORDER BY e.event_datetime ASC
      `
    );

    return res.json(rows);
  } catch (err) {
    return res.status(500).json(err);
  }
});


module.exports = router;


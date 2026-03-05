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

// GET /api/events/:eventId/seats
router.get('/events/:eventId/seats', async (req, res) => {
  try {
    const { eventId } = req.params;

    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.seat_label AS label,
          s.base_price AS basePrice,
          s.status,
          sec.id AS sectionId,
          sec.name AS sectionName,
          sec.booking_fee_type AS bookingFeeType,
          sec.booking_fee_value AS bookingFeeValue
        FROM seats s
        JOIN seat_sections sec ON sec.id = s.section_id
        WHERE s.event_id = ?
        ORDER BY sec.name, s.seat_label
      `,
      [eventId]
    );

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;


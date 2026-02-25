const express = require('express');
const pool = require('../db/mysql');
const { authRequired, adminRequired } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes in this file require auth + admin
router.use(authRequired, adminRequired);

// POST /api/admin/events
router.post('/events', async (req, res) => {
  const { eventName, eventDateTime, venueName, venueState } = req.body;

  if (!eventName || !eventDateTime || !venueName || !venueState) {
    return res.status(400).json({
      error: 'eventName, eventDateTime, venueName and venueState are required'
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Find or create venue
    const [venueRows] = await connection.query(
      `
        SELECT id
        FROM venues
        WHERE name = ? AND state_code = ?
        LIMIT 1
      `,
      [venueName, venueState]
    );

    let venueId;
    if (venueRows.length > 0) {
      venueId = venueRows[0].id;
    } else {
      const [venueInsert] = await connection.query(
        `
          INSERT INTO venues (name, state_code)
          VALUES (?, ?)
        `,
        [venueName, venueState]
      );
      venueId = venueInsert.insertId;
    }

    const [eventInsert] = await connection.query(
      `
        INSERT INTO events (name, venue_id, event_datetime)
        VALUES (?, ?, ?)
      `,
      [eventName, venueId, eventDateTime]
    );

    await connection.commit();

    return res.status(201).json({
      id: eventInsert.insertId,
      name: eventName,
      venueId,
      eventDateTime
    });
  } catch (err) {
    await connection.rollback();
    return res.status(500).json({ error: 'Failed to create event' });
  } finally {
    connection.release();
  }
});

// POST /api/admin/coupons
router.post('/coupons', async (req, res) => {
  const {
    code,
    description,
    discountType,
    discountValue,
    maxDiscountAmount,
    minOrderValue,
    expiryAt,
    globalUsageLimit,
    perUserLimit,
    applicableEventIds
  } = req.body;

  if (!code || !discountType || discountValue == null || !expiryAt) {
    return res.status(400).json({
      error: 'code, discountType, discountValue and expiryAt are required'
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [couponInsert] = await connection.query(
      `
        INSERT INTO coupons (
          code,
          description,
          discount_type,
          discount_value,
          max_discount_amount,
          min_order_value,
          expiry_at,
          global_usage_limit,
          per_user_limit
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        code,
        description || null,
        discountType,
        discountValue,
        maxDiscountAmount || null,
        minOrderValue || 0,
        expiryAt,
        globalUsageLimit || null,
        perUserLimit || null
      ]
    );

    const couponId = couponInsert.insertId;

    if (Array.isArray(applicableEventIds) && applicableEventIds.length > 0) {
      for (const eventId of applicableEventIds) {
        // eslint-disable-next-line no-await-in-loop
        await connection.query(
          `
            INSERT INTO coupon_events (coupon_id, event_id)
            VALUES (?, ?)
          `,
          [couponId, eventId]
        );
      }
    }

    await connection.commit();

    return res.status(201).json({
      id: couponId,
      code,
      discountType,
      discountValue
    });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }
    return res.status(500).json({ error: 'Failed to create coupon' });
  } finally {
    connection.release();
  }
});

module.exports = router;


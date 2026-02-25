const express = require('express');

const router = express.Router();

const { authRequired } = require('../middleware/authMiddleware');
const { lockSeats } = require('../services/seatLockService');
const { calculatePricingWithNewConnection } = require('../services/pricingService');
const { confirmBooking } = require('../services/bookingService');

// All booking routes require authentication
router.use(authRequired);

// POST /api/lock-seats
// Body: { eventId, seatIds: [] }
router.post('/lock-seats', async (req, res) => {
  try {
    const { eventId, seatIds } = req.body;
    const userId = req.user.id;

    if (!eventId || !Array.isArray(seatIds)) {
      return res.status(400).json({ error: 'eventId and seatIds are required' });
    }

    const result = await lockSeats(eventId, seatIds, userId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/pricing/quote
// Body: { eventId, seatIds: [], couponCode? }
router.post('/pricing/quote', async (req, res) => {
  try {
    const { eventId, seatIds, couponCode } = req.body;
    const userId = req.user.id;

    if (!eventId || !Array.isArray(seatIds)) {
      return res.status(400).json({ error: 'eventId and seatIds are required' });
    }

    const pricing = await calculatePricingWithNewConnection({ eventId, seatIds, couponCode, userId });
    return res.json(pricing);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/bookings/confirm
// Body: { eventId, seatIds: [], couponCode?, paymentReference? }
router.post('/bookings/confirm', async (req, res) => {
  try {
    const { eventId, seatIds, couponCode, paymentReference } = req.body;
    const userId = req.user.id;

    if (!eventId || !Array.isArray(seatIds)) {
      return res.status(400).json({ error: 'eventId and seatIds are required' });
    }

    const result = await confirmBooking({ eventId, seatIds, couponCode, userId, paymentReference });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;


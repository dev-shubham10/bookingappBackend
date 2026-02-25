const pool = require('../db/mysql');
const { calculatePricing } = require('./pricingService');
const { ensureSeatsLockedByUser } = require('./seatLockService');
const { recordCouponRedemption } = require('./couponService');

async function confirmBooking({ eventId, seatIds, couponCode, userId, paymentReference }) {
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw new Error('seatIds must be a non-empty array');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Ensure seats are still locked by this user (no expiry or owner change)
    await ensureSeatsLockedByUser(connection, eventId, seatIds, userId);

    // Recalculate pricing on the fly to prevent tampering
    const pricing = await calculatePricing(connection, { eventId, seatIds, couponCode, userId });

    const {
      breakdown: {
        ticketSubtotal,
        bookingFeeTotal,
        couponDiscount,
        taxCgst,
        taxSgst,
        taxIgst,
        totalAmount
      },
      coupon
    } = pricing;

    // Insert booking
    const [bookingResult] = await connection.query(
      `
        INSERT INTO bookings (
          user_id,
          event_id,
          base_amount,
          booking_fee_amount,
          coupon_discount,
          tax_cgst,
          tax_sgst,
          tax_igst,
          total_amount,
          status,
          payment_reference
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)
      `,
      [
        userId,
        eventId,
        ticketSubtotal,
        bookingFeeTotal,
        couponDiscount,
        taxCgst,
        taxSgst,
        taxIgst,
        totalAmount,
        paymentReference || null
      ]
    );

    const bookingId = bookingResult.insertId;

    // Insert booking seats
    for (const seat of pricing.seats) {
      // eslint-disable-next-line no-await-in-loop
      await connection.query(
        `
          INSERT INTO booking_seats (booking_id, seat_id, price)
          VALUES (?, ?, ?)
        `,
        [bookingId, seat.seatId, seat.basePrice]
      );
    }

    // Mark seats as booked
    const placeholders = seatIds.map(() => '?').join(',');
    await connection.query(
      `
        UPDATE seats
        SET status = 'BOOKED'
        WHERE id IN (${placeholders})
      `,
      [...seatIds]
    );

    // Delete locks for these seats
    await connection.query(
      `
        DELETE FROM seat_locks
        WHERE event_id = ?
          AND seat_id IN (${placeholders})
      `,
      [eventId, ...seatIds]
    );

    // Record coupon usage if applicable
    if (coupon) {
      await recordCouponRedemption(connection, coupon.id, userId, bookingId);
    }

    await connection.commit();

    // NOTE: In a real system, here you would also:
    // - Update MongoDB seat status to "BOOKED"
    // - Publish events to message bus, etc.

    return {
      success: true,
      bookingId,
      pricing
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  confirmBooking
};


const pool = require('../db/mysql');
const { getCouponForPricing } = require('./couponService');

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function calculatePricing(connection, { eventId, seatIds, couponCode, userId }) {
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw new Error('seatIds must be a non-empty array');
  }

  const placeholders = seatIds.map(() => '?').join(',');

  // Fetch seat + section data
  const [seatRows] = await connection.query(
    `
      SELECT
        s.id AS seat_id,
        s.seat_label,
        s.base_price,
        s.section_id,
        sec.name AS section_name,
        sec.booking_fee_type,
        sec.booking_fee_value
      FROM seats s
      JOIN seat_sections sec ON sec.id = s.section_id
      WHERE s.event_id = ?
        AND s.id IN (${placeholders})
    `,
    [eventId, ...seatIds]
  );

  if (seatRows.length !== seatIds.length) {
    throw new Error('One or more seats not found for this event');
  }

  // Ticket price sum
  let ticketSubtotal = 0;
  for (const row of seatRows) {
    ticketSubtotal += Number(row.base_price);
  }

  // Section-wise booking fee
  const bookingBySection = {};
  for (const row of seatRows) {
    const basePrice = Number(row.base_price);
    if (!bookingBySection[row.section_id]) {
      bookingBySection[row.section_id] = {
        sectionId: row.section_id,
        sectionName: row.section_name,
        bookingFeeType: row.booking_fee_type,
        bookingFeeValue: Number(row.booking_fee_value),
        ticketSubtotal: 0
      };
    }
    bookingBySection[row.section_id].ticketSubtotal += basePrice;
  }

  let bookingFeeTotal = 0;
  for (const sectionId of Object.keys(bookingBySection)) {
    const sec = bookingBySection[sectionId];
    let sectionFee = 0;
    if (sec.bookingFeeType === 'FLAT') {
      sectionFee = sec.bookingFeeValue;
    } else if (sec.bookingFeeType === 'PERCENT') {
      sectionFee = (sec.ticketSubtotal * sec.bookingFeeValue) / 100;
    }
    bookingFeeTotal += sectionFee;
  }

  ticketSubtotal = round2(ticketSubtotal);
  bookingFeeTotal = round2(bookingFeeTotal);

  const grossBeforeDiscount = round2(ticketSubtotal + bookingFeeTotal);

  // Apply coupon (if any)
  const { coupon, discountAmount } = await getCouponForPricing(connection, {
    eventId,
    userId,
    couponCode,
    grossAmount: grossBeforeDiscount
  });

  const couponDiscount = round2(discountAmount);
  const taxableAmount = round2(grossBeforeDiscount - couponDiscount);

  // GST calculation
  const gstRate = Number(process.env.GST_RATE || '0.18');

  const [venueRows] = await connection.query(
    `
      SELECT v.state_code AS venue_state
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      WHERE e.id = ?
    `,
    [eventId]
  );

  if (venueRows.length === 0) {
    throw new Error('Event/venue not found');
  }

  const venueState = venueRows[0].venue_state;
  const companyState = process.env.COMPANY_STATE || venueState;

  let taxCgst = 0;
  let taxSgst = 0;
  let taxIgst = 0;

  if (venueState === companyState) {
    const halfRate = gstRate / 2;
    taxCgst = round2(taxableAmount * halfRate);
    taxSgst = round2(taxableAmount * halfRate);
  } else {
    taxIgst = round2(taxableAmount * gstRate);
  }

  const totalAmount = round2(taxableAmount + taxCgst + taxSgst + taxIgst);

  return {
    seats: seatRows.map((row) => ({
      seatId: row.seat_id,
      label: row.seat_label,
      basePrice: Number(row.base_price),
      sectionId: row.section_id,
      sectionName: row.section_name
    })),
    breakdown: {
      ticketSubtotal,
      bookingFeeTotal,
      grossBeforeDiscount,
      couponDiscount,
      taxableAmount,
      taxCgst,
      taxSgst,
      taxIgst,
      totalAmount
    },
    coupon: coupon
      ? {
          id: coupon.id,
          code: coupon.code,
          discountType: coupon.discount_type,
          discountValue: Number(coupon.discount_value)
        }
      : null
  };
}

async function calculatePricingWithNewConnection(payload) {
  const connection = await pool.getConnection();
  try {
    const result = await calculatePricing(connection, payload);
    return result;
  } finally {
    connection.release();
  }
}

module.exports = {
  calculatePricing,
  calculatePricingWithNewConnection
};


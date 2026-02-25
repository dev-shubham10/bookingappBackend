const { v4: uuidv4 } = require('uuid');
const pool = require('../db/mysql');

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function getCouponForPricing(connection, { eventId, userId, couponCode, grossAmount }) {
  if (!couponCode) {
    return { coupon: null, discountAmount: 0 };
  }

  const [couponRows] = await connection.query(
    `
      SELECT *
      FROM coupons
      WHERE code = ?
    `,
    [couponCode]
  );

  if (couponRows.length === 0) {
    throw new Error('Invalid coupon code');
  }

  const coupon = couponRows[0];

  // Expiry check
  if (new Date(coupon.expiry_at) <= new Date()) {
    throw new Error('Coupon has expired');
  }

  // Event applicability
  const [eventMapRows] = await connection.query(
    `
      SELECT 1
      FROM coupon_events
      WHERE coupon_id = ?
        AND event_id = ?
    `,
    [coupon.id, eventId]
  );

  if (eventMapRows.length === 0) {
    throw new Error('Coupon not applicable for this event');
  }

  // Global usage limit
  if (coupon.global_usage_limit !== null) {
    const [globalUsageRows] = await connection.query(
      `
        SELECT COUNT(*) AS used_count
        FROM coupon_redemptions
        WHERE coupon_id = ?
      `,
      [coupon.id]
    );
    const usedCount = globalUsageRows[0].used_count;
    if (usedCount >= coupon.global_usage_limit) {
      throw new Error('Coupon usage limit reached');
    }
  }

  // Per-user limit
  if (coupon.per_user_limit !== null) {
    const [userUsageRows] = await connection.query(
      `
        SELECT COUNT(*) AS used_count
        FROM coupon_redemptions
        WHERE coupon_id = ?
          AND user_id = ?
      `,
      [coupon.id, userId]
    );
    const usedCount = userUsageRows[0].used_count;
    if (usedCount >= coupon.per_user_limit) {
      throw new Error('You have already used this coupon maximum allowed times');
    }
  }

  // Min order value on gross amount (ticket + booking fee)
  if (coupon.min_order_value !== null && Number(coupon.min_order_value) > 0) {
    if (grossAmount < Number(coupon.min_order_value)) {
      throw new Error('Order value is below coupon minimum amount');
    }
  }

  let rawDiscount = 0;
  if (coupon.discount_type === 'FLAT') {
    rawDiscount = Number(coupon.discount_value);
  } else if (coupon.discount_type === 'PERCENT') {
    rawDiscount = (grossAmount * Number(coupon.discount_value)) / 100;
  }

  let finalDiscount = rawDiscount;
  if (coupon.max_discount_amount !== null && Number(coupon.max_discount_amount) > 0) {
    finalDiscount = Math.min(rawDiscount, Number(coupon.max_discount_amount));
  }

  finalDiscount = round2(Math.min(finalDiscount, grossAmount));

  return {
    coupon,
    discountAmount: finalDiscount
  };
}

async function recordCouponRedemption(connection, couponId, userId, bookingId) {
  await connection.query(
    `
      INSERT INTO coupon_redemptions (coupon_id, user_id, booking_id)
      VALUES (?, ?, ?)
    `,
    [couponId, userId, bookingId]
  );
}

module.exports = {
  getCouponForPricing,
  recordCouponRedemption,
  generateCouponCode: uuidv4
};


/**
 * Seeding script to populate sample events, sections, and seats
 * Run this after creating admin user and events
 */

const pool = require('./src/db/mysql');

async function seedData() {
  const connection = await pool.getConnection();

  try {
    // Get the first event (admin should have created one)
    const [events] = await connection.query(
      'SELECT id FROM events LIMIT 1'
    );

    if (events.length === 0) {
      console.error('No events found. Please create an event first via admin API.');
      return;
    }

    const eventId = events[0].id;
    console.log(`Seeding data for event ID: ${eventId}`);

    await connection.beginTransaction();

    // Create seat sections
    const [sectionA] = await connection.query(
      `
        INSERT INTO seat_sections (event_id, name, booking_fee_type, booking_fee_value)
        VALUES (?, ?, ?, ?)
      `,
      [eventId, 'Premium', 'FLAT', 100]
    );

    const [sectionB] = await connection.query(
      `
        INSERT INTO seat_sections (event_id, name, booking_fee_type, booking_fee_value)
        VALUES (?, ?, ?, ?)
      `,
      [eventId, 'Standard', 'PERCENT', 5]
    );

    const [sectionC] = await connection.query(
      `
        INSERT INTO seat_sections (event_id, name, booking_fee_type, booking_fee_value)
        VALUES (?, ?, ?, ?)
      `,
      [eventId, 'Economy', 'FLAT', 50]
    );

    const sectionIds = [sectionA.insertId, sectionB.insertId, sectionC.insertId];
    console.log(`Created 3 sections: ${sectionIds.join(', ')}`);

    // Create seats for Premium section
    const premiumSeats = [];
    for (let i = 1; i <= 10; i += 1) {
      premiumSeats.push([eventId, sectionIds[0], `P${i}`, 5000]);
    }

    // Create seats for Standard section
    const standardSeats = [];
    for (let i = 1; i <= 15; i += 1) {
      standardSeats.push([eventId, sectionIds[1], `S${i}`, 3000]);
    }

    // Create seats for Economy section
    const economySeats = [];
    for (let i = 1; i <= 20; i += 1) {
      economySeats.push([eventId, sectionIds[2], `E${i}`, 1500]);
    }

    const allSeats = [...premiumSeats, ...standardSeats, ...economySeats];

    // Insert all seats
    for (const [eId, sId, label, price] of allSeats) {
      // eslint-disable-next-line no-await-in-loop
      await connection.query(
        `
          INSERT INTO seats (event_id, section_id, seat_label, base_price)
          VALUES (?, ?, ?, ?)
        `,
        [eId, sId, label, price]
      );
    }

    console.log(`Created ${allSeats.length} seats (10 Premium + 15 Standard + 20 Economy)`);

    // Create sample coupon
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days from now

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
        'SAVE10',
        '10% discount on all tickets',
        'PERCENT',
        10,
        1000,
        1000,
        expiryDate,
        100,
        5
      ]
    );

    const couponId = couponInsert.insertId;

    // Map coupon to event
    await connection.query(
      `
        INSERT INTO coupon_events (coupon_id, event_id)
        VALUES (?, ?)
      `,
      [couponId, eventId]
    );

    console.log(`Created sample coupon: SAVE10 (10% discount, max ₹1000, min order ₹1000)`);

    await connection.commit();
    console.log('Data seeded successfully!');
  } catch (err) {
    await connection.rollback();
    console.error('Seeding failed:', err.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

seedData();

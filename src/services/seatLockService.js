const pool = require('../db/mysql');

const DEFAULT_LOCK_MINUTES = 5;

function minutesFromNow(minutes) {
  const now = new Date();
  return new Date(now.getTime() + minutes * 60 * 1000);
}

async function lockSeats(eventId, seatIds, userId, lockMinutes = DEFAULT_LOCK_MINUTES) {
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw new Error('seatIds must be a non-empty array');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const placeholders = seatIds.map(() => '?').join(',');

    // 1) Ensure seats are not already booked
    const [bookedRows] = await connection.query(
      `
        SELECT bs.seat_id
        FROM booking_seats bs
        JOIN bookings b ON b.id = bs.booking_id
        WHERE b.event_id = ?
          AND bs.seat_id IN (${placeholders})
          AND b.status = 'CONFIRMED'
      `,
      [eventId, ...seatIds]
    );

    if (bookedRows.length > 0) {
      throw new Error('One or more seats are already booked');
    }

    // 2) Lock rows for these seats that are still active
    const [activeLocks] = await connection.query(
      `
        SELECT seat_id, user_id, locked_until
        FROM seat_locks
        WHERE event_id = ?
          AND seat_id IN (${placeholders})
          AND locked_until > NOW()
        FOR UPDATE
      `,
      [eventId, ...seatIds]
    );

    // If any seat is locked by a different user and lock not expired, fail whole request
    const conflicting = activeLocks.filter((row) => row.user_id !== userId);
    if (conflicting.length > 0) {
      throw new Error('One or more seats are already locked by another user');
    }

    const lockedUntil = minutesFromNow(lockMinutes);

    // 3) Insert or update locks atomically for this user
    for (const seatId of seatIds) {
      // Upsert per seat; unique key on (event_id, seat_id) enforces single lock
      // If an old lock exists (expired or same user), we override it.
      // If another transaction tries to lock same seat concurrently,
      // the unique constraint + transaction isolation ensure only one succeeds.
      // eslint-disable-next-line no-await-in-loop
      await connection.query(
        `
          INSERT INTO seat_locks (event_id, seat_id, user_id, locked_until)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            locked_until = VALUES(locked_until)
        `,
        [eventId, seatId, userId, lockedUntil]
      );
    }

    await connection.commit();

    return {
      success: true,
      lockedUntil: lockedUntil.toISOString()
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function ensureSeatsLockedByUser(connection, eventId, seatIds, userId) {
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw new Error('seatIds must be a non-empty array');
  }

  const placeholders = seatIds.map(() => '?').join(',');

  const [rows] = await connection.query(
    `
      SELECT seat_id, user_id, locked_until
      FROM seat_locks
      WHERE event_id = ?
        AND seat_id IN (${placeholders})
    `,
    [eventId, ...seatIds]
  );

  if (rows.length !== seatIds.length) {
    throw new Error('Some seats are not locked');
  }

  const now = new Date();

  for (const row of rows) {
    const lockExpiry = new Date(row.locked_until);
    if (row.user_id !== userId || lockExpiry <= now) {
      throw new Error('Seat locks missing or expired for this user');
    }
  }
}

module.exports = {
  lockSeats,
  ensureSeatsLockedByUser
};


/**
 * Atomically reserve capacity against the event's current confirmed-slot count.
 * The compare-and-set on reservedSlots prevents two requests from claiming the
 * same remaining slots. Call it inside the transaction that creates bookings.
 */
async function reserveEventSlots(tx, event, requestedSlots, now = new Date()) {
  if (!Number.isInteger(requestedSlots) || requestedSlots < 1) return false;
  if (event.slotsNeeded !== null && event.reservedSlots + requestedSlots > event.slotsNeeded) return false;

  const result = await tx.event.updateMany({
    where: {
      id: event.id,
      status: 'published',
      reservedSlots: event.reservedSlots,
      slotsNeeded: event.slotsNeeded,
      AND: [{ OR: [{ timerEnd: null }, { timerEnd: { gt: now } }] }],
    },
    data: { reservedSlots: { increment: requestedSlots } },
  });

  return result.count === 1;
}

module.exports = { reserveEventSlots };

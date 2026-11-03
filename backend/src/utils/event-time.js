const INDIA_OFFSET = '+05:30';

function getEventStartAt(date, reportTime = '00:00') {
  const eventDate = new Date(date);
  const match = String(reportTime).match(/^(\d{2}):(\d{2})$/);
  if (Number.isNaN(eventDate.getTime()) || !match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const datePart = eventDate.toISOString().slice(0, 10);
  return new Date(`${datePart}T${match[1]}:${match[2]}:00${INDIA_OFFSET}`);
}

module.exports = { getEventStartAt };

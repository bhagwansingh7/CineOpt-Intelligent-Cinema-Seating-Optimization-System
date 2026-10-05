// "7d" | "12h" | "30m" | "45s" | "3600" (seconds) -> milliseconds
function parseDurationMs(value, fallbackMs = 7 * 24 * 3600 * 1000) {
  const match = /^(\d+)\s*([smhd]?)$/i.exec(String(value).trim());
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const factor = { s: 1000, m: 60 * 1000, h: 3600 * 1000, d: 24 * 3600 * 1000 }[unit];
  return amount * factor;
}

module.exports = { parseDurationMs };

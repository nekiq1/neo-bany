/**
 * Расчёт стоимости. Логика ДОЛЖНА совпадать с src/lib/pricing.ts.
 * Подключается из neo.pb.js: require(`${__hooks}/pricing.js`)
 */
var HOUR = 3600000

function parseJson(v, fallback) {
  try {
    if (v === null || v === undefined) return fallback
    if (typeof v === 'string') return JSON.parse(v)
    if (typeof v.length === 'number' && typeof v[0] === 'number') {
      var s = ''
      for (var i = 0; i < v.length; i++) s += String.fromCharCode(v[i])
      return JSON.parse(s)
    }
    return JSON.parse(JSON.stringify(v))
  } catch (_) {
    return fallback
  }
}

function parts(ms, tz) {
  var d = new Date(ms + tz * 60000)
  return { h: d.getUTCHours(), dow: d.getUTCDay() || 7 }
}

function isHappy(hall, settings, ms) {
  var hp = settings.happy
  if (!hp || !hp.enabled || !(hall.price_happy > 0)) return false
  var p = parts(ms, settings.tzOffsetMin)
  return hp.days.indexOf(p.dow) !== -1 && p.h >= hp.from && p.h < hp.to
}

/** hall: {price_per_hour, price_happy, included_guests, extra_guest_price}; extras: [{price, unit, qty}] */
function priceFor(hall, settings, startMs, hours, guests, extras) {
  var base = 0, happy = 0, baseHours = 0, happyHours = 0
  for (var i = 0; i < hours; i++) {
    if (isHappy(hall, settings, startMs + i * HOUR)) { happy += hall.price_happy; happyHours++ }
    else { base += hall.price_per_hour; baseHours++ }
  }
  var included = hall.included_guests > 0 ? hall.included_guests : guests
  var extraGuests = Math.max(0, guests - included)
  var guestsFee = extraGuests * (hall.extra_guest_price || 0) * hours
  var extrasTotal = 0
  for (var j = 0; j < extras.length; j++) {
    var x = extras[j]
    var qty = x.qty > 0 ? x.qty : 0
    if (x.unit === 'hour') extrasTotal += x.price * hours * Math.min(qty, 1)
    else if (x.unit === 'booking') extrasTotal += x.price * Math.min(qty, 1)
    else extrasTotal += x.price * qty
  }
  return {
    base: base, baseHours: baseHours, happy: happy, happyHours: happyHours,
    guestsFee: guestsFee, extraGuests: extraGuests, extrasTotal: extrasTotal,
    total: base + happy + guestsFee + extrasTotal,
  }
}

module.exports = { priceFor: priceFor, parseJson: parseJson, HOUR: HOUR }

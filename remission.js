/**
 * Kenya Prison Remission Calculator
 * Implements the 9-point guide as the gold standard.
 */

function calculateRemission() {
  const sentenceDateInput = document.getElementById('sentence_date').value;
  const years = parseInt(document.getElementById('sentence_years').value, 10);
  const months = parseInt(document.getElementById('sentence_months').value, 10);
  const days = parseInt(document.getElementById('sentence_days').value, 10);

  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = '';

  if (!sentenceDateInput) {
    alert('Please enter a valid sentence date.');
    return;
  }
  if (isNaN(years) || isNaN(months) || isNaN(days)) {
    alert('Please enter valid sentence duration values.');
    return;
  }
  if (years < 0 || months < 0 || days < 0) {
    alert('Duration values cannot be negative.');
    return;
  }
  if (months > 11) {
    alert('Months should be between 0 and 11.');
    return;
  }
  if (days > 364) {
    alert('Days should be between 0 and 364.');
    return;
  }

  // Step 1: Compute LPD = (Sentence Date + Sentence Duration) - 1 day
  let lpdDate = addDurationToDate(sentenceDateInput, years, months, days);
  lpdDate.setDate(lpdDate.getDate() - 1); // Subtract 1 day

  // Step 2: Compute remission according to rules
  const totalSentenceDays = years * 360 + months * 30 + days; // fixed month=30 days, year=12 months
  let remission = { months: 0, days: 0 };

  if (totalSentenceDays <= 30) {
    // No remission for 1-30 days
    remission.months = 0;
    remission.days = 0;
  } else if (totalSentenceDays >= 31 && totalSentenceDays <= 44) {
    // Remission = days above 30
    remission.months = 0;
    remission.days = totalSentenceDays - 30;
  } else {
    // >= 45 days remission = perfect third of sentence duration
    remission = calculatePerfectThird(years, months, days);
  }

  // Step 3: Compute EPD = (LPD - Remission) + 1 day
  let epdDate = subtractRemissionFromLPD(lpdDate, remission);

  epdDate.setDate(epdDate.getDate() + 1);

  // Display results
  resultDiv.innerHTML = `
    <strong>LPD (Latest Possible Discharge):</strong> ${formatDate(lpdDate)}<br/>
    <strong>Remission:</strong> ${remission.months} month${remission.months !== 1 ? 's' : ''}, ${remission.days} day${remission.days !== 1 ? 's' : ''}<br/>
    <strong>EPD (Earliest Possible Discharge):</strong> ${formatDate(epdDate)}
  `;
}

/**
 * Add duration (years, months, days) to a date.
 * Treat year as 12 months, month as 30 days (fixed units).
 * @param {string} startDateStr - YYYY-MM-DD string
 * @param {number} y
 * @param {number} m
 * @param {number} d
 * @returns {Date}
 */
function addDurationToDate(startDateStr, y, m, d) {
  const startDate = new Date(startDateStr);
  let year = startDate.getFullYear() + y;
  let month = startDate.getMonth() + m; // zero-based months
  let day = startDate.getDate() + d;

  // Normalize days (month = 30 days)
  while (day > 30) {
    day -= 30;
    month += 1;
  }
  // Normalize months (year = 12 months)
  while (month > 11) {
    month -= 12;
    year += 1;
  }
  return new Date(year, month, day);
}

/**
 * Calculate perfect third remission from sentence duration.
 * Convert leftover units down, round decimals per rules.
 * @param {number} years
 * @param {number} months
 * @param {number} days
 * @returns {{months: number, days: number}}
 */
function calculatePerfectThird(y, m, d) {
  let remissionMonths = 0;
  let remissionDays = 0;

  // Years → months remission
  if (y > 0) {
    const yearsThird = y / 3;
    const wholeYears = Math.floor(yearsThird);
    const fractionalYears = yearsThird - wholeYears;

    remissionMonths += wholeYears * 4; // 1 year remission = 4 months
    // Convert fractional year to months (12 * fractional)
    const remMonthsFromFraction = fractionalYears * 12;

    // Round months per rule
    remissionMonths += roundDecimal(remMonthsFromFraction);
  }

  // Months remission
  if (m > 0) {
    const monthsThird = m / 3;
    const wholeMonths = Math.floor(monthsThird);
    const fractionalMonths = monthsThird - wholeMonths;

    remissionMonths += wholeMonths;
    remissionDays += roundDecimal(fractionalMonths * 30);
  }

  // Days remission
  if (d > 0) {
    const daysThird = d / 3;
    remissionDays += roundDecimal(daysThird);
  }

  // Normalize days > 30 to months
  while (remissionDays >= 30) {
    remissionDays -= 30;
    remissionMonths += 1;
  }

  return {
    months: remissionMonths,
    days: remissionDays,
  };
}

/**
 * Round decimals: >= 0.5 up, < 0.5 down.
 * @param {number} num
 * @returns {number}
 */
function roundDecimal(num) {
  return num - Math.floor(num) >= 0.5 ? Math.ceil(num) : Math.floor(num);
}

/**
 * Subtract remission from LPD to get EPD.
 * Borrow actual calendar months where needed.
 * @param {Date} lpdDate
 * @param {{months: number, days: number}} remission
 * @returns {Date}
 */
function subtractRemissionFromLPD(lpdDate, remission) {
  // Clone LPD date to avoid mutation
  let epd = new Date(lpdDate.getTime());

  // Subtract days first
  let day = epd.getDate() - remission.days;
  let month = epd.getMonth();
  let year = epd.getFullYear();

  while (day <= 0) {
    // Borrow previous month days
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    day += daysInMonth(month, year);
  }

  // Subtract months
  month -= remission.months;
  while (month < 0) {
    month += 12;
    year -= 1;
  }

  // Set corrected date
  epd = new Date(year, month, day);
  return epd;
}

/**
 * Get days in a calendar month
 * @param {number} month - zero-based month (0=Jan)
 * @param {number} year
 * @returns {number}
 */
function daysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Format Date object as YYYY-MM-DD string
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

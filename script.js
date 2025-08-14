// remission.js
// Implements the 10-Point Gold Standard for LPD / Remission / EPD calculations.
// Outputs final computed dates (dd/mm/yyyy) and remission as Y M D.

/* -------------------------
   Helper utilities
   ------------------------- */

function pad2(n){ return String(n).padStart(2,'0'); }

function formatDDMMYYYYFromParts(y, m, d){
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

function dateFromPartsCalendar(year, month, day){
  // month: 1-12, day: 1.. ; create Date and let JS normalize if needed
  return new Date(year, month - 1, day);
}

function daysInCalendarMonth(month, year){
  // month: 1-12
  return new Date(year, month, 0).getDate();
}

/* -------------------------
   Core Gold Standard logic
   ------------------------- */

/**
 * Add sentence (years, months, days) to a start date using FIXED UNITS:
 * - 1 year = 12 months
 * - 1 month = 30 days
 * Normalization left-to-right: days -> months -> years.
 *
 * Returns an object { year, month, day } in fixed-unit representation (month may be 1..12, day may be 1..30)
 * (Before converting to a real calendar date)
 */
function addFixedDurationToDate_parts(startY, startM, startD, addY, addM, addD){
  // Start with the exact components from start date (calendar values)
  let y = startY;
  let m = startM;
  let d = startD;

  // Add the sentence units directly to components (preserve input exactly)
  d = d + (Number(addD) || 0);
  m = m + (Number(addM) || 0);
  y = y + (Number(addY) || 0);

  // Normalize days using fixed 30-day months
  while (d > 30){
    d -= 30;
    m += 1;
  }

  // Normalize months using 12 months per year
  while (m > 12){
    m -= 12;
    y += 1;
  }

  // Now apply the -1 day for LPD (the sentencing day counts as served)
  d -= 1;
  if (d <= 0){
    // borrow a fixed 30-day month
    m -= 1;
    if (m <= 0){
      m += 12;
      y -= 1;
    }
    d += 30;
  }

  // At this point we have a fixed-unit LPD candidate (year, month, day)
  // day will be in 1..30; month 1..12; year integer.
  return { year: y, month: m, day: d };
}

/**
 * Convert a fixed-unit Y/M/D (1 month = 30 days) into a real calendar date by carrying overflow forward.
 * e.g. fixed 30/02/2025 -> convert: Feb 2025 has 28 days -> leftover 2 days -> 02/03/2025
 *
 * Input month is 1..12, day may be > actual days in that month (but <=30)
 * The algorithm carries overflow forward until day fits actual month length.
 *
 * Returns a JavaScript Date (calendar-correct).
 */
function convertFixedToCalendarDate(fixed){
  let y = fixed.year;
  let m = fixed.month; // 1-12
  let d = fixed.day;

  // If day is greater than actual days in that month, carry forward
  while (true){
    const actual = daysInCalendarMonth(m, y);
    if (d <= actual) break;
    d = d - actual;
    m += 1;
    if (m > 12){ m = 1; y += 1; }
  }

  return dateFromPartsCalendar(y, m, d);
}

/**
 * Compute perfect-third remission using unit-by-unit down-conversion.
 * Follows rules:
 *  - Start with the sentence as passed (years, months, days).
 *  - Years: take largest multiple of 3; remainder years -> convert to months (x12).
 *  - Months: take largest multiple of 3; remainder months -> convert to days (x30).
 *  - Days: divide by 3; round .5 and above up, <.5 down.
 *  - Normalize remission days >=30 => carry to months.
 *
 * Returns { years: remY, months: remM, days: remD }
 */
function computePerfectThird(y, m, d){
  let remY = 0, remM = 0, remD = 0;

  // Years: largest multiple of 3
  if (y > 0){
    const wholeYearsDiv = Math.floor(y / 3);
    remY += wholeYearsDiv;
    const leftoverYears = y - (wholeYearsDiv * 3);
    // Down-convert leftover years to months
    m += leftoverYears * 12;
  }

  // Months
  if (m > 0){
    const wholeMonthsDiv = Math.floor(m / 3);
    remM += wholeMonthsDiv;
    const leftoverMonths = m - (wholeMonthsDiv * 3);
    // Down-convert leftover months to days
    d += leftoverMonths * 30;
  }

  // Days
  if (d > 0){
    const raw = d / 3;
    // Round .5 up, < .5 down
    const frac = raw - Math.floor(raw);
    remD += (frac >= 0.5) ? Math.ceil(raw) : Math.floor(raw);
  }

  // Normalize remD -> remM if >= 30
  while (remD >= 30){
    remD -= 30;
    remM += 1;
  }

  return { years: remY, months: remM, days: remD };
}

/**
 * Given a sentence (y,m,d) return remission in units following Gold Standard:
 * - If total sentence in fixed days <= 30 => 0 remission
 * - If 31..44 days => remission = days above 30 (in days)
 * - If >=45 => perfect third via computePerfectThird()
 *
 * Note: We compute totalDays as y*360 + m*30 + d
 *
 * Returns object { years, months, days }
 */
function computeRemissionFromSentence(y, m, d){
  // total days in fixed-unit accounting
  const totalDays = (Number(y) * 360) + (Number(m) * 30) + Number(d);

  if (totalDays <= 30){
    return { years: 0, months: 0, days: 0 };
  }

  if (totalDays >= 31 && totalDays <= 44){
    const extra = totalDays - 30;
    return { years: 0, months: 0, days: extra };
  }

  // >= 45:
  return computePerfectThird(Number(y), Number(m), Number(d));
}

/**
 * Subtract remission (years, months, days) from a calendar date (JS Date) using REAL calendar borrowing.
 * Subtraction order: subtract days first (borrowing previous calendar month if needed), then months (borrowing years if needed), then years.
 * After subtraction, add 1 day (per EPD formula).
 *
 * Returns a JS Date (calendar-correct).
 */
function subtractRemissionFromCalendarLPD(lpdDate, remission){
  // Clone
  let y = lpdDate.getFullYear();
  let m = lpdDate.getMonth() + 1; // 1..12
  let d = lpdDate.getDate();

  let remY = Number(remission.years || 0);
  let remM = Number(remission.months || 0);
  let remD = Number(remission.days || 0);

  // Subtract days first
  d = d - remD;
  while (d <= 0){
    // Borrow previous calendar month
    m -= 1;
    if (m < 1){
      m = 12;
      y -= 1;
    }
    const borrowDays = daysInCalendarMonth(m, y);
    d += borrowDays;
  }

  // Subtract months
  m = m - remM;
  while (m <= 0){
    m += 12;
    y -= 1;
  }

  // Subtract years
  y = y - remY;

  // Now add 1 day (EPD rule)
  d += 1;
  // If adding day overflows that calendar month, carry forward
  while (d > daysInCalendarMonth(m, y)){
    d -= daysInCalendarMonth(m, y);
    m += 1;
    if (m > 12){
      m = 1;
      y += 1;
    }
  }

  return dateFromPartsCalendar(y, m, d);
}

/* -------------------------
   UI wiring
   ------------------------- */

document.addEventListener('DOMContentLoaded', function(){
  const btn = document.getElementById('calcBtn');
  const clr = document.getElementById('clearBtn');
  const resDiv = document.getElementById('result');
  const resBody = document.getElementById('resultBody');

  btn.addEventListener('click', function(){
    // read inputs
    const startDateInput = document.getElementById('sentenceDate').value;
    const yearsInput = document.getElementById('years').value;
    const monthsInput = document.getElementById('months').value;
    const daysInput = document.getElementById('days').value;

    if (!startDateInput){
      alert('Please enter a sentence date.');
      return;
    }

    // Parse start date parts (calendar)
    const parts = startDateInput.split('-').map(Number);
    const startY = parts[0];
    const startM = parts[1];
    const startD = parts[2];

    // Keep input units as given (do not normalize)
    const y = Number(yearsInput) || 0;
    const m = Number(monthsInput) || 0;
    const d = Number(daysInput) || 0;

    // Compute fixed-unit LPD parts
    const fixedLPD = addFixedDurationToDate_parts(startY, startM, startD, y, m, d);

    // Convert fixed-unit LPD to real calendar LPD by carrying overflow forward
    const lpdCalDate = convertFixedToCalendarDate(fixedLPD);

    // Compute remission according to rules
    const remission = computeRemissionFromSentence(y, m, d);

    // EPD = (LPD - remission) + 1 day (calendar borrowing)
    // EPD = (LPD - remission) + 1 day (calendar borrowing)
let epdCalDate;
if ((y*360 + m*30 + d) <= 30) {
    // Short sentence: no remission, EPD = LPD
    epdCalDate = lpdCalDate;
} else {
    epdCalDate = subtractRemissionFromCalendarLPD(lpdCalDate, remission);
}


    // Format remission for display as "X years Y months Z days" (always show components)
    const remParts = [
      `${remission.years || 0} year${(remission.years == 1) ? '' : 's'}`,
      `${remission.months || 0} month${(remission.months == 1) ? '' : 's'}`,
      `${remission.days || 0} day${(remission.days == 1) ? '' : 's'}`
    ].join(', ');

    // Prepare display
    const sentenceDateDisplay = formatDateDisplayFromParts(startY, startM, startD);
    const durationDisplay = `${y} year${y==1?'':'s'} ${m} month${m==1?'':'s'} ${d} day${d==1?'':'s'}`;
    const lpdDisplay = formatDateToDDMMYYYY(lpdCalDate);
    const epdDisplay = formatDateToDDMMYYYY(epdCalDate);

    // show results
    resDiv.style.display = 'block';
    resBody.innerHTML = `
      <tr><th>Sentence Date</th><td class="mono">${sentenceDateDisplay}</td></tr>
      <tr><th>Duration (as passed)</th><td class="mono">${durationDisplay}</td></tr>
      <tr><th>LPD (Latest Possible Discharge)</th><td class="mono">${lpdDisplay}</td></tr>
      <tr><th>Remission (Y, M, D)</th><td class="mono">${remParts}</td></tr>
      <tr><th>EPD (Earliest Possible Discharge)</th><td class="mono">${epdDisplay}</td></tr>
    `;
  });

  clr.addEventListener('click', function(){
    document.getElementById('sentenceDate').value = '';
    document.getElementById('years').value = '0';
    document.getElementById('months').value = '0';
    document.getElementById('days').value = '0';
    resDiv.style.display = 'none';
    resBody.innerHTML = '';
  });
});

/* -------------------------
   Small formatting helpers
   ------------------------- */

function formatDateToDDMMYYYY(jsDate){
  const d = jsDate.getDate();
  const m = jsDate.getMonth() + 1;
  const y = jsDate.getFullYear();
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

function formatDateDisplayFromParts(y, m, d){
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

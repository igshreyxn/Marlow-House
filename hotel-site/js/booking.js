/*
  Date & room selection modal.
  ------------------------------------------------------------------
  Shows a live availability calendar for the selected room. On
  "Continue to Checkout", the selection is saved to sessionStorage
  and the guest is sent to checkout.html to finish booking.

  Depends on js/shared.js being loaded first (ROOM_DATA,
  getUnavailableDates, toISODate).
  ------------------------------------------------------------------
*/

const calendarState = {
  roomId: "standard",
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  checkIn: null,
  checkOut: null,
};

const roomSelect = document.querySelector("#room-select");
const calGrid = document.querySelector(".calendar-grid");
const calMonthLabel = document.querySelector(".cal-month-label");
const calPrev = document.querySelector(".cal-prev");
const calNext = document.querySelector(".cal-next");
const sumCheckin = document.querySelector(".sum-checkin");
const sumCheckout = document.querySelector(".sum-checkout");
const sumTotal = document.querySelector(".sum-total");
const datesContinueBtn = document.querySelector("#dates-continue");

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function isPastDate(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

// Checks whether every date strictly between two ISO dates (exclusive)
// is free — stops a guest selecting a checkout that spans a booked night.
function rangeHasUnavailable(startISO, endISO, unavailableSet) {
  let d = new Date(startISO);
  const end = new Date(endISO);
  d.setDate(d.getDate() + 1);
  while (d < end) {
    if (unavailableSet.has(toISODate(d))) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}

function renderCalendar() {
  if (!calGrid) return;
  const { viewYear, viewMonth, roomId } = calendarState;
  const unavailable = new Set(getUnavailableDates(roomId));

  calMonthLabel.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  calGrid.innerHTML = "";

  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day is-empty";
    calGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(viewYear, viewMonth, day);
    const iso = toISODate(date);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-day";
    cell.textContent = String(day);
    cell.dataset.date = iso;

    const past = isPastDate(date);
    const booked = unavailable.has(iso);

    if (past) {
      cell.classList.add("is-past");
      cell.disabled = true;
    } else if (booked) {
      cell.classList.add("is-unavailable");
      cell.disabled = true;
    } else {
      cell.classList.add("is-available");
      cell.addEventListener("click", () => handleDayClick(iso, unavailable));
    }

    if (calendarState.checkIn === iso || calendarState.checkOut === iso) {
      cell.classList.add(calendarState.checkIn === iso ? "is-range-start" : "is-range-end");
    } else if (
      calendarState.checkIn &&
      calendarState.checkOut &&
      iso > calendarState.checkIn &&
      iso < calendarState.checkOut
    ) {
      cell.classList.add("is-in-range");
    }

    calGrid.appendChild(cell);
  }

  const today = new Date();
  calPrev.disabled = viewYear === today.getFullYear() && viewMonth === today.getMonth();
}

function handleDayClick(iso, unavailableSet) {
  const { checkIn, checkOut } = calendarState;

  if (!checkIn || (checkIn && checkOut)) {
    calendarState.checkIn = iso;
    calendarState.checkOut = null;
  } else if (iso <= checkIn) {
    calendarState.checkIn = iso;
    calendarState.checkOut = null;
  } else if (rangeHasUnavailable(checkIn, iso, unavailableSet)) {
    calendarState.checkIn = iso;
    calendarState.checkOut = null;
  } else {
    calendarState.checkOut = iso;
  }

  renderCalendar();
  updateSummary();
}

function updateSummary() {
  const { checkIn, checkOut, roomId } = calendarState;
  const room = ROOM_DATA[roomId];

  sumCheckin.textContent = `Check-in: ${checkIn || "—"}`;
  sumCheckout.textContent = `Check-out: ${checkOut || "—"}`;

  if (checkIn && checkOut) {
    const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    const total = nights * room.price;
    sumTotal.textContent = `Total: ₹${total.toLocaleString("en-IN")} for ${nights} night${nights > 1 ? "s" : ""}`;
    datesContinueBtn.disabled = false;
  } else {
    sumTotal.textContent = "Total: —";
    datesContinueBtn.disabled = true;
  }
}

function initCalendarStep(roomId) {
  calendarState.roomId = roomId;
  calendarState.checkIn = null;
  calendarState.checkOut = null;
  const today = new Date();
  calendarState.viewYear = today.getFullYear();
  calendarState.viewMonth = today.getMonth();
  if (roomSelect) roomSelect.value = roomId;
  renderCalendar();
  updateSummary();
}

roomSelect?.addEventListener("change", (e) => {
  calendarState.roomId = e.target.value;
  calendarState.checkIn = null;
  calendarState.checkOut = null;
  renderCalendar();
  updateSummary();
});

calPrev?.addEventListener("click", () => {
  calendarState.viewMonth -= 1;
  if (calendarState.viewMonth < 0) {
    calendarState.viewMonth = 11;
    calendarState.viewYear -= 1;
  }
  renderCalendar();
});

calNext?.addEventListener("click", () => {
  calendarState.viewMonth += 1;
  if (calendarState.viewMonth > 11) {
    calendarState.viewMonth = 0;
    calendarState.viewYear += 1;
  }
  renderCalendar();
});

/* ---- Modal open/close ---- */
const overlay = document.querySelector(".modal-overlay");
const openButtons = document.querySelectorAll("[data-open-booking]");
const closeButton = document.querySelector(".modal-close");

openButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    overlay.classList.add("open");
    const roomId = btn.dataset.roomId || "standard";
    initCalendarStep(roomId);
  })
);
closeButton?.addEventListener("click", () => overlay.classList.remove("open"));
overlay?.addEventListener("click", (e) => {
  if (e.target === overlay) overlay.classList.remove("open");
});

/* ---- Hand off to checkout page ---- */
datesContinueBtn?.addEventListener("click", () => {
  const { roomId, checkIn, checkOut } = calendarState;
  const room = ROOM_DATA[roomId];
  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));

  const draft = {
    roomId,
    roomName: room.name,
    pricePerNight: room.price,
    checkIn,
    checkOut,
    nights,
    total: nights * room.price,
  };

  sessionStorage.setItem("bookingDraft", JSON.stringify(draft));
  window.location.href = "checkout.html";
});

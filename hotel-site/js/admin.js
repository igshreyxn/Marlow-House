/*
  Admin dashboard controller.
  ------------------------------------------------------------------
  Depends on js/shared.js (auth, db, ROOM_DATA, fetchGuestBookedDates,
  fetchAdminBlockedDates, toISODate).

  SECURITY — READ THIS BEFORE GOING LIVE:
  The ADMIN_EMAILS check below is a CLIENT-SIDE convenience only. It
  stops a casual visitor from seeing the dashboard, but it does NOT
  stop someone who edits this JS file in their browser from bypassing
  it entirely. Real protection has to happen server-side:

    1. In Firebase Console, add a custom claim `admin: true` to each
       staff account (via a one-off script using the Admin SDK — this
       can't be done from client-side code).
    2. Write Firestore Security Rules that only allow writes to
       `bookings`, `roomServiceOrders`, `rooms`, and `roomAvailability`
       when `request.auth.token.admin == true`. Example rule:

         match /rooms/{roomId} {
           allow write: if request.auth.token.admin == true;
           allow read: if true;
         }

       Apply the same pattern to the other three collections. Without
       this, ANY signed-in guest could otherwise write to these
       collections directly, regardless of what this admin.html page
       shows or hides.

  DEMO MODE: until Firebase is configured, this page skips real auth
  entirely — any email/password "signs in" — so you can see the
  dashboard and test its panels immediately.
  ------------------------------------------------------------------
*/

const ADMIN_EMAILS = ["sengupta.shreyan9@gmail.com"]; // client-side convenience only — see notice above

// Shown in any panel when a Firestore read/write is blocked because
// this account doesn't have the admin custom claim yet. See the
// "Setting the admin custom claim" instructions in firestore.rules.
function adminPermissionNotice() {
  return `<p style="color:var(--ink-soft)">This account can sign in, but doesn't have full admin access on the server yet — so this data is being blocked from loading. See the "Setting the admin custom claim" steps in <code>firestore.rules</code> to fix this.</p>`;
}

const DEMO_MODE = !(auth && db);

const demoNotice = document.querySelector("#admin-demo-notice");
const loginPanel = document.querySelector("#admin-login-panel");
const dashboard = document.querySelector("#admin-dashboard");
const loginForm = document.querySelector("#admin-login-form");
const loginError = document.querySelector("#admin-login-error");
const signoutBtn = document.querySelector("#admin-signout");

if (DEMO_MODE && demoNotice) demoNotice.style.display = "block";

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.querySelector("#admin-email").value.trim();
  const password = document.querySelector("#admin-password").value;

  if (DEMO_MODE) {
    showDashboard();
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
      await auth.signOut();
      loginError.textContent = "This account doesn't have admin access.";
      loginError.classList.add("show");
      return;
    }
    showDashboard();
  } catch (err) {
    loginError.textContent = getFriendlyAuthError(err);
    loginError.classList.add("show");
  }
});

signoutBtn?.addEventListener("click", async () => {
  if (auth) await auth.signOut();
  dashboard.style.display = "none";
  loginPanel.style.display = "block";
  signoutBtn.style.display = "none";
});

function showDashboard() {
  loginPanel.style.display = "none";
  dashboard.style.display = "block";
  signoutBtn.style.display = "inline-flex";
  loadBookings();
  loadOrders();
  initAvailabilityTab();
  loadRooms();
}

/* ---- Tab switching ---- */
document.querySelectorAll(".admin-tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`.admin-panel[data-panel="${tab.dataset.tab}"]`).classList.add("active");
  })
);

/* ============================================================
   BOOKINGS
   ============================================================ */

const demoBookings = [
  { id: "b1", name: "Priya M.", phone: "+91 98765 43210", email: "priya@example.com", roomName: "The Deluxe", checkIn: "2026-09-25", checkOut: "2026-09-27", nights: 2, total: 18400, message: "High floor if possible, celebrating an anniversary.", status: "confirmed" },
  { id: "b2", name: "Arjun K.", phone: "+91 91234 56789", email: "arjun@example.com", roomName: "The Standard", checkIn: "2026-09-10", checkOut: "2026-09-12", nights: 2, total: 13000, message: "", status: "confirmed" },
];

let currentBookings = [];

async function loadBookings() {
  const listEl = document.querySelector("#admin-bookings-list");
  currentBookings = demoBookings;

  if (!DEMO_MODE) {
    try {
      const snap = await db.collection("bookings").orderBy("createdAt", "desc").get();
      currentBookings = [];
      snap.forEach((doc) => currentBookings.push({ id: doc.id, ...doc.data() }));
    } catch (err) {
      listEl.innerHTML = adminPermissionNotice();
      return;
    }
  }

  renderBookingsList();
}

function renderBookingsList() {
  const listEl = document.querySelector("#admin-bookings-list");

  if (currentBookings.length === 0) {
    listEl.innerHTML = "<p>No bookings yet.</p>";
    return;
  }

  listEl.innerHTML = currentBookings
    .map(
      (b) => `
    <div class="booking-row" style="align-items:flex-start">
      <div>
        <strong>${b.name}</strong> — ${b.roomName}<br>
        <span style="color:var(--ink-soft);font-size:var(--step--1)">
          ${b.checkIn} → ${b.checkOut} (${b.nights} night${b.nights > 1 ? "s" : ""}) · ₹${b.total.toLocaleString("en-IN")}<br>
          ${b.phone} · ${b.email}
        </span>
        ${b.message ? `<div class="admin-message">"${b.message}"</div>` : ""}
        ${b.status === "cancelled" && b.refundAmount != null ? `<div class="admin-message">Refunded ₹${b.refundAmount.toLocaleString("en-IN")}</div>` : ""}
      </div>
      <div style="display:flex;align-items:center;gap:var(--space-sm)">
        <span class="status-pill${b.status === "cancelled" ? " cancelled" : ""}">${b.status}</span>
        ${b.status === "confirmed" ? `<button class="btn btn-ghost admin-cancel-btn" data-id="${b.id}">Cancel</button>` : ""}
      </div>
    </div>
  `
    )
    .join("");

  document.querySelectorAll(".admin-cancel-btn").forEach((btn) =>
    btn.addEventListener("click", () => openAdminCancelModal(btn.dataset.id))
  );
}

/* ---- Cancel & refund modal ---- */
let adminCancelTargetId = null;
const adminCancelModal = document.querySelector("#admin-cancel-modal");
const adminCancelDetails = document.querySelector("#admin-cancel-details");
const adminCancelConfirmBtn = document.querySelector("#admin-cancel-confirm-btn");

function openAdminCancelModal(id) {
  const booking = currentBookings.find((b) => b.id === id);
  if (!booking) return;

  adminCancelTargetId = id;
  const refund = calculateRefund(booking.checkIn, new Date(), booking.total);

  adminCancelDetails.innerHTML = `
    <p><strong>${booking.name}</strong> — ${booking.roomName}</p>
    <p>${booking.checkIn} to ${booking.checkOut}</p>
    <p style="margin-top:var(--space-sm)">
      ${refund.label}: <strong>₹${refund.amount.toLocaleString("en-IN")}</strong> of ₹${booking.total.toLocaleString("en-IN")}
    </p>
  `;
  adminCancelModal.classList.add("open");
}

document.querySelector("#admin-cancel-modal-close")?.addEventListener("click", () => {
  adminCancelModal.classList.remove("open");
});
adminCancelModal?.addEventListener("click", (e) => {
  if (e.target === adminCancelModal) adminCancelModal.classList.remove("open");
});

adminCancelConfirmBtn?.addEventListener("click", async () => {
  const booking = currentBookings.find((b) => b.id === adminCancelTargetId);
  if (!booking) return;

  const refund = calculateRefund(booking.checkIn, new Date(), booking.total);

  booking.status = "cancelled";
  booking.refundAmount = refund.amount;
  booking.refundStatus = "initiated";

  if (!DEMO_MODE) {
    await db.collection("bookings").doc(booking.id).update({
      status: "cancelled",
      refundAmount: refund.amount,
      refundStatus: "initiated", // replace with your payment gateway's refund call — see checkout.js's payment stub
    });

    // Free up the dates on the public calendar — this booking's
    // dates were only unavailable because of this bookedRanges entry.
    if (booking.bookedRangeId) {
      await db.collection("bookedRanges").doc(booking.bookedRangeId).delete();
    }
  }

  adminCancelModal.classList.remove("open");
  renderBookingsList();
});

/* ============================================================
   ROOM SERVICE ORDERS
   ============================================================ */

const demoOrders = [
  { id: "o1", roomNumber: "204", phone: "+91 98765 43210", message: "No onions please.", items: [{ name: "Slow-Roasted Lamb Shank", qty: 1, price: 950 }, { name: "Filter Coffee", qty: 2, price: 150 }], total: 1250, status: "received" },
  { id: "o2", roomNumber: "112", phone: "+91 91234 56789", message: "", items: [{ name: "Citrus & Fennel Salad", qty: 2, price: 340 }], total: 680, status: "delivered" },
];

async function loadOrders() {
  const listEl = document.querySelector("#admin-orders-list");
  let orders = demoOrders;

  if (!DEMO_MODE) {
    try {
      const snap = await db.collection("roomServiceOrders").orderBy("createdAt", "desc").get();
      orders = [];
      snap.forEach((doc) => orders.push({ id: doc.id, ...doc.data() }));
    } catch (err) {
      listEl.innerHTML = adminPermissionNotice();
      return;
    }
  }

  if (orders.length === 0) {
    listEl.innerHTML = "<p>No orders yet.</p>";
    return;
  }

  listEl.innerHTML = orders
    .map(
      (o) => `
    <div class="booking-row" style="align-items:flex-start">
      <div>
        <strong>Room ${o.roomNumber}</strong><br>
        <span style="color:var(--ink-soft);font-size:var(--step--1)">
          ${o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")} · ₹${o.total.toLocaleString("en-IN")}<br>
          ${o.phone}
        </span>
        ${o.message ? `<div class="admin-message">"${o.message}"</div>` : ""}
      </div>
      <select class="order-status-select" data-id="${o.id}">
        <option value="received" ${o.status === "received" ? "selected" : ""}>Received</option>
        <option value="preparing" ${o.status === "preparing" ? "selected" : ""}>Preparing</option>
        <option value="delivered" ${o.status === "delivered" ? "selected" : ""}>Delivered</option>
      </select>
    </div>
  `
    )
    .join("");

  document.querySelectorAll(".order-status-select").forEach((sel) =>
    sel.addEventListener("change", async () => {
      const id = sel.dataset.id;
      const newStatus = sel.value;
      const order = orders.find((o) => o.id === id);
      if (order) order.status = newStatus;

      if (!DEMO_MODE) {
        await db.collection("roomServiceOrders").doc(id).update({ status: newStatus });
      }
    })
  );
}

/* ============================================================
   AVAILABILITY — block/unblock dates per room
   ============================================================ */

// Dates the admin has manually blocked, per room. Loaded from and
// saved to roomAvailability/{roomId}.blockedDates.
const adminBlockedDates = { standard: [], deluxe: [], suite: [] };

// Real guest-booked dates, per room — fetched from bookedRanges
// (written by checkout.js) whenever the selected room changes. Not
// editable here; cancel the booking via the Bookings tab instead.
const adminGuestBookedDates = { standard: [], deluxe: [], suite: [] };

const adminCalState = {
  roomId: "standard",
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  loading: false,
};

const adminRoomSelect = document.querySelector("#admin-room-select");
const adminCalGrid = document.querySelector("#admin-calendar-grid");
const adminCalMonthLabel = document.querySelector(".admin-cal-month-label");
const adminCalPrev = document.querySelector(".admin-cal-prev");
const adminCalNext = document.querySelector(".admin-cal-next");
const adminAvailabilityNote = document.querySelector("#admin-availability-note");

const ADMIN_MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

async function initAvailabilityTab() {
  if (!DEMO_MODE) {
    try {
      for (const roomId of Object.keys(adminBlockedDates)) {
        adminBlockedDates[roomId] = await fetchAdminBlockedDates(roomId);
      }
    } catch (err) {
      adminAvailabilityNote.textContent = "Couldn't load saved blocked dates — showing this session only.";
    }
  }
  await loadGuestBookedDates(adminCalState.roomId);
  renderAdminCalendar();
}

async function loadGuestBookedDates(roomId) {
  adminCalState.loading = true;
  adminCalState.loadError = false;
  renderAdminCalendar();
  try {
    adminGuestBookedDates[roomId] = await fetchGuestBookedDates(roomId);
  } catch (err) {
    console.error("Failed to load guest bookings for calendar:", err);
    adminCalState.loadError = true;
  }
  adminCalState.loading = false;
}

adminRoomSelect?.addEventListener("change", async (e) => {
  adminCalState.roomId = e.target.value;
  await loadGuestBookedDates(adminCalState.roomId);
  renderAdminCalendar();
});

adminCalPrev?.addEventListener("click", () => {
  adminCalState.viewMonth -= 1;
  if (adminCalState.viewMonth < 0) {
    adminCalState.viewMonth = 11;
    adminCalState.viewYear -= 1;
  }
  renderAdminCalendar();
});

adminCalNext?.addEventListener("click", () => {
  adminCalState.viewMonth += 1;
  if (adminCalState.viewMonth > 11) {
    adminCalState.viewMonth = 0;
    adminCalState.viewYear += 1;
  }
  renderAdminCalendar();
});

function renderAdminCalendar() {
  if (!adminCalGrid) return;

  if (adminCalState.loading) {
    adminCalGrid.innerHTML = `<p style="grid-column:1/-1;color:var(--ink-soft);font-size:var(--step--1);padding:var(--space-md) 0">Loading…</p>`;
    return;
  }

  if (adminCalState.loadError) {
    adminCalGrid.innerHTML = `<p style="grid-column:1/-1;color:#A03B3B;font-size:var(--step--1);padding:var(--space-md) 0">Couldn't load guest bookings for this room — check the Firestore rules include bookedRanges.</p>`;
    return;
  }

  const { viewYear, viewMonth, roomId } = adminCalState;
  const guestBooked = new Set(adminGuestBookedDates[roomId]);
  const blocked = new Set(adminBlockedDates[roomId]);

  adminCalMonthLabel.textContent = `${ADMIN_MONTH_NAMES[viewMonth]} ${viewYear}`;

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  adminCalGrid.innerHTML = "";

  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day is-empty";
    adminCalGrid.appendChild(empty);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(viewYear, viewMonth, day);
    const iso = toISODate(date);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-day";
    cell.textContent = String(day);

    if (date < today) {
      cell.classList.add("is-past");
      cell.disabled = true;
    } else if (guestBooked.has(iso)) {
      cell.classList.add("is-unavailable");
      cell.disabled = true;
      cell.title = "Booked by a guest";
    } else if (blocked.has(iso)) {
      cell.style.background = "var(--brass)";
      cell.style.color = "var(--warm-white)";
      cell.addEventListener("click", () => toggleBlockedDate(iso));
    } else {
      cell.classList.add("is-available");
      cell.addEventListener("click", () => toggleBlockedDate(iso));
    }

    adminCalGrid.appendChild(cell);
  }

  const todayDate = new Date();
  adminCalPrev.disabled = viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth();
}

async function toggleBlockedDate(iso) {
  const { roomId } = adminCalState;
  const list = adminBlockedDates[roomId];
  const index = list.indexOf(iso);

  if (index === -1) {
    list.push(iso);
  } else {
    list.splice(index, 1);
  }

  if (!DEMO_MODE) {
    await db.collection("roomAvailability").doc(roomId).set({ blockedDates: list });
    adminAvailabilityNote.textContent = "Saved.";
  } else {
    adminAvailabilityNote.textContent = "Saved for this session only — connect Firebase to persist this.";
  }

  renderAdminCalendar();
}

/* ============================================================
   ROOMS — enable/disable and edit rates
   ============================================================ */

// Demo state layered on top of ROOM_DATA (from shared.js) so this
// tab has something to show and edit before Firestore is connected.
const adminRoomsState = Object.fromEntries(
  Object.entries(ROOM_DATA).map(([id, room]) => [id, { ...room, active: true }])
);

async function loadRooms() {
  if (!DEMO_MODE) {
    try {
      for (const roomId of Object.keys(adminRoomsState)) {
        const doc = await db.collection("rooms").doc(roomId).get();
        if (doc.exists) {
          adminRoomsState[roomId] = { ...adminRoomsState[roomId], ...doc.data() };
        }
      }
    } catch (err) {
      // Falls back to the ROOM_DATA defaults already in adminRoomsState.
    }
  }
  renderRoomsPanel();
}

function renderRoomsPanel() {
  const listEl = document.querySelector("#admin-rooms-list");
  listEl.innerHTML = Object.entries(adminRoomsState)
    .map(
      ([id, room]) => `
    <div class="admin-room-row">
      <div>
        <strong>${room.name}</strong>
        <label class="room-toggle">
          <input type="checkbox" data-id="${id}" class="room-active-toggle" ${room.active ? "checked" : ""}>
          <span>${room.active ? "Bookable" : "Hidden"}</span>
        </label>
      </div>
      <div class="field" style="max-width:180px">
        <label>Price / night</label>
        <input type="number" class="room-price-input" data-id="${id}" value="${room.price}" min="0" step="100">
      </div>
      <button class="btn btn-ghost room-save-btn" data-id="${id}">Save</button>
    </div>
  `
    )
    .join("");

  document.querySelectorAll(".room-save-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const active = document.querySelector(`.room-active-toggle[data-id="${id}"]`).checked;
      const price = Number(document.querySelector(`.room-price-input[data-id="${id}"]`).value);

      adminRoomsState[id].active = active;
      adminRoomsState[id].price = price;

      if (!DEMO_MODE) {
        await db.collection("rooms").doc(id).set({ active, price, name: adminRoomsState[id].name });
      }

      btn.textContent = "Saved";
      setTimeout(() => (btn.textContent = "Save"), 1200);
    })
  );
}

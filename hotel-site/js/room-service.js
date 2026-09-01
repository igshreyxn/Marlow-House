/*
  Room Service menu + cart.
  ------------------------------------------------------------------
  Cart lives in memory (module state) for this page only — on
  "Proceed to Checkout" it's saved to sessionStorage and the guest is
  sent to room-service-checkout.html, mirroring how the room booking
  flow hands off from the date-picker modal to checkout.html.
  ------------------------------------------------------------------
*/

const MENU_ITEMS = [
  { id: "soup", name: "Roasted Tomato Soup", category: "Starters", price: 280, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=500&q=80" },
  { id: "sourdough", name: "Wood-Fired Sourdough & Cultured Butter", category: "Starters", price: 320, image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=500&q=80" },
  { id: "salad", name: "Citrus & Fennel Salad", category: "Starters", price: 340, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=80" },
  { id: "lamb-shank", name: "Slow-Roasted Lamb Shank", category: "Mains", price: 950, image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80" },
  { id: "pasta", name: "Wild Mushroom Tagliatelle", category: "Mains", price: 720, image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=500&q=80" },
  { id: "veg-charred", name: "Charred Seasonal Vegetables", category: "Mains", price: 620, image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=500&q=80" },
  { id: "choc-tart", name: "Dark Chocolate Tart", category: "Desserts", price: 380, image: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=500&q=80" },
  { id: "icecream", name: "Vanilla Bean Ice Cream", category: "Desserts", price: 220, image: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=500&q=80" },
  { id: "coffee", name: "Filter Coffee", category: "Drinks", price: 150, image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=500&q=80" },
  { id: "mocktail", name: "Passionfruit Mocktail", category: "Drinks", price: 280, image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=500&q=80" },
];

const cart = {}; // { itemId: quantity }

const menuContainer = document.querySelector("#menu-container");
const cartItemsEl = document.querySelector("#cart-items");
const cartTotalEl = document.querySelector("#cart-total");
const cartTotalAmountEl = document.querySelector("#cart-total-amount");
const proceedBtn = document.querySelector("#proceed-to-checkout");

function renderMenu() {
  const categories = [...new Set(MENU_ITEMS.map((i) => i.category))];

  menuContainer.innerHTML = categories
    .map(
      (category) => `
    <h3 class="checkout-section-title" style="margin-top:var(--space-lg)">${category}</h3>
    <div class="menu-grid">
      ${MENU_ITEMS.filter((i) => i.category === category)
        .map(
          (item) => `
        <article class="menu-item">
          <div class="menu-item-media"><img src="${item.image}" alt="${item.name}"></div>
          <div class="menu-item-body">
            <h4>${item.name}</h4>
            <span class="price">₹${item.price}</span>
            <button class="btn btn-ghost menu-add-btn" data-id="${item.id}">Add</button>
          </div>
        </article>
      `
        )
        .join("")}
    </div>
  `
    )
    .join("");

  document.querySelectorAll(".menu-add-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      cart[id] = (cart[id] || 0) + 1;
      renderCart();
    })
  );
}

function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  renderCart();
}

function renderCart() {
  const entries = Object.entries(cart);

  if (entries.length === 0) {
    cartItemsEl.innerHTML = `<p style="color:var(--ink-soft);font-size:var(--step--1)">No items yet — add something from the menu.</p>`;
    cartTotalEl.style.display = "none";
    proceedBtn.disabled = true;
    return;
  }

  let total = 0;
  cartItemsEl.innerHTML = entries
    .map(([id, qty]) => {
      const item = MENU_ITEMS.find((i) => i.id === id);
      const lineTotal = item.price * qty;
      total += lineTotal;
      return `
      <div class="cart-row">
        <div>
          <strong>${item.name}</strong><br>
          <span style="color:var(--ink-soft);font-size:var(--step--1)">₹${item.price} each</span>
        </div>
        <div class="qty-stepper">
          <button type="button" data-id="${id}" data-delta="-1">−</button>
          <span>${qty}</span>
          <button type="button" data-id="${id}" data-delta="1">+</button>
        </div>
      </div>
    `;
    })
    .join("");

  cartTotalEl.style.display = "flex";
  cartTotalAmountEl.textContent = `₹${total.toLocaleString("en-IN")}`;
  proceedBtn.disabled = false;

  document.querySelectorAll(".qty-stepper button").forEach((btn) =>
    btn.addEventListener("click", () => changeQty(btn.dataset.id, Number(btn.dataset.delta)))
  );
}

proceedBtn?.addEventListener("click", () => {
  const items = Object.entries(cart).map(([id, qty]) => {
    const item = MENU_ITEMS.find((i) => i.id === id);
    return { id, name: item.name, price: item.price, qty };
  });
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  sessionStorage.setItem("roomServiceDraft", JSON.stringify({ items, total }));
  window.location.href = "room-service-checkout.html";
});

renderMenu();
renderCart();

/* ============================================================
   DETECCIÓN DE ENTORNO TELEGRAM / STANDALONE
============================================================ */
const isTelegram = Boolean(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
const tg = isTelegram ? window.Telegram.WebApp : null;

// Inicialización de Telegram
if (isTelegram) {
  tg.ready();
  tg.expand();
  // Sincronizar colores del sistema
  if (tg.setHeaderColor) {
    tg.setHeaderColor(tg.themeParams?.secondary_bg_color || "#f4f4f7");
  }
}

// Función auxiliar para vibración háptica (solo en Telegram)
function triggerHaptic(style = "light") {
  if (isTelegram && tg.HapticFeedback) {
    tg.HapticFeedback.impactOccurred(style);
  }
}

// Saludo personalizado con el nombre del usuario de Telegram
const userGreeting = document.getElementById("userGreeting");
if (isTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user) {
  userGreeting.innerText = `¡Hola, ${tg.initDataUnsafe.user.first_name}! 👋`;
}

/* ============================================================
   CATÁLOGO DE PRODUCTOS (Extensible)
============================================================ */
const products = [
  { id: 101, name: "Camiseta Vintage 90s", cat: "ropa", price: 14.50, desc: "Algodón 100% orgánico, corte holgado.", emoji: "👕" },
  { id: 102, name: "Sudadera Minimalist", cat: "ropa", price: 29.99, desc: "Interior afelpado con capucha.", emoji: "🧥" },
  { id: 103, name: "Taza de Cerámica Artesanal", cat: "hogar", price: 7.50, desc: "Acabado mate, apta para microondas.", emoji: "☕" },
  { id: 104, name: "Lámpara Nórdica LED", cat: "hogar", price: 22.00, desc: "3 intensidades de luz cálida.", emoji: "💡" },
  { id: 105, name: "Gorra Urbana Classic", cat: "accesorios", price: 11.00, desc: "Ajustable con cierre metálico.", emoji: "🧢" },
  { id: 106, name: "Mochila Impermeable", cat: "accesorios", price: 34.00, desc: "Compartimento para portátil de 15'.", emoji: "🎒" }
];

let cart = {};
let currentCategory = "all";
let currentSearch = "";

/* ============================================================
   RENDERIZADO
============================================================ */
function renderProducts() {
  const container = document.getElementById("catalogGrid");
  const emptyState = document.getElementById("emptyState");
  container.innerHTML = "";

  const filtered = products.filter(p => {
    const matchesCat = currentCategory === "all" || p.cat === currentCategory;
    const matchesQuery = p.name.toLowerCase().includes(currentSearch.toLowerCase()) || 
                         p.desc.toLowerCase().includes(currentSearch.toLowerCase());
    return matchesCat && matchesQuery;
  });

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }

  filtered.forEach(p => {
    const qty = cart[p.id] || 0;
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="card-img-placeholder">${p.emoji}</div>
      <div class="card-title">${p.name}</div>
      <div class="card-desc">${p.desc}</div>
      <div class="card-footer">
        <span class="card-price">${p.price.toFixed(2)} €</span>
        <div class="counter-box">
          <button class="btn-step" onclick="updateItemQty(${p.id}, -1)">−</button>
          <span class="qty-val" id="qty-${p.id}">${qty}</span>
          <button class="btn-step" onclick="updateItemQty(${p.id}, 1)">+</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

/* ============================================================
   LÓGICA DEL CARRITO
============================================================ */
window.updateItemQty = function(id, delta) {
  triggerHaptic(delta > 0 ? "medium" : "light");
  
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];

  const qtyEl = document.getElementById(`qty-${id}`);
  if (qtyEl) qtyEl.innerText = cart[id] || 0;

  syncCartUI();
};

function syncCartUI() {
  let total = 0;
  let count = 0;

  for (const [id, qty] of Object.entries(cart)) {
    const item = products.find(p => p.id === parseInt(id));
    if (item) {
      total += item.price * qty;
      count += qty;
    }
  }

  // Actualizar insignia superior
  document.getElementById("cartCountBadge").innerText = count;

  // Si está dentro de Telegram: usamos el MainButton oficial
  if (isTelegram) {
    if (count > 0) {
      tg.MainButton.setText(`VER PEDIDO (${total.toFixed(2)} €)`);
      tg.MainButton.show();
    } else {
      tg.MainButton.hide();
    }
  } 
  // Si está fuera de Telegram (navegador normal): mostramos barra inferior flotante
  else {
    const standaloneBar = document.getElementById("standaloneCheckoutBar");
    document.getElementById("standaloneTotal").innerText = `${total.toFixed(2)} €`;
    if (count > 0) {
      standaloneBar.classList.add("visible");
    } else {
      standaloneBar.classList.remove("visible");
    }
  }
}

/* ============================================================
   FINALIZACIÓN DEL PEDIDO
============================================================ */
function executeCheckout() {
  const orderItems = [];
  let total = 0;

  for (const [id, qty] of Object.entries(cart)) {
    const item = products.find(p => p.id === parseInt(id));
    if (item) {
      orderItems.push({
        id: item.id,
        nombre: item.name,
        cantidad: qty,
        subtotal: item.price * qty
      });
      total += item.price * qty;
    }
  }

  const payload = {
    tipo: "PEDIDO_MINI_APP",
    articulos: orderItems,
    total: total
  };

  if (isTelegram) {
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    // Envía el JSON directo al bot y cierra la web
    tg.sendData(JSON.stringify(payload));
    tg.close();
  } else {
    // Modo web fuera de Telegram: simulación
    alert("¡Pedido realizado con éxito!\n\n" + JSON.stringify(payload, null, 2));
    cart = {};
    syncCartUI();
    renderProducts();
  }
}

// Asignar eventos de envío
if (isTelegram) {
  tg.MainButton.onClick(executeCheckout);
}
document.getElementById("btnStandalonePay").addEventListener("click", executeCheckout);

/* ============================================================
   EVENTOS DE FILTRO Y BÚSQUEDA
============================================================ */
document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", (e) => {
    triggerHaptic("light");
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    e.target.classList.add("active");
    currentCategory = e.target.getAttribute("data-cat");
    renderProducts();
  });
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  currentSearch = e.target.value.trim();
  renderProducts();
});

// Render inicial
renderProducts();
syncCartUI();
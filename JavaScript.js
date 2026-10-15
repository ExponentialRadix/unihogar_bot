const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

function haptic(type = "light") {
  if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred(type);
}

// Variables Globales
let appData = {
  items: [],
  stats: { total_items: 0, total_val: 0.0 },
  isAdmin: false
};
let cart = {};
let searchQuery = "";

// 1. Extraer los datos reales inyectados por el bot en el URL hash
function loadInjectedData() {
  try {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const rawData = params.get("data");

    if (rawData) {
      const decoded = decodeURIComponent(escape(atob(rawData)));
      appData = JSON.parse(decoded);
    }
  } catch (err) {
    console.warn("Modo local o sin datos inyectados, usando datos de prueba:", err);
    // Datos de fallback si se abre directamente en el navegador sin el bot
    appData = {
      items: [
        { id: 1, nombre: "Artículo Demo 1", descripcion: "Ejemplo de prueba", precio: 10.0 },
        { id: 2, nombre: "Artículo Demo 2", descripcion: "Ejemplo de prueba", precio: 25.5 }
      ],
      stats: { total_items: 2, total_val: 35.5 },
      isAdmin: true
    };
  }

  setupInterface();
}

// 2. Configurar la interfaz según el rol
function setupInterface() {
  if (appData.isAdmin) {
    document.getElementById("roleBadge").innerText = "Administrador 👑";
    document.getElementById("tabAdminBtn").classList.remove("hidden");
  } else {
    document.getElementById("roleBadge").innerText = "Cliente";
  }

  // Actualizar estadísticas
  document.getElementById("statTotalItems").innerText = appData.stats.total_items;
  document.getElementById("statTotalValue").innerText = `${appData.stats.total_val.toFixed(2)} €`;

  renderCatalog();
}

// 3. Renderizar Catálogo
function renderCatalog() {
  const container = document.getElementById("productList");
  const emptyState = document.getElementById("emptyCatalog");
  container.innerHTML = "";

  const filtered = appData.items.filter(item => {
    const name = item.nombre || "";
    const desc = item.descripcion || "";
    return name.toLowerCase().includes(searchQuery) || desc.toLowerCase().includes(searchQuery);
  });

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  filtered.forEach(p => {
    const qty = cart[p.id] || 0;
    const card = document.createElement("div");
    card.className = "prod-card";

    // Botón de eliminar solo visible si eres Admin
    const deleteBtn = appData.isAdmin 
      ? `<button class="btn-del-item" onclick="deleteProduct(${p.id})">🗑️</button>` 
      : "";

    card.innerHTML = `
      <div class="prod-details">
        <h4>${p.nombre}</h4>
        <p>${p.descripcion || "Sin descripción"}</p>
        <span class="prod-price">${p.precio.toFixed(2)} €</span>
      </div>
      <div class="prod-actions">
        ${deleteBtn}
        <button class="btn-qty" onclick="changeQty(${p.id}, -1)">-</button>
        <span class="qty-number" id="qty-${p.id}">${qty}</span>
        <button class="btn-qty" onclick="changeQty(${p.id}, 1)">+</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// 4. Gestión del Carrito y MainButton de Telegram
window.changeQty = function(id, delta) {
  haptic(delta > 0 ? "medium" : "light");
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];

  const qtyEl = document.getElementById(`qty-${id}`);
  if (qtyEl) qtyEl.innerText = cart[id] || 0;

  syncCart();
};

function syncCart() {
  let total = 0;
  let count = 0;

  for (const [id, qty] of Object.entries(cart)) {
    const item = appData.items.find(p => p.id === parseInt(id));
    if (item) {
      total += item.precio * qty;
      count += qty;
    }
  }

  document.getElementById("cartCount").innerText = count;

  if (tg) {
    if (count > 0) {
      tg.MainButton.setText(`ENVIAR PEDIDO (${total.toFixed(2)} €)`);
      tg.MainButton.show();
    } else {
      tg.MainButton.hide();
    }
  }
}

// 5. Finalizar Pedido
if (tg) {
  tg.MainButton.onClick(() => {
    const orderItems = [];
    let total = 0;

    for (const [id, qty] of Object.entries(cart)) {
      const item = appData.items.find(p => p.id === parseInt(id));
      if (item) {
        orderItems.push({ id: item.id, nombre: item.nombre, cantidad: qty, subtotal: item.precio * qty });
        total += item.precio * qty;
      }
    }

    tg.HapticFeedback?.notificationOccurred("success");
    tg.sendData(JSON.stringify({
      accion: "PEDIDO",
      articulos: orderItems,
      total: total
    }));
    tg.close();
  });
}

// 6. Acción Admin: Eliminar Producto
window.deleteProduct = function(id) {
  if (!confirm("¿Deseas eliminar este producto de la base de datos?")) return;
  
  if (tg) {
    tg.HapticFeedback?.notificationOccurred("warning");
    tg.sendData(JSON.stringify({
      accion: "BORRAR_PRODUCTO",
      id: id
    }));
    tg.close();
  }
};

// 7. Acción Admin: Formulario de Alta
document.getElementById("addProductForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("newProdName").value.trim();
  const desc = document.getElementById("newProdDesc").value.trim();
  const price = parseFloat(document.getElementById("newProdPrice").value);

  if (tg) {
    tg.HapticFeedback?.notificationOccurred("success");
    tg.sendData(JSON.stringify({
      accion: "CREAR_PRODUCTO",
      nombre: name,
      descripcion: desc,
      precio: price
    }));
    tg.close();
  }
});

// Navegación entre pestañas
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    haptic("light");
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  searchQuery = e.target.value.toLowerCase().trim();
  renderCatalog();
});

// Inicio
loadInjectedData();
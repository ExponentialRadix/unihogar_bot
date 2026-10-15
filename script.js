function loadInjectedData() {
  try {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const rawData = params.get("data");

    if (rawData) {
      // URLSearchParams ya decodifica la URL automáticamente
      appData = JSON.parse(rawData);
    } else {
      throw new Error("No hay datos en el hash");
    }
  } catch (err) {
    console.warn("Cargando modo demo o fallback:", err);
    appData = {
      items: [],
      stats: { total_items: 0, total_val: 0.0 },
      isAdmin: false
    };
  }

  setupInterface();
}
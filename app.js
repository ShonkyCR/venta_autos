// Detectar automáticamente el backend disponible
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? (window.location.port === '3000' ? '' : 'http://localhost:3000')
  : '';

const ASSETS = 'assets/';

// Estado global de la aplicación
const state = {
  vehicles: [],
  user: null,
  token: localStorage.getItem('autofolioToken') || null,
  activeTab: 'vehicles',
  users: []
};

const app = document.querySelector('#app');

// Barra de carga superior
function triggerLoading() {
  const bar = document.querySelector('#loading-bar');
  if (!bar) return;
  bar.classList.remove('active');
  bar.style.width = '35%';
  bar.style.opacity = '1';
}

function finishLoading() {
  const bar = document.querySelector('#loading-bar');
  if (!bar) return;
  bar.style.width = '100%';
  setTimeout(() => {
    bar.style.opacity = '0';
    setTimeout(() => { bar.style.width = '0%'; }, 300);
  }, 200);
}

// Formato de moneda por defecto a Colones Costa Rica (CRC)
function money(v, c = 'CRC') {
  const symbol = c === 'USD' ? '$' : '₡';
  return `${symbol}${Number(v || 0).toLocaleString('es-CR')}`;
}

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

function imagePath(name) {
  if (!name) return `${ASSETS}sedan.jpeg`;
  if (name.startsWith('http://') || name.startsWith('https://') || name.startsWith('data:')) {
    return name;
  }
  return `${ASSETS}${name}`;
}

// Interacción flexible con API Node.js o PHP/XAMPP
async function apiFetch(endpoint, method = 'GET', body = null) {
  triggerLoading();
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  let url = `${API_BASE}${endpoint}`;

  if (window.location.pathname.includes('/venta_autos') && window.location.port !== '3000') {
    let cleanEndpoint = endpoint.replace('/api/', '');
    let parts = cleanEndpoint.split('/');
    let routeName = parts[0];
    let routeId = parts[1] ? `&id=${parts[1]}` : '';

    if (routeName === 'auth') routeName = parts[1];

    url = `api.php?endpoint=${routeName}${routeId}`;
  }

  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    if (!contentType.includes('application/json') && !url.includes('api.php')) {
      let phpUrl = `api.php?endpoint=${endpoint.replace('/api/', '').split('/')[0]}`;
      const resPhp = await fetch(phpUrl, options);
      if (resPhp.ok) {
        finishLoading();
        return await resPhp.json();
      }
      throw new Error('Servidor de base de datos no disponible.');
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error en la solicitud');
    }
    finishLoading();
    return data;
  } catch (err) {
    finishLoading();
    console.error(`API Error (${endpoint}):`, err);
    throw err;
  }
}

// Cargar vehículos desde MySQL
async function loadVehicles() {
  try {
    const data = await apiFetch('/api/vehicles');
    state.vehicles = Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Error cargando vehículos:', err.message);
  }
}

// Verificar sesión del usuario
async function checkAuth() {
  if (!state.token) {
    state.user = null;
    return false;
  }
  try {
    const res = await apiFetch('/api/auth/me');
    state.user = res.user;
    return true;
  } catch (err) {
    state.token = null;
    state.user = null;
    localStorage.removeItem('autofolioToken');
    return false;
  }
}

// --- COMPONENTES DE INTERFAZ ---

function header(admin = false) {
  return `
  <header>
    <div class="container nav">
      <a class="brand" href="#/">
        <div class="brand-mark"><i class="fa-solid fa-car"></i></div>
        <div>
          <span class="brand-name">AutoFolio<span>.cr</span></span>
          <span class="brand-sub">${admin ? 'panel administrativo' : 'movilidad con criterio'}</span>
        </div>
      </a>

      <button class="mobile-toggle" id="mobile-toggle" aria-label="Menú">
        <i class="fa-solid fa-bars"></i>
      </button>

      ${admin ? `
        <div class="nav-links" id="nav-links">
          ${state.user ? `<span class="user-badge"><i class="fa-solid fa-user-gear"></i> ${esc(state.user.username)} (${esc(state.user.role)})</span>` : ''}
          <a class="muted-link" href="#/" style="font-size:13px"><i class="fa-solid fa-arrow-up-right-from-square"></i> Sitio público</a>
          <button id="btn-logout" class="button outline" style="padding:6px 14px; font-size:11px"><i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión</button>
        </div>
      ` : `
        <nav class="nav-links" id="nav-links">
          <a href="#/catalog"><i class="fa-solid fa-car-side"></i> Autos Disponibles</a>
          <a href="#/how"><i class="fa-solid fa-sliders"></i> Cómo funciona</a>
          <a href="#/contact"><i class="fa-solid fa-address-book"></i> Contacto</a>
          <a class="muted-link" href="#/admin" style="font-size:13px"><i class="fa-solid fa-lock"></i> Panel admin</a>
          <a class="button" href="#/catalog">Ver Autos Disponibles <i class="fa-solid fa-arrow-right"></i></a>
        </nav>
      `}
    </div>
  </header>`;
}

function bindNavToggle() {
  const toggle = document.querySelector('#mobile-toggle');
  const links = document.querySelector('#nav-links');
  if (toggle && links) {
    toggle.onclick = () => links.classList.toggle('open');
  }
}

function footer() {
  return `
  <footer class="footer" style="border-top: 1px solid var(--line); padding: 40px 0; margin-top: 60px;">
    <div class="container" style="display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:center;">
      <div>
        <b class="font-display" style="font-size:16px;color:#dbe4df">AutoFolio<span style="color:var(--gold)">.cr</span></b>
        <div style="margin-top:4px; font-size:13px; color:var(--muted)">Movilidad con criterio · Escazú, San José, Costa Rica</div>
      </div>
      <span style="font-size:12px; color:var(--muted)">© 2026 AutoFolio CR · Precios en Colones (CRC) · MySQL venta_autos</span>
    </div>
  </footer>`;
}

function vehicleCard(v) {
  return `
  <a class="vehicle-card animate-fade" href="#/vehicle/${v.id}">
    <div class="vehicle-photo">
      <img src="${imagePath(v.image)}" alt="${esc(v.brand)} ${esc(v.model)}">
      <div class="vehicle-top">
        <span class="badge"><i class="fa-solid fa-circle-check"></i> ${esc(v.status)}</span>
        ${v.featured ? '<span class="badge dark"><i class="fa-solid fa-star"></i> Destacado</span>' : ''}
      </div>
      <div class="vehicle-bottom">
        <small>${v.year} · ${esc(v.vehicleType)}</small>
        <h3>${esc(v.brand)} <span style="color:#d0ddd7">${esc(v.model)}</span> <span style="float:right;color:var(--gold)"><i class="fa-solid fa-arrow-up-right-from-square"></i></span></h3>
      </div>
    </div>
    <div class="vehicle-meta">
      <strong class="vehicle-price">${money(v.price, v.currency || 'CRC')}</strong>
      <span class="vehicle-specs"><i class="fa-solid fa-gauge-high"></i> ${Number(v.mileage || 0).toLocaleString()} km · <i class="fa-solid fa-gears"></i> ${v.transmission === 'Automática' ? 'Auto' : 'Manual'}</span>
    </div>
  </a>`;
}

// --- VISTAS ---

function home() {
  const featured = state.vehicles.filter(v => v.featured);
  const displayVehicles = featured.length ? featured.slice(0, 3) : state.vehicles.slice(0, 3);

  return `
  <div class="site-shell site-grid animate-fade">
    ${header()}
    <main>
      <!-- HERO -->
      <section class="hero">
        <div class="container hero-inner">
          <div>
            <div class="eyebrow"><i class="fa-solid fa-location-dot"></i> &nbsp; San José · Costa Rica</div>
            <h1>El próximo capítulo de tu <span>movilidad.</span></h1>
            <p class="hero-copy">Una selección exclusiva de autos inspeccionados, historial verificado y precios transparentes en colones (CRC).</p>
            <form class="searchbar" id="hero-search">
              <span style="color:#7e948d"><i class="fa-solid fa-magnifying-glass"></i></span>
              <input name="q" placeholder="Busca por marca, modelo o tipo...">
              <button class="button" type="submit">Buscar</button>
            </form>
            <div style="display:flex;gap:20px;margin-top:24px;color:#9eaea9;font-size:12px;flex-wrap:wrap;">
              <span><i class="fa-solid fa-shield-halved" style="color:var(--gold)"></i> Compra con respaldo</span>
              <span><i class="fa-solid fa-circle-check" style="color:var(--green)"></i> Inspección certificada</span>
              <span><i class="fa-solid fa-file-invoice-dollar" style="color:var(--gold)"></i> Financiamiento disponible</span>
            </div>
          </div>
          <div class="hero-photo">
            <img src="${imagePath('luxury-black.jpeg')}" alt="Vehículo premium">
            <span class="photo-label"><i class="fa-solid fa-gem"></i> &nbsp; Colección Costa Rica</span>
            <div class="photo-bottom">
              <div>
                <span class="eyebrow">Disponible esta semana</span>
                <h2 style="font:600 22px 'Space Grotesk'; margin:4px 0 0">BMW X5 xDrive40i</h2>
              </div>
              <span class="price-pill">₡36,800,000</span>
            </div>
          </div>
        </div>
      </section>

      <!-- CINTA EN MOVIMIENTO INFINITO DE MARCAS -->
      <section class="brand-ticker-section">
        <div class="brand-ticker-title"><i class="fa-solid fa-award"></i> Marcas con las que trabajamos y respaldamos</div>
        <div class="ticker-wrap">
          <div class="ticker-track">
            <div class="ticker-item"><i class="fa-solid fa-car"></i> Toyota</div>
            <div class="ticker-item"><i class="fa-solid fa-car-side"></i> BMW</div>
            <div class="ticker-item"><i class="fa-solid fa-car"></i> Mercedes-Benz</div>
            <div class="ticker-item"><i class="fa-solid fa-car-side"></i> Ford</div>
            <div class="ticker-item"><i class="fa-solid fa-car"></i> Hyundai</div>
            <div class="ticker-item"><i class="fa-solid fa-car-side"></i> Audi</div>
            <div class="ticker-item"><i class="fa-solid fa-car"></i> Nissan</div>
            <div class="ticker-item"><i class="fa-solid fa-car-side"></i> Honda</div>
            <div class="ticker-item"><i class="fa-solid fa-car"></i> Lexus</div>
            <div class="ticker-item"><i class="fa-solid fa-car-side"></i> Chevrolet</div>
            <div class="ticker-item"><i class="fa-solid fa-car"></i> Toyota</div>
            <div class="ticker-item"><i class="fa-solid fa-car-side"></i> BMW</div>
            <div class="ticker-item"><i class="fa-solid fa-car"></i> Mercedes-Benz</div>
            <div class="ticker-item"><i class="fa-solid fa-car-side"></i> Ford</div>
            <div class="ticker-item"><i class="fa-solid fa-car"></i> Hyundai</div>
            <div class="ticker-item"><i class="fa-solid fa-car-side"></i> Audi</div>
            <div class="ticker-item"><i class="fa-solid fa-car"></i> Nissan</div>
            <div class="ticker-item"><i class="fa-solid fa-car-side"></i> Honda</div>
            <div class="ticker-item"><i class="fa-solid fa-car"></i> Lexus</div>
            <div class="ticker-item"><i class="fa-solid fa-car-side"></i> Chevrolet</div>
          </div>
        </div>
      </section>

      <!-- SECCIÓN: AUTOS DISPONIBLES DESTACADOS -->
      <section class="section container">
        <div class="section-head">
          <div>
            <div class="eyebrow">Selección curada</div>
            <h2>Autos Disponibles Destacados (${state.vehicles.length} totales)</h2>
          </div>
          <a class="muted-link" href="#/catalog" style="font-size:13px;color:var(--gold)">Ver todos los Autos Disponibles <i class="fa-solid fa-arrow-right"></i></a>
        </div>
        <div class="vehicle-grid">
          ${displayVehicles.length ? displayVehicles.map(vehicleCard).join('') : `
            <div style="grid-column:1/-1; padding:30px; background:var(--card); border-radius:12px; border:1px solid var(--line); text-align:center;">
              <p style="color:var(--gold); font-weight:bold;">Cargando catálogo desde MySQL...</p>
            </div>
          `}
        </div>
      </section>

      <!-- SECCIÓN: CÓMO FUNCIONA -->
      <section class="section container" id="how">
        <div class="section-head">
          <div>
            <div class="eyebrow">Proceso Transparente</div>
            <h2>¿Cómo funciona comprar tu vehículo con nosotros?</h2>
            <p style="color:var(--muted); max-width:600px; margin-top:8px">Un modelo de compra moderno, ágil y centrado en la tranquilidad del cliente.</p>
          </div>
        </div>

        <div class="steps-grid">
          <div class="step-card">
            <i class="fa-solid fa-magnifying-glass-location step-icon"></i>
            <h3>01. Explora el Catálogo</h3>
            <p>Revisa la lista de autos disponibles en nuestra plataforma con precios reales en colones e información técnica verificada.</p>
          </div>
          <div class="step-card">
            <i class="fa-solid fa-clipboard-check step-icon"></i>
            <h3>02. Inspección Certificada</h3>
            <p>Cada vehículo pasa por una rigurosa revisión mecánica de 150 puntos para certificar que el auto está listo para rodar.</p>
          </div>
          <div class="step-card">
            <i class="fa-solid fa-key step-icon"></i>
            <h3>03. Prueba de Manejo</h3>
            <p>Coordinamos una cita personalizada o videollamada interactiva para que pruebes el auto a tu propio ritmo.</p>
          </div>
          <div class="step-card">
            <i class="fa-solid fa-handshake step-icon"></i>
            <h3>04. Traspaso y Entrega</h3>
            <p>Gestionamos la documentación legal, opciones de financiamiento y la entrega inmediata con garantía garantizada.</p>
          </div>
        </div>
      </section>

      <!-- SECCIÓN: CONTACTO DIRECTO (SOLO DATOS Y WHATSAPP) -->
      <section class="section container" id="contact">
        <div class="section-head">
          <div>
            <div class="eyebrow"><i class="fa-solid fa-address-book"></i> Atención Personalizada</div>
            <h2>Ponte en contacto con nosotros</h2>
            <p style="color:var(--muted); max-width:600px; margin-top:8px">Estamos listos para atenderte directamente por teléfono, correo o conversación en WhatsApp.</p>
          </div>
        </div>

        <div class="contact-grid">
          <div>
            <h3 style="font:600 24px 'Space Grotesk'; margin:0 0 12px">Información del Propietario</h3>
            <p style="color:var(--muted); font-size:14px; line-height:1.6">
              Visítanos en nuestro showroom o escríbenos directamente a través de WhatsApp para recibir atención inmediata sobre cualquiera de nuestros autos disponibles.
            </p>

            <div class="contact-info-list">
              <div class="contact-info-item">
                <div class="contact-icon"><i class="fa-solid fa-phone"></i></div>
                <div>
                  <small style="color:var(--muted); font-size:11px; text-transform:uppercase">Llamada / Teléfono Directo</small>
                  <div style="font-weight:700; font-size:16px">+506 8888-9999 &nbsp;/&nbsp; +506 8000-0000</div>
                </div>
              </div>

              <div class="contact-info-item">
                <div class="contact-icon"><i class="fa-solid fa-envelope"></i></div>
                <div>
                  <small style="color:var(--muted); font-size:11px; text-transform:uppercase">Correo Electrónico</small>
                  <div style="font-weight:700; font-size:15px">contacto@autofolio.cr / gerencia@autofolio.cr</div>
                </div>
              </div>

              <div class="contact-info-item">
                <div class="contact-icon"><i class="fa-solid fa-location-dot"></i></div>
                <div>
                  <small style="color:var(--muted); font-size:11px; text-transform:uppercase">Ubicación Showroom</small>
                  <div style="font-weight:700; font-size:15px">Escazú, San José, Costa Rica</div>
                </div>
              </div>

              <div class="contact-info-item">
                <div class="contact-icon"><i class="fa-solid fa-clock"></i></div>
                <div>
                  <small style="color:var(--muted); font-size:11px; text-transform:uppercase">Horario de Atención</small>
                  <div style="font-weight:700; font-size:15px">Lunes a Sábado: 8:00 AM – 6:00 PM</div>
                </div>
              </div>
            </div>
          </div>

          <!-- TARJETA WHATSAPP DIRECTA -->
          <div style="background: rgba(37,211,102,0.06); border: 1px solid rgba(37,211,102,0.25); border-radius: 16px; padding: 32px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
            <div style="width:64px; height:64px; border-radius:50%; background:#25D366; color:white; display:grid; place-items:center; font-size:32px; margin-bottom:16px; box-shadow: 0 10px 20px rgba(37,211,102,0.3);">
              <i class="fa-brands fa-whatsapp"></i>
            </div>
            <h3 style="font:700 24px 'Space Grotesk'; margin:0 0 8px; color:white">Atención Inmediata por WhatsApp</h3>
            <p style="color:var(--muted); font-size:14px; margin-bottom:24px; max-width:380px;">
              Chatea directamente con la gerencia o ventas para consultar precios, citas de prueba de manejo o información de los vehículos.
            </p>
            <a href="https://wa.me/50688889999?text=Hola%20AutoFolio%2C%20quisiera%20m%C3%A1s%20informaci%C3%B3n%20sobre%20los%20autos%20disponibles" target="_blank" class="button" style="background:#25D366; color:white; font-size:14px; padding:16px 28px; width:100%; max-width:320px;">
              <i class="fa-brands fa-whatsapp" style="font-size:18px"></i> Iniciar Conversación por WhatsApp
            </a>
          </div>
        </div>
      </section>
    </main>
    ${footer()}
  </div>`;
}

function catalog() {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const initial = esc(params.get('search') || '');
  return `
  <div class="site-shell animate-fade">
    ${header()}
    <main class="container page-main">
      <a class="back" href="#/"><i class="fa-solid fa-arrow-left"></i> Volver al inicio</a>
      <div style="display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap">
        <div>
          <div class="eyebrow">Elige con intención</div>
          <h1 class="page-title">Autos Disponibles</h1>
          <p style="color:var(--muted); max-width:600px">Explora nuestro catálogo completo con precios expresados en colones costarricenses (₡ CRC).</p>
        </div>
        <span id="count" style="color:var(--muted); font-size:14px">${state.vehicles.length} unidades disponibles</span>
      </div>

      <div class="toolbar">
        <input id="catalog-search" value="${initial}" placeholder="Busca por marca, modelo o palabra clave...">
        <select id="type-filter">
          <option value="Todos">Todos los tipos</option>
          <option value="SUV">SUV</option>
          <option value="Sedán">Sedán</option>
          <option value="Pick-up">Pick-up</option>
          <option value="4x4">4x4</option>
          <option value="Hatchback">Hatchback</option>
        </select>
        <select id="fuel-filter">
          <option value="Todos">Todos los combustibles</option>
          <option value="Gasolina">Gasolina</option>
          <option value="Diésel">Diésel</option>
          <option value="Híbrido">Híbrido</option>
          <option value="Eléctrico">Eléctrico</option>
        </select>
      </div>

      <div id="catalog-grid" class="vehicle-grid"></div>
    </main>
    ${footer()}
  </div>`;
}

function renderCatalog() {
  const grid = document.querySelector('#catalog-grid');
  const search = document.querySelector('#catalog-search');
  const type = document.querySelector('#type-filter');
  const fuel = document.querySelector('#fuel-filter');

  if (!grid) return;

  const render = () => {
    const q = search.value.toLowerCase().trim();
    const list = state.vehicles.filter(v =>
      (!q || `${v.brand} ${v.model} ${v.vehicleType}`.toLowerCase().includes(q)) &&
      (type.value === 'Todos' || v.vehicleType === type.value) &&
      (fuel.value === 'Todos' || v.fuel === fuel.value)
    );

    const countElem = document.querySelector('#count');
    if (countElem) countElem.textContent = `${list.length} unidades visibles`;

    grid.innerHTML = list.length
      ? list.map(vehicleCard).join('')
      : `<div style="grid-column:1/-1; padding:40px; text-align:center; background:var(--card); border-radius:16px; border:1px solid var(--line);">
          <h3 style="font:600 22px 'Space Grotesk';color:white">No se encontraron vehículos</h3>
          <p style="color:var(--muted)">Intenta modificar la búsqueda o limpiar los filtros.</p>
         </div>`;
  };

  [search, type, fuel].forEach(x => x?.addEventListener('input', render));
  render();
}

function detail(id) {
  const v = state.vehicles.find(x => x.id === Number(id)) || state.vehicles[0];
  if (!v) {
    return `<div class="site-shell">${header()}<main class="container page-main"><h2>Vehículo no encontrado.</h2><a href="#/catalog" class="button">Volver a Autos Disponibles</a></main></div>`;
  }

  const imagesList = Array.isArray(v.images) && v.images.length ? v.images : [v.image || 'sedan.jpeg'];

  const waMsg = encodeURIComponent(`Hola AutoFolio, me interesa el ${v.brand} ${v.model} (ID: #${v.id}) por ${money(v.price, v.currency || 'CRC')}. ¿Sigue disponible?`);
  const waLink = `https://wa.me/50688889999?text=${waMsg}`;

  return `
  <div class="site-shell animate-fade">
    ${header()}
    <main class="container page-main">
      <a class="back" href="#/catalog"><i class="fa-solid fa-arrow-left"></i> Volver a Autos Disponibles</a>
      
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:36px; margin-bottom:40px">
        <div class="gallery-container">
          <div class="main-detail-photo">
            <img id="main-detail-img" src="${imagePath(imagesList[0])}" alt="${esc(v.brand)} ${esc(v.model)}">
          </div>

          ${imagesList.length > 1 ? `
            <div>
              <small style="color:var(--muted); font-size:11px; text-transform:uppercase; margin-bottom:8px; display:block;"><i class="fa-solid fa-images"></i> Galería de Fotos (haz clic para ampliar):</small>
              <div class="gallery-thumbnails">
                ${imagesList.map((imgName, idx) => `
                  <div class="gallery-thumb ${idx === 0 ? 'active' : ''}" data-src="${imagePath(imgName)}">
                    <img src="${imagePath(imgName)}" alt="Foto ${idx + 1}">
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div>
          <div class="eyebrow">Ficha técnica · Unidad #${v.id}</div>
          <h1 style="font:700 36px 'Space Grotesk'; margin:8px 0 16px">${esc(v.brand)} <span style="color:#c7d4cf">${esc(v.model)}</span></h1>
          <div style="font:700 30px 'Space Grotesk'; color:var(--gold); margin-bottom:20px">${money(v.price, v.currency || 'CRC')}</div>

          <p style="color:var(--muted); line-height:1.6; margin-bottom:24px">${esc(v.description || 'Sin descripción disponible.')}</p>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:28px">
            <div style="background:var(--card); padding:12px 16px; border-radius:12px; border:1px solid var(--line);">
              <small style="color:var(--muted); font-size:11px">Año</small>
              <div style="font-weight:700">${v.year}</div>
            </div>
            <div style="background:var(--card); padding:12px 16px; border-radius:12px; border:1px solid var(--line);">
              <small style="color:var(--muted); font-size:11px">Kilometraje</small>
              <div style="font-weight:700">${Number(v.mileage || 0).toLocaleString()} km</div>
            </div>
            <div style="background:var(--card); padding:12px 16px; border-radius:12px; border:1px solid var(--line);">
              <small style="color:var(--muted); font-size:11px">Transmisión</small>
              <div style="font-weight:700">${esc(v.transmission)}</div>
            </div>
            <div style="background:var(--card); padding:12px 16px; border-radius:12px; border:1px solid var(--line);">
              <small style="color:var(--muted); font-size:11px">Combustible</small>
              <div style="font-weight:700">${esc(v.fuel)}</div>
            </div>
          </div>

          <a href="${waLink}" target="_blank" class="button" style="width:100%; text-align:center; padding:16px; background:#25D366; color:white;">
            <i class="fa-brands fa-whatsapp" style="font-size:18px"></i> Consultar por WhatsApp
          </a>
        </div>
      </div>
    </main>
    ${footer()}
  </div>`;
}

function bindGalleryThumbnails() {
  const mainImg = document.querySelector('#main-detail-img');
  const thumbs = document.querySelectorAll('.gallery-thumb');
  if (!mainImg || !thumbs.length) return;

  thumbs.forEach(thumb => {
    thumb.onclick = () => {
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      mainImg.style.opacity = '0.3';
      setTimeout(() => {
        mainImg.src = thumb.dataset.src;
        mainImg.style.opacity = '1';
      }, 150);
    };
  });
}

// --- VISTA DE LOGIN Y ADMINISTRACIÓN ---

function loginView(errorMsg = '') {
  return `
  <div class="site-shell animate-fade">
    ${header()}
    <main class="container page-main">
      <div class="login-card">
        <div class="eyebrow" style="text-align:center"><i class="fa-solid fa-lock"></i> Acceso Privado</div>
        <h1 style="font:700 28px 'Space Grotesk'; text-align:center; margin:10px 0 24px">Panel Administrativo</h1>

        ${errorMsg ? `<div class="alert error">${esc(errorMsg)}</div>` : ''}

        <form id="login-form" style="display:flex; flex-direction:column; gap:16px">
          <label style="font-size:12px; color:var(--muted)">
            Usuario o Correo Electrónico
            <input class="form-input" name="username" required placeholder="ej: admin" style="width:100%; margin-top:6px">
          </label>
          <label style="font-size:12px; color:var(--muted)">
            Contraseña
            <input class="form-input" type="password" name="password" required placeholder="••••••••" style="width:100%; margin-top:6px">
          </label>
          <button class="button" type="submit" style="margin-top:10px"><i class="fa-solid fa-right-to-bracket"></i> Ingresar al Panel</button>
        </form>

        <div style="margin-top:20px; padding:12px; background:rgba(233,189,106,.08); border-radius:10px; font-size:12px; color:var(--muted); text-align:center">
          <i class="fa-solid fa-key" style="color:var(--gold)"></i> <b>Credenciales de acceso:</b><br>
          Usuario: <code>admin</code> &nbsp;|&nbsp; Clave: <code>admin123</code>
        </div>
      </div>
    </main>
    ${footer()}
  </div>`;
}

function bindLoginForm() {
  const form = document.querySelector('#login-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      const res = await apiFetch('/api/auth/login', 'POST', data);
      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('autofolioToken', res.token);
      location.hash = '#/admin';
      route();
    } catch (err) {
      app.innerHTML = loginView(err.message);
      bindLoginForm();
    }
  });
}

function adminView() {
  const totals = {
    total: state.vehicles.length,
    published: state.vehicles.filter(v => v.status === 'Publicado').length,
    reserved: state.vehicles.filter(v => v.status === 'Reservado').length,
    value: state.vehicles.reduce((a, v) => a + Number(v.price || 0), 0)
  };

  return `
  <div class="admin-shell animate-fade">
    ${header(true)}
    <main class="container page-main">
      <div class="admin-heading">
        <div>
          <div class="eyebrow">Control General · MySQL (venta_autos)</div>
          <h1 class="page-title">Panel de Control</h1>
          <p style="color:var(--muted); margin:0">Gestiona los autos disponibles en colones (CRC) y los usuarios con acceso.</p>
        </div>
        <div class="admin-actions">
          <button class="button" id="new-vehicle-btn"><i class="fa-solid fa-plus"></i> Agregar Vehículo</button>
        </div>
      </div>

      <div class="tabs-nav">
        <button class="tab-btn ${state.activeTab === 'vehicles' ? 'active' : ''}" id="tab-vehicles"><i class="fa-solid fa-car"></i> Autos Disponibles (${totals.total})</button>
        <button class="tab-btn ${state.activeTab === 'users' ? 'active' : ''}" id="tab-users"><i class="fa-solid fa-users"></i> Usuarios Administradores</button>
      </div>

      ${state.activeTab === 'vehicles' ? `
        <div class="kpi-grid">
          <div class="kpi"><small>Inventario Total</small><strong>${totals.total}</strong><span>unidades guardadas</span></div>
          <div class="kpi"><small>Publicados</small><strong>${totals.published}</strong><span>visibles en catálogo</span></div>
          <div class="kpi"><small>Reservados</small><strong>${totals.reserved}</strong><span>en proceso de cierre</span></div>
          <div class="kpi"><small>Valor Total Inventario</small><strong>${money(totals.value, 'CRC')}</strong><span>monto total CRC</span></div>
        </div>

        <div class="table-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px">
            <div>
              <h2 style="font:600 20px 'Space Grotesk';margin:0">Autos Disponibles en MySQL</h2>
              <p style="color:var(--muted);font-size:12px;margin:4px 0 0">Crear, editar o eliminar unidades de la base de datos.</p>
            </div>
            <input id="admin-search" class="form-input" style="max-width:260px" placeholder="Buscar por marca o modelo...">
          </div>

          <div style="overflow-x:auto">
            <table>
              <thead>
                <tr>
                  <th>Vehículo</th>
                  <th>Precio (CRC)</th>
                  <th>Estado</th>
                  <th>Kilometraje</th>
                  <th style="text-align:right">Acciones</th>
                </tr>
              </thead>
              <tbody id="admin-body"></tbody>
            </table>
          </div>
        </div>
      ` : `
        <div class="table-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
            <div>
              <h2 style="font:600 20px 'Space Grotesk';margin:0">Usuarios Administradores</h2>
              <p style="color:var(--muted);font-size:12px;margin:4px 0 0">Usuarios con acceso al panel administrativo.</p>
            </div>
            <button class="button" id="new-user-btn"><i class="fa-solid fa-plus"></i> Registrar Administrador</button>
          </div>

          <div style="overflow-x:auto">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th style="text-align:right">Acciones</th>
                </tr>
              </thead>
              <tbody id="users-body"></tbody>
            </table>
          </div>
        </div>
      `}
    </main>
    ${footer()}
  </div>`;
}

function statusClass(s) {
  return s === 'Publicado' ? 'published' : s === 'Reservado' ? 'reserved' : s === 'Vendido' ? 'sold' : 'draft';
}

function renderAdmin() {
  bindNavToggle();
  const btnLogout = document.querySelector('#btn-logout');
  if (btnLogout) {
    btnLogout.onclick = async () => {
      try {
        await apiFetch('/api/auth/logout', 'POST');
      } catch (e) { }
      state.token = null;
      state.user = null;
      localStorage.removeItem('autofolioToken');
      location.hash = '#/login';
      route();
    };
  }

  const tabVehicles = document.querySelector('#tab-vehicles');
  const tabUsers = document.querySelector('#tab-users');
  if (tabVehicles) tabVehicles.onclick = () => { state.activeTab = 'vehicles'; route(); };
  if (tabUsers) tabUsers.onclick = () => { state.activeTab = 'users'; route(); };

  if (state.activeTab === 'vehicles') {
    renderVehicleTable();
    const newBtn = document.querySelector('#new-vehicle-btn');
    if (newBtn) newBtn.onclick = () => openVehicleModal();
  } else {
    renderUsersTable();
    const newUserBtn = document.querySelector('#new-user-btn');
    if (newUserBtn) newUserBtn.onclick = () => openUserModal();
  }
}

function renderVehicleTable() {
  const body = document.querySelector('#admin-body');
  const search = document.querySelector('#admin-search');
  if (!body) return;

  const render = () => {
    const q = (search?.value || '').toLowerCase();
    const list = state.vehicles.filter(v => `${v.brand} ${v.model}`.toLowerCase().includes(q));

    body.innerHTML = list.length ? list.map(v => `
      <tr>
        <td>
          <img src="${imagePath(v.image)}">
          <b>${esc(v.brand)} ${esc(v.model)}</b>
          <small style="display:block;color:#71847d;margin-left:78px">#${v.id} · ${v.year} · ${esc(v.vehicleType)} · ${Array.isArray(v.images) ? v.images.length : 1} foto(s)</small>
        </td>
        <td>${money(v.price, v.currency || 'CRC')}</td>
        <td><span class="status ${statusClass(v.status)}">${esc(v.status)}</span></td>
        <td>${Number(v.mileage || 0).toLocaleString()} km</td>
        <td style="text-align:right">
          <button class="icon-btn edit-btn" data-id="${v.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn delete-btn" data-id="${v.id}" title="Eliminar" style="color:var(--red)"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('') : `<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:30px">No hay vehículos registrados en la base de datos.</td></tr>`;

    body.querySelectorAll('.edit-btn').forEach(b => {
      b.onclick = () => {
        const item = state.vehicles.find(v => v.id === Number(b.dataset.id));
        if (item) openVehicleModal(item);
      };
    });

    body.querySelectorAll('.delete-btn').forEach(b => {
      b.onclick = async () => {
        const id = Number(b.dataset.id);
        const item = state.vehicles.find(v => v.id === id);
        if (confirm(`¿Eliminar permanentemente el vehículo "${item?.brand} ${item?.model}" (#${id}) de MySQL?`)) {
          try {
            await apiFetch(`/api/vehicles/${id}`, 'DELETE');
            state.vehicles = state.vehicles.filter(v => v.id !== id);
            renderVehicleTable();
          } catch (err) {
            alert('Error eliminando vehículo: ' + err.message);
          }
        }
      };
    });
  };

  if (search) search.oninput = render;
  render();
}

async function renderUsersTable() {
  const body = document.querySelector('#users-body');
  if (!body) return;

  try {
    const users = await apiFetch('/api/users');
    state.users = users;

    body.innerHTML = users.map(u => `
      <tr>
        <td>#${u.id}</td>
        <td><b>${esc(u.username)}</b></td>
        <td>${esc(u.email)}</td>
        <td><span class="badge dark">${esc(u.role)}</span></td>
        <td style="text-align:right">
          ${u.id === state.user?.id ? '<small style="color:var(--muted)">Sesión activa</small>' : `
            <button class="button danger delete-user-btn" data-id="${u.id}" style="padding:4px 10px; font-size:11px"><i class="fa-solid fa-trash"></i> Eliminar</button>
          `}
        </td>
      </tr>
    `).join('');

    body.querySelectorAll('.delete-user-btn').forEach(b => {
      b.onclick = async () => {
        const id = Number(b.dataset.id);
        if (confirm(`¿Eliminar este usuario (#${id})?`)) {
          try {
            await apiFetch(`/api/users/${id}`, 'DELETE');
            renderUsersTable();
          } catch (err) {
            alert('Error eliminando usuario: ' + err.message);
          }
        }
      };
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" style="color:var(--red)">Error cargando usuarios: ${err.message}</td></tr>`;
  }
}

// --- MODAL CREAR / EDITAR VEHÍCULO (CON GESTIÓN DE MÚLTIPLES FOTOS) ---

function openVehicleModal(vehicle = null) {
  const isEdit = Boolean(vehicle);
  const v = vehicle || {
    brand: '', model: '', year: 2025, price: '', mileage: 0, currency: 'CRC',
    vehicleType: 'SUV', transmission: 'Automática', fuel: 'Gasolina',
    status: 'Publicado', description: '', featured: false, image: 'sedan.jpeg',
    images: ['sedan.jpeg']
  };

  const currentGallery = Array.isArray(v.images) ? v.images.join(', ') : (v.image || 'sedan.jpeg');
  const options = (arr, val) => arr.map(x => `<option ${x === val ? 'selected' : ''} value="${x}">${x}</option>`).join('');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <div class="eyebrow">${isEdit ? 'Editar registro MySQL' : 'Nuevo vehículo en MySQL'}</div>
          <h2 style="font:600 24px 'Space Grotesk';margin:4px 0 0">${isEdit ? `Editar ${esc(v.brand)} ${esc(v.model)}` : 'Agregar Vehículo'}</h2>
        </div>
        <button class="icon-btn" id="close-modal" type="button"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <form class="modal-form" id="vehicle-form">
        <label>Marca
          <input class="form-input" name="brand" required value="${esc(v.brand)}" placeholder="ej: Toyota">
        </label>
        <label>Modelo
          <input class="form-input" name="model" required value="${esc(v.model)}" placeholder="ej: Hilux">
        </label>
        <label>Año
          <input class="form-input" type="number" name="year" required value="${v.year}">
        </label>
        <label>Precio (Colones CRC)
          <input class="form-input" type="number" name="price" required value="${v.price}" placeholder="ej: 24500000">
        </label>
        <label>Moneda
          <select class="form-select" name="currency">${options(['CRC', 'USD'], v.currency || 'CRC')}</select>
        </label>
        <label>Kilometraje (km)
          <input class="form-input" type="number" name="mileage" value="${v.mileage}">
        </label>
        <label>Tipo de Vehículo
          <select class="form-select" name="vehicleType">${options(['SUV', 'Sedán', 'Pick-up', '4x4', 'Hatchback'], v.vehicleType)}</select>
        </label>
        <label>Transmisión
          <select class="form-select" name="transmission">${options(['Automática', 'Manual'], v.transmission)}</select>
        </label>
        <label>Combustible
          <select class="form-select" name="fuel">${options(['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico'], v.fuel)}</select>
        </label>
        <label>Estado Comercial
          <select class="form-select" name="status">${options(['Publicado', 'Borrador', 'Reservado', 'Vendido'], v.status)}</select>
        </label>

        <!-- SECCIÓN DE FOTOGRAFÍAS -->
        <label class="full" style="background:rgba(255,255,255,0.03); padding:16px; border-radius:12px; border:1px solid var(--line);">
          <strong style="color:var(--gold); margin-bottom:8px; display:block;"><i class="fa-solid fa-camera"></i> Gestión de Fotografías del Vehículo</strong>
          
          <div style="margin-bottom:12px">
            <span style="font-size:11px; color:var(--muted)">1. Foto Principal (Portada de tarjeta)</span>
            <input class="form-input" name="image" required value="${esc(v.image || 'sedan.jpeg')}" placeholder="ej: luxury-black.jpeg o URL de la foto principal" style="width:100%; margin-top:4px">
          </div>

          <div>
            <span style="font-size:11px; color:var(--muted)">2. Fotos Adicionales para la Galería (Frente, Interior, Costado) - separadas por coma</span>
            <input class="form-input" name="raw_images" value="${esc(currentGallery)}" placeholder="ej: luxury-black.jpeg, sedan.jpeg, pickup.jpeg o URLs" style="width:100%; margin-top:4px">
            <small style="color:#71847d; font-size:10px; margin-top:4px; display:block;">Sugerencias predeterminadas: <code>sedan.jpeg</code>, <code>pickup.jpeg</code>, <code>luxury-black.jpeg</code> o pega URLs de imágenes web.</small>
          </div>
        </label>

        <label style="display:flex; flex-direction:row; align-items:center; gap:8px; margin-top:10px" class="full">
          <input type="checkbox" name="featured" ${v.featured ? 'checked' : ''}>
          <span>Destacar en la portada principal</span>
        </label>

        <label class="full">Descripción
          <textarea class="form-textarea" name="description" placeholder="Detalles del auto (interiores, equipamiento, estado de motor)...">${esc(v.description)}</textarea>
        </label>

        <div class="full" style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px">
          <button class="button outline" id="cancel-modal" type="button">Cancelar</button>
          <button class="button" type="submit">${isEdit ? 'Guardar Cambios' : 'Crear Vehículo'}</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  modal.querySelector('#close-modal').onclick = closeModal;
  modal.querySelector('#cancel-modal').onclick = closeModal;

  const form = modal.querySelector('#vehicle-form');
  form.onsubmit = async e => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    data.featured = formData.get('featured') === 'on';

    const rawImgs = data.raw_images || '';
    const imagesArr = rawImgs.split(',').map(s => s.trim()).filter(Boolean);
    if (!imagesArr.includes(data.image)) {
      imagesArr.unshift(data.image);
    }
    data.images = imagesArr;

    try {
      if (isEdit) {
        const updated = await apiFetch(`/api/vehicles/${v.id}`, 'PUT', data);
        const idx = state.vehicles.findIndex(x => x.id === v.id);
        if (idx !== -1) state.vehicles[idx] = updated;
      } else {
        const created = await apiFetch('/api/vehicles', 'POST', data);
        state.vehicles.unshift(created);
      }
      closeModal();
      route();
    } catch (err) {
      alert('Error al guardar vehículo: ' + err.message);
    }
  };
}

// --- MODAL CREAR USUARIO ---

function openUserModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:440px">
      <div class="modal-head">
        <div>
          <div class="eyebrow">Seguridad</div>
          <h2 style="font:600 24px 'Space Grotesk';margin:4px 0 0">Nuevo Administrador</h2>
        </div>
        <button class="icon-btn" id="close-user-modal" type="button"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <form id="user-form" style="display:flex; flex-direction:column; gap:14px">
        <label style="font-size:12px; color:var(--muted)">Nombre de usuario
          <input class="form-input" name="username" required placeholder="ej: carlos" style="width:100%; margin-top:4px">
        </label>
        <label style="font-size:12px; color:var(--muted)">Correo electrónico
          <input class="form-input" type="email" name="email" required placeholder="carlos@autofolio.cr" style="width:100%; margin-top:4px">
        </label>
        <label style="font-size:12px; color:var(--muted)">Contraseña
          <input class="form-input" type="password" name="password" required placeholder="••••••••" style="width:100%; margin-top:4px">
        </label>

        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px">
          <button class="button outline" id="cancel-user-modal" type="button">Cancelar</button>
          <button class="button" type="submit">Guardar Usuario</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  modal.querySelector('#close-user-modal').onclick = closeModal;
  modal.querySelector('#cancel-user-modal').onclick = closeModal;

  const form = modal.querySelector('#user-form');
  form.onsubmit = async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      await apiFetch('/api/users', 'POST', data);
      closeModal();
      renderUsersTable();
    } catch (err) {
      alert('Error creando usuario: ' + err.message);
    }
  };
}

// --- ENRUTADOR CON NAVEGACIÓN DIRECTA A SECCIONES ---

async function route() {
  const hash = location.hash || '#/';
  const [path] = hash.slice(1).split('?');

  await loadVehicles();

  if (path === '/' || path === '' || path === 'how' || path === 'contact' || path === '/how' || path === '/contact') {
    app.innerHTML = home();
    bindNavToggle();

    const searchForm = document.querySelector('#hero-search');
    if (searchForm) {
      searchForm.onsubmit = e => {
        e.preventDefault();
        const q = new FormData(searchForm).get('q');
        location.hash = `#/catalog?search=${encodeURIComponent(q || '')}`;
      };
    }

    if (path.includes('how')) {
      setTimeout(() => {
        document.querySelector('#how')?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } else if (path.includes('contact')) {
      setTimeout(() => {
        document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } else {
      window.scrollTo(0, 0);
    }
  } else if (path === '/catalog') {
    app.innerHTML = catalog();
    bindNavToggle();
    renderCatalog();
    window.scrollTo(0, 0);
  } else if (path.startsWith('/vehicle/')) {
    const id = path.split('/')[2];
    app.innerHTML = detail(id);
    bindNavToggle();
    bindGalleryThumbnails();
    window.scrollTo(0, 0);
  } else if (path === '/login') {
    app.innerHTML = loginView();
    bindNavToggle();
    bindLoginForm();
    window.scrollTo(0, 0);
  } else if (path === '/admin') {
    const isAuth = await checkAuth();
    if (!isAuth) {
      location.hash = '#/login';
      app.innerHTML = loginView('Por favor inicie sesión para ingresar al panel.');
      bindNavToggle();
      bindLoginForm();
      return;
    }
    app.innerHTML = adminView();
    renderAdmin();
    window.scrollTo(0, 0);
  } else {
    location.hash = '#/';
  }
}

window.addEventListener('hashchange', route);
route();

/* ============================================================
   ATLAS DE COLOMBIA · Interacción del mapa
   Sin dependencias externas: SVG + JavaScript del navegador.
   ============================================================ */

(function () {
  'use strict';

  const datos = window.ATLAS_DATOS;
  const geo = window.MAPA_COLOMBIA;

  if (!datos || !geo) {
    console.error('No se encontraron los datos del atlas.');
    return;
  }

  /* ---------- referencias del DOM ---------- */

  const svg = document.getElementById('lienzo');
  const mapaEl = document.getElementById('mapa');
  const capaDepartamentos = document.getElementById('capa-departamentos');
  const capaResaltado = document.getElementById('capa-resaltado');
  const capaGuias = document.getElementById('capa-guias');
  const capaEtiquetas = document.getElementById('capa-etiquetas');
  const capaCapitales = document.getElementById('capa-capitales');
  const capaContexto = document.getElementById('capa-contexto');
  const tooltip = document.getElementById('tooltip');
  const ficha = document.getElementById('ficha');
  const inset = document.getElementById('inset');
  const buscador = document.getElementById('buscador');
  const resultadosEl = document.getElementById('resultados');
  const limpiarBoton = document.getElementById('limpiar-busqueda');
  const listaRegiones = document.getElementById('lista-regiones');
  const listaDepartamentos = document.getElementById('lista-departamentos');
  const conteoLista = document.getElementById('conteo-lista');
  const quitarFiltro = document.getElementById('quitar-filtro');
  const btnCsv = document.getElementById('btn-csv');

  /* ---------- datos derivados ---------- */

  const porId = new Map(datos.departamentos.map((d) => [d.id, d]));
  const regionPorId = new Map(datos.regiones.map((r) => [r.id, r]));
  const totalPoblacion = datos.pais.poblacion;
  const totalSuperficie = datos.pais.superficie;

  const nf = new Intl.NumberFormat('es-CO');
  const nfCompacto = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
  const nf1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function normalizar(texto) {
    return String(texto)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ñ ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function limitar(valor, minimo, maximo) {
    return Math.min(maximo, Math.max(minimo, valor));
  }

  function redondear(valor, decimales) {
    const factor = Math.pow(10, decimales || 0);
    return Math.round(valor * factor) / factor;
  }

  function densidad(departamento) {
    return departamento.poblacion / departamento.superficie;
  }

  /* ============================================================
     Vista (viewBox) y zoom
     ============================================================ */

  const VB = { x: 0, y: 0, w: geo.viewBox[2], h: geo.viewBox[3] };
  const ANCHO_BASE = geo.anchoBase || VB.w;
  const ASPECTO = VB.h / VB.w;
  const ANCHO_MINIMO = 190;

  const vista = { x: VB.x, y: VB.y, w: VB.w, h: VB.h };
  let animacion = null;
  let huboMovimiento = false;
  let escalaEtiquetas = null;

  const etiquetasPorId = new Map();
  const guiasPorId = new Map();
  const capitalesPorId = new Map();
  const gruposPorId = new Map();
  let caminoHalo = null;
  let caminoBorde = null;

  function aplicarVista() {
    svg.setAttribute(
      'viewBox',
      [redondear(vista.x, 2), redondear(vista.y, 2), redondear(vista.w, 2), redondear(vista.h, 2)].join(' ')
    );
    const escala = vista.w / ANCHO_BASE;
    if (escalaEtiquetas === null || Math.abs(escala - escalaEtiquetas) > 0.0001) {
      etiquetasPorId.forEach((etiqueta) => {
        etiqueta.setAttribute('font-size', redondear(Number(etiqueta.dataset.base) * escala, 2));
      });
      capitalesPorId.forEach((capital) => capital.setAttribute('r', redondear(Number(capital.dataset.base) * escala, 2)));
      escalaEtiquetas = escala;
    }
    mapaEl.classList.toggle('zoom-cerca', vista.w < 560);
  }

  function limitarVista(propuesta) {
    const w = limitar(Number.isFinite(propuesta.w) ? propuesta.w : vista.w, ANCHO_MINIMO, VB.w);
    const h = w * ASPECTO;
    return {
      w,
      h,
      x: limitar(Number.isFinite(propuesta.x) ? propuesta.x : vista.x, 0, VB.w - w),
      y: limitar(Number.isFinite(propuesta.y) ? propuesta.y : vista.y, 0, VB.h - h)
    };
  }

  function cancelarAnimacion() {
    if (animacion !== null) {
      cancelAnimationFrame(animacion);
      animacion = null;
    }
  }

  function animarVista(destino, duracion) {
    cancelarAnimacion();
    const inicio = { x: vista.x, y: vista.y, w: vista.w, h: vista.h };
    const fin = limitarVista(destino);
    const tiempoTotal = duracion || 620;
    const t0 = performance.now();

    function paso(t) {
      const avance = Math.min(1, (t - t0) / tiempoTotal);
      const suave = avance < 0.5 ? 4 * avance * avance * avance : 1 - Math.pow(-2 * avance + 2, 3) / 2;
      vista.x = inicio.x + (fin.x - inicio.x) * suave;
      vista.y = inicio.y + (fin.y - inicio.y) * suave;
      vista.w = inicio.w + (fin.w - inicio.w) * suave;
      vista.h = inicio.h + (fin.h - inicio.h) * suave;
      aplicarVista();
      if (avance < 1) {
        animacion = requestAnimationFrame(paso);
      } else {
        vista.x = fin.x;
        vista.y = fin.y;
        vista.w = fin.w;
        vista.h = fin.h;
        aplicarVista();
        animacion = null;
      }
    }
    animacion = requestAnimationFrame(paso);
  }

  function puntoViewBox(clientX, clientY) {
    const matriz = svg.getScreenCTM();
    if (!matriz) return { x: vista.x, y: vista.y };
    const punto = new DOMPoint(clientX, clientY).matrixTransform(matriz.inverse());
    return { x: punto.x, y: punto.y };
  }

  function puntoDeEvento(evento) {
    return puntoViewBox(evento.clientX, evento.clientY);
  }

  function centroVista() {
    return { x: vista.x + vista.w / 2, y: vista.y + vista.h / 2 };
  }

  function zoomHacia(punto, factor) {
    cancelarAnimacion();
    const w = limitar(vista.w * factor, ANCHO_MINIMO, VB.w);
    const escala = w / vista.w;
    vista.x = punto.x - (punto.x - vista.x) * escala;
    vista.y = punto.y - (punto.y - vista.y) * escala;
    vista.w = w;
    vista.h = w * ASPECTO;
    const limitada = limitarVista(vista);
    vista.x = limitada.x;
    vista.y = limitada.y;
    vista.w = limitada.w;
    vista.h = limitada.h;
    aplicarVista();
  }

  function vistaDeDepartamento(id) {
    const info = geo.departamentos[id];
    if (!info) return { x: VB.x, y: VB.y, w: VB.w, h: VB.h };
    const [x0, y0, x1, y1] = info.bbox;
    const ancho = Math.max(x1 - x0, 1);
    const alto = Math.max(y1 - y0, 1);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;

    let w = Math.max(ancho * 2.5, 250);
    let h = w * ASPECTO;
    if (alto * 2.5 > h) {
      h = alto * 2.5;
      w = h / ASPECTO;
    }
    return limitarVista({ x: cx - w / 2, y: cy - h / 2, w, h });
  }

  function irAVistaGeneral(animar) {
    const destino = { x: VB.x, y: VB.y, w: VB.w, h: VB.h };
    if (animar === false) {
      cancelarAnimacion();
      Object.assign(vista, destino);
      aplicarVista();
    } else {
      animarVista(destino, 720);
    }
  }

  /* ============================================================
     Construcción del mapa
     ============================================================ */

  const ORDEN_PINTADO = Object.keys(geo.departamentos).sort(
    (a, b) => geo.departamentos[b].areaPx - geo.departamentos[a].areaPx
  );

  function crearGrupoDepartamento(id) {
    const info = geo.departamentos[id];
    const departamento = porId.get(id);
    const region = regionPorId.get(departamento.region);

    const grupo = document.createElementNS(SVG_NS, 'g');
    grupo.classList.add('departamento');
    grupo.dataset.id = id;
    grupo.setAttribute('role', 'button');
    grupo.setAttribute('tabindex', '0');
    grupo.setAttribute('aria-label', departamento.nombre + ', región ' + region.nombre + '. Capital ' + departamento.capital);

    const camino = document.createElementNS(SVG_NS, 'path');
    camino.setAttribute('d', info.d);
    camino.setAttribute('fill', region.color);
    grupo.appendChild(camino);

    capaDepartamentos.appendChild(grupo);
    gruposPorId.set(id, grupo);

    grupo.addEventListener('pointerenter', (evento) => {
      if (evento.pointerType === 'touch' || svg.classList.contains('arrastrando')) return;
      if (performance.now() < hoverBloqueadoHasta) return;
      hoverActual = id;
      resaltar(id, true);
      actualizarContorno();
      mostrarTooltip(id, evento);
    });
    grupo.addEventListener('pointermove', (evento) => {
      if (evento.pointerType === 'touch' || svg.classList.contains('arrastrando')) return;
      posicionarTooltip(evento);
    });
    grupo.addEventListener('pointerleave', () => {
      hoverActual = null;
      resaltar(id, false);
      actualizarContorno();
      ocultarTooltip();
    });
    grupo.addEventListener('focus', () => {
      hoverActual = id;
      resaltar(id, true);
      revelarEtiqueta(id, true);
      actualizarContorno();
      const infoCapital = geo.departamentos[id];
      const punto = new DOMPoint(infoCapital.centro[0], infoCapital.centro[1]).matrixTransform(
        svg.getScreenCTM()
      );
      mostrarTooltip(id, { clientX: punto.x, clientY: punto.y });
    });
    grupo.addEventListener('blur', () => {
      hoverActual = null;
      resaltar(id, false);
      actualizarContorno();
      ocultarTooltip();
    });
    // Activación sintética (lectores de pantalla). Los clics reales se
    // resuelven en pointerup para que el arrastre no seleccione por error.
    grupo.addEventListener('click', (evento) => {
      if (evento.detail > 0) return;
      seleccionar(id, { zoom: true, desplazarLista: true });
    });
    grupo.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        seleccionar(id, { zoom: true, desplazarLista: true });
      }
      if (evento.key === 'Escape') {
        evento.preventDefault();
        volverAVistaGeneral();
      }
    });
  }

  function crearEtiqueta(id) {
    const info = geo.departamentos[id];
    const departamento = porId.get(id);
    const ajuste = AJUSTES_ETIQUETA[id] || {};
    const x = info.centro[0] + (ajuste.dx || 0);
    const y = info.centro[1] + (ajuste.dy || 0);

    if (ajuste.dx || ajuste.dy) {
      const guia = document.createElementNS(SVG_NS, 'path');
      guia.setAttribute('d', 'M' + info.centro[0] + ',' + info.centro[1] + 'L' + x + ',' + y);
      guia.classList.add('guia');
      capaGuias.appendChild(guia);
      guiasPorId.set(id, guia);
    }

    const etiqueta = document.createElementNS(SVG_NS, 'text');
    etiqueta.setAttribute('x', x);
    etiqueta.setAttribute('y', y);
    etiqueta.dataset.base = String(ajuste.tamano || 12);
    etiqueta.setAttribute('font-size', etiqueta.dataset.base);
    etiqueta.textContent = departamento.nombreCorto;
    etiqueta.classList.add('etiqueta');
    if (ajuste.tier === 2) etiqueta.classList.add('tier-2');
    capaEtiquetas.appendChild(etiqueta);
    etiquetasPorId.set(id, etiqueta);
  }

  function crearCapital(id) {
    const posicion = geo.capitales[id];
    if (!posicion) return;
    const circulo = document.createElementNS(SVG_NS, 'circle');
    circulo.setAttribute('cx', posicion[0]);
    circulo.setAttribute('cy', posicion[1]);
    circulo.dataset.base = '6.5';
    circulo.setAttribute('r', circulo.dataset.base);
    circulo.classList.add('capital');
    capaCapitales.appendChild(circulo);
    capitalesPorId.set(id, circulo);
  }

  const ETIQUETAS_CONTEXTO = [
    { id: 'caribe', texto: 'Mar Caribe', x: 725, y: 70, agua: true },
    { id: 'pacifico', texto: 'Océano Pacífico', x: 72, y: 540, agua: true, rotar: -78 },
    { id: 'panama', texto: 'Panamá', x: 98, y: 238 },
    { id: 'venezuela', texto: 'Venezuela', x: 928, y: 372 },
    { id: 'brasil', texto: 'Brasil', x: 924, y: 806 },
    { id: 'peru', texto: 'Perú', x: 648, y: 1178 },
    { id: 'ecuador', texto: 'Ecuador', x: 208, y: 884 }
  ];

  function crearContexto() {
    ETIQUETAS_CONTEXTO.forEach((item) => {
      const texto = document.createElementNS(SVG_NS, 'text');
      texto.setAttribute('x', item.x);
      texto.setAttribute('y', item.y);
      texto.textContent = item.texto;
      texto.classList.add('contexto');
      if (item.agua) texto.classList.add('agua');
      if (item.rotar) texto.setAttribute('transform', 'rotate(' + item.rotar + ' ' + item.x + ' ' + item.y + ')');
      capaContexto.appendChild(texto);
    });
  }

  /* etiquetas con ajuste manual para evitar cruces */
  const AJUSTES_ETIQUETA = {
    'CO-CUN': { dx: 26, dy: -40 },
    'CO-DC': { dx: 52, dy: 22, tier: 2, tamano: 11 },
    'CO-CAL': { dx: -34, dy: -38, tier: 2, tamano: 11 },
    'CO-RIS': { dx: -62, dy: -8, tier: 2, tamano: 11 },
    'CO-QUI': { dx: -22, dy: 36, tier: 2, tamano: 11 },
    'CO-ATL': { dx: 34, dy: -36, tier: 2, tamano: 11 },
    'CO-SUC': { dx: 42, dy: -16, tier: 2, tamano: 11 },
    'CO-BOY': { dx: 14, dy: -38 },
    'CO-SAN': { dx: 8, dy: -22 },
    'CO-NSA': { dx: 8, dy: -22 },
    'CO-MAG': { dx: 0, dy: 18 },
    'CO-CES': { dx: 8, dy: 6 },
    'CO-COR': { dx: -12, dy: -12 },
    'CO-BOL': { dx: -6, dy: -8 },
    'CO-VAC': { dx: 12, dy: -14 },
    'CO-CHO': { dx: -14, dy: 0 },
    'CO-CAU': { dx: 8, dy: -16 },
    'CO-NAR': { dx: -8, dy: 8 },
    'CO-HUI': { dx: 10, dy: 12 },
    'CO-TOL': { dx: 12, dy: 22 }
  };

  function construirMapa() {
    // contorno que siempre queda por encima de los rellenos
    caminoHalo = document.createElementNS(SVG_NS, 'path');
    caminoHalo.classList.add('resaltado-halo');
    caminoBorde = document.createElementNS(SVG_NS, 'path');
    caminoBorde.classList.add('resaltado-borde');
    capaResaltado.append(caminoHalo, caminoBorde);

    ORDEN_PINTADO.forEach((id) => crearGrupoDepartamento(id));

    ORDEN_PINTADO.forEach((id) => {
      crearEtiqueta(id);
      crearCapital(id);
    });

    // el archipiélago no tiene forma en el mapa continental: vive en el inset
    const sanAndres = geo.islas.sanAndres;
    const providencia = geo.islas.providencia;
    document.querySelector('#isla-san-andres path').setAttribute('d', sanAndres.d);
    document.querySelector('#isla-providencia path').setAttribute('d', providencia.d);

    crearContexto();
    aplicarVista();

    inset.addEventListener('click', () => seleccionar('CO-SAP', { zoom: false, desplazarLista: true }));
    inset.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        seleccionar('CO-SAP', { zoom: false, desplazarLista: true });
      }
    });
  }

  /* ============================================================
     Interacciones de resaltado, selección y tooltip
     ============================================================ */

  let seleccionActual = null;
  let hoverActual = null;
  let hoverBloqueadoHasta = 0;
  let filtroRegion = null;

  function actualizarContorno() {
    const id = hoverActual || seleccionActual;
    const info = id && geo.departamentos[id];
    if (!info) {
      if (caminoHalo) caminoHalo.classList.remove('visible');
      if (caminoBorde) caminoBorde.classList.remove('visible');
      return;
    }
    caminoHalo.setAttribute('d', info.d);
    caminoBorde.setAttribute('d', info.d);
    caminoHalo.classList.add('visible');
    caminoBorde.classList.add('visible');
  }

  function resaltar(id, activo) {
    const grupo = gruposPorId.get(id);
    if (!grupo) return;
    grupo.classList.toggle('activo', activo || seleccionActual === id);
    revelarEtiqueta(id, activo);
    const capital = capitalesPorId.get(id);
    if (capital) capital.classList.toggle('visible', activo || seleccionActual === id);
  }

  function revelarEtiqueta(id, revelada) {
    const etiqueta = etiquetasPorId.get(id);
    const guia = guiasPorId.get(id);
    if (etiqueta) etiqueta.classList.toggle('revelada', revelada || seleccionActual === id);
    if (guia) guia.classList.toggle('revelada', revelada || seleccionActual === id);
  }

  function mostrarTooltip(id, evento) {
    const departamento = porId.get(id);
    const region = regionPorId.get(departamento.region);
    tooltip.innerHTML =
      '<span class="tooltip-region" style="--color:' + region.color + '"><i></i>' + region.nombre + '</span>' +
      '<strong class="tooltip-nombre">' + departamento.nombre + '</strong>' +
      '<dl>' +
      '<div><dt>Capital</dt><dd>' + departamento.capital + '</dd></div>' +
      '<div><dt>Población</dt><dd>' + nf.format(departamento.poblacion) + '</dd></div>' +
      '<div><dt>Superficie</dt><dd>' + nf.format(departamento.superficie) + ' km²</dd></div>' +
      '<div><dt>Municipios</dt><dd>' + departamento.municipios + '</dd></div>' +
      '</dl>';
    tooltip.hidden = false;
    posicionarTooltip(evento);
    requestAnimationFrame(() => tooltip.classList.add('visible'));
  }

  function posicionarTooltip(evento) {
    if (tooltip.hidden) return;
    const rect = mapaEl.getBoundingClientRect();
    const ancho = tooltip.offsetWidth;
    const alto = tooltip.offsetHeight;
    let x = evento.clientX - rect.left + 18;
    let y = evento.clientY - rect.top - alto - 16;

    if (x + ancho > rect.width - 14) x = evento.clientX - rect.left - ancho - 18;
    if (x < 12) x = 12;
    if (y < 12) y = evento.clientY - rect.top + 18;
    if (y + alto > rect.height - 12) y = rect.height - alto - 12;

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function ocultarTooltip() {
    tooltip.classList.remove('visible');
    window.setTimeout(() => {
      if (!tooltip.classList.contains('visible')) tooltip.hidden = true;
    }, 160);
  }

  function seleccionar(id, opciones) {
    const opcionesFinales = opciones || {};
    const departamento = porId.get(id);
    if (!departamento) return;

    if (seleccionActual && seleccionActual !== id) {
      const anterior = gruposPorId.get(seleccionActual);
      if (anterior) anterior.classList.remove('activo');
      const capitalAnterior = capitalesPorId.get(seleccionActual);
      if (capitalAnterior) capitalAnterior.classList.remove('visible');
      const etiquetaAnterior = etiquetasPorId.get(seleccionActual);
      if (etiquetaAnterior) etiquetaAnterior.classList.remove('revelada');
      const guiaAnterior = guiasPorId.get(seleccionActual);
      if (guiaAnterior) guiaAnterior.classList.remove('revelada');
    }

    seleccionActual = id;
    hoverBloqueadoHasta = performance.now() + (opcionesFinales.zoom !== false ? 820 : 140);
    if (hoverActual) resaltar(hoverActual, false);
    hoverActual = null;
    ocultarTooltip();
    mapaEl.classList.add('tiene-seleccion');
    mapaEl.classList.toggle('seleccion-insular', id === 'CO-SAP');
    inset.classList.toggle('activo', id === 'CO-SAP');

    const grupo = gruposPorId.get(id);
    if (grupo) {
      grupo.classList.add('activo');
      revelarEtiqueta(id, true);
      const capital = capitalesPorId.get(id);
      if (capital) capital.classList.add('visible');
    }

    renderizarFicha(departamento);
    sincronizarLista(id);
    actualizarContorno();

    if (opcionesFinales.zoom !== false) {
      animarVista(vistaDeDepartamento(id), 700);
    }
  }

  function volverAVistaGeneral() {
    seleccionActual = null;
    mapaEl.classList.remove('tiene-seleccion');
    mapaEl.classList.remove('seleccion-insular');
    inset.classList.remove('activo');
    gruposPorId.forEach((grupo) => grupo.classList.remove('activo'));
    capitalesPorId.forEach((capital) => capital.classList.remove('visible'));
    etiquetasPorId.forEach((etiqueta) => {
      if (etiqueta.classList.contains('tier-2')) etiqueta.classList.remove('revelada');
    });
    guiasPorId.forEach((guia) => guia.classList.remove('revelada'));
    hoverActual = null;
    actualizarContorno();
    renderizarFicha(null);
    sincronizarLista(null);
    irAVistaGeneral(true);
  }

  /* ============================================================
     Ficha inferior
     ============================================================ */

  function renderizarFicha(departamento) {
    ficha.classList.toggle('con-datos', Boolean(departamento));

    if (!departamento) {
      ficha.innerHTML = '';
      ficha.hidden = true;
      return;
    }

    ficha.hidden = false;
    const region = regionPorId.get(departamento.region);
    const participacion = (departamento.poblacion / totalPoblacion) * 100;
    const tipo = departamento.esDistrito ? 'Distrito Capital' : 'Departamento';
    const detalleDivision = departamento.esDistrito
      ? '20 localidades'
      : departamento.municipios + (departamento.municipios === 1 ? ' municipio' : ' municipios');
    const notaCapital = departamento.capitalFuera ? ' (fuera del departamento)' : '';

    ficha.innerHTML =
      '<div class="ficha-datos">' +
      '<div class="ficha-identidad">' +
      '<span class="pildora-region" style="--color:' + region.color + '"><i></i>Región ' + region.nombre + '</span>' +
      '<h2>' + departamento.nombre + '</h2>' +
      '<p>' + tipo + ' · ' + detalleDivision + '</p>' +
      '<div class="ficha-participacion">' +
      '<p><span>Participación en la población nacional</span><strong>' + nf1.format(participacion) + ' %</strong></p>' +
      '<div class="barra" style="--color:' + region.color + '"><span style="width:' + participacion.toFixed(2) + '%"></span></div>' +
      '</div>' +
      '</div>' +
      '<dl class="ficha-stats">' +
      '<div><dt>Capital</dt><dd>' + departamento.capital + '<span>' + notaCapital + '</span></dd></div>' +
      '<div><dt>Población</dt><dd>' + nf.format(departamento.poblacion) + ' <span>hab.</span></dd></div>' +
      '<div><dt>Superficie</dt><dd>' + nf.format(departamento.superficie) + ' <span>km²</span></dd></div>' +
      '<div><dt>Densidad</dt><dd>' + nf1.format(densidad(departamento)) + ' <span>hab./km²</span></dd></div>' +
      '</dl>' +
      '<button type="button" class="boton-volver" id="boton-volver">Ver todo el mapa</button>' +
      '</div>';

    const botonVolver = document.getElementById('boton-volver');
    if (botonVolver) botonVolver.addEventListener('click', volverAVistaGeneral);
  }

  /* ============================================================
     Listado y leyenda
     ============================================================ */

  const departamentosOrdenados = datos.departamentos
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  function crearLista() {
    departamentosOrdenados.forEach((departamento) => {
      const region = regionPorId.get(departamento.region);
      const item = document.createElement('li');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'boton-departamento';
      boton.dataset.id = departamento.id;
      boton.style.setProperty('--color', region.color);
      boton.setAttribute(
        'aria-label',
        departamento.nombre + ', ' + nf.format(departamento.poblacion) + ' habitantes'
      );
      boton.innerHTML =
        '<span class="punto" aria-hidden="true"></span>' +
        '<span class="nombre">' + departamento.nombre + '</span>' +
        '<span class="poblacion">' + nfCompacto.format(departamento.poblacion) + '</span>';
      boton.addEventListener('click', () => seleccionar(departamento.id, { zoom: true }));
      item.appendChild(boton);
      listaDepartamentos.appendChild(item);
    });
  }

  function sincronizarLista(id) {
    listaDepartamentos.querySelectorAll('.boton-departamento').forEach((boton) => {
      const activo = boton.dataset.id === id;
      boton.setAttribute('aria-current', activo ? 'true' : 'false');
      if (activo) boton.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function crearLeyenda() {
    datos.regiones.forEach((region) => {
      const item = document.createElement('li');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'boton-region';
      boton.dataset.region = region.id;
      boton.style.setProperty('--color', region.color);
      boton.setAttribute('aria-pressed', 'false');
      boton.title = region.texto;
      boton.innerHTML = '<i aria-hidden="true"></i>' + region.nombre;
      boton.addEventListener('click', () => alternarFiltro(region.id));
      item.appendChild(boton);
      listaRegiones.appendChild(item);
    });
  }

  function alternarFiltro(regionId) {
    filtroRegion = filtroRegion === regionId ? null : regionId;

    listaRegiones.querySelectorAll('.boton-region').forEach((boton) => {
      boton.setAttribute('aria-pressed', boton.dataset.region === filtroRegion ? 'true' : 'false');
    });

    let visibles = 0;
    gruposPorId.forEach((grupo, id) => {
      const departamento = porId.get(id);
      const coincide = !filtroRegion || departamento.region === filtroRegion;
      grupo.classList.toggle('filtrado', !coincide);
      if (coincide) visibles += 1;
    });

    etiquetasPorId.forEach((etiqueta, id) => {
      const departamento = porId.get(id);
      etiqueta.classList.toggle('apagada', Boolean(filtroRegion) && departamento.region !== filtroRegion);
    });
    guiasPorId.forEach((guia, id) => {
      const departamento = porId.get(id);
      guia.classList.toggle('apagada', Boolean(filtroRegion) && departamento.region !== filtroRegion);
    });

    departamentosOrdenados.forEach((departamento) => {
      const boton = listaDepartamentos.querySelector('.boton-departamento[data-id="' + departamento.id + '"]');
      if (!boton) return;
      const coincide = !filtroRegion || departamento.region === filtroRegion;
      boton.closest('li').hidden = !coincide;
    });

    // el archipiélago sólo se atenúa visualmente con su propio inset
    const coincideSap = !filtroRegion || filtroRegion === 'insular';
    inset.style.opacity = coincideSap ? '' : '0.35';

    quitarFiltro.hidden = !filtroRegion;

    const total = departamentosOrdenados.length + (filtroRegion ? 0 : 1);
    conteoLista.textContent = filtroRegion
      ? visibles + ' de ' + total
      : String(datos.departamentos.length);

    if (seleccionActual) {
      const departamento = porId.get(seleccionActual);
      if (filtroRegion && departamento.region !== filtroRegion) volverAVistaGeneral();
    }
  }

  /* ============================================================
     Buscador
     ============================================================ */

  let resultadosActuales = [];
  let indiceResultado = -1;

  function buscar(texto) {
    const consulta = normalizar(texto);
    if (!consulta) return [];
    return departamentosOrdenados
      .map((departamento) => {
        const nombre = normalizar(departamento.nombre);
        const corto = normalizar(departamento.nombreCorto);
        const capital = normalizar(departamento.capital);
        let puntaje = 0;
        if (nombre.startsWith(consulta) || corto.startsWith(consulta)) puntaje = 3;
        else if (capital.startsWith(consulta)) puntaje = 2;
        else if (nombre.includes(consulta) || corto.includes(consulta) || capital.includes(consulta)) puntaje = 1;
        return { departamento, puntaje };
      })
      .filter((resultado) => resultado.puntaje > 0)
      .sort((a, b) => b.puntaje - a.puntaje || a.departamento.nombre.localeCompare(b.departamento.nombre, 'es'))
      .slice(0, 8)
      .map((resultado) => resultado.departamento);
  }

  function renderizarResultados(lista, consulta) {
    resultadosActuales = lista;
    indiceResultado = lista.length ? 0 : -1;
    resultadosEl.innerHTML = '';

    if (!consulta) {
      cerrarResultados();
      return;
    }

    if (!lista.length) {
      const vacio = document.createElement('li');
      vacio.className = 'sin-resultados';
      vacio.textContent = 'Sin resultados para “' + consulta + '”';
      resultadosEl.appendChild(vacio);
      resultadosEl.hidden = false;
      buscador.setAttribute('aria-expanded', 'true');
      return;
    }

    lista.forEach((departamento, indice) => {
      const region = regionPorId.get(departamento.region);
      const item = document.createElement('li');
      item.className = 'resultado';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', indice === indiceResultado ? 'true' : 'false');
      item.style.setProperty('--color', region.color);
      item.innerHTML =
        '<span class="punto" aria-hidden="true"></span>' +
        '<span class="nombre">' + departamento.nombre + '</span>' +
        '<span class="detalle">' + departamento.capital + ' · ' + region.nombre + '</span>';
      item.addEventListener('pointerdown', (evento) => {
        evento.preventDefault();
        elegirResultado(indice);
      });
      resultadosEl.appendChild(item);
    });

    resultadosEl.hidden = false;
    buscador.setAttribute('aria-expanded', 'true');
  }

  function moverResultado(direccion) {
    if (!resultadosActuales.length) return;
    indiceResultado = (indiceResultado + direccion + resultadosActuales.length) % resultadosActuales.length;
    resultadosEl.querySelectorAll('.resultado').forEach((item, indice) => {
      item.setAttribute('aria-selected', indice === indiceResultado ? 'true' : 'false');
    });
  }

  function elegirResultado(indice) {
    const departamento = resultadosActuales[indice];
    if (!departamento) return;
    seleccionar(departamento.id, { zoom: true, desplazarLista: true });
    cerrarResultados();
    buscador.blur();
  }

  function cerrarResultados() {
    resultadosEl.hidden = true;
    buscador.setAttribute('aria-expanded', 'false');
    indiceResultado = -1;
  }

  function actualizarBotonLimpiar() {
    limpiarBoton.hidden = !buscador.value;
  }

  buscador.addEventListener('input', () => {
    actualizarBotonLimpiar();
    renderizarResultados(buscar(buscador.value), buscador.value.trim());
  });

  buscador.addEventListener('keydown', (evento) => {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      if (resultadosEl.hidden) renderizarResultados(buscar(buscador.value), buscador.value.trim());
      moverResultado(1);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      moverResultado(-1);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      if (indiceResultado >= 0) elegirResultado(indiceResultado);
    } else if (evento.key === 'Escape') {
      if (!resultadosEl.hidden) {
        cerrarResultados();
      } else {
        buscador.value = '';
        actualizarBotonLimpiar();
      }
    }
  });

  buscador.addEventListener('focus', () => {
    if (buscador.value.trim()) renderizarResultados(buscar(buscador.value), buscador.value.trim());
  });

  document.addEventListener('click', (evento) => {
    if (!evento.target.closest('.buscador')) cerrarResultados();
  });

  limpiarBoton.addEventListener('click', () => {
    buscador.value = '';
    actualizarBotonLimpiar();
    cerrarResultados();
    buscador.focus();
  });

  /* ============================================================
     Exportar CSV
     ============================================================ */

  function descargarCsv() {
    const filas = [
      ['departamento', 'capital', 'region', 'poblacion_2022', 'superficie_km2', 'municipios', 'densidad_hab_km2']
    ];
    departamentosOrdenados.forEach((departamento) => {
      const region = regionPorId.get(departamento.region);
      filas.push([
        departamento.nombre,
        departamento.capital,
        region.nombre,
        departamento.poblacion,
        departamento.superficie,
        departamento.municipios,
        densidad(departamento).toFixed(1).replace('.', ',')
      ]);
    });

    const contenido = '\uFEFF' + filas.map((fila) => fila.join(';')).join('\r\n');
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = 'colombia-departamentos.csv';
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(enlace.href);
  }

  /* ============================================================
     Eventos de cámara y teclado global
     ============================================================ */

  function conectarEventos() {
    svg.addEventListener(
      'wheel',
      (evento) => {
        evento.preventDefault();
        const punto = puntoDeEvento(evento);
        const factor = Math.exp(evento.deltaY * 0.0012);
        zoomHacia(punto, factor);
      },
      { passive: false }
    );

    svg.addEventListener('dblclick', (evento) => {
      zoomHacia(puntoDeEvento(evento), 0.62);
    });

    const punteros = new Map();
    let arrastre = null;
    let pellizco = null;
    let cuadroArrastre = 0;
    let objetivoPulsado = null;

    function distancia(a, b) {
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function escalaPantalla() {
      const matriz = svg.getScreenCTM();
      return {
        x:
          matriz && Math.abs(matriz.a) > 0.000001
            ? 1 / Math.abs(matriz.a)
            : vista.w / Math.max(svg.clientWidth, 1),
        y:
          matriz && Math.abs(matriz.d) > 0.000001
            ? 1 / Math.abs(matriz.d)
            : vista.h / Math.max(svg.clientHeight, 1)
      };
    }

    function iniciarArrastre(clientX, clientY) {
      const escala = escalaPantalla();
      arrastre = {
        vista: { x: vista.x, y: vista.y, w: vista.w },
        inicio: { x: clientX, y: clientY },
        ultimo: { x: clientX, y: clientY },
        escalaX: escala.x,
        escalaY: escala.y
      };
    }

    function aplicarArrastre() {
      if (!arrastre) return;
      const dxPantalla = arrastre.ultimo.x - arrastre.inicio.x;
      const dyPantalla = arrastre.ultimo.y - arrastre.inicio.y;

      if (Math.hypot(dxPantalla, dyPantalla) > 2.5) huboMovimiento = true;
      if (!huboMovimiento) return;

      // El desplazamiento se mide siempre en píxeles de pantalla y con la
      // escala capturada al empezar: no depende del viewBox que va cambiando.
      const limitada = limitarVista({
        x: arrastre.vista.x - dxPantalla * arrastre.escalaX,
        y: arrastre.vista.y - dyPantalla * arrastre.escalaY,
        w: arrastre.vista.w
      });
      vista.x = limitada.x;
      vista.y = limitada.y;
      vista.w = limitada.w;
      vista.h = limitada.h;
      aplicarVista();
    }

    function programarArrastre() {
      if (cuadroArrastre) return;
      cuadroArrastre = requestAnimationFrame(() => {
        cuadroArrastre = 0;
        aplicarArrastre();
      });
    }

    function iniciarPellizco() {
      const pares = Array.from(punteros.values());
      if (pares.length < 2) return;
      const medioX = (pares[0].clientX + pares[1].clientX) / 2;
      const medioY = (pares[0].clientY + pares[1].clientY) / 2;
      pellizco = {
        distancia: Math.max(distancia(pares[0], pares[1]), 1),
        ancla: puntoViewBox(medioX, medioY),
        vista: { x: vista.x, y: vista.y, w: vista.w }
      };
    }

    function aplicarPellizco() {
      const pares = Array.from(punteros.values());
      if (!pellizco || pares.length < 2) return;
      const medioX = (pares[0].clientX + pares[1].clientX) / 2;
      const medioY = (pares[0].clientY + pares[1].clientY) / 2;
      const factor = pellizco.distancia / Math.max(distancia(pares[0], pares[1]), 1);
      const w = limitar(pellizco.vista.w * factor, ANCHO_MINIMO, VB.w);
      const h = w * ASPECTO;
      const rect = svg.getBoundingClientRect();
      const escala = Math.max(Math.min(rect.width / w, rect.height / h), 0.0001);
      const margenX = (rect.width - w * escala) / 2;
      const margenY = (rect.height - h * escala) / 2;

      // El punto que estaba bajo los dedos al empezar queda bajo el nuevo
      // centro, sin recalcular sobre la vista que ya cambió.
      const propuesta = {
        x: pellizco.ancla.x - (medioX - rect.left - margenX) / escala,
        y: pellizco.ancla.y - (medioY - rect.top - margenY) / escala,
        w
      };
      const limitada = limitarVista(propuesta);
      vista.x = limitada.x;
      vista.y = limitada.y;
      vista.w = limitada.w;
      vista.h = limitada.h;
      huboMovimiento = true;
      aplicarVista();
    }

    svg.addEventListener('pointerdown', (evento) => {
      if (evento.pointerType === 'mouse' && evento.button !== 0) return;
      try {
        svg.setPointerCapture(evento.pointerId);
      } catch (error) {
        /* el navegador puede rechazar la captura en casos límite */
      }
      punteros.set(evento.pointerId, { clientX: evento.clientX, clientY: evento.clientY });
      huboMovimiento = false;
      cancelarAnimacion();

      if (punteros.size === 1) {
        objetivoPulsado =
          evento.target && evento.target.closest ? evento.target.closest('.departamento') : null;
        iniciarArrastre(evento.clientX, evento.clientY);
        pellizco = null;
      } else if (punteros.size === 2) {
        objetivoPulsado = null;
        if (cuadroArrastre) {
          cancelAnimationFrame(cuadroArrastre);
          cuadroArrastre = 0;
        }
        arrastre = null;
        iniciarPellizco();
      }

      if (hoverActual) resaltar(hoverActual, false);
      hoverActual = null;
      actualizarContorno();
      ocultarTooltip();
      svg.classList.add('arrastrando');
    });

    svg.addEventListener('pointermove', (evento) => {
      if (!punteros.has(evento.pointerId)) return;
      punteros.set(evento.pointerId, { clientX: evento.clientX, clientY: evento.clientY });

      if (pellizco && punteros.size >= 2) {
        aplicarPellizco();
        return;
      }

      if (arrastre) {
        arrastre.ultimo = { x: evento.clientX, y: evento.clientY };
        programarArrastre();
      }
    });

    function soltarPuntero(evento, cancelado) {
      if (cuadroArrastre) {
        cancelAnimationFrame(cuadroArrastre);
        cuadroArrastre = 0;
      }
      if (arrastre) aplicarArrastre();

      const eraPulsacionSimple = punteros.size === 1 && !pellizco && !cancelado;
      const idSeleccion =
        eraPulsacionSimple && !huboMovimiento && objetivoPulsado
          ? objetivoPulsado.dataset.id
          : null;

      punteros.delete(evento.pointerId);
      const pares = Array.from(punteros.values());

      if (pares.length === 1) {
        // Se levantó uno de los dos dedos: se continúa con un arrastre suave.
        pellizco = null;
        huboMovimiento = true;
        objetivoPulsado = null;
        iniciarArrastre(pares[0].clientX, pares[0].clientY);
      } else if (pares.length === 0) {
        arrastre = null;
        pellizco = null;
        objetivoPulsado = null;
        svg.classList.remove('arrastrando');
      }

      if (idSeleccion) {
        seleccionar(idSeleccion, { zoom: true, desplazarLista: true });
      }
    }

    svg.addEventListener('pointerup', (evento) => soltarPuntero(evento, false));
    svg.addEventListener('pointercancel', (evento) => soltarPuntero(evento, true));

    document.getElementById('zoom-mas').addEventListener('click', () => zoomHacia(centroVista(), 1 / 1.5));
    document.getElementById('zoom-menos').addEventListener('click', () => zoomHacia(centroVista(), 1.5));
    document.getElementById('zoom-reset').addEventListener('click', volverAVistaGeneral);
    quitarFiltro.addEventListener('click', () => alternarFiltro(filtroRegion));
    btnCsv.addEventListener('click', descargarCsv);

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && !evento.target.closest('input')) {
        if (seleccionActual) volverAVistaGeneral();
      }
    });
  }

  /* ============================================================
     Arranque
     ============================================================ */

  function actualizarPildoras() {
    document.getElementById('pildora-entidades').textContent = datos.pais.entidades;
    document.getElementById('pildora-poblacion').textContent = nfCompacto.format(datos.pais.poblacion);
    document.getElementById('pildora-superficie').textContent = nf.format(datos.pais.superficie);
    conteoLista.textContent = String(datos.departamentos.length);
  }

  construirMapa();
  crearLista();
  crearLeyenda();
  actualizarPildoras();
  conectarEventos();
  renderizarFicha(null);
  window.addEventListener('resize', aplicarVista);
})();

/* ============================================================
   Generador de la geometría del mapa
   ------------------------------------------------------------
   Uso:  node tools/build-mapa.js
   Entrada:  data/colombia-departamentos.geojson
   Salida:   js/mapa-colombia.js
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const d3 = require('./d3.v7.min.js');

const raiz = path.join(__dirname, '..');
const entrada = path.join(raiz, 'data', 'colombia-departamentos.geojson');
const salida = path.join(raiz, 'js', 'mapa-colombia.js');

const VIEW = { w: 1000, h: 1200 };

/* ---------- utilidades ---------- */

function leerDatos() {
  const codigo = fs.readFileSync(path.join(raiz, 'js', 'datos.js'), 'utf8');
  const caja = { window: {} };
  vm.runInNewContext(codigo, caja);
  return caja.window.ATLAS_DATOS;
}

function areaAnillo(anillo) {
  let suma = 0;
  for (let i = 0, n = anillo.length; i < n - 1; i++) {
    suma += anillo[i][0] * anillo[i + 1][1] - anillo[i + 1][0] * anillo[i][1];
  }
  return suma / 2;
}

// Deja el anillo exterior en sentido horario y los huecos en antihorario,
// que es la convención que usa d3-geo para polígonos menores a un hemisferio.
function orientarPoligono(anillos) {
  return anillos.map((anillo, indice) => {
    const copia = anillo.map((p) => p.slice());
    const horario = areaAnillo(copia) < 0;
    if (indice === 0 ? !horario : horario) copia.reverse();
    return copia;
  });
}

function orientarGeometria(geometria) {
  if (geometria.type === 'Polygon') {
    return { type: 'Polygon', coordinates: orientarPoligono(geometria.coordinates) };
  }
  if (geometria.type === 'MultiPolygon') {
    return { type: 'MultiPolygon', coordinates: geometria.coordinates.map(orientarPoligono) };
  }
  return geometria;
}

function redondearPath(d) {
  return d.replace(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi, (numero) => {
    const valor = Number(numero);
    if (!Number.isFinite(valor)) throw new Error('Coordenada inválida en el path: ' + numero);
    return (Math.round(valor * 10) / 10).toFixed(1).replace(/\.0$/, '');
  });
}

function areaPolygonPx(points) {
  let suma = 0;
  for (let i = 0, n = points.length; i < n - 1; i++) {
    suma += points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1];
  }
  return Math.abs(suma / 2);
}

/* ---------- lectura de datos ---------- */

const crudo = JSON.parse(fs.readFileSync(entrada, 'utf8'));
const datos = leerDatos();
const porId = new Map(datos.departamentos.map((d) => [d.id, d]));
const porNombre = new Map(datos.departamentos.map((d) => [d.nombre, d]));

const features = crudo.features.map((f) => ({
  ...f,
  geometry: orientarGeometria(f.geometry),
  properties: { ...f.properties }
}));

// Verificación rápida de orientación: el área de Colombia no debe acercarse al hemisferio.
const areaTotal = d3.geoArea({ type: 'FeatureCollection', features });
console.log('Área total (estereorradianes):', areaTotal.toFixed(5));

const continente = features.filter((f) => f.properties.shapeISO !== 'CO-SAP');
const archipielago = features.find((f) => f.properties.shapeISO === 'CO-SAP');

/* ---------- proyección principal ---------- */

const proyeccion = d3
  .geoMercator()
  .fitExtent(
    [
      [46, 34],
      [VIEW.w - 46, VIEW.h - 34]
    ],
    { type: 'FeatureCollection', features: continente }
  );

const generadorPath = d3.geoPath(proyeccion);

const departamentos = {};
for (const f of continente) {
  const id = f.properties.shapeISO;
  const info = porId.get(id);
  if (!info) {
    console.warn('⚠ Sin datos para', id, f.properties.shapeName);
    continue;
  }
  const d = generadorPath(f);
  const centro = generadorPath.centroid(f);
  const limites = generadorPath.bounds(f);
  const anillos = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);
  let areaPx = 0;
  for (const poligono of anillos) areaPx += areaPolygonPx(poligono[0].map((p) => proyeccion(p)));

  departamentos[id] = {
    d: redondearPath(d),
    centro: centro.map((n) => Math.round(n * 10) / 10),
    bbox: [
      Math.round(limites[0][0] * 10) / 10,
      Math.round(limites[0][1] * 10) / 10,
      Math.round(limites[1][0] * 10) / 10,
      Math.round(limites[1][1] * 10) / 10
    ],
    areaPx: Math.round(areaPx)
  };
}

/* ---------- posiciones de capitales y etiquetas de contexto ---------- */

const capitales = {};
for (const info of datos.departamentos) {
  if (info.id === 'CO-SAP') continue;
  if (!info.capitalCoord) continue;
  capitales[info.id] = proyeccion(info.capitalCoord).map((n) => Math.round(n * 10) / 10);
}

const contexto = {
  caribe: proyeccion([-74.6, 13.35]),
  pacifico: proyeccion([-79.65, 3.4]),
  panama: proyeccion([-78.35, 9.35]),
  venezuela: proyeccion([-66.75, 7.0]),
  brasil: proyeccion([-66.9, 1.15]),
  peru: proyeccion([-69.9, -3.7]),
  ecuador: proyeccion([-78.6, 0.35])
};

/* ---------- archipiélago: dos mini mapas ---------- */

function aplanarPoligonos(geometria) {
  if (geometria.type === 'Polygon') return [geometria.coordinates];
  if (geometria.type === 'MultiPolygon') return geometria.coordinates;
  return [];
}

function recortarGrupo(poligonos) {
  return { type: 'MultiPolygon', coordinates: poligonos };
}

function crearMiniMapa(poligonos, caja, margen) {
  const geometria = recortarGrupo(poligonos);
  const proy = d3.geoMercator().fitExtent(
    [
      [margen[0], margen[1]],
      [caja[0] - margen[2], caja[1] - margen[3]]
    ],
    geometria
  );
  const generador = d3.geoPath(proy);
  return {
    viewBox: [0, 0, caja[0], caja[1]],
    d: redondearPath(generador(geometria)),
    area: Math.round(
      poligonos.reduce((total, poligono) => {
        return total + areaPolygonPx(poligono[0].map((p) => proy(p)));
      }, 0)
    )
  };
}

const poligonosArchipielago = aplanarPoligonos(archipielago.geometry);
const gruposIslas = { sanAndres: [], providencia: [] };
for (const poligono of poligonosArchipielago) {
  const centro = d3.geoCentroid({ type: 'Polygon', coordinates: poligono });
  if (centro[1] >= 13.0) gruposIslas.providencia.push(poligono);
  else gruposIslas.sanAndres.push(poligono);
}

const islas = {
  sanAndres: crearMiniMapa(gruposIslas.sanAndres, [150, 104], [14, 12, 14, 12]),
  providencia: crearMiniMapa(gruposIslas.providencia, [150, 104], [16, 12, 16, 12])
};

console.log('Polígonos archipiélago → San Andrés:', gruposIslas.sanAndres.length, '| Providencia:', gruposIslas.providencia.length);
console.log('Áreas mini mapas (px²):', islas.sanAndres.area, islas.providencia.area);

/* ---------- salida ---------- */

const salidaTexto =
  '/* Archivo generado por tools/build-mapa.js. No lo edites a mano. */\n' +
  'window.MAPA_COLOMBIA = ' +
  JSON.stringify(
    {
      generado: new Date().toISOString().slice(0, 10),
      viewBox: [0, 0, VIEW.w, VIEW.h],
      anchoBase: VIEW.w,
      departamentos,
      capitales,
      contexto,
      islas,
      archipielagoBBox: departamentos['CO-AMA'] ? undefined : undefined
    },
    null,
    0
  ) +
  ';\n';

fs.writeFileSync(salida, salidaTexto, 'utf8');
console.log('✔ Mapa generado en', path.relative(raiz, salida), '(' + Math.round(salidaTexto.length / 1024) + ' KB)');
console.log('Departamentos dibujados:', Object.keys(departamentos).length);

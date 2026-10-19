/* ============================================================
   ATLAS DE COLOMBIA · Datos abiertos del proyecto
   ------------------------------------------------------------
   Fuentes:
   - Población y superficie: estimaciones 2022 (DANE), recopiladas
     en la tabla de departamentos de Colombia.
   - Municipios y capitales: DANE / Wikipedia.
   Edita este archivo para actualizar las fichas del mapa.
   ============================================================ */

window.ATLAS_DATOS = {
  pais: {
    nombre: 'Colombia',
    nombreOficial: 'República de Colombia',
    poblacion: 51609474,
    superficie: 1141748,
    municipios: 1103,
    entidades: 33, // 32 departamentos + Bogotá, Distrito Capital
    moneda: 'Peso colombiano (COP)',
    idioma: 'Español',
    fuentePoblacion: 'Estimación 2022 · DANE'
  },

  regiones: [
    {
      id: 'andina',
      nombre: 'Andina',
      color: '#C96B4B',
      texto: 'Tres cordilleras, valles y la mayor concentración de población del país.'
    },
    {
      id: 'caribe',
      nombre: 'Caribe',
      color: '#E2A648',
      texto: 'Litoral caribeño, sabanas, el delta del Magdalena y la Sierra Nevada.'
    },
    {
      id: 'pacifica',
      nombre: 'Pacífica',
      color: '#4E8E86',
      texto: 'Selva húmeda, grandes ríos y el litoral del océano Pacífico.'
    },
    {
      id: 'orinoquia',
      nombre: 'Orinoquía',
      color: '#9AA85A',
      texto: 'Los llanos orientales y la cuenca del río Orinoco.'
    },
    {
      id: 'amazonia',
      nombre: 'Amazonía',
      color: '#5E8868',
      texto: 'Selva tropical continua y la cuenca del río Amazonas.'
    },
    {
      id: 'insular',
      nombre: 'Insular',
      color: '#7C87B8',
      texto: 'Archipiélago de San Andrés, Providencia y Santa Catalina.'
    }
  ],

  departamentos: [
    {
      id: 'CO-AMA',
      nombre: 'Amazonas',
      nombreCorto: 'Amazonas',
      capital: 'Leticia',
      capitalCoord: [-69.94, -4.21],
      region: 'amazonia',
      poblacion: 82068,
      superficie: 109665,
      municipios: 2
    },
    {
      id: 'CO-ANT',
      nombre: 'Antioquia',
      nombreCorto: 'Antioquia',
      capital: 'Medellín',
      capitalCoord: [-75.56, 6.25],
      region: 'andina',
      poblacion: 6887306,
      superficie: 63612,
      municipios: 125
    },
    {
      id: 'CO-ARA',
      nombre: 'Arauca',
      nombreCorto: 'Arauca',
      capital: 'Arauca',
      capitalCoord: [-70.76, 7.09],
      region: 'orinoquia',
      poblacion: 304978,
      superficie: 23818,
      municipios: 7
    },
    {
      id: 'CO-ATL',
      nombre: 'Atlántico',
      nombreCorto: 'Atlántico',
      capital: 'Barranquilla',
      capitalCoord: [-74.80, 10.97],
      region: 'caribe',
      poblacion: 2804025,
      superficie: 3388,
      municipios: 23
    },
    {
      id: 'CO-DC',
      nombre: 'Bogotá, Distrito Capital',
      nombreCorto: 'Bogotá D.C.',
      capital: 'Bogotá',
      capitalCoord: [-74.08, 4.71],
      region: 'andina',
      poblacion: 8906342,
      superficie: 1139,
      municipios: 1,
      esDistrito: true
    },
    {
      id: 'CO-BOL',
      nombre: 'Bolívar',
      nombreCorto: 'Bolívar',
      capital: 'Cartagena de Indias',
      capitalCoord: [-75.51, 10.39],
      region: 'caribe',
      poblacion: 2236603,
      superficie: 25978,
      municipios: 46
    },
    {
      id: 'CO-BOY',
      nombre: 'Boyacá',
      nombreCorto: 'Boyacá',
      capital: 'Tunja',
      capitalCoord: [-73.36, 5.54],
      region: 'andina',
      poblacion: 1259601,
      superficie: 23189,
      municipios: 123
    },
    {
      id: 'CO-CAL',
      nombre: 'Caldas',
      nombreCorto: 'Caldas',
      capital: 'Manizales',
      capitalCoord: [-75.51, 5.07],
      region: 'andina',
      poblacion: 1036455,
      superficie: 7888,
      municipios: 27
    },
    {
      id: 'CO-CAQ',
      nombre: 'Caquetá',
      nombreCorto: 'Caquetá',
      capital: 'Florencia',
      capitalCoord: [-75.60, 1.62],
      region: 'amazonia',
      poblacion: 419275,
      superficie: 88965,
      municipios: 16
    },
    {
      id: 'CO-CAS',
      nombre: 'Casanare',
      nombreCorto: 'Casanare',
      capital: 'Yopal',
      capitalCoord: [-72.40, 5.34],
      region: 'orinoquia',
      poblacion: 442068,
      superficie: 44640,
      municipios: 19
    },
    {
      id: 'CO-CAU',
      nombre: 'Cauca',
      nombreCorto: 'Cauca',
      capital: 'Popayán',
      capitalCoord: [-76.61, 2.44],
      region: 'andina',
      poblacion: 1516018,
      superficie: 29308,
      municipios: 41
    },
    {
      id: 'CO-CES',
      nombre: 'Cesar',
      nombreCorto: 'Cesar',
      capital: 'Valledupar',
      capitalCoord: [-73.25, 10.46],
      region: 'caribe',
      poblacion: 1341697,
      superficie: 22905,
      municipios: 25
    },
    {
      id: 'CO-CHO',
      nombre: 'Chocó',
      nombreCorto: 'Chocó',
      capital: 'Quibdó',
      capitalCoord: [-76.66, 5.69],
      region: 'pacifica',
      poblacion: 553519,
      superficie: 46530,
      municipios: 31
    },
    {
      id: 'CO-COR',
      nombre: 'Córdoba',
      nombreCorto: 'Córdoba',
      capital: 'Montería',
      capitalCoord: [-75.88, 8.75],
      region: 'caribe',
      poblacion: 1856496,
      superficie: 25020,
      municipios: 30
    },
    {
      id: 'CO-CUN',
      nombre: 'Cundinamarca',
      nombreCorto: 'Cundinamarca',
      capital: 'Bogotá',
      capitalCoord: [-74.08, 4.71],
      region: 'andina',
      poblacion: 2473634,
      superficie: 23071,
      municipios: 116,
      capitalFuera: true
    },
    {
      id: 'CO-GUA',
      nombre: 'Guainía',
      nombreCorto: 'Guainía',
      capital: 'Inírida',
      capitalCoord: [-67.92, 3.87],
      region: 'amazonia',
      poblacion: 52061,
      superficie: 72238,
      municipios: 2
    },
    {
      id: 'CO-GUV',
      nombre: 'Guaviare',
      nombreCorto: 'Guaviare',
      capital: 'San José del Guaviare',
      capitalCoord: [-72.64, 2.57],
      region: 'amazonia',
      poblacion: 90357,
      superficie: 53460,
      municipios: 4
    },
    {
      id: 'CO-HUI',
      nombre: 'Huila',
      nombreCorto: 'Huila',
      capital: 'Neiva',
      capitalCoord: [-75.28, 2.93],
      region: 'andina',
      poblacion: 1140932,
      superficie: 19890,
      municipios: 37
    },
    {
      id: 'CO-LAG',
      nombre: 'La Guajira',
      nombreCorto: 'La Guajira',
      capital: 'Riohacha',
      capitalCoord: [-72.91, 11.54],
      region: 'caribe',
      poblacion: 1002394,
      superficie: 20848,
      municipios: 15
    },
    {
      id: 'CO-MAG',
      nombre: 'Magdalena',
      nombreCorto: 'Magdalena',
      capital: 'Santa Marta',
      capitalCoord: [-74.20, 11.24],
      region: 'caribe',
      poblacion: 1463427,
      superficie: 23188,
      municipios: 30
    },
    {
      id: 'CO-MET',
      nombre: 'Meta',
      nombreCorto: 'Meta',
      capital: 'Villavicencio',
      capitalCoord: [-73.63, 4.14],
      region: 'orinoquia',
      poblacion: 1080706,
      superficie: 85635,
      municipios: 29
    },
    {
      id: 'CO-NAR',
      nombre: 'Nariño',
      nombreCorto: 'Nariño',
      capital: 'Pasto',
      capitalCoord: [-77.28, 1.21],
      region: 'andina',
      poblacion: 1629181,
      superficie: 33268,
      municipios: 64
    },
    {
      id: 'CO-NSA',
      nombre: 'Norte de Santander',
      nombreCorto: 'N. de Santander',
      capital: 'Cúcuta',
      capitalCoord: [-72.50, 7.89],
      region: 'andina',
      poblacion: 1651278,
      superficie: 21658,
      municipios: 40
    },
    {
      id: 'CO-PUT',
      nombre: 'Putumayo',
      nombreCorto: 'Putumayo',
      capital: 'Mocoa',
      capitalCoord: [-76.65, 1.15],
      region: 'amazonia',
      poblacion: 369064,
      superficie: 24885,
      municipios: 13
    },
    {
      id: 'CO-QUI',
      nombre: 'Quindío',
      nombreCorto: 'Quindío',
      capital: 'Armenia',
      capitalCoord: [-75.68, 4.53],
      region: 'andina',
      poblacion: 569569,
      superficie: 1845,
      municipios: 12
    },
    {
      id: 'CO-RIS',
      nombre: 'Risaralda',
      nombreCorto: 'Risaralda',
      capital: 'Pereira',
      capitalCoord: [-75.69, 4.81],
      region: 'andina',
      poblacion: 977829,
      superficie: 4140,
      municipios: 14
    },
    {
      id: 'CO-SAP',
      nombre: 'San Andrés y Providencia',
      nombreCorto: 'San Andrés y Prov.',
      capital: 'San Andrés',
      capitalCoord: [-81.70, 12.58],
      region: 'insular',
      poblacion: 65228,
      superficie: 44,
      municipios: 2
    },
    {
      id: 'CO-SAN',
      nombre: 'Santander',
      nombreCorto: 'Santander',
      capital: 'Bucaramanga',
      capitalCoord: [-73.12, 7.13],
      region: 'andina',
      poblacion: 2324090,
      superficie: 30537,
      municipios: 87
    },
    {
      id: 'CO-SUC',
      nombre: 'Sucre',
      nombreCorto: 'Sucre',
      capital: 'Sincelejo',
      capitalCoord: [-75.40, 9.30],
      region: 'caribe',
      poblacion: 972350,
      superficie: 10917,
      municipios: 26
    },
    {
      id: 'CO-TOL',
      nombre: 'Tolima',
      nombreCorto: 'Tolima',
      capital: 'Ibagué',
      capitalCoord: [-75.24, 4.44],
      region: 'andina',
      poblacion: 1346935,
      superficie: 23562,
      municipios: 47
    },
    {
      id: 'CO-VAC',
      nombre: 'Valle del Cauca',
      nombreCorto: 'Valle del Cauca',
      capital: 'Cali',
      capitalCoord: [-76.53, 3.45],
      region: 'pacifica',
      poblacion: 4589278,
      superficie: 22140,
      municipios: 42
    },
    {
      id: 'CO-VAU',
      nombre: 'Vaupés',
      nombreCorto: 'Vaupés',
      capital: 'Mitú',
      capitalCoord: [-70.24, 1.20],
      region: 'amazonia',
      poblacion: 48932,
      superficie: 54135,
      municipios: 3
    },
    {
      id: 'CO-VID',
      nombre: 'Vichada',
      nombreCorto: 'Vichada',
      capital: 'Puerto Carreño',
      capitalCoord: [-67.49, 6.19],
      region: 'orinoquia',
      poblacion: 115778,
      superficie: 100242,
      municipios: 4
    }
  ]
};

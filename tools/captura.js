/* Captura headless para revisar el mapa.
   Uso: node tools/captura.js [idDepartamento] [archivoSalida] [ancho] [alto] */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PUERTO = 9229;
const URL = 'http://localhost:8099/index.html';
const hover = process.argv[2] || '';
const salida = process.argv[3] || path.join(os.tmpdir(), 'atlas-hover.png');
const ancho = Number(process.argv[4]) || 1400;
const alto = Number(process.argv[5]) || 1200;
const modo = process.argv[6] || '';
const paginaCompleta = modo.includes('full');
const perfil = path.join(os.tmpdir(), 'atlas-chrome-' + Date.now());

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--hide-crash-restore-bubble',
    '--remote-debugging-port=' + PUERTO,
    '--user-data-dir=' + perfil,
    '--window-size=' + ancho + ',' + alto,
    URL
  ],
  { stdio: 'ignore' }
);

async function objetivo() {
  for (let i = 0; i < 50; i++) {
    try {
      const respuesta = await fetch('http://127.0.0.1:' + PUERTO + '/json/list');
      const lista = await respuesta.json();
      const pagina = lista.find((item) => item.type === 'page');
      if (pagina) return pagina;
    } catch (error) {
      /* Chrome todavía no está listo */
    }
    await dormir(300);
  }
  throw new Error('Chrome no abrió el puerto de depuración.');
}

async function conectar(url) {
  const ws = new WebSocket(url);
  const pendientes = new Map();
  let siguiente = 0;

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  ws.addEventListener('message', (evento) => {
    const mensaje = JSON.parse(evento.data);
    if (!mensaje.id) return;
    const promesa = pendientes.get(mensaje.id);
    if (!promesa) return;
    pendientes.delete(mensaje.id);
    if (mensaje.error) promesa.reject(new Error(mensaje.error.message));
    else promesa.resolve(mensaje.result);
  });

  return {
    enviar(method, params) {
      const id = ++siguiente;
      return new Promise((resolve, reject) => {
        pendientes.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    },
    cerrar() {
      ws.close();
    }
  };
}

(async () => {
  try {
    const pagina = await objetivo();
    const cdp = await conectar(pagina.webSocketDebuggerUrl);
    await cdp.enviar('Page.enable');
    await cdp.enviar('Runtime.enable');

    for (let i = 0; i < 40; i++) {
      const estado = await cdp.enviar('Runtime.evaluate', {
        expression: "document.querySelectorAll('.departamento').length",
        returnByValue: true
      });
      if (estado.result.value === 32) break;
      await dormir(250);
    }
    await dormir(500);

    async function evaluar(expression) {
      const resultado = await cdp.enviar('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      return resultado.result.value;
    }

    await evaluar(`
      window.__eventosPrueba = [];
      ['pointerdown', 'pointerup', 'click'].forEach((tipo) => {
        document.addEventListener(tipo, (evento) => {
          const grupo = evento.target.closest ? evento.target.closest('.departamento') : null;
          window.__eventosPrueba.push({
            tipo: tipo,
            etiqueta: evento.target.tagName,
            dept: grupo ? grupo.dataset.id : null,
            detalle: evento.detail,
            x: Math.round(evento.clientX),
            y: Math.round(evento.clientY)
          });
        }, true);
      });
    `);

    if (modo.includes('drag')) {
      const centroMapa = await evaluar(`(() => {
        const r = document.querySelector('.mapa').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, innerHeight / 2) };
      })()`);

      await cdp.enviar('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x: centroMapa.x,
        y: centroMapa.y,
        deltaX: 0,
        deltaY: -500
      });
      await dormir(450);

      const inicio = centroMapa;
      await cdp.enviar('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: inicio.x,
        y: inicio.y,
        button: 'left',
        buttons: 1,
        clickCount: 1
      });

      const muestras = [];
      for (let i = 1; i <= 30; i++) {
        const x = inicio.x + i * 4.5;
        const y = inicio.y + i * 2;
        await cdp.enviar('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x,
          y,
          button: 'left',
          buttons: 1
        });
        await dormir(16);
        if (i % 6 === 0 || i === 30) {
          muestras.push(await evaluar("document.getElementById('lienzo').getAttribute('viewBox')"));
        }
      }

      await cdp.enviar('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: inicio.x + 135,
        y: inicio.y + 60,
        button: 'left',
        buttons: 0,
        clickCount: 1
      });
      await dormir(500);

      const estadoArrastre = await evaluar(`(() => ({
        viewBox: document.getElementById('lienzo').getAttribute('viewBox'),
        seleccion: document.getElementById('mapa').classList.contains('tiene-seleccion'),
        eventos: window.__eventosPrueba.slice(-8),
        arrastrando: document.getElementById('lienzo').classList.contains('arrastrando')
      }))()`);

      const puntoClic = await evaluar(`(() => {
        const mapa = document.querySelector('.mapa').getBoundingClientRect();
        const grupos = Array.from(document.querySelectorAll('.departamento'));
        for (const grupo of grupos) {
          const r = grupo.querySelector('path').getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          if (x > mapa.left + 90 && x < mapa.right - 90 && y > mapa.top + 110 && y < mapa.bottom - 230) {
            return { x, y, id: grupo.dataset.id };
          }
        }
        return null;
      })()`);

      if (puntoClic) {
        await cdp.enviar('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: puntoClic.x,
          y: puntoClic.y,
          buttons: 0
        });
        await cdp.enviar('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: puntoClic.x,
          y: puntoClic.y,
          button: 'left',
          buttons: 1,
          clickCount: 1
        });
        await cdp.enviar('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: puntoClic.x,
          y: puntoClic.y,
          button: 'left',
          buttons: 0,
          clickCount: 1
        });
        await dormir(1000);
      }

      const estadoClic = await evaluar(`(() => ({
        viewBox: document.getElementById('lienzo').getAttribute('viewBox'),
        seleccion: document.getElementById('mapa').classList.contains('tiene-seleccion'),
        activo: document.querySelector('.departamento.activo')?.dataset.id || null,
        ficha: document.getElementById('ficha').innerText.slice(0, 45).replace(/\\n/g, ' · '),
        eventos: window.__eventosPrueba.slice(-8)
      }))()`);

      console.log(JSON.stringify({ muestras, estadoArrastre, puntoClic, estadoClic }, null, 2));
    }

    if (modo.includes('touch')) {
      await cdp.enviar('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
      const centroMapa = await evaluar(`(() => {
        const r = document.querySelector('.mapa').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, innerHeight / 2) };
      })()`);
      const puntos = (separacion) => [
        { x: centroMapa.x - separacion, y: centroMapa.y, id: 1, radiusX: 2, radiusY: 2, force: 1 },
        { x: centroMapa.x + separacion, y: centroMapa.y, id: 2, radiusX: 2, radiusY: 2, force: 1 }
      ];
      await cdp.enviar('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: puntos(70)
      });
      for (let i = 1; i <= 12; i++) {
        await cdp.enviar('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: puntos(70 + i * 9)
        });
        await dormir(20);
      }
      await cdp.enviar('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await dormir(500);
      const estadoPellizco = await evaluar(`(() => ({
        viewBox: document.getElementById('lienzo').getAttribute('viewBox'),
        seleccion: document.getElementById('mapa').classList.contains('tiene-seleccion'),
        arrastrando: document.getElementById('lienzo').classList.contains('arrastrando')
      }))()`);
      console.log(JSON.stringify({ estadoPellizco }, null, 2));
    }

    if (modo.includes('inset')) {
      await evaluar("document.getElementById('inset').click()");
      await dormir(900);
    }

    if (hover && !modo.includes('drag')) {
      const punto = await cdp.enviar('Runtime.evaluate', {
        expression:
          "(() => { const g = document.querySelector('.departamento[data-id=\"" +
          hover +
          "\"] path'); if (!g) return null; const r = g.getBoundingClientRect(); return {x:r.x + r.width/2, y:r.y + r.height/2}; })()",
        returnByValue: true
      });
      if (punto.result.value) {
        await cdp.enviar('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: punto.result.value.x,
          y: punto.result.value.y,
          buttons: 0
        });
        await dormir(300);
        if (modo.includes('click')) {
          await cdp.enviar('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: punto.result.value.x,
            y: punto.result.value.y,
            button: 'left',
            buttons: 1,
            clickCount: 1
          });
          await cdp.enviar('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: punto.result.value.x,
            y: punto.result.value.y,
            button: 'left',
            buttons: 0,
            clickCount: 1
          });
          await dormir(1200);
        }
        await dormir(400);
      }
    }

    let clip;
    if (paginaCompleta) {
      const metricas = await cdp.enviar('Page.getLayoutMetrics');
      const contenido = metricas.cssContentSize;
      clip = { x: 0, y: 0, width: contenido.width, height: contenido.height, scale: 1 };
    }

    const captura = await cdp.enviar('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: Boolean(paginaCompleta),
      fromSurface: true,
      ...(clip ? { clip } : {})
    });
    fs.writeFileSync(salida, Buffer.from(captura.data, 'base64'));
    console.log(salida);
    cdp.cerrar();
  } catch (error) {
    console.error(error);
  } finally {
    chrome.kill();
  }
})();

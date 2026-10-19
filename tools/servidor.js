/* Servidor estático mínimo para probar el atlas en el navegador.
   Uso: node tools/servidor.js [puerto] */
const http = require('http');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const puerto = Number(process.argv[2]) || 8099;

const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const relativo = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    const archivo = path.join(raiz, relativo);

    if (!archivo.startsWith(raiz)) {
      res.writeHead(403);
      res.end('Prohibido');
      return;
    }

    fs.readFile(archivo, (error, contenido) => {
      if (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('No encontrado: ' + relativo);
        return;
      }
      res.writeHead(200, { 'Content-Type': tipos[path.extname(archivo).toLowerCase()] || 'application/octet-stream' });
      res.end(contenido);
    });
  })
  .listen(puerto, () => console.log('Servidor en http://localhost:' + puerto));

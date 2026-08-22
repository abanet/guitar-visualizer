#!/usr/bin/env node
/*
 * Servidor local mínimo para que el botón "Generar vídeos" de la propia app web dispare la
 * generación por lotes, sin tener que usar la terminal ni escribir rutas de disco a mano.
 *
 * La app no puede leer rutas absolutas del selector de carpeta del navegador (restricción de
 * seguridad), así que el flujo es: eliges la carpeta visualmente (input con webkitdirectory), el
 * navegador lee su contenido y lo SUBE aquí (audio + sesiones + config visual, todo en una
 * petición), este servidor genera los vídeos en segundo plano, y la app te da un enlace de
 * descarga por cada vídeo terminado.
 *
 * Arranque (una vez, se queda corriendo en segundo plano):
 *   node scripts/server.js
 *
 * Solo escucha en localhost — no expone nada a la red.
 *
 * Endpoints:
 *   GET  /api/status              → estado del último lote lanzado (o {idle:true} si ninguno)
 *   POST /api/generate            → multipart/form-data, ver parseUpload() abajo. Arranca el lote.
 *   POST /api/cancel              → detiene el lote en curso (best-effort)
 *   GET  /api/download?tag=<tag>  → descarga el vídeo ya terminado de ese job
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Busboy = require('busboy');
const { runBatch, requestCancel } = require('./lib/batch-sessions');

const PORT = process.env.GV_SERVER_PORT ? parseInt(process.env.GV_SERVER_PORT, 10) : 8787;
const repoRoot = path.resolve(__dirname, '..');
const defaultAppPath = path.join(repoRoot, 'guitarvisualizer.html');
const videoOutRoot = path.join(repoRoot, 'video-out');

let currentState = { idle: true };
let running = false;

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function sanitizeName(name) {
  return String(name || 'lote').replace(/[^\w\-]+/g, '_').slice(0, 60) || 'lote';
}

// Recibe el multipart del navegador: el archivo de audio, uno o más .json de sesión, y campos
// de texto (config visual ya serializada, segundos extra, concurrencia, nombre de carpeta).
function parseUpload(req) {
  return new Promise((resolve, reject) => {
    const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-upload-'));
    const sessionsDir = path.join(uploadDir, 'sessions');
    fs.mkdirSync(sessionsDir);

    const fields = {};
    let audioPath = null;
    const pendingWrites = [];
    let sawFile = false;

    let bb;
    try { bb = Busboy({ headers: req.headers, limits: { fileSize: 300 * 1024 * 1024 } }); }
    catch (e) { return reject(e); }

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (name, stream, info) => {
      sawFile = true;
      const filename = info.filename || 'file';
      let destPath;
      if (name === 'audio') destPath = path.join(uploadDir, 'audio' + (path.extname(filename) || '.m4a'));
      else destPath = path.join(sessionsDir, path.basename(filename));
      const writeStream = fs.createWriteStream(destPath);
      const p = new Promise((res, rej) => {
        writeStream.on('finish', res);
        writeStream.on('error', rej);
        stream.on('error', rej);
      });
      pendingWrites.push(p);
      if (name === 'audio') audioPath = destPath;
      stream.pipe(writeStream);
    });

    bb.on('error', reject);
    bb.on('finish', async () => {
      try {
        await Promise.all(pendingWrites);
        if (!sawFile) return reject(new Error('No se recibió ningún archivo.'));
        resolve({ uploadDir, sessionsDir, audioPath, fields });
      } catch (e) { reject(e); }
    });

    req.pipe(bb);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/api/ping') return send(res, 200, { ok: true });
  if (req.method === 'GET' && url.pathname === '/api/status') return send(res, 200, currentState);

  if (req.method === 'POST' && url.pathname === '/api/cancel') {
    requestCancel();
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/download') {
    const tag = url.searchParams.get('tag');
    const job = (currentState.jobs || []).find((j) => j.tag === tag);
    if (!job || job.status !== 'done' || !job.outPath || !fs.existsSync(job.outPath)) {
      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
      return res.end('No encontrado');
    }
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${tag}.mp4"`,
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(job.outPath).pipe(res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/generate') {
    if (running) return send(res, 409, { error: 'Ya hay un lote en marcha. Espera a que termine o cancélalo primero.' });

    let upload;
    try { upload = await parseUpload(req); }
    catch (e) { return send(res, 400, { error: 'No se pudo procesar la subida: ' + e.message }); }

    if (!upload.audioPath) return send(res, 400, { error: 'Falta el archivo de audio en la carpeta elegida.' });

    const extraSec = upload.fields.extra !== undefined ? parseFloat(upload.fields.extra) : 2;
    const concurrency = upload.fields.concurrency ? parseInt(upload.fields.concurrency, 10) : 1;
    const width = upload.fields.width ? parseInt(upload.fields.width, 10) : 1600;
    const height = upload.fields.height ? parseInt(upload.fields.height, 10) : 900;
    let visConfig = null;
    if (upload.fields.visConfig) {
      try { visConfig = JSON.parse(upload.fields.visConfig); }
      catch (e) { return send(res, 400, { error: 'Configuración visual inválida: ' + e.message }); }
    }
    const outDir = path.join(videoOutRoot, sanitizeName(upload.fields.folderName) + '-' + Date.now());

    running = true;
    currentState = { idle: false, running: true, startedAt: Date.now(), jobs: [], outDir };
    send(res, 200, { started: true });

    runBatch({
      appPath: defaultAppPath, dir: upload.sessionsDir, audioPath: upload.audioPath, outDir,
      extraSec, visConfig, visConfigPath: null, concurrency, width, height,
      onUpdate: (state) => { currentState = { idle: false, outDir, ...state }; },
    }).then((state) => {
      currentState = { idle: false, outDir, ...state };
    }).catch((e) => {
      currentState = { idle: false, running: false, fatalError: e.message, jobs: currentState.jobs || [], outDir };
    }).finally(() => {
      running = false;
      fs.rm(upload.uploadDir, { recursive: true, force: true }, () => {});
    });

    return;
  }

  send(res, 404, { error: 'No encontrado: ' + req.method + ' ' + url.pathname });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor de generación de vídeos escuchando en http://localhost:${PORT}`);
  console.log('Déjalo corriendo — la app le habla desde la pestaña "Vídeo" (botón "Generar vídeos").');
  console.log('Vídeos generados en: ' + videoOutRoot);
});

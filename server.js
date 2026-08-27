const http = require('http');
const fs = require('fs');
const path = require('path');
const GUN = require('gun');

const PORT = Number(process.env.PORT) || 3456;
const DATA_DIR = path.join(__dirname, 'data');
const rooms = new Map();

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function roomFile(id) {
  return path.join(DATA_DIR, `${id}.json`);
}

function readRoomFile(id) {
  try {
    return JSON.parse(fs.readFileSync(roomFile(id), 'utf8'));
  } catch {
    return null;
  }
}

function writeRoomFile(id, data) {
  fs.writeFileSync(roomFile(id), JSON.stringify(data));
}

const serve = GUN.serve(__dirname);
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/room/')) {
    const id = url.pathname.slice('/api/room/'.length);
    if (!id) {
      res.writeHead(400).end('missing id');
      return;
    }

    if (req.method === 'GET') {
      const data = rooms.get(id) || readRoomFile(id);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(data));
      return;
    }

    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          rooms.set(id, data);
          writeRoomFile(id, data);
          gun.get('truqui-v2').get(id).get('state').put(JSON.stringify(data));
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
          });
          res.end('ok');
        } catch {
          res.writeHead(400).end('bad json');
        }
      });
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }
  }

  return serve(req, res);
});

const gun = GUN({ web: server, file: DATA_DIR });

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Puerto ${PORT} ocupado. Liberá con: kill $(lsof -t -i:${PORT})`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`Truqui → http://localhost:${PORT}`);
  console.log(`GUN relay → http://localhost:${PORT}/gun`);
});

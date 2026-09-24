// خادم تطوير بسيط: يقدّم ملفات اللعبة ويحفظ لقطات الشاشة المرسلة إلى /shot
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/shot')) {
    const name = (new URL(req.url, 'http://x').searchParams.get('n') || 'shot').replace(/[^\w-]/g, '');
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      fs.mkdirSync(path.join(root, 'tools', 'shots'), { recursive: true });
      fs.writeFileSync(path.join(root, 'tools', 'shots', name + '.png'), Buffer.from(body.split(',')[1], 'base64'));
      res.end('ok');
    });
    return;
  }
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(8766, () => console.log('dev server on 8766'));

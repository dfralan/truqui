import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');

const copy = (src, dest = src) => {
  const from = join(root, src);
  const to = join(dist, dest);
  if (!existsSync(from)) return;
  mkdirSync(join(to, '..'), { recursive: true });
  cpSync(from, to, { recursive: true });
};

copy('img');
copy('style.css');
copy('funnel.css');
copy('players.jpg');
copy('preview.jpeg');
copy('robots.txt');
copy('sitemap.xml');
copy('index.html');
copy('truqui.html');

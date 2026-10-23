
const fs = require('fs');
const path = require('path');

const root = __dirname;

function readFile(...candidates) {
  for (const file of candidates) {
    const fullPath = path.join(root, file);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fs.readFileSync(fullPath, 'utf8');
    }
  }
  throw new Error(`Missing file: ${candidates.join(' or ')}`);
}

let html = readFile('index.html');

const css = readFile('css/style.css', 'style.css');
html = html.replace(
  '<link rel="stylesheet" href="css/style.css">',
  () => `<style>\n${css}\n</style>`
);

const scripts = [
  ['js/data.js', 'data.js'],
  ['js/utils.js', 'utils.js'],
  ['js/render.js', 'render.js'],
  ['js/app.js', 'app.js']
];

for (const candidates of scripts) {
  const tag = `<script src="${candidates[0]}"></script>`;
  if (!html.includes(tag)) {
    throw new Error(`Missing script tag: ${tag}`);
  }

  const source = readFile(...candidates);
  html = html.replace(tag, () => `<script>\n${source}\n</script>`);
}

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html, 'utf8');

console.log('Build successful');

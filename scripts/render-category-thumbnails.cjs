const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const categories = ['uniforms', 'safety-vests', 'hand-protection', 'safety-shoes', 'helmets', 'eye-face-protection', 'hearing-respiratory', 'traffic-safety', 'hardware-tools'];
const imagePattern = /<image href="([^"]+)" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" preserveAspectRatio="xMidYMid meet"\/>/g;

(async () => {
  let rendered = 0;
  for (const category of categories) {
    const directory = path.join('assets', 'img', 'category', category);
    for (const filename of fs.readdirSync(directory).filter(name => name.endsWith('.svg'))) {
      let svg = fs.readFileSync(path.join(directory, filename), 'utf8');
      const products = [...svg.matchAll(imagePattern)];
      svg = svg.replace(imagePattern, '');
      const layers = [];
      for (const product of products) {
        const width = Number(product[4]);
        const height = Number(product[5]);
        const source = product[1].replaceAll('&amp;', '&');
        const input = source.startsWith('data:')
          ? Buffer.from(source.slice(source.indexOf(',') + 1), 'base64')
          : Buffer.from(await (await fetch(source)).arrayBuffer());
        const resized = await sharp(input).resize(width, height, {
          fit: 'contain',
          background: { r: 247, g: 248, b: 250, alpha: 0 }
        }).png().toBuffer();
        layers.push({ input: resized, left: Number(product[2]), top: Number(product[3]) });
      }
      const background = await sharp(Buffer.from(svg)).png().toBuffer();
      const output = path.join(directory, filename.replace(/\.svg$/, '.png'));
      await sharp(background).composite(layers).png({ compressionLevel: 9 }).toFile(output);
      rendered += 1;
    }
  }
  console.log(`Rendered ${rendered} category thumbnails.`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});

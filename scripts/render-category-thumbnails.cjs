const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const categories = ['uniforms', 'hand-protection', 'safety-shoes', 'helmets', 'eye-face-protection', 'hearing-respiratory'];
const imagePattern = /<image href="data:([^;]+);base64,([^"]+)" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" preserveAspectRatio="xMidYMid meet"\/>/g;

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
        const width = Number(product[5]);
        const height = Number(product[6]);
        const input = Buffer.from(product[2], 'base64');
        const resized = await sharp(input).resize(width, height, {
          fit: 'contain',
          background: { r: 247, g: 248, b: 250, alpha: 0 }
        }).png().toBuffer();
        layers.push({ input: resized, left: Number(product[3]), top: Number(product[4]) });
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

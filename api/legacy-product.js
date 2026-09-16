import fs from 'node:fs';

const products = JSON.parse(
  fs.readFileSync(new URL('../data/products-live.json', import.meta.url), 'utf8')
);

const paths = new Map(products.map(product => [
  `${product.category}-${String(product.sku).toLowerCase()}`,
  `/products/${product.slug}/`
]));

export default function handler(request, response) {
  const value = request.query.p || request.query.uid;
  const productId = Array.isArray(value) ? value[0] : value;
  const destination = paths.get(String(productId || '').toLowerCase());

  response.setHeader('Location', destination || '/shop.html');
  return response.status(308).end();
}

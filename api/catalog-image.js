const PRODUCTS = 'https://myodfvshmusywmhdozwt.supabase.co/rest/v1/products_public';
const KEY = 'sb_publishable_yqVW7IVTIgSarj8nKwVTuQ_zrj80eQ-';

export default async function handler(req, res) {
  const requested = String(req.query.name || '').replace(/\.(avif|webp|png|jpe?g)$/i, '');
  const match = requested.match(/^(.*?)(?:--(\d+))?$/);
  const slug = String(req.query.slug || '');
  const imageIndex = Math.max(0, Number(match?.[2] || 1) - 1);
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).end('Invalid image');

  const query = `${PRODUCTS}?select=images&slug=eq.${encodeURIComponent(slug)}&limit=1`;
  const productResponse = await fetch(query, { headers: { apikey: KEY } });
  const rows = productResponse.ok ? await productResponse.json() : [];
  const source = rows[0]?.images?.[imageIndex];
  if (!source) return res.status(404).end('Image not found');

  const imageResponse = await fetch(source);
  if (!imageResponse.ok) return res.status(502).end('Image unavailable');
  res.setHeader('Content-Type', imageResponse.headers.get('content-type') || 'image/webp');
  res.setHeader('Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=86400');
  res.status(200).send(Buffer.from(await imageResponse.arrayBuffer()));
}

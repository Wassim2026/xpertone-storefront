const CATEGORY_PATHS = new Set([
  'eye-face-protection',
  'hand-protection',
  'hardware-tools',
  'hearing-respiratory',
  'helmets',
  'rainwear-marine',
  'safety-shoes',
  'safety-vests',
  'traffic-safety',
  'uniforms'
]);

export default function middleware(request) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  if (!CATEGORY_PATHS.has(category)) {
    return;
  }

  url.pathname = `/category/${category}/`;
  url.search = '';

  return Response.redirect(url, 308);
}

export const config = {
  matcher: [
    {
      source: '/shop.html',
      has: [{ type: 'query', key: 'category' }]
    }
  ]
};

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

export default function handler(request, response) {
  const value = request.query.category;
  const category = Array.isArray(value) ? value[0] : value;

  if (!CATEGORY_PATHS.has(category)) {
    return response.status(404).end();
  }

  response.setHeader('Location', `/category/${category}/`);
  return response.status(308).end();
}

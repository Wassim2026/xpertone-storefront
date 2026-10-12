#!/usr/bin/env python3
"""Apply metadata and direct-link fixes without regenerating catalogue pages.

The storefront's catalogue generator can rebuild product/category bodies from a
remote data source. This maintenance step intentionally changes only each
existing product page's <head> plus legacy /shop.html hrefs, preserving the
restored images, category assignments, copy and order UI byte-for-byte.
"""

from __future__ import annotations

import html as html_lib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://www.xpertonecreative.com"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", html_lib.unescape(value)).strip()


def seo_title(product_name: str, sku: str) -> str:
    suffix = f" | SKU {sku.upper()} | Xpertone" if sku else " | Xpertone Dubai"
    shortened = product_name
    while len(html_lib.escape(f"{shortened}{suffix}", quote=True)) > 60:
        next_value = re.sub(r"\s+\S*$", "", shortened).rstrip(" ,:;-|")
        shortened = next_value if next_value and next_value != shortened else shortened[:-1].rstrip(" ,:;-|")
    return f"{shortened}{suffix}"


def first_match(source: str, pattern: str, default: str = "") -> str:
    match = re.search(pattern, source, flags=re.I | re.S)
    return match.group(1) if match else default


def update_product(path: Path) -> bool:
    source = path.read_text(encoding="utf-8")
    name = clean(first_match(source, r'<h1\s+class="mt-1">(.*?)</h1>'))
    sku = clean(first_match(source, r'<p\s+class="product-sku">SKU:\s*<strong>(.*?)</strong>'))
    if not name:
        raise ValueError(f"Product name not found in {path.relative_to(ROOT)}")

    title = seo_title(name, sku)
    description = first_match(source, r'<meta\s+name="description"\s+content="([^"]*)"')
    image = first_match(source, r'<meta\s+property="og:image"\s+content="([^"]*)"', f"{ORIGIN}/assets/img/brand/og-xpertone.png")
    slug = path.parent.name
    canonical = f"{ORIGIN}/products/{slug}/"

    updated = re.sub(r'<title>[\s\S]*?</title>', f"<title>{html_lib.escape(title)}</title>", source, count=1, flags=re.I)
    updated = re.sub(r'\s*<link\s+rel="canonical"[^>]*>', "", updated, flags=re.I)
    updated = re.sub(r'\s*<meta\s+(?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*>', "", updated, flags=re.I)
    metadata = (
        f'\n<link rel="canonical" href="{canonical}">'
        f'\n<meta property="og:type" content="product">'
        f'\n<meta property="og:title" content="{html_lib.escape(title)}">'
        f'\n<meta property="og:description" content="{html_lib.escape(description)}">'
        f'\n<meta property="og:url" content="{canonical}">'
        f'\n<meta property="og:image" content="{html_lib.escape(image)}">'
        f'\n<meta name="twitter:card" content="summary_large_image">'
        f'\n<meta name="twitter:title" content="{html_lib.escape(title)}">'
        f'\n<meta name="twitter:description" content="{html_lib.escape(description)}">'
        f'\n<meta name="twitter:image" content="{html_lib.escape(image)}">'
    )
    description_tag = re.search(r'<meta\s+name="description"\s+content="[^"]*">', updated, flags=re.I)
    if not description_tag:
        raise ValueError(f"Description metadata not found in {path.relative_to(ROOT)}")
    insert_at = description_tag.end()
    updated = f"{updated[:insert_at]}{metadata}{updated[insert_at:]}"

    if updated == source:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def direct_catalogue_links(path: Path) -> int:
    source = path.read_text(encoding="utf-8")
    updated, count = re.subn(r'href=(["\'])/?shop\.html\1', r'href=\1/sitemap.html\1', source, flags=re.I)
    if count:
        path.write_text(updated, encoding="utf-8")
    return count


def public_html_files() -> list[Path]:
    files = []
    for path in ROOT.rglob("*.html"):
        relative = path.relative_to(ROOT)
        if any(part in {".git", "admin", "crm"} for part in relative.parts):
            continue
        files.append(path)
    return files


product_files = sorted((ROOT / "products").glob("*/index.html"))
changed_products = sum(update_product(path) for path in product_files)
changed_links = sum(direct_catalogue_links(path) for path in public_html_files())

service_worker = ROOT / "sw.js"
worker_source = service_worker.read_text(encoding="utf-8")
worker_updated, worker_links = re.subn(r"(['\"])/shop\.html\1", r"\1/sitemap.html\1", worker_source)
if worker_links:
    service_worker.write_text(worker_updated, encoding="utf-8")

print({
    "product_pages": len(product_files),
    "product_heads_changed": changed_products,
    "legacy_html_links_replaced": changed_links,
    "service_worker_links_replaced": worker_links,
})

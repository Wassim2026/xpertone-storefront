#!/usr/bin/env python3
"""Strict, dependency-free audit for the static storefront."""

import argparse
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://www.xpertonecreative.com"
RETIRED_UNIFORM_CATEGORIES = [
    "35-65-coverall-without-reflector",
    "35-65-coverall-with-reflector",
    "35-65-pant-shirt-without-reflector",
    "35-65-pant-shirt-with-reflector",
    "other-pant-shirt-sets",
    "workwear-trousers-pants",
    "specialist-coveralls",
    "work-jackets-trouser-sets",
]


def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")


def matches(source, pattern):
    return re.findall(pattern, source, flags=re.I | re.S)


def locs(relative):
    return matches(read(relative), r"<loc>([^<]+)</loc>")


def public_html_files():
    result = []
    for path in ROOT.rglob("*.html"):
        relative = path.relative_to(ROOT)
        if any(part in {".git", "admin", "crm"} for part in relative.parts):
            continue
        result.append(path)
    return sorted(result)


def local_target(base_file, href, has_root_base):
    if not href or href.startswith(("#", "//")) or "{" in href:
        return None
    parsed = urlparse(html.unescape(href))
    if parsed.scheme and parsed.netloc != "www.xpertonecreative.com":
        return None
    if parsed.scheme and parsed.scheme not in {"http", "https"}:
        return None
    pathname = unquote(parsed.path)
    if not pathname:
        return None
    if pathname.startswith("/") or parsed.netloc or has_root_base:
        target = ROOT / pathname.lstrip("/")
    else:
        target = base_file.parent / pathname
    if pathname.endswith("/"):
        target = target / "index.html"
    return target.resolve()


parser = argparse.ArgumentParser()
parser.add_argument("--strict", action="store_true")
parser.add_argument("--output")
args = parser.parse_args()

product_files = sorted((ROOT / "products").glob("*/index.html"))
title_map = {}
product_issues = []
for path in product_files:
    source = path.read_text(encoding="utf-8")
    slug = path.parent.name
    title_match = re.search(r"<title>(.*?)</title>", source, flags=re.I | re.S)
    title = title_match.group(1).strip() if title_match else ""
    sku_match = re.search(r'<p class="product-sku">SKU:\s*<strong>(.*?)</strong>', source, flags=re.I | re.S)
    sku = html.unescape(sku_match.group(1).strip()) if sku_match else ""
    title_map.setdefault(title, []).append(slug)
    if not title or re.match(r"^Product\s*[—-]", title, flags=re.I):
        product_issues.append("%s: generic or missing title" % slug)
    if sku and sku not in html.unescape(title):
        product_issues.append("%s: title missing SKU %s" % (slug, sku))
    if len(title) > 60:
        product_issues.append("%s: title source is %d characters" % (slug, len(title)))
    canonical = "%s/products/%s/" % (ORIGIN, slug)
    if '<link rel="canonical" href="%s">' % canonical not in source:
        product_issues.append("%s: canonical mismatch" % slug)
    for label, pattern in [
        ("canonical", r'<link\s+rel="canonical"'),
        ("og:title", r'<meta\s+property="og:title"'),
        ("twitter:title", r'<meta\s+name="twitter:title"'),
    ]:
        count = len(matches(source, pattern))
        if count != 1:
            product_issues.append("%s: %s count %d" % (slug, label, count))
    if '<meta name="robots" content="index,follow">' not in source:
        product_issues.append("%s: missing index,follow" % slug)

duplicate_titles = [
    {"title": title, "count": len(slugs), "examples": slugs[:5]}
    for title, slugs in title_map.items() if len(slugs) > 1
]

html_files = public_html_files()
legacy_shop = []
broken_links = []
internal_links_checked = 0
for path in html_files:
    source = path.read_text(encoding="utf-8")
    count = len(matches(source, r'href=(["\'])/?shop\.html\1'))
    if count:
        legacy_shop.append({"file": str(path.relative_to(ROOT)), "count": count})
    has_root_base = bool(re.search(r'<base\s+href=["\']/["\']', source, flags=re.I))
    for _, href in re.findall(r'href=(["\'])([^"\']+)\1', source, flags=re.I):
        target = local_target(path, href, has_root_base)
        if target is None:
            continue
        internal_links_checked += 1
        if not target.exists():
            broken_links.append("%s -> %s" % (path.relative_to(ROOT), href))

sitemap_children = locs("sitemap.xml")
child_files = [urlparse(url).path.lstrip("/") for url in sitemap_children]
active_urls = []
for child in child_files:
    if (ROOT / child).exists():
        active_urls.extend(locs(child))
duplicate_sitemap_urls = sorted({url for url in active_urls if active_urls.count(url) > 1})
sitemap_missing_files = []
for url in active_urls:
    target = local_target(ROOT / "index.html", url, True)
    if target is not None and not target.exists():
        sitemap_missing_files.append(url)

posts = json.loads(read("data/blog-posts.json"))
expected_blog_urls = [ORIGIN + "/blog/"] + [ORIGIN + post["url"] for post in posts]
blog_urls_missing = [url for url in expected_blog_urls if url not in active_urls]
blog_issues = []
for post in posts:
    path = ROOT / post["url"].lstrip("/") / "index.html"
    if not path.exists():
        blog_issues.append("%s: missing file" % post["url"])
        continue
    source = path.read_text(encoding="utf-8")
    title = (re.search(r"<title>(.*?)</title>", source, flags=re.I | re.S) or [None, ""])[1]
    description = (re.search(r'<meta\s+name="description"\s+content="([^"]*)"', source, flags=re.I) or [None, ""])[1]
    if not title or len(title) > 60:
        blog_issues.append("%s: title length %d" % (post["url"], len(title)))
    if not description or len(description) > 155:
        blog_issues.append("%s: description length %d" % (post["url"], len(description)))
    if len(matches(source, r"<h1\b")) != 1:
        blog_issues.append("%s: H1 count is not one" % post["url"])
    canonical = ORIGIN + post["url"]
    if '<link rel="canonical" href="%s">' % canonical not in source:
        blog_issues.append("%s: canonical mismatch" % post["url"])
    for payload in matches(source, r'<script\s+type="application/ld\+json">(.*?)</script>'):
        try:
            json.loads(html.unescape(payload))
        except json.JSONDecodeError as error:
            blog_issues.append("%s: invalid JSON-LD (%s)" % (post["url"], error.msg))

redirects = json.loads(read("vercel.json")).get("redirects", [])
category_sitemap = set(locs("sitemap-categories.xml"))
retired_state = []
for slug in RETIRED_UNIFORM_CATEGORIES:
    source = "/category/uniforms/%s/" % slug
    file_path = ROOT / source.lstrip("/") / "index.html"
    retired_state.append({
        "slug": slug,
        "permanentRedirect": any(rule.get("source") == source and rule.get("destination") == "/category/uniforms/" and rule.get("permanent") is True for rule in redirects),
        "staticFileExists": file_path.exists(),
        "inCategorySitemap": ORIGIN + source in category_sitemap,
    })

result = {
    "productPages": len(product_files),
    "uniqueProductTitles": len(title_map),
    "duplicateProductTitleGroups": len(duplicate_titles),
    "duplicateProductTitles": duplicate_titles[:10],
    "productIssueCount": len(product_issues),
    "productIssueExamples": product_issues[:20],
    "publicHtmlFiles": len(html_files),
    "legacyShopLinks": sum(item["count"] for item in legacy_shop),
    "legacyShopFiles": len(legacy_shop),
    "internalLinksChecked": internal_links_checked,
    "brokenInternalLinks": len(broken_links),
    "brokenInternalLinkExamples": broken_links[:20],
    "sitemapChildren": sitemap_children,
    "activeSitemapUrls": len(active_urls),
    "duplicateSitemapUrls": duplicate_sitemap_urls,
    "sitemapMissingFiles": sitemap_missing_files,
    "blogPosts": len(posts),
    "blogUrlsMissingFromActiveSitemaps": blog_urls_missing,
    "blogIssueCount": len(blog_issues),
    "blogIssueExamples": blog_issues[:20],
    "retiredUniformCategories": retired_state,
}

output = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
print(output, end="")
if args.output:
    output_path = ROOT / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output, encoding="utf-8")

retired_wrong = [item for item in retired_state if not item["permanentRedirect"] or item["inCategorySitemap"] or item["staticFileExists"]]
failed = any([
    product_issues,
    duplicate_titles,
    legacy_shop,
    broken_links,
    duplicate_sitemap_urls,
    sitemap_missing_files,
    blog_urls_missing,
    blog_issues,
    retired_wrong,
])
if args.strict and failed:
    sys.exit(1)

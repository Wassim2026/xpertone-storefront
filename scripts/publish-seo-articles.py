#!/usr/bin/env python3
"""Build reviewed Markdown buyer guides into the static Xpertone blog."""

import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://www.xpertonecreative.com"
DATE = "2026-10-12"
DATE_LABEL = "12 October 2026"

ARTICLES = [
    {
        "source": "content/blog/01-uniform-size-split-uae.md",
        "slug": "bulk-uniform-size-split-uae",
        "category": "Uniform Planning",
        "kicker": "Bulk uniform planning guide",
        "lead": "Turn a staff list into a clear garment-by-garment size split, including separate shirt and trouser quantities, spares and multi-site packing.",
        "excerpt": "Build a usable bulk uniform size split with a worked 40-person example, separate garment quantities, spare stock and multi-site reconciliation.",
        "image": "/assets/img/category/uniforms/100-twill-pant-shirt-without-reflector.png",
        "image_alt": "Current Xpertone pant-and-shirt workwear category image used to illustrate uniform size planning",
        "image_caption": "Choose the exact garment first, then record sizes against that product's own size chart.",
        "related": [
            ("/blog/work-uniform-supplier-dubai-guide/", "How to Choose a Work Uniform Supplier"),
            ("/category/uniforms/", "Browse Workwear & Uniforms"),
            ("/contact.html#quote", "Request a Uniform Quote"),
        ],
    },
    {
        "source": "content/blog/02-bilingual-logo-artwork-approval.md",
        "slug": "uniform-logo-artwork-approval-checklist",
        "category": "Artwork Approval",
        "kicker": "Uniform artwork approval guide",
        "lead": "A production-proof checklist for Arabic and English logos, file versions, garment colours, dimensions and repeat-order records.",
        "excerpt": "Prepare Arabic and English uniform artwork for production with checks for files, wording, colour, placement, proof versions and approvals.",
        "image": "/assets/img/category/uniforms/100-cotton-pant-shirt-without-reflector.png",
        "image_alt": "Current Xpertone workwear category image used to illustrate measured logo placement on uniforms",
        "image_caption": "Artwork approval should identify the exact garment, colour, position, dimensions and proof revision.",
        "related": [
            ("/blog/embroidery-vs-dtf-printing-company-uniforms-dubai/", "Embroidery vs DTF Printing"),
            ("/category/uniforms/", "Browse Workwear & Uniforms"),
            ("/category/safety-vests/", "Browse Safety Vests"),
        ],
    },
    {
        "source": "content/blog/03-safety-vest-buying-printing-checklist.md",
        "slug": "safety-vest-buying-logo-printing-checklist-uae",
        "category": "Safety Vest Procurement",
        "kicker": "Safety vest procurement guide",
        "lead": "Check the exact vest, site requirement, fit, documentation and permitted logo placement before approving a branded bulk order.",
        "excerpt": "Check safety-vest specifications, fit, documents and logo placement before a bulk UAE order with this procurement-focused checklist.",
        "image": "/assets/img/category/safety-vests/supervisor-vests.jpg",
        "image_alt": "Current Xpertone safety-vest category image used to illustrate procurement and logo-placement checks",
        "image_caption": "Catalogue role labels help browsing, but they do not replace an exact product specification or safety review.",
        "related": [
            ("/category/safety-vests/", "Browse Safety Vests"),
            ("/blog/custom-safety-vest-printing-dubai/", "Custom Safety Vest Printing Guide"),
            ("/blog/uniform-logo-artwork-approval-checklist/", "Uniform Logo Artwork Checklist"),
        ],
    },
]


def esc(value):
    return html.escape(str(value), quote=True)


def inline(value):
    rendered = esc(value)
    rendered = re.sub(r"\[([^]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', rendered)
    rendered = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", rendered)
    return rendered


def parse_source(path):
    source = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n(.*)$", source, flags=re.S)
    if not match:
        raise ValueError("Missing front matter: %s" % path)
    front = {}
    for line in match.group(1).splitlines():
        key, value = line.split(":", 1)
        front[key.strip()] = value.strip().strip('"')
    body = match.group(2).strip()
    title_match = re.search(r"^#\s+(.+)$", body, flags=re.M)
    if not title_match:
        raise ValueError("Missing H1: %s" % path)
    title = title_match.group(1).strip()
    body = body[title_match.end():].strip()
    return front, title, body


def extract_faq(body):
    marker = re.search(r"^##\s+Common questions\s*$", body, flags=re.M | re.I)
    if not marker:
        return body, []
    before = body[:marker.start()].rstrip()
    faq_source = body[marker.end():]
    questions = []
    for match in re.finditer(r"^###\s+(.+?)\n+(.*?)(?=^###\s+|\Z)", faq_source, flags=re.M | re.S):
        answer = re.sub(r"\s+", " ", match.group(2)).strip()
        questions.append((match.group(1).strip(), answer))
    return before, questions


def render_table(lines):
    rows = [[cell.strip() for cell in line.strip().strip("|").split("|")] for line in lines]
    header = rows[0]
    data = rows[2:]
    head = "".join("<th scope=\"col\">%s</th>" % inline(cell) for cell in header)
    body = "".join("<tr>%s</tr>" % "".join("<td>%s</td>" % inline(cell) for cell in row) for row in data)
    return '<div class="table-responsive mb-4"><table class="table table-striped align-middle"><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (head, body)


def markdown_body(source):
    lines = source.splitlines()
    out = []
    paragraph = []
    i = 0

    def flush_paragraph():
        if paragraph:
            out.append("<p>%s</p>" % inline(" ".join(part.strip() for part in paragraph)))
            paragraph.clear()

    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            flush_paragraph()
            i += 1
            continue
        if line.startswith("## "):
            flush_paragraph()
            out.append("<h2>%s</h2>" % inline(line[3:].strip()))
            i += 1
            continue
        if line.startswith("### "):
            flush_paragraph()
            out.append("<h3>%s</h3>" % inline(line[4:].strip()))
            i += 1
            continue
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|?\s*:?-+", lines[i + 1]):
            flush_paragraph()
            table = [line]
            i += 1
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                table.append(lines[i])
                i += 1
            out.append(render_table(table))
            continue
        if re.match(r"^-\s+", line):
            flush_paragraph()
            items = []
            while i < len(lines) and re.match(r"^-\s+", lines[i]):
                items.append(re.sub(r"^-\s+", "", lines[i]).strip())
                i += 1
            out.append("<ul>%s</ul>" % "".join("<li>%s</li>" % inline(item) for item in items))
            continue
        if re.match(r"^\d+\.\s+", line):
            flush_paragraph()
            items = []
            while i < len(lines) and re.match(r"^\d+\.\s+", lines[i]):
                items.append(re.sub(r"^\d+\.\s+", "", lines[i]).strip())
                i += 1
            out.append("<ol>%s</ol>" % "".join("<li>%s</li>" % inline(item) for item in items))
            continue
        paragraph.append(line)
        i += 1
    flush_paragraph()
    return "".join(out)


def faq_html(questions):
    return '<h2>Frequently asked questions</h2><div class="article-faq">%s</div>' % "".join(
        "<details><summary>%s</summary><p>%s</p></details>" % (inline(question), inline(answer))
        for question, answer in questions
    )


def article_schema(title, description, url, image, questions):
    graph = [{
        "@type": "BlogPosting",
        "headline": title,
        "description": description,
        "datePublished": DATE,
        "dateModified": DATE,
        "mainEntityOfPage": url,
        "author": {"@type": "Organization", "name": "Xpertone Creative LLC-FZ"},
        "publisher": {"@type": "Organization", "name": "Xpertone Creative LLC-FZ", "url": ORIGIN + "/"},
        "image": ORIGIN + image,
    }]
    if questions:
        graph.append({
            "@type": "FAQPage",
            "mainEntity": [{
                "@type": "Question",
                "name": question,
                "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"\[([^]]+)\]\([^)]+\)", r"\1", answer)},
            } for question, answer in questions],
        })
    return {"@context": "https://schema.org", "@graph": graph}


def build_article(config):
    front, title, markdown = parse_source(ROOT / config["source"])
    markdown = re.sub(r"\n###\s+(?:Ready|Need|Request)[^\n]*\n+.*?(?=\n##\s+Common questions)", "", markdown, flags=re.I | re.S)
    markdown, questions = extract_faq(markdown)
    url = "%s/blog/%s/" % (ORIGIN, config["slug"])
    title_meta = front["meta_title"]
    description = front["meta_description"]
    schema = json.dumps(article_schema(title, description, url, config["image"], questions), ensure_ascii=False, separators=(",", ":"))
    related = "".join('<a href="%s">%s</a>' % (esc(href), esc(label)) for href, label in config["related"])
    page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>{esc(title_meta)}</title><meta name="description" content="{esc(description)}"><link rel="canonical" href="{url}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="article"><meta property="og:title" content="{esc(title_meta)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{ORIGIN}{esc(config['image'])}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(title_meta)}"><meta name="twitter:description" content="{esc(description)}"><meta name="twitter:image" content="{ORIGIN}{esc(config['image'])}"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"><link rel="stylesheet" href="assets/css/blog.css?v=20260914a"><script type="application/ld+json">{schema}</script></head><body data-page="blog"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><header class="article-hero"><div class="container article-hero__inner"><nav class="breadcrumb-xo" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/blog/">Guides</a> / {esc(config['category'])}</nav><span class="article-kicker d-inline-block mt-4">{esc(config['kicker'])}</span><h1 class="mt-2">{esc(title)}</h1><p class="lead">{esc(config['lead'])}</p><div class="article-meta"><span>Published {DATE_LABEL}</span><span>Dubai, UAE</span><span>Approx. 7 min read</span></div></div></header><article class="section"><div class="container article-shell"><div class="article-body"><figure class="article-figure"><img src="{esc(config['image'])}" alt="{esc(config['image_alt'])}" loading="eager" width="1254" height="1254"><figcaption>{esc(config['image_caption'])}</figcaption></figure>{markdown_body(markdown)}<section class="article-cta"><h2 class="h3 text-white mt-0">Discuss your order with Xpertone</h2><p>Send the garment or vest reference, quantities, sizes and branding requirement for a clear quotation and production review.</p><a class="btn btn-xo" href="/contact.html#quote">Request a quote</a></section>{faq_html(questions)}<div class="article-related mt-5"><strong>Related:</strong>{related}</div></div></div></article></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>'''
    target = ROOT / "blog" / config["slug"] / "index.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(page + "\n", encoding="utf-8")
    return {
        "title": title,
        "url": "/blog/%s/" % config["slug"],
        "category": config["category"],
        "date": DATE,
        "dateLabel": DATE_LABEL,
        "excerpt": config["excerpt"],
        "image": config["image"],
        "imageAlt": config["image_alt"],
    }


new_posts = [build_article(config) for config in ARTICLES]
posts_file = ROOT / "data" / "blog-posts.json"
posts = json.loads(posts_file.read_text(encoding="utf-8"))
new_urls = {post["url"] for post in new_posts}
posts = new_posts + [post for post in posts if post["url"] not in new_urls]
posts_file.write_text(json.dumps(posts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

blog_schema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Xpertone Creative LLC-FZ Workwear & PPE Guides",
    "url": ORIGIN + "/blog/",
    "publisher": {"@type": "Organization", "name": "Xpertone Creative LLC-FZ", "url": ORIGIN + "/"},
    "blogPost": [{"@type": "BlogPosting", "headline": post["title"], "url": ORIGIN + post["url"], "datePublished": post["date"]} for post in posts],
}
cards = "".join(f'''<article class="blog-card"><a class="blog-card__img" href="{esc(post['url'])}"><img loading="lazy" src="{esc(post['image'])}" alt="{esc(post['imageAlt'])}" width="1200" height="675"></a><div class="blog-card__body"><div class="blog-card__meta"><span>{esc(post['category'])}</span><span>{esc(post['dateLabel'])}</span></div><h2><a href="{esc(post['url'])}">{esc(post['title'])}</a></h2><p>{esc(post['excerpt'])}</p></div></article>''' for post in posts)
index_page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/png" sizes="32x32" href="/assets/img/brand/favicon-32.png"><title>Workwear, PPE & Printing Guides Dubai | Xpertone Creative</title><meta name="description" content="Practical UAE buying guides on safety vests, work uniforms, PPE, custom printing, embroidery and branded workwear from Xpertone Creative in Dubai."><link rel="canonical" href="{ORIGIN}/blog/"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="website"><meta property="og:title" content="Workwear, PPE & Printing Guides Dubai | Xpertone Creative"><meta property="og:description" content="Practical UAE buying guides for workwear, PPE and branded company clothing."><meta property="og:url" content="{ORIGIN}/blog/"><meta property="og:image" content="{ORIGIN}/assets/img/brand/og-xpertone.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Workwear, PPE & Printing Guides Dubai | Xpertone Creative"><meta name="twitter:description" content="Practical UAE buying guides for workwear, PPE and branded company clothing."><meta name="twitter:image" content="{ORIGIN}/assets/img/brand/og-xpertone.png"><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" rel="stylesheet"><link href="/assets/css/main.css?v=20260914sku" rel="stylesheet"><link href="/assets/css/blog.css?v=20260914a" rel="stylesheet"><script type="application/ld+json">{json.dumps(blog_schema, ensure_ascii=False, separators=(',', ':'))}</script></head><body data-page="blog"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="blog-hero"><div class="container"><span class="eyebrow text-warning">Xpertone Guides</span><h1 class="display-5 fw-bold mt-3">Practical workwear, PPE and printing guides for UAE buyers</h1><p class="mt-3">Clear checklists for choosing products, preparing artwork, planning size quantities and requesting accurate quotations.</p></div></section><section class="section"><div class="container"><div class="section-head"><span class="eyebrow">Latest articles</span><h2 class="mt-2 mb-0">Practical answers before you place an order</h2></div><div class="blog-grid">{cards}</div></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="/assets/js/config.js?v=20260914sku"></script><script src="/assets/js/store.js?v=20260914sku"></script><script src="/assets/js/ui.js?v=20260914sku"></script></body></html>'''
(ROOT / "blog" / "index.html").write_text(index_page + "\n", encoding="utf-8")

blog_rows = [(ORIGIN + "/blog/", DATE)] + [(ORIGIN + post["url"], post["date"]) for post in posts]
sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s\n</urlset>\n' % "\n".join(
    '  <url><loc>%s</loc><lastmod>%s</lastmod><changefreq>%s</changefreq><priority>0.8</priority></url>' % (esc(url), date, "weekly" if url.endswith("/blog/") else "monthly")
    for url, date in blog_rows
)
(ROOT / "sitemap-blog.xml").write_text(sitemap, encoding="utf-8")

contextual_links = [
    (ROOT / "blog/work-uniform-supplier-dubai-guide/index.html", "For repeat orders, the supplier should be able to work from your previous size split. That turns the second order into a simple replenishment instead of another fitting exercise.</p>", 'For repeat orders, the supplier should be able to work from your previous size split. That turns the second order into a simple replenishment instead of another fitting exercise.</p><p>Use our <a href="/blog/bulk-uniform-size-split-uae/">worked uniform size-split guide</a> to convert confirmed staff sizes into garment quantities, spares and site allocations.</p>'),
    (ROOT / "blog/embroidery-vs-dtf-printing-company-uniforms-dubai/index.html", "This prevents the logo from moving slightly each time a new batch is produced.</p>", 'This prevents the logo from moving slightly each time a new batch is produced.</p><p>Before production, use the <a href="/blog/uniform-logo-artwork-approval-checklist/">uniform logo artwork approval checklist</a> to verify bilingual wording, file versions, colours and proof dimensions.</p>'),
    (ROOT / "category/safety-vests/index.html", "Open a range to compare available colours, SKUs, sizes and current pricing.</p>", 'Open a range to compare available colours, SKUs, sizes and current pricing. Use our <a href="/blog/safety-vest-buying-logo-printing-checklist-uae/">safety-vest buying and logo checklist</a> to prepare a model-specific enquiry before approval.</p>'),
]
for path, needle, replacement in contextual_links:
    source = path.read_text(encoding="utf-8")
    if replacement in source:
        continue
    if needle not in source:
        raise ValueError("Contextual-link insertion point missing: %s" % path)
    path.write_text(source.replace(needle, replacement, 1), encoding="utf-8")

print(json.dumps({"published_articles": len(new_posts), "blog_posts": len(posts), "sitemap_urls": len(blog_rows)}))

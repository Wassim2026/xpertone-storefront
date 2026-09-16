import csv
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "img" / "products" / "clean-reference"
MAP_FILE = ROOT / "data" / "generated-product-images.json"
OUTPUT = ROOT.parents[1] / "outputs" / "catalogue-mockups"
SITE = "https://www.xpertonecreative.com"


def main():
    mapping = json.loads(MAP_FILE.read_text(encoding="utf-8"))
    manifest = []
    missing = []
    for sku, item in mapping.items():
        png = ASSETS / item["category"] / f"{sku}.png"
        if not png.exists():
            missing.append(sku)
            continue
        webp = png.with_suffix(".webp")
        with Image.open(png) as image:
            image.convert("RGB").save(webp, "WEBP", quality=91, method=6)
        url = f"{SITE}/assets/img/products/clean-reference/{item['category']}/{sku}.webp?v=20260916exact"
        item["images"] = [url]
        item["replacement_type"] = "front-and-back" if item["category"] == "uniforms" else "single-clean-image"
        manifest.append({
            "sku": sku,
            "category": item["category"],
            "title": item["title"],
            "replacement_type": item["replacement_type"],
            "file": str(webp),
            "live_url": url,
            "source_reference": item["old_images"][0],
        })
    if missing:
        raise SystemExit(f"Missing replacements: {', '.join(missing)}")
    MAP_FILE.write_text(json.dumps(mapping, indent=2), encoding="utf-8")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "sku-image-audit-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    with (OUTPUT / "sku-image-audit-manifest.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=manifest[0].keys())
        writer.writeheader(); writer.writerows(manifest)

    font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 20)
    for page in range((len(manifest) + 11) // 12):
        sheet = Image.new("RGB", (1200, 1000), "#eef2f5")
        draw = ImageDraw.Draw(sheet)
        for index, row in enumerate(manifest[page * 12:page * 12 + 12]):
            image = Image.open(row["file"]).convert("RGB")
            image.thumbnail((280, 275))
            x = (index % 4) * 300
            y = (index // 4) * 330
            sheet.paste(image, (x + (300-image.width)//2, y + 8 + (275-image.height)//2))
            draw.text((x+12, y+292), f"{row['sku']}  {row['category']}", font=font, fill="#102544")
        sheet.save(OUTPUT / f"qa-contact-sheet-{page+1:02d}.jpg", quality=88)
    print(json.dumps({"replacements": len(manifest), "uniforms": sum(x["category"] == "uniforms" for x in manifest), "other": sum(x["category"] != "uniforms" for x in manifest)}, indent=2))


if __name__ == "__main__":
    main()

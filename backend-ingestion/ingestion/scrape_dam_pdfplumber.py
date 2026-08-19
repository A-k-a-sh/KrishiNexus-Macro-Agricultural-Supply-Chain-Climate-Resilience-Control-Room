#!/usr/bin/env python3
"""
scrape_dam_pdfplumber.py
------------------------
Complete DAM daily division-level retail price scraper.

- Downloads today's (or latest N days) PDFs from the official listing page
- Extracts tables with pdfplumber
- Maps garbled Bengali commodity names → clean English names
- Writes market_prices-ready JSON

Source: দৈনিক বিভাগীয় খুচরা বাজারদর
Listing: https://dam.gov.bd/pages/static-pages/6922e0d1933eb65569e28b21

Usage:
  python3 scrape_dam_pdfplumber.py              # latest date, all 8 divisions
  python3 scrape_dam_pdfplumber.py --days 3     # last 3 dates
  python3 scrape_dam_pdfplumber.py --no-download  # only parse existing PDFs
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

import pdfplumber
from bs4 import BeautifulSoup

import os
LISTING_URL = os.environ.get("DAM_MARKET_URL", "https://dam.gov.bd/pages/static-pages/6922e0d1933eb65569e28b21")
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
USER_AGENT = "Mozilla/5.0 (compatible; KrishiNexusBot/1.0; +https://krishinexus.gov.bd)"

DIVISION_ORDER = [
    {"id": "dhaka", "labelEn": "Dhaka", "labelBn": "ঢাকা"},
    {"id": "chittagong", "labelEn": "Chittagong", "labelBn": "চট্টগ্রাম"},
    {"id": "khulna", "labelEn": "Khulna", "labelBn": "খুলনা"},
    {"id": "rajshahi", "labelEn": "Rajshahi", "labelBn": "রাজশাহী"},
    {"id": "barisal", "labelEn": "Barisal", "labelBn": "বরিশাল"},
    {"id": "rangpur", "labelEn": "Rangpur", "labelBn": "রংপুর"},
    {"id": "sylhet", "labelEn": "Sylhet", "labelBn": "সিলেট"},
    {"id": "mymensingh", "labelEn": "Mymensingh", "labelBn": "ময়মনসিংহ"},
]

COMMODITY_MAP = {
    # Flour
    "আটো": "Wheat flour",
    "আটো (প্যোরেট-সোেো)": "Wheat flour (packet, white)",
    "আটো (কখোিো)": "Wheat flour (loose)",
    "ক োলো": "Wheat flour (loose)",
    "প্যোরেট-সোেো": "Wheat flour (packet, white)",
    "আটা-(প্যাকেট)": "Wheat flour (packet)",
    "আটা-(প্যাদেট)": "Wheat flour (packet)",
    "আটা-(কখািা)": "Wheat flour (loose)",
    "আটা-(ব ািা)": "Wheat flour (loose)",
    # Lentils
    "মসুর (উন্নি)": "Lentils (masur, premium)",
    "মসুর (কমোটো)": "Lentils (masur, coarse)",
    "মসুর ডোি (উন্নি)": "Lentils (masur, premium)",
    "মসুর ডোি (কমোটো)": "Lentils (masur, coarse)",
    "মশুি ডাি (কমাটা/আমোনীকৃি)": "Lentils (masur, coarse/imported)",
    "মশুি ডাি সরু (উন্নি)": "Lentils (masur, thin premium)",
    "মশুি ডাি (বমাটা )": "Lentils (masur, coarse)",
    "মশুি ডাি (সরু)": "Lentils (masur, thin)",
    "েসুর ডোি (উন্নি)": "Lentils (masur, premium)",
    "েসুর ডোি (আেেোিী)": "Lentils (masur, imported)",
    "মুগ (সরু- উন্নি)": "Mung (thin, premium)",
    "মুগ -(কমোটো)": "Mung (coarse)",
    "মুগ ডোি (সরু- উন্নি)": "Mung (thin, premium)",
    "মুগ ডোি-(কমোটো)": "Mung (coarse)",
    "মুগ ডাি (সরু)": "Mung (thin)",
    "মুগ ডাি (কমাটা)": "Mung (coarse)",
    "মুগ ডাি (বমাটা)": "Mung (coarse)",
    "মুগ ডোি-(সোিোরি)": "Mung (sari)",
    "ক সোরী": "Lentils (khesari)",
    "কখসোরী ডোি": "Lentils (khesari)",
    "কেসোরী ডোি": "Lentils (khesari)",
    "মোশ েলোই": "Black gram (maskalai)",
    "বুট": "Chickpeas",
    "েলোই": "Gram (kalai)",
    "কছোলো": "Gram (loose)",
    "কছোিো": "Gram (loose)",
    "ক ািা েিাই": "Gram (kalai, loose)",
    "ক োিো": "Gram (loose)",
    "ব ািা েিাই": "Gram (kalai, loose)",
    # Oils
    "সয়োনর্ি (ক োলো)": "Oil (soybean, loose)",
    "পোম (ক োলো)": "Oil (palm, loose)",
    "সয়োনর্ি (েযোি ১নলিঃ নর্নিন্ন ব্র্যোন্ড)": "Oil (soybean, 1L can)",
    "সয়োনর্ি (েযোি 5নলিঃনর্নিন্ন ব্র্যোন্ড)": "Oil (soybean, 5L can)",
    "সনরেো (ক োলো)": "Oil (mustard, loose)",
    "কিি-সয়োনর্ি (কখোিো)": "Oil (soybean, loose)",
    "কিি-পোম (কখোিো)": "Oil (palm, loose)",
    "কিি-সয়োনর্ি (েযোি ১নিঃ": "Oil (soybean, 1L can)",
    "কিি-সয়োনর্ি (েযোি ৫নিঃ": "Oil (soybean, 5L can)",
    "কিি-সয়োনর্ি (কেোিো)": "Oil (soybean, loose)",
    "কিি-েোে (কেোিো)": "Oil (palm, loose)",
    "সয়ারবন কিি-(কখািা)": "Oil (soybean, loose)",
    "পাম কিি- (কখািা)": "Oil (palm, loose)",
    "সয়ারবন কিি (েযান ১রিঃ)": "Oil (soybean, 1L can)",
    "সয়ার ন বিি-(ব ািা)": "Oil (soybean, loose)",
    "পাম বিি- (ব ািা)": "Oil (palm, loose)",
    "সয়ার ন বিি-ব ািি-1রিঃ": "Oil (soybean, 1L can)",
    "সয়ার ন বিি (েযান ৫রিঃ)": "Oil (soybean, 5L can)",
    "ব্র্যসনোন্ডর)ষোর কিি (কেোিো)": "Oil (soybean, branded can)",
    # Sugar / Salt
    "আমদোিীকৃি (সোদো-ক োলো)": "Sugar (imported, white loose)",
    "নচনি-আেেোিীকৃি (সোেো-কেোিো)": "Sugar (imported, white loose)",
    "রচরন আমোনীকৃি (কখািা)": "Sugar (imported, loose)",
    "রচরন (ব ািা)": "Sugar (loose)",
    "নিনি": "Sugar",
    "িবর্ (প্যাদেটিাি)": "Salt (packet)",
    "ি র্ (প্যাকেটিাি)সাধাির্/উন্নি": "Salt (packet)",
    # Onion / Garlic / Ginger / Chili
    "কেঁয়োি (কদশী)": "Onions (local)",
    "কেঁয়োি": "Onions",
    "রিঁয়াি কেরশ": "Onions (local)",
    "বেঁয়াি (বেশী)": "Onions (local)",
    "রসুি (কদশী)": "Garlic (local)",
    "রসুি (িোয়িো)": "Garlic (Chinese)",
    "রসুি": "Garlic",
    "িসুন (কেশী)": "Garlic (local)",
    "িসুন (আমোনীকৃি চায়না)": "Garlic (Chinese, imported)",
    "িসুন (বেশী) ব াট": "Garlic (local)",
    "িসুন বেশী": "Garlic (local)",
    "িসুন (আমোনীকৃি)": "Garlic (imported)",
    "আদো (আমদোিীকৃি)": "Ginger (imported)",
    "আদো": "Ginger",
    "আো (আমোনীকৃি)": "Ginger (imported)",
    "আো (আমোনীকৃি)(েযাকিিা)": "Ginger (imported, packet)",
    "আো বেশী": "Ginger (local)",
    "আেো (আমেোিীকৃি)": "Ginger (imported)",
    "আেো (আেেোিীকৃি)": "Ginger (imported)",
    "শুেিো মনরি (কদশী)": "Chili (dry, local)",
    "শুেিো মনরি (কেশী)": "Chili (dry, local)",
    "শুেিো েনরচ (কেশী)": "Chili (dry, local)",
    "োঁিো মনরি": "Chili (green)",
    "োঁচামরিচ": "Chili (green)",
    "োঁচো েনরচ": "Chili (green)",
    # Vegetables
    "আলু": "Potatoes",
    "কর্গুি": "Cabbage",
    "োঁিো কেঁরপ": "Cauliflower",
    "োঁচাদিঁদপ": "Cauliflower",
    "োঁচাকপকপ": "Cauliflower",
    "োঁচো কেঁরে": "Cauliflower",
    "নমনি কুমড়ো": "Sweet gourd",
    "নেনি কুেড়ো": "Sweet gourd",
    "চিচিিংগা": "Snake gourd",
    "মুখীকচু": "Mukhikachu",
    "র্রর্টি": "Yardlong bean",
    "পটি": "Pointed gourd",
    "শসো": "Cucumber",
    "লোউ": "Bottle gourd",
    "িোউ": "Bottle gourd",
    "পটল": "Pointed gourd",
    "কেঁড়স": "Okra",
    "েচুরলনি": "Eggplant",
    "েচুরিনি": "Eggplant",
    "কবগুন": "Eggplant",
    "ব গুন সাধাির্/উন্নি": "Eggplant",
    "িোলকুমড়ো (িোনল)": "Ash gourd",
    "চোিকুমড়ো": "Ash gourd",
    "চোিকুেড়ো": "Ash gourd",
    "েোেররোল": "Ridge gourd",
    "ন িংগো": "Bitter gourd",
    "ন ংগো": "Bitter gourd",
    "ধুন্দুল": "Sponge gourd",
    "ধুন্দি": "Sponge gourd",
    "উরে/েরল্লো": "Plantain",
    "ঊরে/েরল্লো": "Plantain",
    "ফোম বসোদো/লোল": "Beans",
    "টরমরটো": "Tomatoes",
    "টরেরটো": "Tomatoes",
    "রমরিকুমড়া": "Pumpkin",
    "কপয়োরো": "Green banana",
    # Meat / Poultry / Fish / Egg
    "গরু": "Meat (beef)",
    "মোাংস- গরু": "Meat (beef)",
    "ছোগল": "Meat (mutton/goat)",
    "ছোগরির মোাংস": "Meat (mutton/goat)",
    "খোনসর মোাংস": "Meat (mutton)",
    "াগদিি মাাংস": "Meat (mutton/goat)",
    "িয়লোর": "Chicken (broiler)",
    "কমোরগ-মুরনগ (িয়িোর)": "Chicken (broiler)",
    "মুিগী (িয়িাি) িযান্ত": "Chicken (broiler)",
    "কমোরগ-মুরনগ (কেশী) িযোন্ত": "Chicken (local)",
    "কমোরগ-মুরনগ (কেশী) িযা": "Chicken (local)",
    "কমািগ-মুিগী (কেশী) িযান্ত": "Chicken (local)",
    "বমািগ-মুিরগ (বেশী) িযান্ত": "Chicken (local)",
    "কমোরগ-মুরনগ (ব্রয়িোর) িযোন্ত": "Chicken (broiler)",
    "কমোরগ-মুরনগ (েে/কসোিোিী) িযোন্ত": "Chicken (sonali)",
    "কমািগ-মুিগী (েে/কসানািী িাইরিড ও পারেস্তানী) িযান্ত": "Chicken (sonali/hybrid)",
    "কসোিোলী (েোলোরর্োড/বহোইনিড)": "Chicken (sonali)",
    "কসোিোিী/ িোি েোিোর র্োড ব": "Chicken (sonali)",
    "কমোরগ-মুরনগ (কসোিোিী/েোিোরর্োড)ব": "Chicken (sonali)",
    "েে/কসোিোলী": "Chicken (sonali)",
    "কসোিোলী (েোলোরর্োি/বহোইনিি)": "Chicken (sonali)",
    "কমোরগ/মুরনগ": "Chicken",
    "নডমঃ মুরনগ (কসোিোিী)": "Egg (chicken)",
    "নডমিঃ মুরনগ (কেশী)": "Egg (local chicken)",
    "নডমঃ ফোম বসোেো/িোি": "Egg (farm)",
    "নডমিঃ ফোম বসোেো/িোি": "Egg (farm)",
    "রডম মুিরগ (কেরশ)": "Egg (local)",
    "রডম মুিরগ ফাম ণ(সাো ও িাি)": "Egg (farm)",
    "রডমঃমুিরগ(েে/বসাঃ বেশী": "Egg (sonali/local)",
    "রুই (িোরের) ১ ১ − ৪ ২": "Fish (rohu, farmed)",
    "রুই মা": "Fish (rohu)",
    "রুই মা (চাষকৃি )": "Fish (rohu, farmed)",
    "১ েোিল (িোরের) ১ −৪ ২": "Fish (catla, farmed)",
    "কিিোনপয়ো মোছ (চোরির)": "Fish (climbing perch)",
    "কিলোনপয়ো (িোরের)": "Fish (climbing perch, farmed)",
    "ইনিশ মোছ": "Fish (hilsa)",
    "ইরিশ মা": "Fish (hilsa)",
    "ইরিশ মা (৫০০-১০০০ গ্রাম)": "Fish (hilsa, 500-1000g)",
    "ইনলশ (৪০০-৯০০ গ্রোম)": "Fish (hilsa, 400-900g)",
    "োিি মা": "Fish (catfish)",
    "পাাংগাস মা": "Fish (pangasius)",
    "পোিংগোস (িোরের)": "Fish (pangasius, farmed)",
    "গোির (কেশী)": "Fish (local)",
    # Fruit
    "আরপল": "Apple",
    "আরপি": "Apple",
    "আম": "Mango",
    "েলো (সোগর)": "Banana (sagar)",
    "েিো (সোগর)": "Banana (sagar)",
    "েিো (চাঁপো)": "Banana (champa)",
    # Rice
    "গুটি স্বিোব (কমোটো)": "Rice (Guti Swarna, coarse)",
    "গুটি স্বণোব(কমোটো)": "Rice (Guti Swarna, coarse)",
    "পোিোম, নি ধোি ২৮, নি ধোি-২৯(": "Rice (Pajam / BRRI)",
    "নিরোশোইল-শম্পো েোটোনর(সরু)": "Rice (Zirashail)",
    "নর্ররোই (সরু)": "Rice (Nizershail)",
    "নি ধোি-৩৪ (সুগন্ধী)": "Rice (BRRI-34, aromatic)",
    "কমোটো (নর্আর১১)": "Rice (coarse, IRRI)",
    "ির্ণ (প্যোরেটিোি-কমোটো": "Rice (packet, coarse)",
    "(প্যোরেটিোি-কমোটো ও নচেি)": "Rice (packet, coarse)",
    "চাি সরু (রি-ধান-81, রি-ধান-84)": "Rice (thin, BRRI-81/84)",
    "চাি মাঝািী (রি-ধান-28, রি-ধান-29)": "Rice (medium, BRRI-28/29)",
    "চাি কমাটা (গুটি স্বর্াণ, িাি স্বর্াণ, রিিা- ২)": "Rice (coarse, Guti Swarna)",
    "চাি সুগরি (রি-ধান-34, রি-ধান-80)": "Rice (aromatic, BRRI-34/80)",
    "পোিোম, নব্র-িোি-২৮,নব্রিোি-২৯(মো োনর)": "Rice (Pajam / BRRI-28/29)",
    "নিরোশোইি-শম্পো েোটোনর(সরু": "Rice (Zirashail)",
    "নব্র-িোি-৩৪(সুগন্ধী)": "Rice (BRRI-34, aromatic)",
    "চোি কমোটো (গুটি স্বিো": "Rice (coarse, Guti Swarna)",
    "চোি- মো োনর (পোিোম, নি িোি-২৮": "Rice (medium, Pajam/BRRI)",
    "চোি সরু (নিরোশোইি, েোটোর": "Rice (thin, Zirashail)",
    "চোি সরু (র্োিোম, নর্ররোই)": "Rice (thin, Nizershail)",
    "চোি সুগন্ধী ( নি িোি-৩৪": "Rice (aromatic, BRRI-34)",
    "ব াকিা চাি সরু (রি-63,৮১,৮৮)": "Rice (packet, thin)",
    "ব াকিা চাি-(মাঝািী) রি-28,29": "Rice (packet, medium)",
    "ব াকিা চাি-(বমাটা)রিিা": "Rice (packet, coarse)",
    "আমন চাি-মাঝািী (স্বর্াণ-5,রি-49)": "Rice (Aman, medium)",
    "আমন চাি-বমাটা (গুটি স্বর্াণ)": "Rice (Aman, coarse Guti Swarna)",
    "র্সোরুি ো(েনি ইরিোশযোোনইেি))": "Rice (Miniket / Zirashail)",
    # Milk
    "গুুঁরড়ো (পনলপ্যোে)": "Milk powder (poly pack)",
    "গুুঁরড়ো (প্যোে:নর্নভন্ন ব্র্যোন্ড)": "Milk powder (branded)",
    "গুুঁরড়ো দুি (পনিপ্যোে)": "Milk powder",
    "গুদড়া দুধ (পরি প্যাদেট)": "Milk powder (poly pack)",
    "গুকড়া দুধ (প্যাকেট)": "Milk powder (packet)",
    "আটো (কেোিো)": "Wheat flour (loose)",
    "আলু িল্যান্ড (িাি )": "Potatoes (Holland)",
    "আলু িল্যান্ড/োরডনণাি (িাি)": "Potatoes (Holland/Cardinal)",
    "আলু-হল্যোন্ড": "Potatoes (Holland)",
    "আেি স্থোিীয়": "Ginger (local)",
    "আেো-আমেোিী": "Ginger (imported)",
    "ইনিশ েো (ক োট)": "Fish (hilsa, cut)",
    "কিি-সয়োনর্ি (েযোি ৫ নিঃনর্নভন্ন ব্র্যোন্ড)": "Oil (soybean, 5L can)",
    "কিিোনেয়ো েো (চোরষর)": "Fish (climbing perch, farmed)",
    "কেঁরশ": "Okra",
    "কেোরগ-মুরনগ (কসোিোিী/েে)": "Chicken (sonali)",
    "কেোরগ-মুরনগ (কেশী)": "Chicken (local)",
    "কেোরগ-মুরনগ (িয়িোর)": "Chicken (broiler)",
    "গুুঁরড়ো দুি (েনিপ্যোে)": "Milk powder",
    "ধুন্দুি": "Sponge gourd",
    "ন াংগো": "Bitter gourd",
    "কর্োররো েোইনিড": "Carrot",
    "আরেি": "Apple",
}

SKIP_NAMES = {
    "", "-", "—", ",,", "প্রনি কেনি", "প্রনিটি", "প্রতি কেজি", "প্রতিটি",
    "১ নিটোর", "১ নলটোর", "৫ নিটোর", "৫ নলটোর", "৪টি", "১ তিটার", "৫ তিটার",
    "প্রনি কেতি", ",, ফামণ",
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def map_commodity(raw: str) -> str:
    key = norm(raw)
    if key in SKIP_NAMES:
        return "Unknown"
    if key in COMMODITY_MAP:
        return COMMODITY_MAP[key]
    for k, v in COMMODITY_MAP.items():
        if len(k) >= 4 and (k in key or key in k):
            return v
    return f"Unknown ({key[:50]})" if key else "Unknown"


def parse_price_range(cell: str):
    if not cell:
        return None, None, None
    cell = cell.replace(",", "").replace("–", "-").replace("—", "-")
    for i, d in enumerate("০১২৩৪৫৬৭৮৯"):
        cell = cell.replace(d, str(i))
    nums = re.findall(r"\d+\.?\d*", cell)
    if len(nums) >= 2:
        lo, hi = float(nums[0]), float(nums[1])
        if lo == 0 and hi == 0:
            return None, None, None
        return lo, hi, round((lo + hi) / 2, 2)
    if len(nums) == 1:
        v = float(nums[0])
        if v == 0:
            return None, None, None
        return v, v, v
    return None, None, None


def unit_from_raw(raw: str) -> str:
    r = raw or ""
    if any(x in r for x in ("নলটোর", "লিটার", "তিটার", "নিটোর")):
        if "৫" in r or "5" in r:
            return "5L"
        return "L"
    if "প্রনিটি" in r or "প্রতিটি" in r:
        return "piece"
    if "৪টি" in r:
        return "4 pieces"
    return "KG"


def is_price_cell(cell: str) -> bool:
    if not cell:
        return False
    c = cell.replace(",", "")
    return bool(re.search(r"\d+\.?\d*\s*[-–—]\s*\d+\.?\d*", c))


def bn_date_to_iso(bn_date: str):
    s = bn_date.strip()
    for i, d in enumerate("০১২৩৪৫৬৭৮৯"):
        s = s.replace(d, str(i))
    m = re.match(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})", s)
    if not m:
        return None
    dd, mm, yyyy = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return f"{yyyy:04d}-{mm:02d}-{dd:02d}"


def fetch_url(url: str, dest: Path | None = None) -> bytes:
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
        data = resp.read()
    if dest:
        dest.write_bytes(data)
    return data


def parse_listing(html: str) -> list:
    soup = BeautifulSoup(html, "html.parser")
    table = None
    for t in soup.find_all("table"):
        header = t.find("tr")
        if header and "ঢাকা" in header.get_text():
            table = t
            break
    if table is None:
        return []

    results = []
    for row in table.find_all("tr")[1:]:
        cells = row.find_all(["td", "th"])
        if len(cells) < 9:
            continue
        date_iso = bn_date_to_iso(cells[0].get_text(strip=True))
        if not date_iso:
            continue
        for i, div in enumerate(DIVISION_ORDER):
            cell = cells[i + 1]
            a = cell.find("a", href=True)
            if not a:
                continue
            href = a["href"].strip()
            if not href.endswith(".pdf"):
                continue
            if href.startswith("/"):
                href = "https://dam.gov.bd" + href
            elif "objectstorage" not in href and not href.startswith("http"):
                href = "https://objectstorage.ap-dcc-gazipur-1.oraclecloud15.com/n/axvjbnqprylg/b/V2Ministry/o/" + href.lstrip("/")
            results.append({
                "date": date_iso,
                "divisionId": div["id"],
                "divisionLabel": div["labelEn"],
                "url": href,
            })
    return results


def extract_from_table(table, division_id, division_label, report_date):
    if not table or len(table) < 3:
        return []

    n_cols = max(len(r) for r in table)
    price_score = [0] * n_cols
    text_score = [0] * n_cols

    for row in table[1:]:
        for ci in range(min(len(row), n_cols)):
            cell = (row[ci] or "").replace("\n", " ").strip()
            if is_price_cell(cell):
                price_score[ci] += 1
            elif cell and cell not in ("-", "—") and not re.match(r"^\d+$", cell):
                text_score[ci] += 1

    price_cols = [i for i, s in enumerate(price_score) if s >= 2]
    if not price_cols:
        return []
    today_col = price_cols[0]

    name_col = 0
    best = -1
    for i in range(today_col):
        if text_score[i] > best:
            best = text_score[i]
            name_col = i

    unit_col = None
    for i in range(today_col - 1, -1, -1):
        if i == name_col:
            continue
        unit_like = 0
        for row in table[2:min(10, len(table))]:
            if i >= len(row):
                continue
            c = (row[i] or "").strip()
            if any(x in c for x in ("কেনি", "কেজি", "কেতি", "নলটোর", "লিটার", "নিটোর", "প্রনিটি", "টি")):
                unit_like += 1
        if unit_like >= 1:
            unit_col = i
            break

    records = []
    for row in table[1:]:
        cells = [(c or "").replace("\n", " ").strip() for c in row]
        if today_col >= len(cells):
            continue
        lo, hi, avg = parse_price_range(cells[today_col])
        if avg is None:
            continue

        name = cells[name_col] if name_col < len(cells) else ""
        if not name or name in SKIP_NAMES or re.match(r"^\d+$", name):
            for i in range(today_col):
                if i == name_col or i == unit_col:
                    continue
                cand = cells[i] if i < len(cells) else ""
                if cand and cand not in SKIP_NAMES and not re.match(r"^\d+$", cand) and not is_price_cell(cand):
                    name = cand
                    break

        if not name or name in SKIP_NAMES or re.match(r"^\d+$", name):
            continue
        if any(x in name for x in ("সর্বনিম্ন", "পণ্যের", "বাজারদর", "হ্রাস", "বৃদ্ধি", "আজকের", "তারিখ")):
            continue

        unit_raw = cells[unit_col] if unit_col is not None and unit_col < len(cells) else ""
        commodity = map_commodity(name)
        if commodity == "Unknown":
            continue

        records.append({
            "commodity": commodity,
            "commodityRaw": norm(name),
            "unit": unit_from_raw(unit_raw),
            "minPrice": lo,
            "maxPrice": hi,
            "price": avg,
            "priceType": "Retail",
            "currency": "BDT",
            "source": "DAM",
            "divisionId": division_id,
            "divisionLabel": division_label,
            "date": report_date,
        })
    return records


def extract_records_from_pdf(pdf_path: Path, division_id: str, division_label: str, report_date: str):
    records = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                for table in page.extract_tables() or []:
                    records.extend(
                        extract_from_table(table, division_id, division_label, report_date)
                    )
    except Exception as e:
        print(f"  [warn] failed to parse {pdf_path.name}: {e}", file=sys.stderr)
        return []

    seen = set()
    unique = []
    for r in records:
        key = (r["commodity"], r["unit"], r["minPrice"], r["maxPrice"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(r)
    return unique


def download_pdfs(entries: list, max_dates: int = 1) -> list:
    dates = sorted({e["date"] for e in entries}, reverse=True)[:max_dates]
    selected = [e for e in entries if e["date"] in dates]
    downloaded = []
    for e in selected:
        fname = f"{e['date']}_{e['divisionId']}.pdf"
        dest = OUTPUT_DIR / fname
        if dest.exists() and dest.stat().st_size > 1000:
            print(f"  [skip] {fname} (already exists)")
        else:
            try:
                print(f"  [get]  {fname} ...", end=" ", flush=True)
                fetch_url(e["url"], dest)
                print(f"OK ({dest.stat().st_size // 1024} KB)")
                time.sleep(0.4)
            except Exception as ex:
                print(f"FAIL ({ex})")
                continue
        downloaded.append({**e, "path": dest})
    return downloaded


def main():
    parser = argparse.ArgumentParser(description="DAM division daily price scraper")
    parser.add_argument("--days", type=int, default=1, help="How many latest dates to process (default 1)")
    parser.add_argument("--no-download", action="store_true", help="Only parse already-downloaded PDFs")
    args = parser.parse_args()

    items = []

    if not args.no_download:
        print(f"Fetching listing page: {LISTING_URL}")
        try:
            html = fetch_url(LISTING_URL).decode("utf-8", errors="replace")
            (OUTPUT_DIR / "listing.html").write_text(html, encoding="utf-8")
        except Exception as e:
            print(f"Failed to fetch listing: {e}", file=sys.stderr)
            cached = Path(__file__).parent / "dam_listing.html"
            if cached.exists():
                html = cached.read_text(encoding="utf-8", errors="replace")
                print("Using cached listing HTML")
            else:
                sys.exit(1)

        entries = parse_listing(html)
        print(f"Found {len(entries)} PDF links across dates")
        if not entries:
            print("No entries parsed from listing", file=sys.stderr)
            sys.exit(1)

        print(f"Downloading PDFs for latest {args.days} date(s)...")
        items = download_pdfs(entries, max_dates=args.days)
    else:
        for p in sorted(OUTPUT_DIR.glob("*_*.pdf")):
            parts = p.stem.split("_", 1)
            if len(parts) != 2:
                continue
            date_str, div_id = parts
            div = next((d for d in DIVISION_ORDER if d["id"] == div_id), None)
            if not div:
                continue
            items.append({
                "date": date_str,
                "divisionId": div["id"],
                "divisionLabel": div["labelEn"],
                "path": p,
            })

    if not items:
        print("No PDFs to process.")
        sys.exit(1)

    all_records = []
    print()
    print(f"{'Division':12s}  {'Date':10s}  {'Rows':>5s}  {'Mapped':>7s}  {'Unknown':>8s}")
    print("-" * 52)

    for item in items:
        recs = extract_records_from_pdf(
            item["path"], item["divisionId"], item["divisionLabel"], item["date"]
        )
        known = sum(1 for r in recs if not r["commodity"].startswith("Unknown"))
        unknown = len(recs) - known
        print(f"{item['divisionLabel']:12s}  {item['date']:10s}  {len(recs):5d}  {known:7d}  {unknown:8d}")
        all_records.extend(recs)

    out_path = OUTPUT_DIR / "dam_prices_latest.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)

    mapped = [r for r in all_records if not r["commodity"].startswith("Unknown")]
    print()
    print(f"Total: {len(all_records)}  |  Mapped: {len(mapped)}  |  Unknown: {len(all_records) - len(mapped)}")
    print(f"Saved → {out_path}")

    print()
    print("--- Sample mapped records ---")
    for r in mapped[:20]:
        print(f"  {r['date']} | {r['divisionId']:11s} | {r['commodity'][:40]:40s} | {r['minPrice']:>7.1f}-{r['maxPrice']:<7.1f} {r['unit']}")

    unknowns = sorted({r["commodityRaw"] for r in all_records if r["commodity"].startswith("Unknown")})
    if unknowns:
        print()
        print(f"--- Remaining unmapped ({len(unknowns)}) ---")
        for u in unknowns[:20]:
            print(f"  {u!r}")


if __name__ == "__main__":
    main()

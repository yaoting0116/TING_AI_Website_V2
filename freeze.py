# freeze.py
# Generate a static export of your Flask app into a `build/` folder
# Target: deploy the `build/` folder to Cloudflare Pages (or any static host)
#
# This enhanced script does the following on top of rendering the fixed routes:
#  - Renders the listed ROUTES (/, /music, /game, /learning, /NLP)
#  - Copies the whole `static/` folder into `build/static/`
#  - Auto-generates per-item pages for files inside `static/music/` and
#    `static/images/` so you get pages like `/music/<filename>` and
#    `/images/<filename>` (stored as `build/music/<slug>/index.html` etc.)
#
# Usage (local):
# 1. Ensure your venv has requirements installed, e.g.:
#      pip install -r requirements.txt
# 2. Run:
#      python freeze.py
# 3. The script will create (or replace) the `build/` folder.
#
# Cloudflare Pages settings (example):
#   Build command: pip install -r requirements.txt && python freeze.py
#   Build output directory: build

import os
import shutil
import re
from urllib.parse import quote
from app import app

TARGET_DIR = 'build'
# Which routes to request and save (add your routes here)
ROUTES = ['/', '/music', '/game', '/learning', '/NLP']


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def save_response(route_path: str, data: bytes):
    # route_path like '/' or '/music' -> save to build/index.html or build/music/index.html
    if route_path == '/':
        out_path = os.path.join(TARGET_DIR, 'index.html')
        ensure_dir(os.path.dirname(out_path))
    else:
        sub = route_path.lstrip('/')
        out_dir = os.path.join(TARGET_DIR, sub)
        ensure_dir(out_dir)
        out_path = os.path.join(out_dir, 'index.html')

    with open(out_path, 'wb') as f:
        f.write(data)


def copy_static():
    src = app.static_folder or 'static'
    dst = os.path.join(TARGET_DIR, 'static')
    if os.path.exists(dst):
        shutil.rmtree(dst)
    if os.path.isdir(src):
        print(f"Copying static folder: {src} -> {dst}")
        shutil.copytree(src, dst)
    else:
        print(f"No static folder found at: {src}")


def list_files_in_subfolder(subfolder_name):
    folder = os.path.join(app.static_folder or 'static', subfolder_name)
    if not os.path.isdir(folder):
        return []
    files = [f for f in os.listdir(folder) if os.path.isfile(os.path.join(folder, f))]
    return files


def make_slug(filename: str) -> str:
    # URL-safe folder name for each generated page
    return quote(filename, safe='')


def generate_music_pages():
    music_files = list_files_in_subfolder('music')
    music_pages = []

    for fname in music_files:
        slug = make_slug(fname)
        out_dir = os.path.join(TARGET_DIR, 'music', slug)
        ensure_dir(out_dir)
        out_path = os.path.join(out_dir, 'index.html')

        audio_src = f"/static/music/{fname}"
        title = fname

        html = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
</head>
<body>
  <h1>{title}</h1>
  <audio controls src="{audio_src}">Your browser does not support the audio element.</audio>
  <p><a href="/music">Back to music list</a></p>
</body>
</html>
"""
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(html)
        music_pages.append((fname, f"/music/{slug}/"))
        print(f"Generated music page for: {fname} -> /music/{slug}/")

    return music_pages


def generate_image_pages():
    image_files = list_files_in_subfolder('images')
    image_pages = []

    for fname in image_files:
        slug = make_slug(fname)
        out_dir = os.path.join(TARGET_DIR, 'images', slug)
        ensure_dir(out_dir)
        out_path = os.path.join(out_dir, 'index.html')

        img_src = f"/static/images/{fname}"
        title = fname

        html = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
</head>
<body>
  <h1>{title}</h1>
  <img src="{img_src}" alt="{title}" style="max-width:100%;height:auto;" />
  <p><a href="/">Back to homepage</a></p>
</body>
</html>
"""
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(html)
        image_pages.append((fname, f"/images/{slug}/"))
        print(f"Generated image page for: {fname} -> /images/{slug}/")

    return image_pages


def freeze():
    # remove old build
    if os.path.exists(TARGET_DIR):
        print(f"Removing existing {TARGET_DIR}/")
        shutil.rmtree(TARGET_DIR)
    ensure_dir(TARGET_DIR)

    client = app.test_client()

    for route in ROUTES:
        print(f"GET {route}")
        resp = client.get(route)
        if resp.status_code == 200:
            save_response(route, resp.get_data())
            print(f"  -> saved: {route}")
        else:
            print(f"  -> skipped (status {resp.status_code}): {route}")

    # Copy static files (css, js, images, music, ...)
    copy_static()

    # Generate per-music and per-image pages
    music_pages = generate_music_pages()
    image_pages = generate_image_pages()

    # NOTE: We removed the code that patched build/music/index.html to insert
    # a generated "Music pages" list. The /music page will remain exactly as
    # served by your Flask app (no automatic injected list).

    print('\nFinished freezing app.')
    print(f"Static site is in: {TARGET_DIR}/")
    print("Deploy the build/ folder to Cloudflare Pages (set output dir to 'build').")


if __name__ == '__main__':
    freeze()

# TING AI Website V2 🎵🖼️

## Overview

I built TING-AI as my personal portfolio and playground for AI-related works. The site stores and showcases outputs, experiments, and demos including AI-generated images, audio, model demos, prompts, notebooks, and small interactive demos. The site is generated from a small Flask app and static assets, then exported into a build/ folder so it can be deployed as a static site (Cloudflare Pages is recommended).

# What I host here

- AI images & galleries — Stable Diffusion / other model outputs under static/images/.

- AI audio & music — Generated or processed audio under static/music/.

- Demos & mini apps — Small interactive demos (front-end JS, demos rendered server-side then frozen).

- Notebooks & prompts — Links or rendered outputs for research/code samples.

- Everything is file-based (github). I export the site to build/ and serve the static files on Cloudflare Pages (or any static host).

# Features

- Automatic image gallery that lists files in static/images/.

- Automatic playlist that detects audio files in static/music/ and provides play/pause, next/prev, shuffle, repeat, volume, and progress.

- Small demos and pages auto-rendered from Flask templates then exported to static HTML.

- Lightweight: small Python dependency footprint and easy to redeploy.

- Designed for privacy and provenance: I include model + prompt metadata alongside outputs where appropriate.

```
Project layout
/ (project root)
├── static/
│   ├── images/           # AI outputs (png/jpg/webp)
│   ├── music/            # Audio files (mp3/wav)
│   └── css/, js/, ...
├── app.py                # Flask application (app object)
├── freeze.py             # Export script: render routes -> build/
├── requirements.txt
└── README.md
```
### Prerequisites  
- Python 3.8+  
- Flask
- Jinja2

## Demo (Live Version) 🌐  
You can see the live, deployed version of this site at:  
[👉 Live Demo on Render]([TING AI Website V2](https://ting-ai-website-v2.pages.dev/)) 





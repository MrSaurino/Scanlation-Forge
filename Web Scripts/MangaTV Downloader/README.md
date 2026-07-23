# MangaTV Downloader

A dedicated Userscript designed to automate the retrieval of manga chapters from [MangaTV](https://mangatv.net/). Built specifically for scanlation workflows, this tool streamlines the "raw hunting" process by batch-downloading entire chapters and preparing them for digital cleaning and typesetting.

## Key Features

*   **Batch ZIP Downloading:** Grabs all pages of a chapter and compiles them into a single `.zip` file instantly.
*   **Auto-Format Normalization:** Intercepts image buffers and strictly converts all pages to `.png` format, ensuring standard quality for Photoshop editors.
*   **Stealth Mode Engine:** Implements a controlled 1.5-second request throttle to mimic human reading speed, bypassing Cloudflare's rate-limiting and IP bans.
*   **Multi-Context Scraping:** Capable of extracting image URLs from the active DOM, hidden scripts, and background API responses.
*   **Iframe Fallback:** If the primary extraction fails on index pages, the script opens a hidden, muted tunnel to force-load the chapter and extract the assets.

## How to Use

This script operates in two main areas of MangaTV:

**1. Inside a Chapter (Reader Area)**
* Navigate to any manga chapter.
* A floating button `[⬇ Descargar Capítulo (ZIP)]` will appear at the bottom or top of the reader.
* Click it once. The script will handle the scanning, downloading, and zipping automatically.

**2. In the Manga Directory (Chapter List)**
* Navigate to a manga's main page (where the chapter list is displayed).
* A small `[⬇ ZIP]` button will be injected next to every available chapter link.
* Click any of them to download that specific chapter without needing to open it in a new tab.

## Troubleshooting

*   **Stuck at "Downloading..." or HTTP 403 Errors:** If the firewall catches you, the script will attempt auto-retries. If it completely fails, pause your downloads for 10-15 minutes (even days in extreme cases) to let your IP cool down from the server's blacklist.
*   **No images found:** Refresh the page to ensure the DOM fully loaded before clicking the download button.

## Ethical Use

This tool is strictly provided for the **preservation and archival of manga** by scanlation groups. Please support official releases and use this script responsibly to avoid straining the host servers.

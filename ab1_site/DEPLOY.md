ABI Viewer (ab1) — Deployment Guide (/abi subpath)

Overview
- Purpose: Serve the mirrored AB1 viewer UI and provide APIs to parse Sanger sequencing .ab1 files.
- App path: Served under the subdirectory `/abi` (behind Apache).

Directory Layout
- `ab1_site/server.py`: Flask app serving static files and APIs under `/abi`.
- `ab1_site/site_root/www.chiplot.online`: Mirrored static assets (HTML/JS/CSS/images).

Prerequisites
- Python 3.10+ (3.11/3.12/3.13 OK)
- Network to install Python packages (pip wheels for flask/biopython/numpy)
- Apache (if exposing via subdirectory proxy)

Install Steps
1) Copy files to the server
   - Place the whole `ab1_site/` directory, e.g. `/opt/abi/ab1_site`.

2) Create Python venv and install dependencies
   - `sudo apt-get update && sudo apt-get install -y python3 python3-venv` (Debian/Ubuntu)
   - `cd /opt/abi/ab1_site`
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install --upgrade pip`
   - `pip install flask biopython gunicorn`

3) Run the app (choose one)
   - Development: `python server.py` (binds to `0.0.0.0:8000`)
   - Production (recommended): `gunicorn -w 2 -b 127.0.0.1:8000 'server:create_app()'`

Apache Reverse Proxy (Subdirectory /abi)
- Enable proxy modules:
  - `sudo a2enmod proxy proxy_http headers`
- Add to your VirtualHost config (e.g., `/etc/apache2/sites-available/000-default.conf`):

  <Location /abi/>
    ProxyPass http://127.0.0.1:8000/abi/
    ProxyPassReverse http://127.0.0.1:8000/abi/
    RequestHeader set X-Forwarded-Prefix "/abi"
  </Location>

- Reload Apache: `sudo systemctl reload apache2`
- Access URL: `https://<your-domain>/abi/static/ChiBioTools/src/ab1_file.html`

systemd Service (optional)
- Create `/etc/systemd/system/abi.service`:

  [Unit]
  Description=ABI Viewer API
  After=network.target

  [Service]
  WorkingDirectory=/opt/abi/ab1_site
  ExecStart=/opt/abi/ab1_site/.venv/bin/gunicorn -w 2 -b 127.0.0.1:8000 'server:create_app()'
  Restart=always
  User=www-data
  Group=www-data

  [Install]
  WantedBy=multi-user.target

- Enable & start: `sudo systemctl daemon-reload && sudo systemctl enable --now abi.service`

Usage
- Open `/abi/static/ChiBioTools/src/ab1_file.html` in a browser.
- Drag & drop an `.ab1` file to visualize peaks and sequence.

Troubleshooting
- App logs (dev): `/tmp/ab1_flask.log` (when running `python server.py`)
- App logs (systemd): `journalctl -u abi.service`
- Apache logs: `/var/log/apache2/error.log` and `access.log`
- 500 errors on upload:
  - Check `/tmp/ab1_flask.log` or `journalctl -u abi.service`
  - Some AB1 files may use different trace tags; the server maps DATA9–12 (fallback DATA1–4). Adjust if needed.

Customizing the Subdirectory
- Default subdirectory is `/abi`.
- To change it, update these locations to the same new prefix:
  - `ab1_site/server.py`: `BASE_PREFIX = '/abi'`
  - `static/ChiBioTools/src/ab1_file.html`: `window.API_BASE`, `window.ASSET_BASE`, and all script/icon paths prefixed with `/abi`.
  - Apache `ProxyPass`/`ProxyPassReverse` target and `<Location>` path.


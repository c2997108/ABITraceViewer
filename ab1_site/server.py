import io
import os
from typing import Dict, List

import traceback
from flask import Flask, jsonify, redirect, request, send_from_directory

BASE_PREFIX = '/abi'


def create_app() -> Flask:
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'site_root', 'www.chiplot.online'))
    # Serve all mirrored files under /abi/...
    app = Flask(__name__, static_folder=root_dir, static_url_path=BASE_PREFIX)

    @app.get('/')
    def index():
        return redirect(f'{BASE_PREFIX}/static/ChiBioTools/src/ab1_file.html', code=302)

    @app.get(f'{BASE_PREFIX}/')
    def abi_root():
        return redirect(f'{BASE_PREFIX}/static/ChiBioTools/src/ab1_file.html', code=302)

    @app.get(f'{BASE_PREFIX}/xiaochi/gettoken')
    def get_token():
        # The frontend only logs this; return a simple token payload
        return jsonify({
            'token': 'local-dev-token',
            'expires_in': 3600,
        })

    @app.post(f'{BASE_PREFIX}/ChiBioTools/getAb1Data')
    def get_ab1_data():
        up = request.files.get('file')
        if not up:
            return jsonify({'error': 'file is required'}), 400

        try:
            parsed = parse_ab1(up.stream, up.filename)
            return jsonify(parsed)
        except Exception as e:
            # Log full traceback to aid debugging
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500

    # Explicit route to serve known paths under static root (optional clarity)
    @app.get(f'{BASE_PREFIX}/<path:path>')
    def static_proxy(path: str):
        return send_from_directory(app.static_folder, path)

    return app


def parse_ab1(stream: io.BufferedIOBase, filename: str) -> Dict:
    # Lazy import to avoid mandatory dependency at import time
    from Bio import SeqIO

    # Ensure we can read from start
    if hasattr(stream, 'seek'):
        stream.seek(0)

    # Some BioPython AbiIO code expects a file-like with a .name attribute.
    # Wrap the bytes in BytesIO and attach a name to avoid TypeError.
    data = stream.read()
    bio = io.BytesIO(data)
    try:
        bio.name = filename or 'uploaded.ab1'  # type: ignore[attr-defined]
    except Exception:
        pass
    record = SeqIO.read(bio, 'abi')
    abif = record.annotations.get('abif_raw', {})

    # Trace channels: commonly DATA9..DATA12 correspond to G,A,T,C on many ABI machines
    # Fallbacks try older DATA1..DATA4.
    def get_trace(tag: str) -> List[int]:
        v = abif.get(tag)
        if v is None:
            return []
        try:
            return list(map(int, v))
        except Exception:
            # As bytes buffer of 16-bit? BioPython already decodes to array('H', ...). Fallback empty.
            return []

    g = get_trace('DATA9') or get_trace('DATA1')
    a = get_trace('DATA10') or get_trace('DATA2')
    t = get_trace('DATA11') or get_trace('DATA3')
    c = get_trace('DATA12') or get_trace('DATA4')

    # Normalize lengths to the shortest non-empty to avoid mismatch
    lens = [len(x) for x in (g, a, t, c) if x]
    npoints = min(lens) if lens else 0
    if npoints and (len(g) != npoints or len(a) != npoints or len(t) != npoints or len(c) != npoints):
        g, a, t, c = g[:npoints], a[:npoints], t[:npoints], c[:npoints]

    # Base calls and positions
    bases = abif.get('PBAS2') or abif.get('PBAS1') or b''
    if isinstance(bases, bytes):
        bases = bases.decode(errors='ignore')
    # Keep IUPAC codes including ambiguity (e.g., N, R, Y, ...). Upper-case and filter to letters only.
    bases = ''.join(ch for ch in bases if ch.isalpha()).upper()

    positions = abif.get('PLOC2') or abif.get('PLOC1') or []
    try:
        positions = list(map(int, positions))
    except Exception:
        positions = []

    # Base quality/confidence; optional
    quality = abif.get('PCON2') or abif.get('PCON1') or []
    try:
        quality = list(map(int, quality))
    except Exception:
        quality = []

    n_base = min(len(bases), len(positions))
    if quality and len(quality) >= n_base:
        qvals = quality[:n_base]
    else:
        # Default to a mid-quality if not present
        qvals = [30] * n_base

    # TSV with headers expected by frontend: base_symbol, base_location, base_quality
    lines = ["base_symbol\tbase_location\tbase_quality"]
    for i in range(n_base):
        lines.append(f"{bases[i]}\t{positions[i]}\t{qvals[i]}")
    tsv = "\n".join(lines)

    summary = [{
        'file name': filename,
        'base count': n_base,
        'trace length': npoints,
    }]

    peak_data = {
        'length': npoints,
        'channels': ['G', 'A', 'T', 'C'],
        'G': g,
        'A': a,
        'T': t,
        'C': c,
    }

    return {
        'summary': summary,
        'baseData': tsv,
        'peakData': peak_data,
    }


if __name__ == '__main__':
    app = create_app()
    # Bind to 0.0.0.0:8080 to match earlier static server
    app.run(host='0.0.0.0', port=8080, debug=False)

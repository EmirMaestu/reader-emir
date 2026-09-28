"""Desempaqueta el index.html "bundle" en archivos estáticos.
Uso: python tools/unbundle.py <bundle.html> <carpeta_destino>"""
import base64, gzip, json, os, re, sys

NAMES = {
    'ca6283eb-9270-4a16-a8ef-86789ce40141': 'vendor/react.production.min.js',
    '4ebad5e3-137b-4107-a182-455cf24cf2a9': 'vendor/react-dom.production.min.js',
    '60b9711d-fc6a-4203-8df9-cd65daad292a': 'vendor/dc-runtime.js',
    '63ca9dc9-0668-4cd7-a013-f302704e07e4': 'vendor/ds-bundle.js',
    'ad89b139-586e-4e5c-bed8-8e4e47ecbb6d': 'vendor/jszip.min.js',
}

src_path, out = sys.argv[1], sys.argv[2]
src = open(src_path, encoding='utf-8').read()
block = lambda t: json.loads(re.search(r'<script type="__bundler/' + t + r'">(.*?)</script>', src, re.S).group(1))
manifest, template, ext = block('manifest'), block('template'), block('ext_resources')

paths = {}
for uuid, e in manifest.items():
    data = base64.b64decode(e['data'])
    if e.get('compressed'):
        data = gzip.decompress(data)
    rel = NAMES.get(uuid) or ('fonts/' + uuid + '.woff2' if e['mime'].startswith('font/') else 'assets/' + uuid)
    os.makedirs(os.path.join(out, os.path.dirname(rel)), exist_ok=True)
    open(os.path.join(out, rel), 'wb').write(data)
    paths[uuid] = rel

for uuid, rel in paths.items():
    template = template.replace(uuid, rel)

resources = {e['id']: paths[e['uuid']] for e in ext}
res_script = '<script>window.__resources = ' + json.dumps(resources) + ';</script>\n'
template = template.replace('<script src="vendor/dc-runtime.js">', res_script + '<script src="vendor/dc-runtime.js">', 1)

open(os.path.join(out, 'index.html'), 'w', encoding='utf-8', newline='\n', errors='surrogatepass').write(template)
print('ok', len(paths), 'archivos')

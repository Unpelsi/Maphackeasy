import vpk, json, re, os

pack = vpk.open(r'D:\SteamLibrary\steamapps\common\Counter-Strike Global Offensive\game\csgo\pak01_dir.vpk')
ov = {}
for name in pack:
    if name.startswith('resource/overviews/') and name.endswith('.txt'):
        data = pack[name].read().decode('utf-8', errors='replace')
        # Parse pos_x, pos_y, scale from the key-value pairs
        m = re.search(r'"pos_x"\s+"(-?\d+)"', data)
        pos_x = m.group(1) if m else None
        m = re.search(r'"pos_y"\s+"(-?\d+)"', data)
        pos_y = m.group(1) if m else None
        m = re.search(r'"scale"\s+"([\d.]+)"', data)
        scale = m.group(1) if m else None
        key = name.replace('resource/overviews/', '').replace('.txt', '')
        if pos_x and pos_y and scale:
            ov[key] = {'px': int(pos_x), 'py': int(pos_y), 's': float(scale)}
            print(f'{key}: pos=({ov[key]["px"]},{ov[key]["py"]}) scale={ov[key]["s"]}')
        else:
            print(f'{key}: MISSING DATA (px={pos_x}, py={pos_y}, s={scale})')

# Also add _s2, _v1, _v2 variants from known keys
for k, v in list(ov.items()):
    if k.endswith('_s2'):
        ov[k.replace('_s2', '')] = v
    elif k.endswith('_v1'):
        ov[k.replace('_v1', '')] = v
    elif k.endswith('_v2'):
        ov[k.replace('_v2', '')] = v

out = r'C:\progi\OxranaLoutabaClient-Dll-CS2\vercel-radar\public\overviews.json'
with open(out, 'w', encoding='utf-8') as fp:
    json.dump(ov, fp, indent=2, ensure_ascii=False)
print(f'\nSaved {len(ov)} maps to {out}')

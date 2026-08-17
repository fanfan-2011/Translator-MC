# 从 Modrinth 下载一个纯英文（无中文语言文件）的 Minecraft Fabric Mod 用于测试
import urllib.request
import urllib.parse
import json
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'test-files')
os.makedirs(OUT_DIR, exist_ok=True)
UA = {'User-Agent': 'Translator-MC/1.0 (testing tool)'}


def get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=timeout))


# 1) 搜索候选 Mod（纯英文、有语言文件的热门 Mod）
candidates = ['sodium', 'iris', 'lithium', 'modmenu', 'roughly-enough-items', 'emi']
found = {}
for slug in candidates:
    try:
        d = get(f'https://api.modrinth.com/v2/project/{slug}')
        # 检查该项目是否有 en_us 语言文件（通过版本文件列表判断需下载后才知道，这里先记录元数据）
        found[slug] = {
            'title': d.get('title'),
            'downloads': d.get('downloads'),
            'categories': d.get('categories'),
        }
        print(f"{slug:22s} | {d.get('title'):30s} | downloads {d.get('downloads'):>8} | {','.join(d.get('categories', []))}")
    except Exception as e:
        print(f"{slug:22s} | ERR {e}")


# 2) 下载 Sodium（渲染优化 Mod，GUI 设置文本丰富）
def download_mod(slug, out_name):
    versions = get(f'https://api.modrinth.com/v2/project/{slug}/version')
    # 选最新的 fabric 版本
    fabric = [v for v in versions if 'fabric' in (v.get('loaders') or [])]
    if not fabric:
        fabric = versions
    latest = fabric[0]
    files = latest.get('files', [])
    primary = next((f for f in files if f.get('primary')), files[0] if files else None)
    if not primary:
        return None
    url = primary['url']
    filename = primary['filename']
    out_path = os.path.join(OUT_DIR, out_name)
    print(f'\n下载 {latest.get("name")} -> {filename}')
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    with open(out_path, 'wb') as f:
        f.write(data)
    print(f'已保存: {out_path} ({len(data)//1024} KB)')
    return out_path


download_mod('sodium', 'sodium-test-mod.jar')

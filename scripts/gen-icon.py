# 生成 Translator MC 的应用图标：icon.svg（矢量源）+ icon.png + icon.ico（多尺寸）
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'build')
os.makedirs(OUT_DIR, exist_ok=True)

FONT = 'C:/Windows/Fonts/msyhbd.ttc'  # 微软雅黑粗体

SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4d7cff"/>
      <stop offset="100%" stop-color="#1a30a8"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="248" height="248" rx="56" fill="url(#bg)"/>
  <text x="128" y="176" font-family="'Microsoft YaHei', 'PingFang SC', sans-serif"
        font-size="150" font-weight="700" fill="#ffffff" text-anchor="middle">译</text>
</svg>
'''


def gradient_bg(size):
    """对角线性渐变背景，带圆角透明边。"""
    top = (77, 124, 255)    # #4d7cff
    bottom = (26, 48, 168)  # #1a30a8
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            r = int(top[0] + (bottom[0] - top[0]) * t)
            g = int(top[1] + (bottom[1] - top[1]) * t)
            b = int(top[2] + (bottom[2] - top[2]) * t)
            px[x, y] = (r, g, b, 255)
    # 圆角遮罩（图标外四角透明）
    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img.putalpha(mask)
    return img


def make_icon(size):
    img = gradient_bg(size)
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, int(size * 0.56))
    # anchor='mm' 让文字的水平和垂直中心精确落在画布中心
    draw.text((size / 2, size / 2), '译', font=font, fill=(255, 255, 255, 255), anchor='mm')
    return img


def main():
    # SVG 源文件
    svg_path = os.path.join(OUT_DIR, 'icon.svg')
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(SVG)
    print('SVG:', svg_path)

    # 256 PNG
    png_path = os.path.join(OUT_DIR, 'icon.png')
    make_icon(256).save(png_path, 'PNG')
    print('PNG:', png_path)

    # ICO（多尺寸）
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    imgs = [make_icon(s) for s, _ in sizes]
    ico_path = os.path.join(OUT_DIR, 'icon.ico')
    imgs[-1].save(ico_path, format='ICO', sizes=[(s, s) for s, _ in sizes], append_images=imgs[:-1])
    print('ICO:', ico_path, '含尺寸', [f'{s}x{s}' for s, _ in sizes])


if __name__ == '__main__':
    main()

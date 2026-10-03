/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 语义化令牌：颜色全部指向 index.css 里的 CSS 变量（亮/暗两套），
        // 组件里只写 bg-surface / text-ink / border-line 这类语义类名，不写死 hex。
        // 令牌来源见 design/UI-SPEC.md（Figma 文件 tsm）。
        bg: 'var(--tsm-bg)',
        surface: {
          DEFAULT: 'var(--tsm-surface)',
          2: 'var(--tsm-surface-2)',
          3: 'var(--tsm-surface-3)',
          4: 'var(--tsm-surface-4)'
        },
        alt: 'var(--tsm-row-alt)',
        sunken: 'var(--tsm-sunken)',
        code: 'var(--tsm-code-bg)',
        line: {
          DEFAULT: 'var(--tsm-line)',
          2: 'var(--tsm-line-2)',
          3: 'var(--tsm-line-3)',
          4: 'var(--tsm-line-4)',
          row: 'var(--tsm-line-row)'
        },
        ink: {
          DEFAULT: 'var(--tsm-ink)',
          2: 'var(--tsm-ink-2)',
          3: 'var(--tsm-ink-3)',
          4: 'var(--tsm-ink-4)'
        },
        muted: {
          DEFAULT: 'var(--tsm-muted)',
          2: 'var(--tsm-muted-2)',
          3: 'var(--tsm-muted-3)',
          4: 'var(--tsm-muted-4)',
          5: 'var(--tsm-muted-5)'
        },
        primary: {
          DEFAULT: 'var(--tsm-primary)',
          fg: 'var(--tsm-on-primary)',
          soft: 'var(--tsm-primary-soft)',
          line: 'var(--tsm-primary-line)',
          ink: 'var(--tsm-primary-ink)'
        },
        accent: {
          DEFAULT: 'var(--tsm-accent)',
          2: 'var(--tsm-accent-2)',
          soft: 'var(--tsm-accent-soft)'
        },
        link: 'var(--tsm-link)',
        target: 'var(--tsm-target)',
        key: 'var(--tsm-key)',
        danger: {
          DEFAULT: 'var(--tsm-danger)',
          soft: 'var(--tsm-danger-soft)'
        },
        hover: 'var(--tsm-hover)',
        selected: 'var(--tsm-selected)',
        // 主面板与灰色外壳之间的 1px 硬边界（设计稿实测为纯黑 1px 线）
        edge: '#000000'
      },
      fontFamily: {
        sans: [
          'Inter',
          'Microsoft YaHei UI',
          'Microsoft YaHei',
          'PingFang SC',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        mono: ['Roboto Mono', 'Consolas', 'Menlo', 'monospace'],
        machine: ['Anonymous Pro', 'Roboto Mono', 'Consolas', 'monospace']
      },
      fontSize: {
        '2xs': ['11px', '14px'],
        xs: ['12px', '16px'],
        sm: ['13px', '17px'],
        base: ['14px', '18px'],
        md: ['15px', '19px'],
        lg: ['16px', '20px']
      },
      borderRadius: {
        win: '6px',
        chip: '4px',
        input: '8px',
        sm: '12px',
        tile: '14px',
        card: '16px',
        panel: '18px',
        update: '20px',
        full: '999px'
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 8px 20px -10px rgba(0,0,0,0.07)',
        update: '0 1px 2px rgba(0,0,0,0.05), 0 8px 20px -8px rgba(0,0,0,0.08)',
        primary: '0 6px 16px -6px rgba(102,218,72,0.2)',
        input: '0 2px 8px -2px rgba(0,0,0,0.04)',
        glass: '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.25)',
        menu: '0 4px 12px rgba(0,0,0,0.06), 0 12px 32px -12px rgba(0,0,0,0.18)'
      }
    }
  },
  plugins: []
}

[简体中文](README.md) | English
# Translator MC

Minecraft AI translation tool — supports AI translation for `Minecraft Mod` / `Resource Pack` / `Shader Pack`. The Agent automatically analyzes file structures, extracts text, calls large models for batch translation, manages terminology, performs quality checks, supports manual review, and finally exports safely.

## Features
 - **Simple interface, beginner-friendly**
 - **Multi-language support**
 - **Mod, Resource Pack, Shader Pack support**
 - **AI precise translation**
 - **Support for custom translation models**
 - **Completely free and open source**

## Screenshots
**Main interface:**
![main](screenshots/image.png)

**Translation interface:**
![translate](screenshots/image2.png)

**Translation memory:**
![memory](screenshots/image3.png)

**Translation history:**
![history](screenshots/image4.png)



## How to Run

### Option 1: Run the packaged program directly (recommended)

Download the latest binary from "Releases":

| File name                                | File type   |
|------------------------------------|--------|
| `Translator-MC-mobile-win-version.zip` | Portable version   |
| `Translator-MC-Setup-win-version.exe`  | exe installer |

> To ensure the best experience, please download and use the latest version of the application

### Option 2: Run in development mode (requires Node.js 20+)

```bash
npm install        # Install dependencies for the first time
npm run dev        # Start development mode (hot reload)
```

### Option 3: Repackage it yourself

```bash
npm run build:win  # Build + package Windows installer (output to release/)
```

## Core Features

### Import and Recognition

- **Drag-and-drop import**: Supports `.jar` / `.zip` / directories, with multi-file import.
- **Type recognition**: Recognizes Mods, Resource Packs, and Shader Packs.
  - Mod: `fabric.mod.json` / `quilt` / `mods.toml` / `mcmod.info`
  - Resource Pack: `pack.mcmeta`
  - Shader Pack: `shaders/`
- **Language file parsing**: Compatible with multiple parsers for `JSON` / `JSON5` / `.lang` / `.properties` / `YAML` / `TOML`.

### Translation and AI

- **Source language adaptation**: Automatically recognizes non-English source languages such as Japanese, Korean, German, French, and Russian.
- **Target language selection**: Supports 12 target languages, including Simplified Chinese, Traditional Chinese, Japanese, Korean, English, French, German, Russian, Spanish, Portuguese, Italian, and more.
- **AI batch translation**: Multiple entries per batch, supports OpenAI-compatible APIs.
- **Multiple Providers**: Built-in provider presets for OpenAl, DeepSeek, Zhipu GLM, Moonshot (Kimi), local Ollama, and LM Studio.
- **Dedicated Prompts**: Three independent system prompt sets for Mod / Shader / Resource Pack.
- **Contextual translation**: Injects package name, category, terminology list, and translation memory.
- **Translation memory**: Automatically reuses identical source text.

### Quality Control

- **Terminology list**: Supports create, read, update, and delete, injects into prompts, and performs terminology consistency checks.
- **Translation history**: Records a version for every AI or manual modification.
- **Placeholder validation**: Validates placeholders such as `%s` / `%1$s` / `%d` / `${name}` / `<player>`.
- **Format code protection**: Protects format codes such as `§a` / `§b` / `§r`.
- **JSON Schema validation**: Repairs and parses JSON output from LLMs.
- **AI quality review**: Provides scores, issues, and suggestions.
- **Issue center**: Summarizes issues such as placeholders, terminology, formatting, and missing content.

### Export

- Supports exporting localized resource pack zips, as well as modified Jar files.

### Interface and Efficiency

- Supports search, filtering, and batch selection.
- Supports theme switching, keyboard shortcuts, and log viewing.
## Testing

```bash
npm run typecheck                 # TypeScript type checking
node scripts/selftest.cjs         # Core logic self-test (requires npx esbuild packaging first)
npx electron . --selftest         # Full end-to-end self-test (import → recognize → extract → store → export)
```

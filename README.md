# VTTC - Virtual Tabletop Converter

**VTTC** is a command line tool (CLI) that quickly converts various image and video formats into optimized formats compatible with popular VTTs (e.g. Foundry VTT, Roll20, Fantasy Grounds).

> Right now it's pretty basic and lacks of some options (especially for video formats) but still useful for quick conversion.

## Installation

1. Install [Node.js 18+](https://nodejs.org/en/download) if you don't have it.
2. Run:

```
npm i vttc -g
```

(folder doesn't matter, it will install a Global package)

## Usage

1. Open a command prompt in the directory with files you want to convert.

- **Windows**: Right Click -> Open in Terminal.
- **Mac**: [see instruction](https://support.apple.com/guide/terminal/open-new-terminal-windows-and-tabs-trmlb20c7888/mac).
- **Linux**: you already know that.

2. Run:

```
vttc
```

## Updating

You may update all global packages with:

```
npm update -g
```

## Credits

- [@clack/prompts](https://github.com/natemoo-re/clack) - fancy CLI prompts
- [@DreamOfIce/ffmpeg.wasm](https://github.com/DreamOfIce/ffmpeg.wasm-core) - working fork of [@ffmpegwasm/ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)

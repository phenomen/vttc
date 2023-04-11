# VTTC - Virtual Tabletop Converter

**VTTC** is a command-line tool (CLI) that quickly converts various image and video formats into formats compatible with most VTT (i.e. Foundry VTT, Roll20, Fantasy Grounds).

## Installation

1. Install [Node.js 18+](https://nodejs.org/en/download) if you don't have it.
2. Run:

```
npm i vttc -g
```

(folder doesn't matter, it will install a Global package)

## Usage

1. Open a command prompt in the directory with files you want to convert. **Windows**: Right Click -> Open in Terminal.
2. Run:

```
vttc
```

## Update

You may update all global packages with:

```
npm update -g
```

## Credits

- @clack/prompts - fancy CLI prompts
- @DreamOfIce/ffmpeg.wasm - working fork of @ffmpegwasm/ffmpeg.wasm

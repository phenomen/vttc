# VTTC - Virtual Tabletop Converter

**VTTC** is a command line tool (CLI) that quickly converts various image and video formats into optimized formats compatible with popular VTTs (e.g. Foundry VTT, Roll20, Fantasy Grounds).

## Supported Formats

- **Image conversion:** any image into WEBP, PNG, JPEG, AVIF.
- **Video conversion:** any video into WEBM, MP4, OGG, MP3.
- **Audio conversion:** any audio into OGG, MP3.

## Prerequisites

Install [Node.js 20+](https://nodejs.org/en/download) if you don't have it installed.

## Usage

1. Open a command prompt in the directory with files you want to convert.

- **Windows**: Right Click -> Open in Terminal.
- **Mac**: [see instruction](https://support.apple.com/guide/terminal/open-new-terminal-windows-and-tabs-trmlb20c7888/mac).
- **Linux**: you already should know that.

2. Run:

```
npx vttc
```

## TODO

- [x] Recursive directory processing
- [x] FFmpeg V6
- [ ] Launch with arguments bypassing prompts
- [ ] More options (remove audio track, remove transparency, custom framerate, etc.)

## Credits

- [@clack/prompts](https://github.com/natemoo-re/clack) - CLI prompts
- [@ffmpegwasm/ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) - FFmpeg WASM

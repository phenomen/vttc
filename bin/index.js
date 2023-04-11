#! /usr/bin/env node
import { intro, select, isCancel, cancel, text } from "@clack/prompts";
import { convert } from "./convert.js";

async function main() {
  console.log();
  intro(" [ VTTC ] ");

  const folder = await text({
    message: "Select an input folder",
    placeholder: "./",
    defaultValue: "./",
    initialValue: "./",
  });

  if (isCancel(folder)) {
    cancel("Operation cancelled");
    return process.exit(0);
  }

  const action = await select({
    message: "Select an action",
    options: [
      { value: "image", label: "Image conversion" },
      { value: "video", label: "Video conversion" },
      { value: "audio", label: "Audio conversion" },
    ],
  });

  if (isCancel(action)) {
    cancel("Operation cancelled");
    return process.exit(0);
  }

  let format;

  if (action === "image") {
    format = await select({
      message: "Select an output format",
      options: [
        { value: "webp", label: "WEBP", hint: "Recommended" },
        { value: "png", label: "PNG", hint: "Loseless" },
        { value: "jpeg", label: "JPEG" },
        { value: "avif", label: "AVIF" },
      ],
    });
  } else if (action === "video") {
    format = await select({
      message: "Select an output format",
      options: [
        { value: "webm", label: "WEBM", hint: "Recommended" },
        { value: "mp4", label: "MP4" },
        { value: "ogg", label: "OGG", hint: "Audio only" },
        { value: "mp3", label: "MP3", hint: "Audio only" },
      ],
    });
  } else if (action === "audio") {
    format = await select({
      message: "Select an output format",
      options: [
        { value: "ogg", label: "OGG", hint: "Recommended" },
        { value: "mp3", label: "MP3" },
      ],
    });
  }

  if (isCancel(format)) {
    cancel("Operation cancelled");
    return process.exit(0);
  }

  const quality = await select({
    message: "Select a quality",
    options: [
      { value: "high", label: "HIGH" },
      { value: "mid", label: "MEDIUM", hint: "Recommended" },
      { value: "low", label: "LOW" },
    ],
    initialValue: "mid",
  });

  if (isCancel(quality)) {
    cancel("Operation cancelled");
    return process.exit(0);
  }

  await convert(folder, action, format, quality);

  process.exit(0);
}
main().catch(console.error);

#!/usr/bin/env bun
import { intro, select, isCancel, cancel, text, outro } from "@clack/prompts";
import { createFileData } from "./files.js";
import type { OutputFormat, QualityLevel } from "./files.js";
import { convert } from "./convert.js";

async function main() {
  console.log();
  intro(" [ VTTC 4.0.0 ] ");

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

  const format = await select<OutputFormat>({
    message: "Select an output format",
    options: [
      { value: "webp", label: "WEBP", hint: "Recommended for images" },
      { value: "png", label: "PNG" },
      { value: "jpeg", label: "JPEG" },
      { value: "webm", label: "WEBM", hint: "Recommended for video" },
      { value: "mp4", label: "MP4" },
      { value: "ogg", label: "OGG", hint: "Recommended for audio" },
      { value: "aac", label: "AAC" },
    ],
  });

  if (isCancel(format)) {
    cancel("Operation cancelled");
    return process.exit(0);
  }

  const quality = await select<QualityLevel>({
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

  const fileData = await createFileData(folder, format, quality);

  await convert(fileData);

  outro("Your converted files are in the 'output' folder.");

  process.exit(0);
}
main().catch(console.error);

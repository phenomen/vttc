#!/usr/bin/env bun
import {
  intro,
  select,
  isCancel,
  cancel,
  text,
  outro,
  confirm,
  log,
} from "@clack/prompts";
import {
  createFileData,
  resolveInputFolder,
  getActionLabel,
  getQualityLabel,
  countGifInputs,
} from "./files.js";
import type { OutputFormat, QualityLevel } from "./files.js";
import { convert } from "./convert.js";
import { version } from "../package.json";

function exitWithCancel(): never {
  cancel("Operation cancelled");
  process.exit(0);
}

function exitWithError(message: string, exitCode = 1): never {
  log.error(message);
  process.exit(exitCode);
}

async function main(): Promise<void> {
  console.log();
  intro(` [ VTTC ${version} ] `);

  const folderInput = await text({
    message: "Input folder path",
    placeholder: "./",
    defaultValue: "./",
  });

  if (isCancel(folderInput)) {
    exitWithCancel();
  }

  let inputFolder: string;
  try {
    inputFolder = await resolveInputFolder(folderInput);
  } catch (error) {
    exitWithError(getReadableError(error));
  }

  const format = await select<OutputFormat>({
    message: "Select an output format",
    options: [
      {
        value: "webp",
        label: "WEBP",
        hint: "Best for tokens, tiles, and scenes",
      },
      {
        value: "png",
        label: "PNG",
        hint: "Lossless; use when alpha must stay perfect",
      },
      {
        value: "avif",
        label: "AVIF",
        hint: "Smaller files; newer Foundry versions",
      },
      {
        value: "jpeg",
        label: "JPEG",
        hint: "Photos without transparency",
      },
      {
        value: "webm",
        label: "WEBM",
        hint: "Best for animated effects and ambience",
      },
      { value: "mp4", label: "MP4" },
      {
        value: "ogg",
        label: "OGG",
        hint: "Best for sound effects and ambience",
      },
      { value: "aac", label: "AAC" },
    ],
  });

  if (isCancel(format)) {
    exitWithCancel();
  }

  const quality = await select<QualityLevel>({
    message: "Select a quality",
    options: [
      { value: "high", label: "HIGH", hint: "Published module quality" },
      { value: "mid", label: "MEDIUM", hint: "Recommended" },
      { value: "low", label: "LOW", hint: "Fast previews and temp assets" },
    ],
    initialValue: "mid",
  });

  if (isCancel(quality)) {
    exitWithCancel();
  }

  let fileData;
  try {
    fileData = await createFileData(inputFolder, format, quality);
  } catch (error) {
    exitWithError(getReadableError(error));
  }

  const { filePaths, settings, outputFolder } = fileData;
  const mediaLabel = getActionLabel(settings.action);

  if (filePaths.length === 0) {
    exitWithError(
      `No ${mediaLabel} files found in ${inputFolder} for ${format.toUpperCase()} output`
    );
  }

  const gifCount = settings.action === "image" ? countGifInputs(filePaths) : 0;

  console.log("");
  log.info(
    `Found ${filePaths.length} ${mediaLabel} file(s) in ${inputFolder}`
  );
  log.info(
    `Output: ${format.toUpperCase()} (${getQualityLabel(quality)} quality) → ${outputFolder}`
  );

  if (gifCount > 0) {
    log.warning(
      `${gifCount} GIF file(s) detected — animation may be reduced to a single frame`
    );
  }

  const shouldProceed = await confirm({
    message: `Convert ${filePaths.length} file(s)?`,
    initialValue: true,
  });

  if (isCancel(shouldProceed) || !shouldProceed) {
    exitWithCancel();
  }

  const outcome = await convert(fileData);

  if (!outcome.ok) {
    exitWithError(outcome.message, outcome.exitCode);
  }

  outro(`Converted files are in ${outputFolder}`);
  process.exit(0);
}

function getReadableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  exitWithError(getReadableError(error));
});
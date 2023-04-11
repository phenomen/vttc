#! /usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createFFmpeg, fetchFile } from "@ffmpeg.wasm/main";
import { intro, select, spinner, group, cancel, text } from "@clack/prompts";

async function convert(userFolder, userFormat, userQuality) {
  const ffmpeg = createFFmpeg({ log: false });
  const s = spinner();

  const inputDir = path.join(userFolder);
  const outputDir = path.join(userFolder, "output");

  async function createOutputDir() {
    try {
      await fs.mkdir(outputDir);
    } catch (error) {
      if (error.code === "EEXIST") {
        console.log("Output directory already exists");
      } else {
        console.error(error);
      }
    }
  }

  await createOutputDir();
  await ffmpeg.load();

  const files = await fs.readdir(inputDir);

  const compatibleFiles = files.filter((file) =>
    [
      ".avif",
      ".gif",
      ".jpeg",
      ".jpg",
      ".m4v",
      ".mov",
      ".mp4",
      ".mpeg",
      ".png",
      ".webm",
      ".webp",
    ].includes(path.extname(file).toLowerCase())
  );

  if (compatibleFiles.length === 0) {
    console.log("No compatible files found");
    process.exit(0);
  }

  s.start(`Converting ${compatibleFiles.length} file(s) into ${userFormat}`);

  for (let i = 0; i < compatibleFiles.length; i++) {
    const inputFile = path.join(inputDir, compatibleFiles[i]);
    const outputFile = path.join(
      outputDir,
      compatibleFiles[i].replace(/\.[^/.]+$/, "") + "." + userFormat
    );

    ffmpeg.FS("writeFile", compatibleFiles[i], await fetchFile(inputFile));

    await ffmpeg.run("-i", compatibleFiles[i], "-q", userQuality, outputFile);

    await fs.writeFile(outputFile, ffmpeg.FS("readFile", outputFile));
  }

  s.stop(`Converted ${compatibleFiles.length} file(s)`);

  process.exit(0);
}

async function main() {
  console.log();
  intro(" - VTTC - ");

  const prompts = await group(
    {
      folder: () =>
        text({
          message: "Select an input folder",
          placeholder: "./",
          defaultValue: "./",
          initialValue: "./",
        }),

      format: () =>
        select({
          message: "Select an output format",
          options: [
            { value: "webp", label: "WEBP", hint: "Optimized images" },
            { value: "webm", label: "WEBM", hint: "Optimized video" },
            { value: "png", label: "PNG", hint: "Loseless images" },
            { value: "mp4", label: "MP4", hint: "Legacy video" },
            { value: "jpeg", label: "JPEG", hint: "Legacy images" },
          ],
        }),

      quality: () =>
        select({
          message: "Select a quality",
          options: [
            { value: "90", label: "HIGH" },
            { value: "75", label: "MEDIUM" },
            { value: "60", label: "LOW" },
          ],
          initialValue: "75",
        }),
    },
    {
      onCancel: ({ results }) => {
        cancel("Operation cancelled.");
        process.exit(0);
      },
    }
  );
  convert(prompts.folder, prompts.format, prompts.quality);
}
main().catch(console.error);

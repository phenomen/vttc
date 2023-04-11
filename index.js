import fs from "node:fs/promises";
import path from "node:path";
import { createFFmpeg, fetchFile } from "@ffmpeg.wasm/main";
import { intro, select, spinner, group, cancel, text } from "@clack/prompts";
import color from "picocolors";

async function convert(userFolder, userFormat, userQuality) {
  const ffmpeg = createFFmpeg({ log: false });
  const s = spinner();

  const inputDir = path.join(userFolder);
  const outputDir = path.join(userFolder, "output");

  async function createOutputDir() {
    try {
      await fs.mkdir(outputDir);
    } catch (error) {
      console.error(error);
    }
  }

  await createOutputDir();
  await ffmpeg.load();

  const files = await fs.readdir(inputDir);

  const compatibleFiles = files.filter((file) =>
    [".jpg", ".jpeg", ".avif", ".png", "webp", ".gif", "webm", ".mov", ".mp4", ".mpeg"].includes(
      path.extname(file).toLowerCase()
    )
  );

  if (compatibleFiles.length === 0) {
    console.log("No compatible files found");
    process.exit(0);
  }

  s.start(`Converting ${compatibleFiles.length} files into ${userFormat}`);

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

  s.stop(`${compatibleFiles.length} files are converted`);

  process.exit(0);
}

async function main() {
  console.log();
  intro(color.bgYellow(color.black(" VTTC ")));

  const prompts = await group(
    {
      folder: () =>
        text({
          message: "Choose an input folder",
          placeholder: "./",
          defaultValue: "./",
          initialValue: "./",
        }),

      format: () =>
        select({
          message: "Choose an output format",
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
          message: "Choose a quality",
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

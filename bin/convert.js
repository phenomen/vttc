import { createFFmpeg, fetchFile } from "@ffmpeg.wasm/main";
import fs from "node:fs/promises";
import path from "node:path";
import { spinner } from "@clack/prompts";

const formatsImage = [".avif", ".jpeg", ".jpg", ".png", ".webp"];
const formatsVideo = [".m4v", ".mov", ".mp4", ".mpeg", ".webm"];
const formatsAudio = [".m4a", ".mp3", ".wav", ".ogg"];

export async function convert(userFolder, userAction, userFormat, userQuality) {
  // SETTINGS

  let compatibleFormats = [];
  let quality = [];
  let extra = [];

  switch (userAction) {
    case "image":
      compatibleFormats = formatsImage;
      switch (userQuality) {
        case "high":
          quality = ["-q", "90"];
          break;
        case "mid":
          quality = ["-q", "75"];
          break;
        case "low":
          quality = ["-q", "60"];
          break;
      }

      break;
    case "video":
      compatibleFormats = formatsVideo;
      switch (userQuality) {
        case "high":
          quality = ["-b:v", "2M", "-b:a", "128k"];
          break;
        case "mid":
          quality = ["-b:v", "1M", "-b:a", "128k"];
          break;
        case "low":
          quality = ["-b:v", "512k", "-b:a", "64k"];
          break;
      }
      break;
    case "audio":
      compatibleFormats = formatsAudio;
      switch (userQuality) {
        case "high":
          quality = ["-b:a", "192k"];
          break;
        case "mid":
          quality = ["-b:a", "128k"];
          break;
        case "low":
          quality = ["-b:a", "64k"];
          break;
      }
      break;
  }

  switch (userFormat) {
    case "webm":
      extra = ["-c:v", "libvpx", "-c:a", "libvorbis", "-row-mt", "1"];
      break;
    case "mp4":
      extra = ["-c:a", "libvorbis"];
      break;
    case "ogg":
      extra = ["-vn"];
      break;
    case "mp3":
      extra = ["-vn"];
      break;
  }

  // FILES

  const inputDir = path.join(userFolder);
  const outputDir = path.join(userFolder, "output");

  const files = await fs.readdir(inputDir);

  const compatibleFiles = files.filter((file) =>
    compatibleFormats.includes(path.extname(file).toLowerCase())
  );

  if (compatibleFiles.length === 0) {
    console.error("No compatible files found");
    process.exit(0);
  }

  async function createOutputDir() {
    try {
      await fs.mkdir(outputDir);
    } catch (error) {
      if (error.code === "EEXIST") {
        console.log("Output directory already exists");
      } else {
        console.error(error);
        process.exit(1);
      }
    }
  }

  await createOutputDir();

  // FFMPEG

  const ffmpeg = createFFmpeg({ log: false });

  await ffmpeg.load();

  const s = spinner();

  s.start(`Converting ${compatibleFiles.length} file(s) into ${userFormat}`);

  for (let i = 0; i < compatibleFiles.length; i++) {
    const inputFile = path.join(inputDir, compatibleFiles[i]);
    const outputFile = path.join(
      outputDir,
      compatibleFiles[i].replace(/\.[^/.]+$/, "") + "." + userFormat
    );

    ffmpeg.FS("writeFile", compatibleFiles[i], await fetchFile(inputFile));

    if (userAction === "image") {
      await ffmpeg.run("-i", compatibleFiles[i], ...quality, outputFile);
    }

    if (userAction === "video") {
      await ffmpeg.run("-i", compatibleFiles[i], ...quality, ...extra, outputFile);
    }

    if (userAction === "audio") {
      await ffmpeg.run("-i", compatibleFiles[i], ...quality, ...extra, outputFile);
    }

    await fs.writeFile(outputFile, ffmpeg.FS("readFile", outputFile));

    ffmpeg.FS("unlink", outputFile);
  }

  s.stop(`Converted ${compatibleFiles.length} file(s)`);
}

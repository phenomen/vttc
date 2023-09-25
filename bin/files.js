import fs from "fs/promises";
import path from "path";

let compatibleFormats = [];
let settings;
let action;
let extra = [];
let quality;

const formatsImage = [
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".tiff",
  ".webp",
  ".jfif",
];
const formatsVideo = [
  ".avi",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".webm",
  ".wmv",
];
const formatsAudio = [
  ...formatsVideo,
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".ogg",
  ".wav",
];

function setSettings(userFormat, userQuality) {
  if (["webp", "png", "avif", "jpg", "jpeg", "jfif"].includes(userFormat)) {
    action = "image";
    compatibleFormats = formatsImage;

    if (userQuality === "high") {
      quality = 90;
    } else if (userQuality === "mid") {
      quality = 80;
    } else if (userQuality === "low") {
      quality = 60;
    }
  } else if (["webm", "mp4"].includes(userFormat)) {
    action = "video";
    compatibleFormats = formatsVideo;

    if (userQuality === "high") {
      quality = ["-b:v", "2M", "-b:a", "96k"];
    } else if (userQuality === "mid") {
      quality = ["-b:v", "1M", "-b:a", "96k"];
    } else if (userQuality === "low") {
      quality = ["-b:v", "512k", "-b:a", "96k"];
    }
  } else if (["mp3", "ogg"].includes(userFormat)) {
    action = "audio";
    compatibleFormats = formatsAudio;

    if (userQuality === "high") {
      quality = ["-b:a", "160k"];
    } else if (userQuality === "mid") {
      quality = ["-b:a", "128k"];
    } else if (userQuality === "low") {
      quality = ["-b:a", "96k"];
    }
  } else {
    console.error("Unknown output format");
    process.exit(0);
  }

  if (userFormat === "webm") {
    extra = [
      "-c:v",
      "libvpx-vp9",
      "-c:a",
      "libopus",
      "-row-mt",
      "1",
      "-f",
      "webm",
    ];
  } else if (userFormat === "mp4") {
    extra = ["-c:a", "libopus"];
  } else if (userFormat === "ogg") {
    extra = ["-vn", "-c:a", "libopus"];
  } else if (userFormat === "mp3") {
    extra = ["-vn"];
  }

  settings = { format: userFormat, action, quality, extra };
}

export async function createFileData(inputFolder, userFormat, userQuality) {
  setSettings(userFormat, userQuality);

  const filePaths = [];

  const scanDirectory = async (dir) => {
    const files = await fs.readdir(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        await scanDirectory(filePath);
      } else {
        if (compatibleFormats.includes(path.extname(file))) {
          const relativePath = path.relative(inputFolder, filePath);
          const outputPath = path.join(inputFolder, "output", relativePath);
          const outputDir = path.dirname(outputPath);

          try {
            await fs.mkdir(outputDir, { recursive: true });

            const outputFileName =
              path.basename(outputPath, path.extname(outputPath)) +
              `.${userFormat}`;
            const finalOutputPath = path.join(outputDir, outputFileName);

            filePaths.push({
              input: path.normalize(filePath),
              output: path.normalize(finalOutputPath),
            });
          } catch (err) {
            console.error(`Error creating directory: ${outputDir}`);
            console.error(err);
          }
        }
      }
    }
  };

  await scanDirectory(inputFolder);

  return { filePaths, settings };
}

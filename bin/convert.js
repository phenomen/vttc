import sharp from "sharp";
import * as fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { spinner } from "@clack/prompts";
import ffmpegPath from "ffmpeg-static";
import ffmpegFluent from "fluent-ffmpeg";

export async function convert(userFolder, userFormat, userQuality) {
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

  const ffmpeg = ffmpegFluent;
  ffmpeg.setFfmpegPath(ffmpegPath);

  let action;
  let compatibleFormats = [];
  let extra = [];
  let quality;

  const s = spinner();

  // SETTINGS

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
    extra = ["-c:v", "libvpx", "-c:a", "libopus", "-row-mt", "1", "-f", "webm"];
  } else if (userFormat === "mp4") {
    extra = ["-c:a", "libopus"];
  } else if (userFormat === "ogg") {
    extra = ["-vn", "-c:a", "libopus"];
  } else if (userFormat === "mp3") {
    extra = ["-vn"];
  }

  // FILES

  const inputDir = path.normalize(userFolder);
  const outputDir = path.join(userFolder, "output");

  const files = await fsp.readdir(inputDir);

  const compatibleFiles = files.filter((file) =>
    compatibleFormats.includes(path.extname(file).toLowerCase())
  );

  if (compatibleFiles.length === 0) {
    console.error("No compatible files found");
    process.exit(0);
  }

  async function createOutputDir() {
    try {
      await fsp.mkdir(outputDir);
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

  // FUNCTIONS

  async function transcodeFile(inputFile, outputFile, userFormat) {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(outputFile);
      ffmpeg(inputFile)
        .addOutputOptions([
          "-movflags +frag_keyframe+separate_moof+omit_tfhd_offset+empty_moov",
          ...quality,
          ...extra,
        ])
        .format(userFormat)
        .on("end", () => {
          writeStream.end();
          resolve();
        })
        .on("error", (err, stdout, stderr) => {
          console.log("An error occurred: " + err.message);
          console.log("ffmpeg output:\n" + stdout);
          console.log("ffmpeg stderr:\n" + stderr);
          writeStream.end();
          reject(err);
        })
        .pipe(writeStream);
    });
  }

  s.start(`Converting ${compatibleFiles.length} file(s) into ${userFormat}`);

  if (action === "video" || action === "audio") {
    const transcodePromises = [];

    for (const file of compatibleFiles) {
      const inputFile = path.join(inputDir, file);
      const outputFile = path.join(
        outputDir,
        `${file.replace(/\.[^/.]+$/, "")}.${userFormat}`
      );

      transcodePromises.push(transcodeFile(inputFile, outputFile, userFormat));
    }

    try {
      await Promise.all(transcodePromises);
    } catch (error) {
      console.log(error);
    }
  }

  if (action === "image") {
    for (const file of compatibleFiles) {
      const inputFile = path.join(inputDir, file);
      const outputFile = path.join(
        outputDir,
        `${file.replace(/\.[^/.]+$/, "")}.${userFormat}`
      );

      let sharpObject = sharp(inputFile);

      if (userFormat === "jpeg") {
        sharpObject = sharpObject.jpeg({ quality: quality });
      } else if (userFormat === "webp") {
        sharpObject = sharpObject.webp({ quality: quality });
      }

      try {
        const metadata = await sharpObject.metadata();
        const { width, height } = metadata;

        if (width > 16383 || height > 16383) {
          sharpObject = sharpObject.resize(16383);
          console.log("Image is > 16393px and was resized for compatibility.");
        }

        await sharpObject.toFile(outputFile);
      } catch (error) {
        console.error("Error processing image:", error);
      }
    }
  }

  s.stop(`Converted ${compatibleFiles.length} file(s)`);
}

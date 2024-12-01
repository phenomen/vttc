import sharp from "sharp";
import fs from "node:fs";
import { spinner } from "@clack/prompts";
import ffmpegPath from "ffmpeg-static";
import ffmpegFluent from "fluent-ffmpeg";

export async function convert(fileData) {
  if (!fileData?.filePaths?.length) {
    console.error("No valid files to convert");
    process.exit(1);
  }

  const { filePaths, settings } = fileData;
  const { format, action, quality, extra } = settings;

  const s = spinner();

  s.start(`Converting ${filePaths.length} file(s) into ${format}`);

  if (action === "video" || action === "audio") {
    const ffmpeg = ffmpegFluent;
    ffmpeg.setFfmpegPath(ffmpegPath);

    const transcodePromises = [];

    for (const file of filePaths) {
      const inputFile = file.input;
      const outputFile = file.output;

      transcodePromises.push(
        transcodeFile(inputFile, outputFile, format, quality, extra)
      );
    }

    async function transcodeFile(
      inputFile,
      outputFile,
      format,
      quality,
      extra
    ) {
      return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(outputFile);
        ffmpeg(inputFile)
          .addOutputOptions([
            "-movflags +frag_keyframe+separate_moof+omit_tfhd_offset+empty_moov",
            ...quality,
            ...extra,
          ])
          .format(format)
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

    try {
      await Promise.all(transcodePromises);
    } catch (error) {
      console.log(error);
      s.stop(`Failed to convert files: ${error.message}`);
      process.exit(1);
    }
  }

  if (action === "image") {
    const imagePromises = filePaths.map(async (file) => {
      const { input: inputFile, output: outputFile } = file;
      let sharpObject = sharp(inputFile);

      if (format === "jpeg") {
        sharpObject = sharpObject.jpeg({ quality });
      } else if (format === "webp") {
        sharpObject = sharpObject.webp({ quality });
      }

      try {
        const metadata = await sharpObject.metadata();
        const { width, height } = metadata;

        if (width > 16384 || height > 16384) {
          sharpObject = sharpObject.resize(16384);
          console.log("Image is > 16384px and was resized for compatibility.");
        }

        await sharpObject.toFile(outputFile);
      } catch (error) {
        console.error("Error processing image:", error);
        s.stop(`Failed to convert image ${inputFile}: ${error.message}`);
        process.exit(1);
      }
    });

    try {
      await Promise.all(imagePromises);
    } catch (error) {
      console.error("Error processing images:", error);
      s.stop(`Failed to convert images: ${error.message}`);
      process.exit(1);
    }
  }

  s.stop(`Converted ${filePaths.length} file(s)`);
}

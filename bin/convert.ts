import { spinner, log } from "@clack/prompts";
import path from "path";
import {
  Input,
  Output,
  Conversion,
  ALL_FORMATS,
  FilePathSource,
  FilePathTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  OggOutputFormat,
  AdtsOutputFormat,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_LOW,
  type ConversionOptions,
  type Quality,
} from "mediabunny";
import type {
  AudioOutputFormat,
  FileData,
  FilePathData,
  ImageOutputFormat,
  VideoOutputFormat,
} from "./files.js";

type MediaOutputFormat = VideoOutputFormat | AudioOutputFormat;
type NormalizedImageFormat = "webp" | "png" | "avif" | "jpeg";

type ConversionResult =
  | {
      success: true;
      file: string;
    }
  | {
      success: false;
      file: string;
      error: string;
    };

// Helper function to convert technical errors into user-friendly messages
function getReadableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("unsupported or unrecognizable format")) {
    return "File format not supported or file is corrupted";
  }
  if (message.includes("no encodable target codec")) {
    return "Cannot encode to target format (codec not supported in this environment)";
  }
  if (message.includes("undecodable_source_codec")) {
    return "Cannot decode source codec (WebCodecs API may not be available in this Bun runtime)";
  }
  if (
    message.includes("VideoDecoder is not defined") ||
    message.includes("AudioDecoder is not defined")
  ) {
    return "WebCodecs API not available in this Bun runtime";
  }
  if (message.includes("Unsupported image format")) {
    return message;
  }
  if (message.includes("ENOENT")) {
    return "File not found";
  }
  if (message.includes("EACCES")) {
    return "Permission denied";
  }
  if (message.includes("Conversion validation failed")) {
    return message.replace("Conversion validation failed: ", "");
  }

  // Return simplified error message
  return message;
}

export async function convert(fileData: FileData): Promise<void> {
  if (!fileData?.filePaths?.length) {
    console.error("No valid files to convert");
    process.exit(1);
  }

  const { filePaths, settings } = fileData;
  const { qualityLevel } = settings;

  // Check if WebCodecs API is available for video/audio conversion
  if (settings.action === "video" || settings.action === "audio") {
    if (
      typeof globalThis.VideoDecoder === "undefined" ||
      typeof globalThis.AudioDecoder === "undefined"
    ) {
      console.log("");
      log.error("WebCodecs API is not available in this runtime");
      log.warning("Mediabunny requires WebCodecs for video/audio conversion");
      console.log("");
      log.info("Solutions:");
      log.step("• Upgrade to the latest Bun release");
      log.step("• Verify your source codecs are supported by WebCodecs");
      console.log("");
      process.exit(1);
    }
  }

  // Map quality level to Mediabunny quality constants
  let mediabunnyQuality: Quality;
  if (qualityLevel === "high") {
    mediabunnyQuality = QUALITY_HIGH;
  } else if (qualityLevel === "mid") {
    mediabunnyQuality = QUALITY_MEDIUM;
  } else if (qualityLevel === "low") {
    mediabunnyQuality = QUALITY_LOW;
  } else {
    mediabunnyQuality = QUALITY_MEDIUM; // Default fallback
  }

  const s = spinner();

  s.start(`Converting ${filePaths.length} file(s) into ${settings.format}`);

  if (settings.action === "video" || settings.action === "audio") {
    const { action, format } = settings;
    const transcodePromises = filePaths.map((file: FilePathData) =>
      transcodeFile(file.input, file.output, format, mediabunnyQuality, action)
    );

    async function transcodeFile(
      inputFile: string,
      outputFile: string,
      format: MediaOutputFormat,
      mediabunnyQuality: Quality,
      action: "video" | "audio"
    ): Promise<ConversionResult> {
      let input: Input<FilePathSource> | undefined;
      try {
        // Create input from file
        input = new Input({
          formats: ALL_FORMATS,
          source: new FilePathSource(inputFile),
        });

        // Determine output format
        let outputFormat;
        if (format === "webm") {
          outputFormat = new WebMOutputFormat();
        } else if (format === "mp4") {
          outputFormat = new Mp4OutputFormat({
            fastStart: "in-memory",
          });
        } else if (format === "ogg") {
          outputFormat = new OggOutputFormat();
        } else if (format === "aac") {
          outputFormat = new AdtsOutputFormat();
        } else {
          throw new Error(`Unsupported format: ${format}`);
        }

        // Create output
        const output = new Output({
          format: outputFormat,
          target: new FilePathTarget(outputFile),
        });

        // Configure conversion options
        const conversionOptions: ConversionOptions = {
          input,
          output,
        };

        // Add video options if converting video
        if (action === "video") {
          conversionOptions.video = {
            bitrate: mediabunnyQuality,
          };

          // Set codec based on format
          if (format === "webm") {
            conversionOptions.video.codec = "vp9";
            conversionOptions.video.alpha = "keep"; // Preserve transparency for WebM
          } else if (format === "mp4") {
            conversionOptions.video.codec = "avc"; // H.264 for MP4
          }

          conversionOptions.audio = {
            bitrate: mediabunnyQuality,
          };

          // Set audio codec based on format
          if (format === "webm") {
            conversionOptions.audio.codec = "opus";
          } else if (format === "mp4") {
            conversionOptions.audio.codec = "aac";
          }
        }

        // Add audio options if converting audio
        if (action === "audio") {
          conversionOptions.video = {
            discard: true, // Remove video track for audio-only formats
          };
          conversionOptions.audio = {
            bitrate: mediabunnyQuality,
          };

          // Set audio codec based on format
          if (format === "ogg") {
            conversionOptions.audio.codec = "opus";
          } else if (format === "aac") {
            conversionOptions.audio.codec = "aac";
          }
        }

        // Initialize and execute conversion
        const conversion = await Conversion.init(conversionOptions);

        if (!conversion.isValid) {
          const reasons = conversion.discardedTracks
            .map((dt) => dt.reason)
            .join(", ");
          throw new Error(`Conversion validation failed: ${reasons}`);
        }

        await conversion.execute();

        // Clean up
        input.dispose();

        return { success: true, file: inputFile };
      } catch (error) {
        // Clean up on error
        if (input) {
          try {
            input.dispose();
          } catch {}
        }

        // Return detailed error info
        return {
          success: false,
          file: inputFile,
          error: getReadableError(error),
        };
      }
    }

    // Wait for all conversions to complete
    const results = await Promise.all(transcodePromises);

    // Separate successes and failures
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Report results
    if (failed.length === 0) {
      s.stop(`✓ Successfully converted ${successful.length} file(s)`);
    } else if (successful.length === 0) {
      s.stop(`✗ All conversions failed`);
      console.log("");
      failed.forEach(({ file, error }) => {
        log.error(`${path.basename(file)}: ${error}`);
      });
      console.log("");
      process.exit(1);
    } else {
      s.stop(
        `⚠ Converted ${successful.length} file(s), ${failed.length} failed`
      );
      console.log("");
      log.warning("Failed files:");
      failed.forEach(({ file, error }) => {
        log.error(`  ${path.basename(file)}: ${error}`);
      });
      console.log("");
    }
  }

  if (settings.action === "image") {
    const { format, quality } = settings;
    const imagePromises = filePaths.map(async (file: FilePathData): Promise<ConversionResult> => {
      const { input: inputFile, output: outputFile } = file;

      try {
        await convertImageFile(inputFile, outputFile, format, quality);

        return { success: true, file: inputFile };
      } catch (error) {
        return {
          success: false,
          file: inputFile,
          error: getReadableError(error),
        };
      }
    });

    // Wait for all conversions to complete
    const results = await Promise.all(imagePromises);

    // Separate successes and failures
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Report results
    if (failed.length === 0) {
      s.stop(`✓ Successfully converted ${successful.length} file(s)`);
    } else if (successful.length === 0) {
      s.stop(`✗ All conversions failed`);
      console.log("");
      failed.forEach(({ file, error }) => {
        log.error(`${path.basename(file)}: ${error}`);
      });
      console.log("");
      process.exit(1);
    } else {
      s.stop(
        `⚠ Converted ${successful.length} file(s), ${failed.length} failed`
      );
      console.log("");
      log.warning("Failed files:");
      failed.forEach(({ file, error }) => {
        log.error(`  ${path.basename(file)}: ${error}`);
      });
      console.log("");
    }
  }
}

async function convertImageFile(
  inputFile: string,
  outputFile: string,
  format: ImageOutputFormat,
  quality: number
): Promise<void> {
  const image = Bun.file(inputFile).image();
  const { width, height } = await image.metadata();
  const outputFormat = normalizeImageFormat(format);

  let pipeline = image;
  if (width > 16384 || height > 16384) {
    pipeline = pipeline.resize(16384, 16384, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  if (outputFormat === "jpeg") {
    pipeline = pipeline.jpeg({ quality });
  } else if (outputFormat === "webp") {
    pipeline = pipeline.webp({ quality });
  } else if (outputFormat === "png") {
    pipeline = pipeline.png();
  } else if (outputFormat === "avif") {
    pipeline = pipeline.avif({ quality });
  } else {
    throw new Error(`Unsupported image format: ${format}`);
  }

  await pipeline.write(outputFile);
}

function normalizeImageFormat(format: ImageOutputFormat): NormalizedImageFormat {
  if (format === "jpg" || format === "jfif") {
    return "jpeg";
  }

  return format;
}

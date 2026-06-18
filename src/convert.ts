import { spinner, log } from "@clack/prompts";
import { registerMediabunnyServer } from "@mediabunny/server";
import path from "path";
import { mkdir } from "fs/promises";
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
  type ConversionOptions,
} from "mediabunny";
import type {
  AudioOutputFormat,
  ConversionSettings,
  FileData,
  FilePathData,
  ImageOutputFormat,
  VideoOutputFormat,
} from "./files.js";
import { mapWithConcurrency } from "./pool.js";

registerMediabunnyServer();

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

export type ConvertOutcome =
  | { ok: true }
  | { ok: false; exitCode: number; message: string };

const IMAGE_CONCURRENCY = 8;
const VIDEO_CONCURRENCY = 2;
const AUDIO_CONCURRENCY = 4;

function getReadableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("ENOENT")) {
    return "File not found";
  }
  if (message.includes("EACCES")) {
    return "Permission denied";
  }

  return message;
}

async function ensureOutputDir(outputFile: string): Promise<void> {
  await mkdir(path.dirname(outputFile), { recursive: true });
}

function disposeInput(input: Input<FilePathSource> | undefined): void {
  if (!input) {
    return;
  }

  try {
    input.dispose();
  } catch (disposeError) {
    console.error(getReadableError(disposeError));
  }
}

function reportResults(
  s: ReturnType<typeof spinner>,
  results: ConversionResult[],
  format: string
): ConvertOutcome {
  const successful = results.filter((result) => result.success);
  const failed = results.filter((result) => !result.success);

  if (failed.length === 0) {
    s.stop(`✓ Successfully converted ${successful.length} file(s) to ${format}`);
    return { ok: true };
  }

  if (successful.length === 0) {
    s.stop("✗ All conversions failed");
    console.log("");
    failed.forEach(({ file, error }) => {
      log.error(`${path.basename(file)}: ${error}`);
    });
    console.log("");
    return { ok: false, exitCode: 1, message: "All conversions failed" };
  }

  s.stop(`⚠ Converted ${successful.length} file(s), ${failed.length} failed`);
  console.log("");
  log.warning("Failed files:");
  failed.forEach(({ file, error }) => {
    log.error(`  ${path.basename(file)}: ${error}`);
  });
  console.log("");

  return { ok: true };
}

async function transcodeFile(
  inputFile: string,
  outputFile: string,
  format: MediaOutputFormat,
  settings: ConversionSettings & { action: "video" | "audio" }
): Promise<ConversionResult> {
  let input: Input<FilePathSource> | undefined;

  try {
    await ensureOutputDir(outputFile);

    input = new Input({
      formats: ALL_FORMATS,
      source: new FilePathSource(inputFile),
    });

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

    const output = new Output({
      format: outputFormat,
      target: new FilePathTarget(outputFile),
    });

    const conversionOptions: ConversionOptions = {
      input,
      output,
    };

    if (settings.action === "video") {
      conversionOptions.video = {
        bitrate: settings.quality.video,
      };

      if (format === "webm") {
        conversionOptions.video.codec = "vp9";
        conversionOptions.video.alpha = "keep";
      } else if (format === "mp4") {
        conversionOptions.video.codec = "avc";
      }

      conversionOptions.audio = {
        bitrate: settings.quality.audio,
      };

      if (format === "webm") {
        conversionOptions.audio.codec = "opus";
      } else if (format === "mp4") {
        conversionOptions.audio.codec = "aac";
      }
    }

    if (settings.action === "audio") {
      conversionOptions.video = {
        discard: true,
      };
      conversionOptions.audio = {
        bitrate: settings.quality.audio,
      };

      if (format === "ogg") {
        conversionOptions.audio.codec = "opus";
      } else if (format === "aac") {
        conversionOptions.audio.codec = "aac";
      }
    }

    const conversion = await Conversion.init(conversionOptions);

    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks
        .map((track) => track.reason)
        .join(", ");
      throw new Error(`Conversion validation failed: ${reasons}`);
    }

    await conversion.execute();
    disposeInput(input);

    return { success: true, file: inputFile };
  } catch (error) {
    disposeInput(input);

    return {
      success: false,
      file: inputFile,
      error: getReadableError(error),
    };
  }
}

async function convertImageFile(
  inputFile: string,
  outputFile: string,
  format: ImageOutputFormat,
  quality: number
): Promise<void> {
  await ensureOutputDir(outputFile);

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

function getConcurrency(settings: ConversionSettings): number {
  if (settings.action === "image") {
    return IMAGE_CONCURRENCY;
  }
  if (settings.action === "video") {
    return VIDEO_CONCURRENCY;
  }

  return AUDIO_CONCURRENCY;
}

export async function convert(fileData: FileData): Promise<ConvertOutcome> {
  if (!fileData.filePaths.length) {
    return {
      ok: false,
      exitCode: 1,
      message: "No valid files to convert",
    };
  }

  const { filePaths, settings } = fileData;
  const s = spinner();

  s.start(`Converting ${filePaths.length} file(s) into ${settings.format}`);

  const onProgress = (completed: number, total: number, file: FilePathData) => {
    s.message(`Converting ${completed}/${total}: ${path.basename(file.input)}`);
  };

  if (settings.action === "video" || settings.action === "audio") {
    const results = await mapWithConcurrency(
      filePaths,
      getConcurrency(settings),
      (file) => transcodeFile(file.input, file.output, settings.format, settings),
      onProgress
    );

    return reportResults(s, results, settings.format);
  }

  const results = await mapWithConcurrency(
    filePaths,
    getConcurrency(settings),
    async (file) => {
      try {
        await convertImageFile(
          file.input,
          file.output,
          settings.format,
          settings.quality
        );

        return { success: true, file: file.input } satisfies ConversionResult;
      } catch (error) {
        return {
          success: false,
          file: file.input,
          error: getReadableError(error),
        } satisfies ConversionResult;
      }
    },
    onProgress
  );

  return reportResults(s, results, settings.format);
}
import path from "path";
import { stat } from "fs/promises";

export type ImageOutputFormat = "webp" | "png" | "avif" | "jpg" | "jpeg" | "jfif";
export type VideoOutputFormat = "webm" | "mp4";
export type AudioOutputFormat = "ogg" | "aac";
export type OutputFormat = ImageOutputFormat | VideoOutputFormat | AudioOutputFormat;
export type QualityLevel = "high" | "mid" | "low";
export type ConversionAction = "image" | "video" | "audio";

export type FilePathData = {
  input: string;
  output: string;
};

type VideoQuality = {
  video: number;
  audio: number;
};

type AudioQuality = {
  audio: number;
};

export type ConversionSettings =
  | {
    format: ImageOutputFormat;
    action: "image";
    quality: number;
    qualityLevel: QualityLevel;
  }
  | {
    format: VideoOutputFormat;
    action: "video";
    quality: VideoQuality;
    qualityLevel: QualityLevel;
  }
  | {
    format: AudioOutputFormat;
    action: "audio";
    quality: AudioQuality;
    qualityLevel: QualityLevel;
  };

export type FileData = {
  filePaths: FilePathData[];
  settings: ConversionSettings;
  inputFolder: string;
  outputFolder: string;
};

const formatsImage = [
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".tiff",
  ".webp",
  ".jfif",
] as const;

const formatsVideo = [
  ".avi",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".webm",
  ".wmv",
] as const;

const formatsAudio = [
  ...formatsVideo,
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".ogg",
  ".wav",
] as const;

const imageOutputFormats: readonly ImageOutputFormat[] = [
  "webp",
  "png",
  "avif",
  "jpg",
  "jpeg",
  "jfif",
];

const videoOutputFormats: readonly VideoOutputFormat[] = ["webm", "mp4"];
const audioOutputFormats: readonly AudioOutputFormat[] = ["ogg", "aac"];

const OUTPUT_DIR_NAME = "output";

function isImageFormat(format: OutputFormat): format is ImageOutputFormat {
  return imageOutputFormats.includes(format as ImageOutputFormat);
}

function isVideoFormat(format: OutputFormat): format is VideoOutputFormat {
  return videoOutputFormats.includes(format as VideoOutputFormat);
}

function isAudioFormat(format: OutputFormat): format is AudioOutputFormat {
  return audioOutputFormats.includes(format as AudioOutputFormat);
}

function getImageQuality(userQuality: QualityLevel): number {
  if (userQuality === "high") {
    return 90;
  }
  if (userQuality === "low") {
    return 60;
  }

  return 80;
}

function getVideoQuality(userQuality: QualityLevel): VideoQuality {
  if (userQuality === "high") {
    return {
      video: 2_000_000,
      audio: 96_000,
    };
  }
  if (userQuality === "low") {
    return {
      video: 512_000,
      audio: 96_000,
    };
  }

  return {
    video: 1_000_000,
    audio: 96_000,
  };
}

function getAudioQuality(userQuality: QualityLevel): AudioQuality {
  if (userQuality === "high") {
    return {
      audio: 160_000,
    };
  }
  if (userQuality === "low") {
    return {
      audio: 96_000,
    };
  }

  return {
    audio: 128_000,
  };
}

export function buildSettings(
  userFormat: OutputFormat,
  userQuality: QualityLevel
): ConversionSettings {
  if (isImageFormat(userFormat)) {
    return {
      format: userFormat,
      action: "image",
      quality: getImageQuality(userQuality),
      qualityLevel: userQuality,
    };
  }

  if (isVideoFormat(userFormat)) {
    return {
      format: userFormat,
      action: "video",
      quality: getVideoQuality(userQuality),
      qualityLevel: userQuality,
    };
  }

  if (isAudioFormat(userFormat)) {
    return {
      format: userFormat,
      action: "audio",
      quality: getAudioQuality(userQuality),
      qualityLevel: userQuality,
    };
  }

  throw new Error(`Unknown output format: ${userFormat}`);
}

function getCompatibleExtensions(action: ConversionAction): readonly string[] {
  if (action === "image") {
    return formatsImage;
  }
  if (action === "video") {
    return formatsVideo;
  }

  return formatsAudio;
}

function isUnderOutputDir(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/");
  return normalized === OUTPUT_DIR_NAME || normalized.startsWith(`${OUTPUT_DIR_NAME}/`);
}

export async function resolveInputFolder(folder: string): Promise<string> {
  const resolved = path.resolve(folder);

  try {
    const folderStat = await stat(resolved);
    if (!folderStat.isDirectory()) {
      throw new Error(`Not a folder: ${resolved}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Not a folder:")) {
      throw error;
    }

    throw new Error(`Folder not found: ${resolved}`);
  }

  return resolved;
}

export function getActionLabel(action: ConversionAction): string {
  if (action === "image") {
    return "image";
  }
  if (action === "video") {
    return "video";
  }

  return "audio";
}

export function getQualityLabel(quality: QualityLevel): string {
  if (quality === "high") {
    return "high";
  }
  if (quality === "low") {
    return "low";
  }

  return "medium";
}

export function countGifInputs(filePaths: readonly FilePathData[]): number {
  return filePaths.filter((file) => path.extname(file.input).toLowerCase() === ".gif").length;
}

export async function createFileData(
  inputFolder: string,
  userFormat: OutputFormat,
  userQuality: QualityLevel
): Promise<FileData> {
  const resolvedFolder = await resolveInputFolder(inputFolder);
  const settings = buildSettings(userFormat, userQuality);
  const compatibleFormats = getCompatibleExtensions(settings.action);
  const outputFolder = path.join(resolvedFolder, OUTPUT_DIR_NAME);

  const filePaths: FilePathData[] = [];
  const glob = new Bun.Glob("**/*");

  for await (const file of glob.scan({ cwd: resolvedFolder, onlyFiles: true })) {
    if (isUnderOutputDir(file)) {
      continue;
    }

    if (!compatibleFormats.includes(path.extname(file).toLowerCase())) {
      continue;
    }

    const inputPath = path.join(resolvedFolder, file);
    const outputPath = path.join(outputFolder, file);
    const outputFileName =
      path.basename(outputPath, path.extname(outputPath)) + `.${userFormat}`;
    const finalOutputPath = path.join(path.dirname(outputPath), outputFileName);

    filePaths.push({
      input: path.normalize(inputPath),
      output: path.normalize(finalOutputPath),
    });
  }

  return {
    filePaths,
    settings,
    inputFolder: resolvedFolder,
    outputFolder,
  };
}
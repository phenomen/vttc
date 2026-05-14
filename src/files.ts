import path from "path";
import { mkdir } from "fs/promises";

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
};

let compatibleFormats: readonly string[] = [];
let settings: ConversionSettings;
let action: ConversionAction;
let quality: ConversionSettings["quality"];

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
      video: 2_000_000, // 2 Mbps
      audio: 96_000, // 96 kbps
    };
  }
  if (userQuality === "low") {
    return {
      video: 512_000, // 512 kbps
      audio: 96_000, // 96 kbps
    };
  }

  return {
    video: 1_000_000, // 1 Mbps
    audio: 96_000, // 96 kbps
  };
}

function getAudioQuality(userQuality: QualityLevel): AudioQuality {
  if (userQuality === "high") {
    return {
      audio: 160_000, // 160 kbps
    };
  }
  if (userQuality === "low") {
    return {
      audio: 96_000, // 96 kbps
    };
  }

  return {
    audio: 128_000, // 128 kbps
  };
}

function setSettings(userFormat: OutputFormat, userQuality: QualityLevel): void {
  if (isImageFormat(userFormat)) {
    action = "image";
    compatibleFormats = formatsImage;
    quality = getImageQuality(userQuality);
  } else if (isVideoFormat(userFormat)) {
    action = "video";
    compatibleFormats = formatsVideo;
    quality = getVideoQuality(userQuality);
  } else if (isAudioFormat(userFormat)) {
    action = "audio";
    compatibleFormats = formatsAudio;
    quality = getAudioQuality(userQuality);
  } else {
    console.error("Unknown output format");
    process.exit(0);
  }

  settings = { format: userFormat, action, quality, qualityLevel: userQuality } as ConversionSettings;
}

export async function createFileData(
  inputFolder: string,
  userFormat: OutputFormat,
  userQuality: QualityLevel
): Promise<FileData> {
  setSettings(userFormat, userQuality);

  const filePaths: FilePathData[] = [];
  const glob = new Bun.Glob("**/*");

  for await (const file of glob.scan({ cwd: inputFolder, onlyFiles: true })) {
    const filePath = path.join(inputFolder, file);

    if (compatibleFormats.includes(path.extname(file).toLowerCase())) {
      const outputPath = path.join(inputFolder, "output", file);
      const outputDir = path.dirname(outputPath);

      try {
        await mkdir(outputDir, { recursive: true });

        const outputFileName =
          path.basename(outputPath, path.extname(outputPath)) + `.${userFormat}`;
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

  return { filePaths, settings };
}

import { createFFmpeg, fetchFile } from "@ffmpeg.wasm/main";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { spinner } from "@clack/prompts";

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

	let action;
	let compatibleFormats = [];
	let extra = [];
	let quality;

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
			quality = ["-b:v", "2M", "-b:a", "128k"];
		} else if (userQuality === "mid") {
			quality = ["-b:v", "1M", "-b:a", "128k"];
		} else if (userQuality === "low") {
			quality = ["-b:v", "512k", "-b:a", "64k"];
		}
	} else if (["mp3", "ogg"].includes(userFormat)) {
		action = "audio";
		compatibleFormats = formatsAudio;

		if (userQuality === "high") {
			quality = ["-b:a", "192k"];
		} else if (userQuality === "mid") {
			quality = ["-b:a", "128k"];
		} else if (userQuality === "low") {
			quality = ["-b:a", "64k"];
		}
	} else {
		console.error("Unknown output format");
		process.exit(0);
	}

	if (userFormat === "webm") {
		extra = [
			"-c:v",
			"libvpx",
			"-c:a",
			"libvorbis",
			"-row-mt",
			"1",
			"-f",
			"webm",
		];
	} else if (userFormat === "mp4") {
		extra = ["-c:a", "libvorbis"];
	} else if (userFormat === "ogg") {
		extra = ["-vn", "-c:a", "libvorbis"];
	} else if (userFormat === "mp3") {
		extra = ["-vn"];
	}

	// FILES

	const inputDir = path.normalize(userFolder);
	const outputDir = path.join(userFolder, "output");

	const files = await fs.readdir(inputDir);

	const compatibleFiles = files.filter((file) =>
		compatibleFormats.includes(path.extname(file).toLowerCase()),
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

	const s = spinner();

	s.start(`Converting ${compatibleFiles.length} file(s) into ${userFormat}`);

	if (action === "video" || action === "audio") {
		// FFMPEG

		const ffmpeg = createFFmpeg({ log: false });

		await ffmpeg.load();

		for (let i = 0; i < compatibleFiles.length; i++) {
			const inputFile = path.join(inputDir, compatibleFiles[i]);
			const outputFile = path.join(
				outputDir,
				`${compatibleFiles[i].replace(/\.[^/.]+$/, "")}.${userFormat}`,
			);

			ffmpeg.FS("writeFile", compatibleFiles[i], await fetchFile(inputFile));

			await ffmpeg.run(
				"-i",
				compatibleFiles[i],
				...quality,
				...extra,
				outputFile,
			);

			await fs.writeFile(outputFile, ffmpeg.FS("readFile", outputFile));

			ffmpeg.FS("unlink", outputFile);
		}
	}

	if (action === "image") {
		for (let i = 0; i < compatibleFiles.length; i++) {
			const inputFile = path.join(inputDir, compatibleFiles[i]);
			const outputFile = path.join(
				outputDir,
				`${compatibleFiles[i].replace(/\.[^/.]+$/, "")}.${userFormat}`,
			);

			let sharpObject = sharp(inputFile);

			if (userFormat === "jpeg") {
				sharpObject = sharpObject.jpeg({ quality: quality });
			} else if (userFormat === "webp") {
				sharpObject = sharpObject.webp({ quality: quality });
			}

			const metadata = await sharpObject.metadata();

			const { width, height } = metadata;

			if (width > 16383 || height > 16383) {
				sharpObject = sharpObject.resize(16383);
			}

			await sharpObject.toFile(outputFile);
		}
	}
	s.stop(`Converted ${compatibleFiles.length} file(s)`);
}

#! /usr/bin/env node
import { intro, select, isCancel, cancel, text, outro } from "@clack/prompts";
import { convert } from "./convert.js";

async function main() {
	console.log();
	intro(" [ VTTC ] ");

	const folder = await text({
		message: "Select an input folder",
		placeholder: "./",
		defaultValue: "./",
		initialValue: "./",
	});

	if (isCancel(folder)) {
		cancel("Operation cancelled");
		return process.exit(0);
	}

	const format = await select({
		message: "Select an output format",
		options: [
			{ value: "webp", label: "WEBP", hint: "Recommended for images" },
			{ value: "png", label: "PNG" },
			{ value: "jpg", label: "JPG" },
			{ value: "webm", label: "WEBM", hint: "Recommended for video" },
			{ value: "mp4", label: "MP4" },
			{ value: "ogg", label: "OGG", hint: "Recommended for audio" },
			{ value: "mp3", label: "MP3" },
		],
	});

	if (isCancel(format)) {
		cancel("Operation cancelled");
		return process.exit(0);
	}

	const quality = await select({
		message: "Select a quality",
		options: [
			{ value: "high", label: "HIGH" },
			{ value: "mid", label: "MEDIUM", hint: "Recommended" },
			{ value: "low", label: "LOW" },
		],
		initialValue: "mid",
	});

	if (isCancel(quality)) {
		cancel("Operation cancelled");
		return process.exit(0);
	}

	await convert(folder, format, quality);

	outro("Your converted files are in the 'output' folder.");

	process.exit(0);
}
main().catch(console.error);

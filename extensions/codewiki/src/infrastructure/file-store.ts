import type { FileStore } from "../application/ports.ts";
import {
	appendJsonl,
	isDirectory,
	maybeReadJson,
	pathExists,
	readJson,
	readText,
	writeJson,
	writeText,
} from "./filesystem.ts";

export interface CodewikiFileStore extends FileStore {
	readText(path: string): Promise<string>;
	writeText(path: string, content: string): Promise<void>;
	pathExists(path: string): Promise<boolean>;
	isDirectory(path: string): Promise<boolean>;
}

export function nodeFileStore(): CodewikiFileStore {
	return {
		readText,
		writeText,
		readJson,
		maybeReadJson,
		writeJson,
		appendJsonl,
		pathExists,
		isDirectory,
	};
}

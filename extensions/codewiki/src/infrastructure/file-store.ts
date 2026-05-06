import type { CodewikiFileStorePort } from "../core/ports";
import {
	isDirectory,
	maybeReadJson,
	pathExists,
	readJson,
	readText,
	writeText,
} from "./filesystem";

export const nodeFileStore: CodewikiFileStorePort = {
	readText,
	writeText,
	readJson,
	maybeReadJson,
	pathExists,
	isDirectory,
};

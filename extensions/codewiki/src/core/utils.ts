/**
 * core/utils.ts — compatibility shim
 *
 * Re-exports from the new canonical locations:
 *   - Pure logic → domain/shared/utils.ts
 *   - I/O helpers → infrastructure/filesystem.ts
 */

export * from "../domain/shared/utils";
export {
	readJson,
	maybeReadJson,
	maybeReadJsonSync,
	pathExists,
} from "../infrastructure/filesystem";

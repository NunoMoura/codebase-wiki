import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerPiAdapter } from "./src/adapters/pi/index.ts";

export default function codewikiExtension(pi: ExtensionAPI) {
	registerPiAdapter(pi);
}

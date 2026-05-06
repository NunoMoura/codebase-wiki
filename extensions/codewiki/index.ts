import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerPiAdapter } from "./src/adapters/pi/index";

export default function codewikiExtension(pi: ExtensionAPI) {
	registerPiAdapter(pi);
}

import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

export function padToWidth(text: string, width: number): string {
	const safeWidth = Math.max(0, width);
	const truncated = truncateToWidth(text, safeWidth);
	const padding = Math.max(0, safeWidth - visibleWidth(truncated));
	return `${truncated}${" ".repeat(padding)}`;
}

export function truncatePlain(text: string, width: number): string {
	return truncateToWidth(text, Math.max(0, width));
}

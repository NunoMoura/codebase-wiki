export interface CodewikiFileStorePort {
	readText(path: string): Promise<string>;
	writeText(path: string, content: string): Promise<void>;
	readJson<T>(path: string): Promise<T>;
	maybeReadJson<T>(path: string): Promise<T | null>;
	pathExists(path: string): Promise<boolean>;
	isDirectory(path: string): Promise<boolean>;
}

export interface CodewikiUiPort {
	setStatus(key: string, value: string | undefined): void;
	input?(prompt: string, initial?: string): Promise<string>;
}

export interface CodewikiSessionManagerPort {
	getSessionId?: () => string;
	getBranch?: () => unknown[];
}

export interface CodewikiContextPort {
	cwd: string;
	workspaceRoot?: string;
	ui: CodewikiUiPort;
	sessionManager?: CodewikiSessionManagerPort;
}

export interface CodewikiRuntimePort {
	setSessionName(name: string): void;
	appendEntry(type: string, data: unknown): void;
}

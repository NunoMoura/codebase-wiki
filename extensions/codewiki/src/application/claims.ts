import { dirname, resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type {
	ChangeClaimConflict,
	ChangeClaimMode,
	ChangeClaimRecord,
	ChangeClaimRole,
	ChangeClaimScope,
	WorktreeIsolationMetadata,
	ChangeClaimState,
	ChangeClaimsFile,
	CodewikiClaimToolInput,
	WikiProject,
} from "../domain/shared/types.ts";
import { nowIso, unique } from "../domain/shared/utils.ts";
import { withLockedPaths } from "../../mutation-queue.ts";

const DEFAULT_TTL_MINUTES = 120;
const MAX_TTL_MINUTES = 24 * 60;
const EMPTY_CLAIMS_FILE: ChangeClaimsFile = {
	version: 1,
	updated_at: "",
	next_sequence: 1,
	claims: [],
};

export function claimsFilePath(project: WikiProject): string {
	return resolve(project.root, `${project.metaRoot}/runtime/claims.json`);
}

function cloneEmptyClaimsFile(): ChangeClaimsFile {
	return { ...EMPTY_CLAIMS_FILE, claims: [] };
}

export async function readChangeClaimsFile(project: WikiProject): Promise<ChangeClaimsFile> {
	try {
		const raw = await readFile(claimsFilePath(project), "utf8");
		return normalizeClaimsFile(JSON.parse(raw));
	} catch (error: any) {
		if (error?.code === "ENOENT") return cloneEmptyClaimsFile();
		throw error;
	}
}

export function normalizeClaimsFile(value: any): ChangeClaimsFile {
	const file = cloneEmptyClaimsFile();
	file.version = Number.isFinite(Number(value?.version)) ? Number(value.version) : 1;
	file.updated_at = typeof value?.updated_at === "string" ? value.updated_at : "";
	file.next_sequence = Number.isFinite(Number(value?.next_sequence))
		? Math.max(1, Math.floor(Number(value.next_sequence)))
		: 1;
	file.claims = Array.isArray(value?.claims)
		? value.claims.map(normalizeClaimRecord).filter(Boolean) as ChangeClaimRecord[]
		: [];
	const maxSequence = file.claims
		.map((claim) => parseClaimSequence(claim.id))
		.filter((seq): seq is number => seq !== null)
		.reduce((max, seq) => Math.max(max, seq), 0);
	file.next_sequence = Math.max(file.next_sequence, maxSequence + 1);
	return file;
}

function normalizeClaimRecord(value: any): ChangeClaimRecord | null {
	const id = String(value?.id || "").trim();
	const sessionId = String(value?.session_id || "").trim();
	if (!id || !sessionId) return null;
	const mode = normalizeClaimMode(value?.mode);
	const status = ["active", "released", "expired"].includes(String(value?.status || ""))
		? String(value.status) as ChangeClaimRecord["status"]
		: "active";
	return {
		id,
		session_id: sessionId,
		agent_name: String(value?.agent_name || "Agent").trim() || "Agent",
		status,
		mode,
		role: normalizeClaimRole(value?.role),
		summary: String(value?.summary || "").trim(),
		task_id: optionalTrim(value?.task_id),
		build_ref: optionalTrim(value?.build_ref),
		worktree: normalizeWorktreeIsolation(value?.worktree),
		scopes: normalizeScopes(value?.scopes),
		created_at: String(value?.created_at || value?.updated_at || nowIso()).trim(),
		updated_at: String(value?.updated_at || value?.created_at || nowIso()).trim(),
		expires_at: String(value?.expires_at || nowIso()).trim(),
		released_at: optionalTrim(value?.released_at),
	};
}

function optionalTrim(value: unknown): string | undefined {
	const text = String(value ?? "").trim();
	return text || undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

function normalizeClaimRole(value: unknown): ChangeClaimRole | undefined {
	const role = String(value ?? "").trim() as ChangeClaimRole;
	return ["builder", "validator", "publisher", "observer"].includes(role) ? role : undefined;
}

function normalizeSha(value: unknown): string | undefined {
	const text = optionalTrim(value);
	if (!text) return undefined;
	return /^[0-9a-f]{7,64}$/i.test(text) ? text : undefined;
}

export function normalizeWorktreeIsolation(value: any): WorktreeIsolationMetadata | undefined {
	if (!value || typeof value !== "object") return undefined;
	const out: WorktreeIsolationMetadata = {};
	const worktreePath = optionalTrim(value.worktree_path || value.worktreePath);
	const branch = optionalTrim(value.branch);
	const notes = optionalTrim(value.notes);
	const sessionId = optionalTrim(value.session_id || value.sessionId);
	const claimId = optionalTrim(value.claim_id || value.claimId);
	const builderSessionId = optionalTrim(value.builder_session_id || value.builderSessionId);
	const builderClaimId = optionalTrim(value.builder_claim_id || value.builderClaimId);
	const relatedClaimIds = Array.isArray(value.related_claim_ids || value.relatedClaimIds)
		? (value.related_claim_ids || value.relatedClaimIds).map(optionalTrim).filter(Boolean) as string[]
		: [];
	if (worktreePath) out.worktree_path = worktreePath;
	if (branch) out.branch = branch;
	for (const key of ["base_sha", "head_sha", "validated_sha", "published_sha"] as const) {
		const camelKey = key.replace(/_([a-z])/g, (_match: string, c: string) => c.toUpperCase());
		const sha = normalizeSha(value[key] || value[camelKey]);
		if (sha) out[key] = sha;
	}
	const clean = optionalBoolean(value.clean);
	const freshContext = optionalBoolean(value.fresh_context ?? value.freshContext);
	if (clean !== undefined) out.clean = clean;
	if (freshContext !== undefined) out.fresh_context = freshContext;
	if (sessionId) out.session_id = sessionId;
	if (claimId) out.claim_id = claimId;
	if (builderSessionId) out.builder_session_id = builderSessionId;
	if (builderClaimId) out.builder_claim_id = builderClaimId;
	if (relatedClaimIds.length) out.related_claim_ids = Array.from(new Set(relatedClaimIds));
	if (notes) out.notes = notes;
	return Object.keys(out).length ? out : undefined;
}

export function normalizeScopes(scopes: unknown): ChangeClaimScope[] {
	if (!Array.isArray(scopes)) return [];
	const serialized = new Set<string>();
	const result: ChangeClaimScope[] = [];
	for (const raw of scopes) {
		const scope = normalizeScope(raw);
		if (!scope) continue;
		const key = scopeKey(scope);
		if (serialized.has(key)) continue;
		serialized.add(key);
		result.push(scope);
	}
	return result;
}

export function normalizeScope(raw: any): ChangeClaimScope | null {
	const layer = String(raw?.layer || "").trim() as ChangeClaimScope["layer"];
	if (!["knowledge", "roadmap", "code", "build", "validation", "graph", "source"].includes(layer)) return null;
	const scope: ChangeClaimScope = { layer };
	const path = normalizePathLike(raw?.path);
	const taskId = optionalTrim(raw?.task_id || raw?.taskId);
	const ref = optionalTrim(raw?.ref);
	const description = optionalTrim(raw?.description);
	if (path) scope.path = path;
	if (taskId) scope.task_id = taskId;
	if (ref) scope.ref = ref;
	if (description) scope.description = description;
	if (!scope.path && !scope.task_id && !scope.ref && !scope.description) return null;
	return scope;
}

function normalizePathLike(value: unknown): string {
	return String(value ?? "")
		.trim()
		.replace(/^\.\//, "")
		.replace(/\\/g, "/")
		.replace(/\/+/g, "/");
}

function normalizeClaimMode(value: unknown): ChangeClaimMode {
	return String(value || "write").trim() === "read" ? "read" : "write";
}

function parseClaimSequence(id: string): number | null {
	const match = /^CLAIM-(\d+)$/.exec(String(id || "").trim());
	return match ? Number(match[1]) : null;
}

function formatClaimId(sequence: number): string {
	return `CLAIM-${String(sequence).padStart(3, "0")}`;
}

export function isClaimActive(claim: ChangeClaimRecord, now = new Date()): boolean {
	if (claim.status !== "active") return false;
	const expires = Date.parse(claim.expires_at);
	return Number.isFinite(expires) && expires > now.getTime();
}

export function activeChangeClaims(file: ChangeClaimsFile, now = new Date()): ChangeClaimRecord[] {
	return file.claims.filter((claim) => isClaimActive(claim, now));
}

export function buildChangeClaimState(file: ChangeClaimsFile, now = new Date()): ChangeClaimState {
	const claims = activeChangeClaims(file, now).sort((a, b) => {
		const t = String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
		return t !== 0 ? t : a.id.localeCompare(b.id);
	});
	const conflicts = detectClaimConflicts(claims);
	return {
		generated_at: nowIso(),
		active_claim_count: claims.length,
		warning_count: conflicts.filter((conflict) => conflict.kind === "warning").length,
		conflict_count: conflicts.filter((conflict) => conflict.kind === "conflict").length,
		claims,
		conflicts,
	};
}

export function detectClaimConflicts(claims: ChangeClaimRecord[]): ChangeClaimConflict[] {
	const conflicts: ChangeClaimConflict[] = [];
	for (let i = 0; i < claims.length; i += 1) {
		for (let j = i + 1; j < claims.length; j += 1) {
			const left = claims[i];
			const right = claims[j];
			if (!left || !right || left.session_id === right.session_id) continue;
			for (const leftScope of left.scopes) {
				for (const rightScope of right.scopes) {
					if (!scopesOverlap(leftScope, rightScope)) continue;
					const kind = left.mode === "write" && right.mode === "write" ? "conflict" : "warning";
					conflicts.push({
						kind,
						claim_ids: [left.id, right.id].sort(),
						sessions: [left.session_id, right.session_id].sort(),
						scope: commonScope(leftScope, rightScope),
						reason: kind === "conflict"
							? "Overlapping write claims from different sessions."
							: "Read/write overlap from different sessions.",
					});
				}
			}
		}
	}
	return dedupeConflicts(conflicts);
}

function dedupeConflicts(conflicts: ChangeClaimConflict[]): ChangeClaimConflict[] {
	const seen = new Set<string>();
	const result: ChangeClaimConflict[] = [];
	for (const conflict of conflicts) {
		const key = `${conflict.kind}:${conflict.claim_ids.join("+")}:${scopeKey(conflict.scope)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(conflict);
	}
	return result.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === "conflict" ? -1 : 1;
		return a.claim_ids.join(",").localeCompare(b.claim_ids.join(","));
	});
}

function commonScope(left: ChangeClaimScope, right: ChangeClaimScope): ChangeClaimScope {
	return left.path || left.task_id || left.ref ? left : right;
}

function scopeKey(scope: ChangeClaimScope): string {
	return [scope.layer, scope.task_id || "", scope.path || "", scope.ref || "", scope.description || ""].join(":");
}

export function scopesOverlap(left: ChangeClaimScope, right: ChangeClaimScope): boolean {
	if (left.layer !== right.layer) return false;
	if (left.task_id || right.task_id) return Boolean(left.task_id && right.task_id && left.task_id === right.task_id);
	if (left.ref || right.ref) return Boolean(left.ref && right.ref && left.ref === right.ref);
	if (left.path || right.path) return pathsOverlap(left.path || "", right.path || "");
	return Boolean(left.description && right.description && left.description === right.description);
}

function pathBase(path: string): { base: string; glob: boolean } {
	const normalized = normalizePathLike(path);
	if (normalized.endsWith("/**")) return { base: normalized.slice(0, -3).replace(/\/$/, ""), glob: true };
	if (normalized.endsWith("/*")) return { base: normalized.slice(0, -2).replace(/\/$/, ""), glob: true };
	return { base: normalized.replace(/\/$/, ""), glob: false };
}

function pathsOverlap(leftPath: string, rightPath: string): boolean {
	const left = pathBase(leftPath);
	const right = pathBase(rightPath);
	if (!left.base || !right.base) return false;
	if (left.base === right.base) return true;
	if (left.glob && (right.base === left.base || right.base.startsWith(`${left.base}/`))) return true;
	if (right.glob && (left.base === right.base || left.base.startsWith(`${right.base}/`))) return true;
	return false;
}

export async function mutateChangeClaims(
	project: WikiProject,
	input: CodewikiClaimToolInput,
	session: { sessionId: string; agentName: string },
): Promise<{ changed: boolean; claim?: ChangeClaimRecord; claims: ChangeClaimRecord[]; conflicts: ChangeClaimConflict[]; summary: string }> {
	const filePath = claimsFilePath(project);
	let output: { changed: boolean; claim?: ChangeClaimRecord; claims: ChangeClaimRecord[]; conflicts: ChangeClaimConflict[]; summary: string } | null = null;
	await withLockedPaths([filePath], async () => {
		const file = await readChangeClaimsFile(project);
		const now = new Date();
		markExpired(file, now);
		const action = input.action;
		if (action === "list") {
			const state = buildChangeClaimState(file, now);
			output = { changed: false, claims: state.claims, conflicts: state.conflicts, summary: summarizeClaimAction(action, state.claims, state.conflicts) };
			return;
		}
		if (action === "release") {
			const released = releaseClaims(file, input.claimId, session.sessionId);
			if (released > 0) await writeClaimsFile(filePath, file);
			const state = buildChangeClaimState(file, now);
			output = { changed: released > 0, claims: state.claims, conflicts: state.conflicts, summary: `codewiki claim: released ${released} claim(s)` };
			return;
		}
		if (action === "heartbeat") {
			const extended = heartbeatClaims(file, input.claimId, session.sessionId, ttlMinutes(input.ttl_minutes));
			if (extended > 0) await writeClaimsFile(filePath, file);
			const state = buildChangeClaimState(file, now);
			output = { changed: extended > 0, claims: state.claims, conflicts: state.conflicts, summary: `codewiki claim: extended ${extended} claim(s)` };
			return;
		}
		const scopes = normalizeScopes(input.scopes);
		if (scopes.length === 0) throw new Error("codewiki_claim claim requires at least one valid scope.");
		const summary = String(input.summary || "").trim();
		if (!summary) throw new Error("codewiki_claim claim requires summary.");
		const candidate: ChangeClaimRecord = {
			id: formatClaimId(file.next_sequence),
			session_id: session.sessionId,
			agent_name: session.agentName,
			status: "active",
			mode: normalizeClaimMode(input.mode),
			role: normalizeClaimRole(input.role),
			summary,
			task_id: optionalTrim(input.taskId),
			build_ref: optionalTrim(input.buildRef),
			worktree: normalizeWorktreeIsolation(input.worktree),
			scopes,
			created_at: nowIso(),
			updated_at: nowIso(),
			expires_at: new Date(Date.now() + ttlMinutes(input.ttl_minutes) * 60_000).toISOString(),
		};
		const nextClaims = [...activeChangeClaims(file, now), candidate];
		const conflicts = detectClaimConflicts(nextClaims).filter((conflict) => conflict.claim_ids.includes(candidate.id));
		if (conflicts.some((conflict) => conflict.kind === "conflict") && !input.force) {
			throw new Error(`codewiki_claim conflict: ${conflicts.map((conflict) => conflict.reason).join("; ")}`);
		}
		file.claims.push(candidate);
		file.next_sequence += 1;
		await writeClaimsFile(filePath, file);
		const state = buildChangeClaimState(file, now);
		output = { changed: true, claim: candidate, claims: state.claims, conflicts: state.conflicts, summary: summarizeClaimAction(action, state.claims, state.conflicts, candidate) };
	});
	return output!;
}

function ttlMinutes(value: unknown): number {
	const minutes = Number(value ?? DEFAULT_TTL_MINUTES);
	if (!Number.isFinite(minutes)) return DEFAULT_TTL_MINUTES;
	return Math.min(MAX_TTL_MINUTES, Math.max(1, Math.floor(minutes)));
}

function markExpired(file: ChangeClaimsFile, now: Date): void {
	let changed = false;
	for (const claim of file.claims) {
		if (claim.status === "active" && !isClaimActive(claim, now)) {
			claim.status = "expired";
			claim.updated_at = nowIso();
			changed = true;
		}
	}
	if (changed) file.updated_at = nowIso();
}

function releaseClaims(file: ChangeClaimsFile, claimId: string | undefined, sessionId: string): number {
	let count = 0;
	for (const claim of file.claims) {
		if (claim.status !== "active") continue;
		if (claimId && claim.id !== claimId) continue;
		if (!claimId && claim.session_id !== sessionId) continue;
		claim.status = "released";
		claim.released_at = nowIso();
		claim.updated_at = nowIso();
		count += 1;
	}
	if (count > 0) file.updated_at = nowIso();
	return count;
}

function heartbeatClaims(file: ChangeClaimsFile, claimId: string | undefined, sessionId: string, minutes: number): number {
	let count = 0;
	const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
	for (const claim of file.claims) {
		if (claim.status !== "active") continue;
		if (claimId && claim.id !== claimId) continue;
		if (!claimId && claim.session_id !== sessionId) continue;
		claim.expires_at = expiresAt;
		claim.updated_at = nowIso();
		count += 1;
	}
	if (count > 0) file.updated_at = nowIso();
	return count;
}

async function writeClaimsFile(filePath: string, file: ChangeClaimsFile): Promise<void> {
	file.updated_at = nowIso();
	file.claims = file.claims.slice(-200);
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(file, null, 2) + "\n", "utf8");
}

function summarizeClaimAction(action: string, claims: ChangeClaimRecord[], conflicts: ChangeClaimConflict[], claim?: ChangeClaimRecord): string {
	if (action === "claim" && claim) {
		const role = claim.role ? `, role=${claim.role}` : "";
		const worktree = claim.worktree?.worktree_path ? ", worktree=recorded" : "";
		return `codewiki claim: ${claim.id} active (${claim.mode}${role}${worktree}, scopes=${claim.scopes.length}, warnings=${conflicts.filter((c) => c.kind === "warning").length}, conflicts=${conflicts.filter((c) => c.kind === "conflict").length})`;
	}
	return `codewiki claim: ${claims.length} active, ${conflicts.length} overlap(s)`;
}

export function claimScopeLabels(scopes: ChangeClaimScope[]): string[] {
	return unique(scopes.map((scope) => scope.task_id || scope.path || scope.ref || scope.description || scope.layer).filter(Boolean));
}

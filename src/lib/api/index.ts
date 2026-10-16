import { demoApi } from "./demo";
import { httpApi } from "./http";
import type { TeamSpaceApi } from "./types";

/** VITE_API_MODE=http + VITE_API_BASE_URL switches to the real Spring Boot API. Default: demo. */
export const api: TeamSpaceApi = import.meta.env["VITE_API_MODE"] === "http" ? httpApi : demoApi;
export const isDemo = api.mode === "demo";
export * from "./types";
export { ApiError, isApiError, errorMessage } from "./errors";

export const emailEnabled = import.meta.env["VITE_EMAIL_ENABLED"] === "true";

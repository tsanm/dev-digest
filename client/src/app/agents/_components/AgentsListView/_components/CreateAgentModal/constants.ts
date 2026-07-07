import type { Provider } from "@devdigest/shared";

/** Default provider/model for a new agent. OpenRouter is the configured key. */
export const DEFAULT_PROVIDER: Provider = "openrouter";
export const DEFAULT_MODEL = "openai/gpt-4o-mini";

/** Selectable providers in the create form (default first). */
export const PROVIDER_OPTIONS: readonly Provider[] = ["openrouter", "openai", "anthropic"];

/** Modal width (px). */
export const MODAL_WIDTH = 620;

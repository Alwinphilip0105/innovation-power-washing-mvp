/**
 * Stand-in for the `server-only` package under Vitest.
 *
 * In the Next build, importing `server-only` is what stops a module that holds
 * secrets from being pulled into a client bundle. Node has no such condition,
 * so tests alias it to this empty module (see vitest.config.ts).
 */
export {};

/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_BACKEND_URL?: string
	readonly VITE_RB_API?: string
	readonly VITE_WS_URL?: string
	readonly VITE_ENABLE_3D_MAP?: string
	readonly VITE_ENABLE_ANALYTICS?: string
	readonly VITE_ENABLE_DEBUG_LOGGING?: string
	readonly VITE_SENTRY_DSN?: string
	readonly VITE_ENV?: string
	readonly VITE_CDN_URL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}

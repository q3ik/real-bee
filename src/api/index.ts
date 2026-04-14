/**
 * Barrel export for the typed HTTP client layer.
 *
 * Import from this module to access all API clients:
 *   import { apiRequest, requestTTS, requestSTT } from '@/api';
 *   import { ApiError, TimeoutError } from '@/api';
 *   import type { TtsRequest, SttRequest, TtsResponse, SttResponse } from '@/api';
 */

// Core client
export { apiRequest } from "./client";
export type { ApiRequestOptions } from "./client";

// TTS client
export { requestTTS, getTtsProvider } from "./ttsClient";

// STT client
export { requestSTT, getSttProvider, isBrowserSpeechRecognitionAvailable } from "./sttClient";

// Types
export {
  ApiError,
  TimeoutError,
  type TtsProvider,
  type SttProvider,
  type TtsRequest,
  type TtsResponse,
  type SttRequest,
  type SttResponse,
  type ProviderConfig,
} from "./types";

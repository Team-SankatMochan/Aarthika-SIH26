/**
 * AARTHIKA TTS service — text-to-speech via expo-speech.
 *
 * Future scope: speech-to-text (voice → new businesses) will layer on top
 * of this module. `speak()` stays the single entry point for all spoken
 * output so the app talks consistently across screens and languages.
 */

import * as Speech from 'expo-speech';

/** Map our 9 app languages to a BCP-47 tag expo-speech understands. */
const VOICE_LANG: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  ml: 'ml-IN',
  te: 'te-IN',
  pa: 'pa-IN',
  kn: 'kn-IN',
  ur: 'ur-IN',
  bho: 'hi-IN', // Bhojpuri uses Hindi TTS engine
};

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  onDone?: () => void;
  onError?: (err: any) => void;
  onStopped?: () => void;
}

let activeSafetyTimer: any = null;

/** Speak a phrase out loud with completion callback. Safe no-op when speech is unavailable. */
export function speak(
  text: string,
  lang: string = 'en',
  rateOrOptions: number | SpeakOptions = 0.95,
  onDoneCallback?: () => void
) {
  if (!text) {
    if (typeof rateOrOptions === 'object' && rateOrOptions?.onDone) {
      rateOrOptions.onDone();
    } else if (onDoneCallback) {
      onDoneCallback();
    }
    return;
  }

  // Clear any existing fallback timer
  if (activeSafetyTimer) {
    clearTimeout(activeSafetyTimer);
    activeSafetyTimer = null;
  }

  let rate = 0.95;
  let onDone = onDoneCallback;
  let onError: ((err: any) => void) | undefined;
  let onStopped: (() => void) | undefined;

  if (typeof rateOrOptions === 'number') {
    rate = rateOrOptions;
  } else if (typeof rateOrOptions === 'object') {
    rate = rateOrOptions.rate ?? 0.95;
    onDone = rateOrOptions.onDone ?? onDoneCallback;
    onError = rateOrOptions.onError;
    onStopped = rateOrOptions.onStopped;
  }

  let finished = false;
  const finishOnce = () => {
    if (activeSafetyTimer) {
      clearTimeout(activeSafetyTimer);
      activeSafetyTimer = null;
    }
    if (!finished) {
      finished = true;
      onDone?.();
    }
  };

  // Safety fallback timer so UI never hangs if an OS TTS engine does not fire onDone
  const estimatedMs = Math.max(2200, Math.min(12000, text.length * 90));
  activeSafetyTimer = setTimeout(() => {
    finishOnce();
  }, estimatedMs);

  try {
    Speech.stop();
    Speech.speak(text, {
      language: VOICE_LANG[lang] || VOICE_LANG.en,
      rate,
      pitch: 1,
      onDone: () => {
        finishOnce();
      },
      onError: (err) => {
        console.warn('[tts] speak error event:', err);
        onError?.(err);
        finishOnce();
      },
      onStopped: () => {
        if (activeSafetyTimer) {
          clearTimeout(activeSafetyTimer);
          activeSafetyTimer = null;
        }
        onStopped?.();
      },
    });
  } catch (e) {
    console.warn('[tts] speak failed:', e);
    finishOnce();
  }
}

/** Check if speech is currently active */
export async function isSpeaking(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch (_e) {
    return false;
  }
}

/** Interrupt any in-flight speech. */
export function stopSpeaking() {
  if (activeSafetyTimer) {
    clearTimeout(activeSafetyTimer);
    activeSafetyTimer = null;
  }
  try {
    Speech.stop();
  } catch (e) {
    console.warn('[tts] stop failed:', e);
  }
}


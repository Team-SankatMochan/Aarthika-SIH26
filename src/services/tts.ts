/**
 * AARTHIKA TTS service — text-to-speech via expo-speech.
 *
 * Future scope: speech-to-text (voice → new businesses) will layer on top
 * of this module. `speak()` stays the single entry point for all spoken
 * output so the app talks consistently across screens and languages.
 */

import * as Speech from 'expo-speech';

/** Map our 8 app languages to a BCP-47 tag expo-speech understands. */
const VOICE_LANG: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ml: 'ml-IN',
  te: 'te-IN',
  pa: 'pa-IN',
  kn: 'kn-IN',
  ur: 'ur-IN',
  bho: 'hi-IN', // Bhojpuri falls back to Hindi TTS voice
};

/** Speak a phrase out loud. Safe no-op when speech is unavailable. */
export function speak(text: string, lang: string = 'en', rate: number = 0.95) {
  if (!text) return;
  try {
    Speech.speak(text, {
      language: VOICE_LANG[lang] || VOICE_LANG.en,
      rate,
      pitch: 1,
    });
  } catch (e) {
    console.warn('[tts] speak failed:', e);
  }
}

/** Interrupt any in-flight speech. */
export function stopSpeaking() {
  try {
    Speech.stop();
  } catch (e) {
    console.warn('[tts] stop failed:', e);
  }
}

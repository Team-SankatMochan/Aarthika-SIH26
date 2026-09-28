/**
 * AARTHIKA Speech-to-Text (STT) Service
 * Real Native & Web Speech Recognition Service.
 */

import { Platform } from 'react-native';

let ExpoSpeechRecognitionModule: any = null;

export function isNativeSpeechModuleAvailable(): boolean {
  return Platform.OS !== 'web' && getExpoSpeechRecognitionModule() !== null;
}

export function getExpoSpeechRecognitionModule(): any {
  if (Platform.OS === 'web') return null;
  if (ExpoSpeechRecognitionModule) return ExpoSpeechRecognitionModule;

  try {
    // The package imports requireNativeModule at module scope and throws in
    // Expo Go or an older binary. Query Expo's registry without importing it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expo = require('expo');
    ExpoSpeechRecognitionModule = expo.requireOptionalNativeModule('ExpoSpeechRecognition');
  } catch {
    // Retry after a runtime reload instead of caching an unavailable module.
    ExpoSpeechRecognitionModule = null;
  }
  return ExpoSpeechRecognitionModule;
}

export const STT_LANG_MAP: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  ml: 'ml-IN',
  te: 'te-IN',
  pa: 'pa-IN',
  kn: 'kn-IN',
  ur: 'ur-IN',
  bho: 'hi-IN',
};

export interface STTOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  defaultAnswer?: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (errorMsg: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface SpeechInputProvider {
  isSupported(): boolean;
  startListening(options: STTOptions): void;
  stopListening(): void;
  getActiveState(): boolean;
}

class WebSpeechProvider implements SpeechInputProvider {
  private recognition: any = null;
  private isListening: boolean = false;
  private lastTranscript: string = '';

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as any;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public startListening(options: STTOptions) {
    if (this.isListening) {
      this.stopListening();
    }
    this.lastTranscript = '';

    const win = window as any;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      options.onError?.('Speech recognition is not supported in this browser. Please type your input below.');
      return;
    }

    try {
      this.recognition = new SpeechRecognitionClass();
      const bcp47Lang = STT_LANG_MAP[options.lang || 'en'] || 'en-IN';
      this.recognition.lang = bcp47Lang;
      this.recognition.continuous = options.continuous ?? false;
      this.recognition.interimResults = options.interimResults ?? true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening = true;
        options.onStart?.();
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += trans;
          } else {
            interimTranscript += trans;
          }
        }

        if (finalTranscript) {
          this.lastTranscript = '';
          options.onResult(finalTranscript.trim(), true);
        } else if (interimTranscript) {
          this.lastTranscript = interimTranscript.trim();
          options.onResult(this.lastTranscript, false);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('[STT] Recognition error:', event.error);
        let message = 'Speech recognition error. Please type below.';
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          message = options.lang === 'hi'
            ? 'माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया सेटिंग्स में अनुमति दें या नीचे लिखें।'
            : 'Microphone permission denied. Please allow microphone in settings or type below.';
        } else if (event.error === 'no-speech') {
          message = options.lang === 'hi'
            ? 'कोई आवाज़ सुनाई नहीं दी। दोबारा बोलने के लिए माइक दबाएं।'
            : 'No speech detected. Tap mic to try again.';
        } else if (event.error === 'network') {
          message = options.lang === 'hi'
            ? 'नेटवर्क समस्या। कृपया नीचे लिखकर जवाब दें।'
            : 'Network error during speech recognition. Please type below.';
        }
        this.isListening = false;
        options.onError?.(message);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.lastTranscript) {
          const transcript = this.lastTranscript;
          this.lastTranscript = '';
          options.onResult(transcript, true);
        }
        options.onEnd?.();
      };

      this.recognition.start();
    } catch (e: any) {
      this.isListening = false;
      console.warn('[STT] Failed to start speech recognition:', e);
      options.onError?.(e.message || 'Failed to start microphone. Please type below.');
    }
  }

  public stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_e) {
        // ignore
      }
      this.recognition = null;
    }
    this.isListening = false;
  }

  public getActiveState(): boolean {
    return this.isListening;
  }
}

class NativeSpeechProvider implements SpeechInputProvider {
  private isListening: boolean = false;
  private currentOptions: STTOptions | null = null;
  private listeners: any[] = [];
  private lastTranscript: string = '';
  private initializedListeners: boolean = false;
  private hasDeliveredFinal: boolean = false;
  private startSequence: number = 0;
  private startIssued: boolean = false;
  private cancelRequested: boolean = false;

  private setupListeners() {
    if (!isNativeSpeechModuleAvailable()) return;
    const mod = getExpoSpeechRecognitionModule();
    if (!mod?.addListener || this.initializedListeners) return;
    this.initializedListeners = true;
    try {
      this.listeners.push(
        mod.addListener('start', () => {
          if (this.cancelRequested) {
            mod.abort?.();
            return;
          }
          this.isListening = true;
          this.currentOptions?.onStart?.();
        }),
        mod.addListener('result', (event: any) => {
          const text = event.results?.[0]?.transcript || '';
          if (text) {
            const trimmed = text.trim();
            if (event.isFinal) {
              if (!this.hasDeliveredFinal) {
                this.hasDeliveredFinal = true;
                this.lastTranscript = '';
                this.currentOptions?.onResult(trimmed, true);
              }
            } else {
              if (!this.hasDeliveredFinal) {
                this.lastTranscript = trimmed;
                this.currentOptions?.onResult(trimmed, false);
              }
            }
          }
        }),
        mod.addListener('error', (event: any) => {
          if (this.cancelRequested || event.error === 'aborted') return;
          this.isListening = false;
          console.warn('[STT] Native Recognition error:', event.error, event.message);
          let message = 'माइक की अनुमति नहीं मिली या कोई तकनीकी समस्या है। आप नीचे लिखकर भी जवाब दे सकते हैं।';
          if (event.error === 'not-allowed') {
            message = 'माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया सेटिंग्स में अनुमति दें या नीचे लिखें।';
          } else if (event.error === 'network') {
            message = 'वॉइस रिकग्निशन अभी उपलब्ध नहीं है। कृपया लिखकर जवाब दें।';
          } else if (event.error === 'no-speech' || event.error === 'speech-timeout') {
            message = 'कोई आवाज़ सुनाई नहीं दी। दोबारा बोलने के लिए माइक दबाएं।';
          } else if (event.error === 'client') {
            message = 'डिवाइस में माइक/STT की समस्या है। एम्यूलेटर या Google App की माइक सेटिंग्स जांचें।';
          }
          this.currentOptions?.onError?.(message);
        }),
        mod.addListener('end', () => {
          this.isListening = false;
          if (!this.cancelRequested && this.lastTranscript && this.currentOptions && !this.hasDeliveredFinal) {
            this.hasDeliveredFinal = true;
            const finalCandidate = this.lastTranscript;
            this.lastTranscript = '';
            this.currentOptions.onResult(finalCandidate, true);
          }
          this.currentOptions?.onEnd?.();
          this.currentOptions = null;
          this.startIssued = false;
          this.cancelRequested = false;
        })
      );
    } catch (e) {
      console.warn('[STT] Could not attach native speech listeners:', e);
    }
  }

  public isSupported(): boolean {
    if (!isNativeSpeechModuleAvailable()) return false;
    const mod = getExpoSpeechRecognitionModule();
    if (!mod) return false;
    try {
      if (typeof mod.isRecognitionAvailable === 'function') {
        return Boolean(mod.isRecognitionAvailable());
      }
    } catch {
      return false;
    }
    return true;
  }

  private isStarting = false;

  public async startListening(options: STTOptions) {
    if (this.isStarting || this.startIssued) {
      options.onError?.('The microphone is still closing. Please tap again in a moment.');
      return;
    }
    this.isStarting = true;
    const sequence = ++this.startSequence;
    this.cancelRequested = false;

    try {
      this.currentOptions = options;
      this.lastTranscript = '';
      this.hasDeliveredFinal = false;
      this.setupListeners();

      const mod = getExpoSpeechRecognitionModule();
      if (!mod) {
        options.onError?.('Voice recognition needs an app build that includes expo-speech-recognition. Expo Go cannot use this microphone feature.');
        return;
      }

      if (typeof mod.isRecognitionAvailable === 'function' && !mod.isRecognitionAvailable()) {
        let services: string[] = [];
        try {
          if (Platform.OS === 'android' && typeof mod.getSpeechRecognitionServices === 'function') {
            services = mod.getSpeechRecognitionServices();
          }
        } catch {
          // Service listing is diagnostic only; Android package visibility can
          // hide providers even when the recognizer itself works.
        }
        console.warn('[STT] Recognition unavailable; Android services:', services);
        options.onError?.(
          options.lang === 'hi'
            ? 'इस डिवाइस पर वॉइस रिकग्निशन सेवा उपलब्ध नहीं है। सिस्टम सेटिंग्स में Speech Recognition & Synthesis या Google ऐप चालू करें।'
            : 'No speech recognition service is available. Enable Speech Recognition & Synthesis or the Google app in device settings.'
        );
        return;
      }

      const perms = await mod.requestPermissionsAsync?.();
      if (sequence !== this.startSequence) return;
      if (perms && !perms.granted) {
        this.isListening = false;
        options.onError?.(
          options.lang === 'hi'
            ? 'माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया सेटिंग्स में अनुमति दें या नीचे लिखें।'
            : 'Microphone permission denied. Please allow microphone in settings or type below.'
        );
        return;
      }

      const bcp47Lang = STT_LANG_MAP[options.lang || 'hi'] || 'hi-IN';
      this.startIssued = true;
      mod.start({
        lang: bcp47Lang,
        interimResults: options.interimResults ?? true,
        continuous: options.continuous ?? false,
        requiresOnDeviceRecognition: false,
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'web_search',
        },
      });
    } catch (e: any) {
      this.startIssued = false;
      this.isListening = false;
      console.warn('[STT] Native speech recognition failed:', e);
      options.onError?.(
        options.lang === 'hi'
          ? 'वॉइस रिकग्निशन शुरू करने में समस्या आई। कृपया नीचे लिखकर जवाब दें।'
          : 'Failed to start voice recognition. Please type below.'
      );
    } finally {
      this.isStarting = false;
    }
  }

  public stopListening() {
    if (this.cancelRequested || (!this.isStarting && !this.startIssued && !this.isListening)) return;
    ++this.startSequence;
    this.cancelRequested = true;
    this.currentOptions = null;
    try {
      if (this.startIssued) {
        const mod = getExpoSpeechRecognitionModule();
        mod?.abort?.();
      }
    } catch (_e) {
      this.startIssued = false;
    }
    this.isListening = false;
  }

  public getActiveState(): boolean {
    return this.isListening || this.isStarting || this.startIssued;
  }
}

class IntelligentVoiceSimulationProvider implements SpeechInputProvider {
  private isListening: boolean = false;
  private currentOptions: STTOptions | null = null;
  private timer: any = null;
  private customResponse: string | null = null;

  public isSupported(): boolean {
    return true;
  }

  public setNextResponse(text: string) {
    this.customResponse = text;
  }

  public startListening(options: STTOptions) {
    this.stopListening();
    this.isListening = true;
    this.currentOptions = options;
    options.onStart?.();

    if (this.customResponse !== null) {
      const resp = this.customResponse;
      this.customResponse = null;
      this.timer = setTimeout(() => {
        if (!this.isListening) return;
        this.isListening = false;
        options.onResult(resp, true);
        options.onEnd?.();
      }, 300);
    } else {
      // If no mock response set, notify that simulation is not active and prompt typing
      options.onError?.('Speech recognition is not supported on this platform. Please type below.');
      this.isListening = false;
      options.onEnd?.();
    }
  }

  public stopListening() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.isListening) {
      this.isListening = false;
      this.currentOptions?.onEnd?.();
    }
  }

  public getActiveState(): boolean {
    return this.isListening;
  }
}

class SpeechToTextService {
  private activeProvider: SpeechInputProvider | null = null;
  private simulationProvider = new IntelligentVoiceSimulationProvider();

  public getProvider(): SpeechInputProvider {
    if (this.activeProvider) {
      return this.activeProvider;
    }

    if (Platform.OS === 'web') {
      const webProvider = new WebSpeechProvider();
      if (webProvider.isSupported()) {
        this.activeProvider = webProvider;
        return webProvider;
      }
    } else {
      if (getExpoSpeechRecognitionModule()) {
        const nativeProvider = new NativeSpeechProvider();
        this.activeProvider = nativeProvider;
        return nativeProvider;
      }
      const webProvider = new WebSpeechProvider();
      if (webProvider.isSupported()) {
        this.activeProvider = webProvider;
        return webProvider;
      }
    }

    return {
      isSupported: () => false,
      startListening: (options: STTOptions) => {
        options.onError?.(
          options.lang === 'hi'
            ? 'वॉइस रिकग्निशन इस डिवाइस/ब्राउज़र पर उपलब्ध नहीं है। कृपया नीचे लिखकर जवाब दें।'
            : Platform.OS === 'web'
              ? 'Voice recognition is not available in this browser. Please type your input below.'
              : 'Voice recognition requires an app build with expo-speech-recognition. Expo Go cannot use this microphone feature.'
        );
      },
      stopListening: () => {},
      getActiveState: () => false,
    };
  }

  public isSupported(): boolean {
    return this.getProvider().isSupported();
  }

  public setNextResponse(text: string) {
    this.simulationProvider.setNextResponse(text);
    this.activeProvider = this.simulationProvider;
  }

  public startListening(options: STTOptions) {
    this.getProvider().startListening(options);
  }

  public stopListening() {
    this.activeProvider?.stopListening();
  }

  public getActiveState(): boolean {
    return this.getProvider().getActiveState();
  }
}

export const sttService = new SpeechToTextService();


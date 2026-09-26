/**
 * AARTHIKA Speech-to-Text (STT) Service
 * Real Native & Web Speech Recognition Service.
 */

import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

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

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as any;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public startListening(options: STTOptions) {
    if (this.isListening) {
      this.stopListening();
    }

    const win = window as any;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      options.onError?.('Speech recognition is not supported in this browser. Please type your input.');
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

        const currentText = finalTranscript || interimTranscript;
        if (currentText) {
          options.onResult(currentText.trim(), !!finalTranscript);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('[STT] Recognition error:', event.error);
        let message = 'Speech recognition error';
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          message = 'Microphone permission denied. Please allow microphone access in settings.';
        } else if (event.error === 'no-speech') {
          message = 'No speech detected. Please speak into your microphone.';
        } else if (event.error === 'network') {
          message = 'Network error during speech recognition.';
        }
        this.isListening = false;
        options.onError?.(message);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        options.onEnd?.();
      };

      this.recognition.start();
    } catch (e: any) {
      this.isListening = false;
      console.warn('[STT] Failed to start speech recognition:', e);
      options.onError?.(e.message || 'Failed to start microphone.');
    }
  }

  public stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
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

  constructor() {
    if (Platform.OS !== 'web') {
      this.setupListeners();
    }
  }

  private setupListeners() {
    // using event listener approach from expo-speech-recognition
    this.listeners.push(
      ExpoSpeechRecognitionModule.addListener('start', () => {
        this.isListening = true;
        this.currentOptions?.onStart?.();
      }),
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const text = event.results[0]?.transcript || '';
        if (text) {
          this.currentOptions?.onResult(text, event.isFinal);
        }
      }),
      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        this.isListening = false;
        console.warn('[STT] Native Recognition error:', event.error, event.message);
        let message = 'माइक की अनुमति नहीं मिली या कोई तकनीकी समस्या है। आप नीचे लिखकर भी जवाब दे सकते हैं।';
        if (event.error === 'network') {
          message = 'Voice recognition अभी उपलब्ध नहीं है। कृपया लिखकर जवाब दें।';
        }
        this.currentOptions?.onError?.(message);
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        this.isListening = false;
        this.currentOptions?.onEnd?.();
      })
    );
  }

  public isSupported(): boolean {
    return true; // We assume it's supported on native platforms via ExpoSpeechRecognitionModule
  }

  public async startListening(options: STTOptions) {
    if (this.isListening) {
      this.stopListening();
    }
    
    this.currentOptions = options;

    try {
      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perms.granted) {
        options.onError?.('माइक की अनुमति नहीं मिली। आप नीचे लिखकर भी जवाब दे सकते हैं।');
        return;
      }
      
      const bcp47Lang = STT_LANG_MAP[options.lang || 'hi'] || 'hi-IN';
      ExpoSpeechRecognitionModule.start({
        lang: bcp47Lang,
        interimResults: options.interimResults ?? true,
        continuous: options.continuous ?? false,
      });
    } catch (e: any) {
      console.warn('[STT] Failed to start native speech recognition:', e);
      options.onError?.('Voice recognition अभी उपलब्ध नहीं है। कृपया लिखकर जवाब दें।');
    }
  }

  public stopListening() {
    ExpoSpeechRecognitionModule.stop();
    this.isListening = false;
  }

  public getActiveState(): boolean {
    return this.isListening;
  }
}

class ManualInputFallback implements SpeechInputProvider {
  public isSupported() { return true; }
  public startListening(options: STTOptions) {
    options.onError?.('Voice recognition is not available. Please type your input.');
  }
  public stopListening() {}
  public getActiveState() { return false; }
}

class SpeechToTextService {
  private provider: SpeechInputProvider;

  constructor() {
    if (Platform.OS === 'web') {
      this.provider = new WebSpeechProvider();
    } else {
      this.provider = new NativeSpeechProvider();
    }
  }

  public isSupported(): boolean {
    return this.provider.isSupported();
  }

  public startListening(options: STTOptions) {
    this.provider.startListening(options);
  }

  public stopListening() {
    this.provider.stopListening();
  }

  public getActiveState(): boolean {
    return this.provider.getActiveState();
  }
}

export const sttService = new SpeechToTextService();

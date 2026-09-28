const mockListeners: Record<string, (event?: any) => void> = {};
const mockNative = {
  addListener: jest.fn((name: string, callback: (event?: any) => void) => {
    mockListeners[name] = callback;
    return { remove: jest.fn() };
  }),
  isRecognitionAvailable: jest.fn(() => true),
  getSpeechRecognitionServices: jest.fn(() => ['com.google.android.tts']),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  start: jest.fn(),
  abort: jest.fn(),
};

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));
jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => mockNative) }));
jest.mock('expo-speech', () => ({ stop: jest.fn(async () => {}), speak: jest.fn() }));

import { requireOptionalNativeModule } from 'expo';
import * as Speech from 'expo-speech';
import { sttService } from '../stt';
import { speak, stopSpeaking } from '../tts';

describe('native voice turn taking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sttService.stopListening();
    void stopSpeaking();
  });

  it('attaches one listener set and does not abort an idle recognizer', async () => {
    sttService.isSupported();
    sttService.isSupported();
    sttService.stopListening();
    expect(mockNative.abort).not.toHaveBeenCalled();

    const onError = jest.fn();
    sttService.startListening({ lang: 'hi', onResult: jest.fn(), onError });
    await Promise.resolve();
    expect(mockNative.start).toHaveBeenCalledTimes(1);
    expect(mockNative.addListener).toHaveBeenCalledTimes(4);

    mockListeners.start();
    sttService.stopListening();
    sttService.stopListening();
    expect(mockNative.abort).toHaveBeenCalledTimes(1);
    mockListeners.error({ error: 'aborted', message: 'cancelled' });
    mockListeners.end();
    expect(onError).not.toHaveBeenCalled();
  });

  it('starts recognition without relying on Android service listing', async () => {
    const onError = jest.fn();
    sttService.startListening({ lang: 'en', onResult: jest.fn(), onError });
    await Promise.resolve();
    expect(mockNative.start).toHaveBeenCalledTimes(1);
    expect(mockNative.getSpeechRecognitionServices).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    sttService.stopListening();
    mockListeners.end();
  });

  it('reports a missing device recognizer without issuing a native start', async () => {
    mockNative.isRecognitionAvailable.mockReturnValueOnce(false);
    mockNative.getSpeechRecognitionServices.mockReturnValueOnce([]);
    const onError = jest.fn();
    sttService.startListening({ lang: 'en', onResult: jest.fn(), onError });
    await Promise.resolve();
    expect(mockNative.start).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('No speech recognition service'));
  });

  it('reports a missing native build without throwing during module loading', () => {
    jest.mocked(requireOptionalNativeModule).mockReturnValueOnce(null);
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const freshService = require('../stt').sttService;
      const onError = jest.fn();
      freshService.startListening({ lang: 'en', onResult: jest.fn(), onError });
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('app build'));
    });
  });

  it('waits for the prior TTS stop before playing a new prompt', async () => {
    let releaseStop: (() => void) | undefined;
    jest.mocked(Speech.stop).mockImplementationOnce(() => new Promise<void>(resolve => {
      releaseStop = resolve;
    }));
    const onDone = jest.fn();

    speak('What is your name?', 'en', { onDone });
    expect(Speech.speak).not.toHaveBeenCalled();
    releaseStop?.();
    await Promise.resolve();
    expect(Speech.speak).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();

    const speechOptions = jest.mocked(Speech.speak).mock.calls[0][1];
    speechOptions?.onDone?.();
    expect(onDone).toHaveBeenCalledTimes(1);
    await stopSpeaking();
  });

  it('does not start recognition after the user cancels during permission setup', async () => {
    let grantPermission: ((value: { granted: boolean }) => void) | undefined;
    mockNative.requestPermissionsAsync.mockImplementationOnce(() =>
      new Promise(resolve => { grantPermission = resolve; })
    );
    sttService.startListening({ lang: 'hi', onResult: jest.fn() });
    sttService.stopListening();
    grantPermission?.({ granted: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(mockNative.start).not.toHaveBeenCalled();
  });

  it('does not play a stale prompt after a newer prompt takes its place', async () => {
    let releaseFirstStop: (() => void) | undefined;
    jest.mocked(Speech.stop).mockImplementationOnce(() => new Promise<void>(resolve => {
      releaseFirstStop = resolve;
    }));
    speak('old prompt', 'en');
    speak('new prompt', 'en');
    await Promise.resolve();
    releaseFirstStop?.();
    await Promise.resolve();
    expect(Speech.speak).toHaveBeenCalledTimes(1);
    expect(jest.mocked(Speech.speak).mock.calls[0][0]).toBe('new prompt');
    await stopSpeaking();
  });
});

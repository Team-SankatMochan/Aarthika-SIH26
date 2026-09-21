import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { sttService } from '../services/stt';
import { parseSpokenNumber, NumberParseResult } from '../services/numberParser';

interface NumericVoiceModalProps {
  isOpen: boolean;
  fieldLabel: string;
  currentLang: string;
  t: (key: string) => string;
  onApplyValue: (val: number) => void;
  onClose: () => void;
}

export const NumericVoiceModal: React.FC<NumericVoiceModalProps> = ({
  isOpen,
  fieldLabel,
  currentLang,
  t,
  onApplyValue,
  onClose,
}) => {
  const [listening, setListening] = useState<boolean>(false);
  const [spokenText, setSpokenText] = useState<string>('');
  const [parsedResult, setParsedResult] = useState<NumberParseResult | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for listening state
  useEffect(() => {
    if (listening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [listening]);

  // Auto-start listening on modal open
  useEffect(() => {
    if (isOpen) {
      setSpokenText('');
      setParsedResult(null);
      setManualInput('');
      setErrorMsg(null);
      startVoiceListening();
    } else {
      sttService.stopListening();
      setListening(false);
    }
    return () => {
      sttService.stopListening();
    };
  }, [isOpen, currentLang]);

  const startVoiceListening = () => {
    setErrorMsg(null);
    setListening(true);

    sttService.startListening({
      lang: currentLang,
      continuous: false,
      interimResults: true,
      onStart: () => {
        setListening(true);
      },
      onResult: (transcript, isFinal) => {
        setSpokenText(transcript);
        const parsed = parseSpokenNumber(transcript);
        setParsedResult(parsed);
        if (parsed.success) {
          setManualInput(parsed.value.toString());
        }
        if (isFinal) {
          setListening(false);
        }
      },
      onError: (err) => {
        setListening(false);
        setErrorMsg(err);
      },
      onEnd: () => {
        setListening(false);
      },
    });
  };

  const handleApply = () => {
    if (parsedResult && parsedResult.success && parsedResult.value > 0) {
      onApplyValue(parsedResult.value);
      onClose();
    } else if (manualInput.trim()) {
      const num = parseFloat(manualInput);
      if (!isNaN(num) && num >= 0) {
        onApplyValue(num);
        onClose();
      } else {
        setErrorMsg(t('invalid_number_msg') || 'Please enter a valid number.');
      }
    } else {
      setErrorMsg(t('invalid_number_msg') || 'Please speak or enter a valid number.');
    }
  };

  const langNames: Record<string, string> = {
    en: 'English',
    hi: 'हिन्दी (Hindi)',
    bn: 'বাংলা (Bengali)',
    ml: 'മലയാളം',
    te: 'తెలుగు',
    pa: 'ਪੰਜਾਬੀ',
    kn: 'ಕನ್ನಡ',
    ur: 'اردو',
    bho: 'भोजपुरी',
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
          {/* Mobile Bottom Sheet Grab Handle */}
          <View style={styles.grabHandle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.modalTitle}>
              {t('numeric_voice_title') || 'Voice Numeric Input'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={{ fontSize: 16, color: '#867468' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.targetFieldText}>
            {fieldLabel}
          </Text>
          <Text style={styles.subtext}>
            {t('numeric_voice_sub') || 'Speak a number (e.g. 50000, 50 thousand, पचास हजार, পঞ্চাশ হাজার)'}
          </Text>

          {/* Animated Mic Indicator */}
          <View style={styles.micContainer}>
            <Animated.View
              style={[
                styles.micPulseCircle,
                listening && styles.micPulseActive,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <TouchableOpacity
                style={[styles.micButton, listening && styles.micButtonActive]}
                onPress={listening ? () => sttService.stopListening() : startVoiceListening}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 32 }}>🎙️</Text>
              </TouchableOpacity>
            </Animated.View>

            <Text style={styles.stateLabel}>
              {listening
                ? `${t('voice_listening') || 'Listening...'} (${langNames[currentLang] || 'English'})`
                : t('voice_tap_to_speak') || 'Tap mic to speak'}
            </Text>
          </View>

          {/* Recognized Text & Interpretation */}
          {spokenText.length > 0 && (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>{t('spoken_text') || 'Spoken Speech:'}</Text>
              <Text style={styles.spokenTextDisplay}>"{spokenText}"</Text>

              {parsedResult && parsedResult.success ? (
                <View style={styles.successValueBadge}>
                  <Text style={styles.successLabel}>
                    {t('interpreted_number') || 'Interpreted Value: ₹'}{parsedResult.value.toLocaleString('en-IN')}
                  </Text>
                </View>
              ) : (
                <Text style={styles.warningText}>
                  {t('invalid_number_msg') || 'Could not interpret a valid number. You can type below:'}
                </Text>
              )}
            </View>
          )}

          {/* Error Message */}
          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Manual Input Fallback */}
          <View style={styles.manualInputRow}>
            <Text style={styles.inputPrefix}>₹</Text>
            <TextInput
              style={styles.manualInput}
              keyboardType="numeric"
              placeholder="Or enter value manually..."
              placeholderTextColor="#867468"
              value={manualInput}
              onChangeText={(txt) => {
                setManualInput(txt);
                const num = parseFloat(txt);
                if (!isNaN(num)) {
                  setParsedResult({ success: true, value: num, formatted: txt, rawText: txt });
                }
              }}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>{t('cancel') || 'Cancel'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={handleApply}
              activeOpacity={0.8}
            >
              <Text style={styles.applyBtnText}>
                {t('apply_number_btn') || 'Apply Number'} →
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 30,
    maxHeight: '85%',
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d8c2b5',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#8e4e14',
  },
  closeBtn: {
    padding: 6,
  },
  targetFieldText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1b1c15',
    marginTop: 4,
  },
  subtext: {
    fontSize: 12,
    color: '#534439',
    marginTop: 2,
    lineHeight: 16,
  },
  micContainer: {
    alignItems: 'center',
    marginVertical: 18,
  },
  micPulseCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#f5f4e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micPulseActive: {
    backgroundColor: 'rgba(244, 162, 97, 0.35)',
  },
  micButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3f6653',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: '#ba1a1a',
  },
  stateLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3f6653',
    marginTop: 8,
  },
  resultBox: {
    backgroundColor: '#f5f4e8',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#867468',
    textTransform: 'uppercase',
  },
  spokenTextDisplay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1b1c15',
    marginTop: 2,
    fontStyle: 'italic',
  },
  successValueBadge: {
    marginTop: 8,
    backgroundColor: '#e2f4ea',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  successLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2d6a4f',
  },
  warningText: {
    fontSize: 12,
    color: '#ba1a1a',
    marginTop: 6,
  },
  errorBox: {
    backgroundColor: '#ffdad6',
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 12,
    color: '#ba1a1a',
    fontWeight: '600',
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d8c2b5',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  inputPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8e4e14',
    marginRight: 6,
  },
  manualInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#1b1c15',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#867468',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#534439',
  },
  applyBtn: {
    flex: 2,
    backgroundColor: '#f4a261',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6f3800',
  },
});

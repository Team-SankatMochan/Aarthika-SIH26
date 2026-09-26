import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Platform, ActivityIndicator } from 'react-native';
import { QuestionConfig } from '../../engine/InterviewEngine';
import { sttService } from '../../services/stt';
import { parseSpokenNumber } from '../../services/numberParser';
import { speak, stopSpeaking } from '../../services/tts';

interface Props {
  question: QuestionConfig;
  onConfirm: (value: any, source: string, derivationMetadata?: any) => void;
}

type UIState = 'IDLE' | 'LISTENING' | 'TRANSCRIBING' | 'RESULT';

export const VoiceQuestionCard: React.FC<Props> = ({ question, onConfirm }) => {
  const [transcript, setTranscript] = useState('');
  const [inputValue, setInputValue] = useState<string>('');
  const [uiState, setUiState] = useState<UIState>('IDLE');
  const [parseError, setParseError] = useState('');

  // Derivation state
  const [inDerivationMode, setInDerivationMode] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [derivationAnswers, setDerivationAnswers] = useState<Record<string, number>>({});
  const [derivedValue, setDerivedValue] = useState<number | null>(null);

  const isNumeric = question.input_type !== 'TEXT';

  useEffect(() => {
    // Speak question on mount
    let isMounted = true;
    setTimeout(() => {
      if (isMounted) {
        speak(question.prompt_hi, 'hi');
      }
    }, 500);
    return () => {
      isMounted = false;
      stopSpeaking();
    };
  }, [question.id]);

  const handleGlobalIntents = (text: string): boolean => {
    const textLower = text.toLowerCase();
    
    // I don't know intent
    if (textLower.includes('मुझे नहीं पता') || textLower.includes('पता नहीं') || textLower.includes('नहीं मालूम') || textLower.includes('help me estimate')) {
      if (question.allow_estimation) {
        setInDerivationMode(true);
        speak('कोई बात नहीं। मैं अनुमान लगाने में मदद करती हूँ.', 'hi');
      } else {
        onConfirm(null, 'USER_PROVIDED'); // store as unknown
      }
      return true;
    }

    if (textLower.includes('फिर से बोलो')) {
      speak(question.prompt_hi, 'hi');
      return true;
    }

    return false;
  };

  const startListeningBase = (onResultText: (text: string) => void) => {
    if (sttService.getActiveState()) {
      sttService.stopListening();
      setUiState('IDLE');
      return;
    }

    setParseError('');
    setUiState('LISTENING');
    sttService.startListening({
      lang: 'hi',
      onStart: () => setUiState('LISTENING'),
      onResult: (text, isFinal) => {
        if (!isFinal) {
          setUiState('TRANSCRIBING');
        } else {
          setUiState('RESULT');
          onResultText(text);
        }
      },
      onEnd: () => {
        if (uiState !== 'RESULT') {
          setUiState('IDLE');
        }
      },
      onError: (err) => {
        setUiState('IDLE');
        setParseError(err);
      }
    });
  };

  const handleMicPress = () => {
    // If we are in RESULT state, we might be listening for a confirmation
    if (uiState === 'RESULT') {
      startListeningBase((text) => {
        const textLower = text.toLowerCase();
        if (textLower.includes('हाँ') || textLower.includes('हां') || textLower.includes('yes') || textLower.includes('जी')) {
          confirmValue();
        } else if (textLower.includes('नहीं') || textLower.includes('गलत है') || textLower.includes('change') || textLower.includes('दोबारा')) {
          setInputValue('');
          setTranscript('');
          setUiState('IDLE');
        } else {
          processMainResult(text);
        }
      });
      return;
    }

    setTranscript('');
    setInputValue('');
    startListeningBase(processMainResult);
  };

  const processMainResult = (text: string) => {
    setTranscript(text);
    if (handleGlobalIntents(text)) {
      setUiState('IDLE');
      return;
    }

    if (isNumeric) {
      const parsed = parseSpokenNumber(text);
      if (parsed.success) {
        setInputValue(parsed.value.toString());
        setParseError('');
        const confirmText = question.confirmation_hi.replace('{{value}}', parsed.formatted);
        speak(confirmText, 'hi');
      } else {
        setParseError('मैं रकम ठीक से समझ नहीं पाई। कृपया दोबारा बोलें या लिखें।');
        speak('मैं रकम ठीक से समझ नहीं पाई। कृपया दोबारा बोलें या लिखें।', 'hi');
      }
    } else {
      setInputValue(text);
      const confirmText = question.confirmation_hi.replace('{{value}}', text);
      speak(confirmText, 'hi');
    }
  };

  const handleDerivationMicPress = (stepId: string) => {
    setTranscript('');
    startListeningBase((text) => {
      setTranscript(text);
      const parsed = parseSpokenNumber(text);
      if (parsed.success) {
        const val = parsed.value;
        setDerivationAnswers(prev => {
          const next = { ...prev, [stepId]: val };
          if (question.derivation_steps && Object.keys(next).length === question.derivation_steps.length) {
            const calculated = question.derivation_formula ? question.derivation_formula(next) : val;
            setDerivedValue(calculated);
            speak(`आपके जवाबों से महीने का अनुमानित खर्च ${calculated} निकलता है। क्या यह सही है?`, 'hi');
          } else {
            setCurrentStepIndex(i => i + 1);
            if (question.derivation_steps) {
               speak(question.derivation_steps[currentStepIndex + 1].prompt_hi, 'hi');
            }
          }
          return next;
        });
      }
    });
  };

  const confirmValue = () => {
    sttService.stopListening();
    if (isNumeric) {
      onConfirm(Number(inputValue), 'USER_PROVIDED');
    } else {
      onConfirm(inputValue, 'USER_PROVIDED');
    }
  };

  if (inDerivationMode && question.derivation_steps) {
    const currentStep = question.derivation_steps[currentStepIndex];
    
    if (derivedValue !== null) {
      return (
        <View style={styles.card}>
          <Text style={styles.prompt}>आपके जवाबों से अनुमान:</Text>
          <Text style={{ fontSize: 32, fontWeight: 'bold', marginVertical: 10 }}>₹{derivedValue.toLocaleString('en-IN')}</Text>
          
          <View style={{ flexDirection: 'row', marginTop: 20 }}>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(derivedValue, 'DERIVED_FROM_USER_INPUT', derivationAnswers)}>
              <Text style={styles.btnText}>✓ सही है</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#e0e0e0', marginLeft: 10 }]} onPress={() => {
              setDerivedValue(null);
              setDerivationAnswers({});
              setCurrentStepIndex(0);
            }}>
              <Text style={[styles.btnText, { color: '#333' }]}>✎ बदलें</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <Text style={styles.subPrompt}>अनुमान लगाने में मदद (Step {currentStepIndex + 1}/{question.derivation_steps.length})</Text>
        <Text style={styles.prompt}>{currentStep.prompt_hi}</Text>
        
        <View style={styles.inputRow}>
          <TouchableOpacity style={[styles.micBtn, uiState === 'LISTENING' && styles.micActive]} onPress={() => handleDerivationMicPress(currentStep.id)}>
            <Text style={styles.micIcon}>🎙️</Text>
          </TouchableOpacity>
        </View>
        {transcript ? <Text style={styles.transcriptText}>मैंने सुना: &quot;{transcript}&quot;</Text> : null}
      </View>
    );
  }

  const renderStatus = () => {
    switch (uiState) {
      case 'LISTENING': return <Text style={styles.statusText}>सुन रही हूँ...</Text>;
      case 'TRANSCRIBING': return <Text style={styles.statusText}>आपकी बात समझ रही हूँ...</Text>;
      default: return null;
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.prompt}>{question.prompt_hi}</Text>
      
      <TouchableOpacity style={styles.listenBtn} onPress={() => speak(question.prompt_hi, 'hi')}>
        <Text style={styles.listenBtnText}>🔊 फिर से सुनें</Text>
      </TouchableOpacity>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={(val) => {
            setInputValue(val);
            setTranscript('Manual Edit');
            setParseError('');
            setUiState('RESULT');
          }}
          placeholder={isNumeric ? "0" : "लिखें..."}
          keyboardType={isNumeric ? "numeric" : "default"}
        />
        <TouchableOpacity style={[styles.micBtn, uiState === 'LISTENING' && styles.micActive]} onPress={handleMicPress}>
          <Text style={styles.micIcon}>🎙️</Text>
        </TouchableOpacity>
      </View>

      {renderStatus()}
      
      {uiState === 'RESULT' && transcript && transcript !== 'Manual Edit' && !parseError ? (
        <Text style={styles.transcriptText}>मैंने सुना: &quot;{transcript}&quot;</Text>
      ) : null}
      
      {parseError ? (
        <Text style={[styles.transcriptText, { color: 'red' }]}>{parseError}</Text>
      ) : null}

      {inputValue ? (
        <View style={styles.confirmationBox}>
          <Text style={styles.confirmText}>
            {question.confirmation_hi.replace('{{value}}', isNumeric ? `₹${Number(inputValue).toLocaleString('en-IN')}` : inputValue)}
          </Text>
          <Text style={styles.confirmSubText}>क्या यह सही है? (हाँ / नहीं)</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmValue}>
              <Text style={styles.btnText}>✓ सही है</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editBtn} onPress={() => setUiState('IDLE')}>
              <Text style={styles.btnTextDark}>✎ बदलें</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.retryBtn} onPress={() => { setInputValue(''); setTranscript(''); handleMicPress(); }}>
              <Text style={styles.btnTextDark}>🎙 दोबारा बोलें</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.instructionText}>बोलकर जवाब दें</Text>
      )}

      {question.allow_estimation && question.derivation_steps && !inputValue && (
        <TouchableOpacity style={styles.estimateBtn} onPress={() => setInDerivationMode(true)}>
          <Text style={styles.estimateText}>🤔 मुझे नहीं पता, अनुमान लगाएं</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#fff', borderRadius: 16, elevation: 4, marginVertical: 10, position: 'relative' },
  prompt: { fontSize: 22, fontWeight: 'bold', color: '#8e4e14', marginBottom: 8 },
  subPrompt: { fontSize: 14, color: '#666', marginBottom: 20 },
  listenBtn: { alignSelf: 'flex-start', padding: 8, backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 15 },
  listenBtnText: { fontSize: 14, color: '#333' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  input: { flex: 1, fontSize: 32, borderBottomWidth: 2, borderBottomColor: '#f4a261', paddingVertical: 10, marginRight: 10 },
  micBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#f4a261', alignItems: 'center', justifyContent: 'center' },
  micActive: { backgroundColor: '#e76f51' },
  micIcon: { fontSize: 24 },
  statusText: { fontSize: 14, color: '#e76f51', fontStyle: 'italic', marginTop: 5, marginBottom: 5 },
  transcriptText: { fontSize: 14, color: '#666', fontStyle: 'italic', marginBottom: 15 },
  instructionText: { fontSize: 16, color: '#888', marginTop: 10, textAlign: 'center' },
  confirmationBox: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, marginTop: 10 },
  confirmText: { fontSize: 18, marginBottom: 5 },
  confirmSubText: { fontSize: 14, color: '#666', marginBottom: 15, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  confirmBtn: { backgroundColor: '#3f6653', padding: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
  editBtn: { backgroundColor: '#e0e0e0', padding: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
  retryBtn: { backgroundColor: '#ffd6a5', padding: 12, borderRadius: 10, alignItems: 'center', flex: 1 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnTextDark: { color: '#333', fontSize: 16, fontWeight: 'bold' },
  estimateBtn: { marginTop: 20, padding: 15, backgroundColor: '#efeee3', borderRadius: 10, alignItems: 'center' },
  estimateText: { fontSize: 16, color: '#3f6653', fontWeight: 'bold' }
});

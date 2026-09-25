import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Platform } from 'react-native';
import { QuestionConfig, DerivationStep } from '../../engine/InterviewEngine';
import { sttService } from '../../services/stt';

interface Props {
  question: QuestionConfig;
  onConfirm: (value: any, source: string, derivationMetadata?: any) => void;
}

export const VoiceQuestionCard: React.FC<Props> = ({ question, onConfirm }) => {
  const [transcript, setTranscript] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isDemoVoice, setIsDemoVoice] = useState(false);

  // Derivation state
  const [inDerivationMode, setInDerivationMode] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [derivationAnswers, setDerivationAnswers] = useState<Record<string, number>>({});
  const [derivedValue, setDerivedValue] = useState<number | null>(null);

  const startListeningBase = (onResultText: (text: string) => void) => {
    if (isListening) {
      sttService.stopListening();
      setIsListening(false);
      return;
    }

    if (Platform.OS !== 'web') {
      setIsDemoVoice(true);
      setIsListening(true);
      setTimeout(() => {
        const mockTranscript = question.id === 'margin_capital' ? 'Mahine ka lagbhag chaar hazaar hai' : '200';
        onResultText(mockTranscript);
        setIsListening(false);
      }, 2000);
      return;
    }

    sttService.startListening({
      lang: 'hi',
      onStart: () => setIsListening(true),
      onResult: (text) => onResultText(text),
      onEnd: () => setIsListening(false),
      onError: () => setIsListening(false)
    });
  };

  const handleMicPress = () => {
    setTranscript('');
    setInputValue('');
    startListeningBase((text) => {
      setTranscript(text);
      const match = text.match(/\d+/);
      if (match) setInputValue(match[0]);
    });
  };

  const handleDerivationMicPress = (stepId: string) => {
    setTranscript('');
    startListeningBase((text) => {
      setTranscript(text);
      const match = text.match(/\d+/);
      if (match) {
        const val = Number(match[0]);
        setDerivationAnswers(prev => {
          const next = { ...prev, [stepId]: val };
          // If all steps are answered, compute
          if (question.derivation_steps && Object.keys(next).length === question.derivation_steps.length) {
            const calculated = question.derivation_formula ? question.derivation_formula(next) : val;
            setDerivedValue(calculated);
          } else {
            setCurrentStepIndex(i => i + 1);
          }
          return next;
        });
      }
    });
  };

  if (inDerivationMode && question.derivation_steps) {
    const currentStep = question.derivation_steps[currentStepIndex];
    
    if (derivedValue !== null) {
      return (
        <View style={styles.card}>
          <Text style={styles.prompt}>आपके जवाबों से अनुमान:</Text>
          <Text style={{ fontSize: 32, fontWeight: 'bold', marginVertical: 10 }}>₹{derivedValue.toLocaleString('en-IN')}</Text>
          <Text style={{ fontSize: 12, fontStyle: 'italic', color: '#666' }}>यह अनुमान है, verified market data नहीं.</Text>
          
          <View style={{ flexDirection: 'row', marginTop: 20 }}>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(derivedValue, 'DERIVED_FROM_USER_INPUT', derivationAnswers)}>
              <Text style={styles.btnText}>✓ सही है</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#e0e0e0', marginLeft: 10 }]} onPress={() => {
              setDerivedValue(null);
              setDerivationAnswers({});
              setCurrentStepIndex(0);
            }}>
              <Text style={[styles.btnText, { color: '#333' }]}>बदलें</Text>
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
          <TouchableOpacity style={[styles.micBtn, isListening && styles.micActive]} onPress={() => handleDerivationMicPress(currentStep.id)}>
            <Text style={styles.micIcon}>🎙️</Text>
          </TouchableOpacity>
        </View>
        {transcript ? <Text style={styles.transcriptText}>सुना गया: &quot;{transcript}&quot;</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {isDemoVoice && <Text style={styles.demoBadge}>DEMO VOICE INPUT</Text>}
      <Text style={styles.prompt}>{question.prompt_hi}</Text>
      <Text style={styles.subPrompt}>{question.prompt_en}</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={(val) => {
            setInputValue(val);
            setTranscript('Manual Edit');
          }}
          placeholder="0"
          keyboardType="numeric"
        />
        <TouchableOpacity style={[styles.micBtn, isListening && styles.micActive]} onPress={handleMicPress}>
          <Text style={styles.micIcon}>🎙️</Text>
        </TouchableOpacity>
      </View>

      {transcript ? (
        <Text style={styles.transcriptText}>सुना गया: &quot;{transcript}&quot;</Text>
      ) : null}

      {inputValue ? (
        <View style={styles.confirmationBox}>
          <Text style={styles.confirmText}>
            {question.confirmation_hi.replace('{{value}}', inputValue)}
          </Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(Number(inputValue), 'USER_PROVIDED')}>
            <Text style={styles.btnText}>✓ सही है</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {question.allow_estimation && question.derivation_steps && (
        <TouchableOpacity style={styles.estimateBtn} onPress={() => setInDerivationMode(true)}>
          <Text style={styles.estimateText}>🤔 अनुमान लगाने में मदद करें</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#fff', borderRadius: 16, elevation: 4, marginVertical: 10, position: 'relative' },
  demoBadge: { position: 'absolute', top: -10, right: 10, backgroundColor: '#f57f17', color: '#fff', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  prompt: { fontSize: 22, fontWeight: 'bold', color: '#8e4e14', marginBottom: 8 },
  subPrompt: { fontSize: 14, color: '#666', marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  input: { flex: 1, fontSize: 32, borderBottomWidth: 2, borderBottomColor: '#f4a261', paddingVertical: 10, marginRight: 10 },
  micBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#f4a261', alignItems: 'center', justifyContent: 'center' },
  micActive: { backgroundColor: '#e76f51' },
  micIcon: { fontSize: 24 },
  transcriptText: { fontSize: 14, color: '#666', fontStyle: 'italic', marginBottom: 15 },
  confirmationBox: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, marginTop: 10 },
  confirmText: { fontSize: 18, marginBottom: 15 },
  confirmBtn: { backgroundColor: '#3f6653', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  estimateBtn: { marginTop: 20, padding: 15, backgroundColor: '#efeee3', borderRadius: 10, alignItems: 'center' },
  estimateText: { fontSize: 16, color: '#3f6653', fontWeight: 'bold' }
});

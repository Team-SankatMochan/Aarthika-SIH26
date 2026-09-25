import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { QuestionConfig } from '../../engine/InterviewEngine';
import { TrustBadge } from './TrustBadge';

interface Props {
  question: QuestionConfig;
  onConfirm: (value: any) => void;
  onHelpEstimate: () => void;
}

export const VoiceQuestionCard: React.FC<Props> = ({ question, onConfirm, onHelpEstimate }) => {
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Mock voice interaction
  const handleMicPress = () => {
    setIsListening(true);
    setTimeout(() => {
      setInputValue('600');
      setIsListening(false);
    }, 1500);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.prompt}>{question.prompt_hi}</Text>
      <Text style={styles.subPrompt}>{question.prompt_en}</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="0"
          keyboardType="numeric"
        />
        <TouchableOpacity style={[styles.micBtn, isListening && styles.micActive]} onPress={handleMicPress}>
          <Text style={styles.micIcon}>🎙️</Text>
        </TouchableOpacity>
      </View>

      {inputValue ? (
        <View style={styles.confirmationBox}>
          <Text style={styles.confirmText}>
            {question.confirmation_hi.replace('{{value}}', inputValue)}
          </Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(Number(inputValue))}>
            <Text style={styles.btnText}>✓ सही है</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {question.allow_estimation && (
        <TouchableOpacity style={styles.estimateBtn} onPress={onHelpEstimate}>
          <Text style={styles.estimateText}>🤔 अनुमान लगाने में मदद करें</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: '#fff', borderRadius: 16, elevation: 4, marginVertical: 10 },
  prompt: { fontSize: 22, fontWeight: 'bold', color: '#8e4e14', marginBottom: 8 },
  subPrompt: { fontSize: 14, color: '#666', marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  input: { flex: 1, fontSize: 32, borderBottomWidth: 2, borderBottomColor: '#f4a261', paddingVertical: 10, marginRight: 10 },
  micBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#f4a261', alignItems: 'center', justifyContent: 'center' },
  micActive: { backgroundColor: '#e76f51' },
  micIcon: { fontSize: 24 },
  confirmationBox: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, marginTop: 10 },
  confirmText: { fontSize: 18, marginBottom: 15 },
  confirmBtn: { backgroundColor: '#3f6653', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  estimateBtn: { marginTop: 20, padding: 15, backgroundColor: '#efeee3', borderRadius: 10, alignItems: 'center' },
  estimateText: { fontSize: 16, color: '#3f6653', fontWeight: 'bold' }
});

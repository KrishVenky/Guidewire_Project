import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { authAPI } from '../api';
import { useAuthStore } from '../store';

type RootStackParamList = {
  WorkerLogin: undefined;
  WorkerDashboard: { workerId: string };
  Home: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'WorkerLogin'>;

export default function WorkerLoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { login } = useAuthStore();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  const handleRequestOTP = async () => {
    if (phone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      await authAPI.requestOTP(phone);
      setStep('otp');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.verifyOTP(phone, otp);
      await login(response.access_token, response.worker.id, false);
      navigation.navigate('WorkerDashboard', { workerId: response.worker.id });
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>
          {step === 'phone' ? 'Enter your phone number' : 'Enter the OTP sent to your phone'}
        </Text>
      </View>

      <View style={styles.form}>
        {step === 'phone' ? (
          <>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="9876543210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
              placeholderTextColor="#666"
            />

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleRequestOTP}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Send OTP</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>OTP</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="123456"
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
              placeholderTextColor="#666"
            />

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleVerifyOTP}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Verify & Login</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendButton}
              onPress={() => setStep('phone')}
            >
              <Text style={styles.resendButtonText}>Change Phone Number</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.backButtonText}>← Back to Home</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 8,
  },
  form: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  otpInput: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendButtonText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  backButton: {
    alignItems: 'center',
    marginTop: 32,
  },
  backButtonText: {
    color: '#666666',
    fontSize: 14,
  },
});

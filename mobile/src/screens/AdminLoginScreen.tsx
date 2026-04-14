import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { authAPI } from '../api';
import { useAuthStore } from '../store';

type RootStackParamList = {
  AdminLogin: undefined;
  AdminDashboard: undefined;
  Home: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'AdminLogin'>;

export default function AdminLoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { login } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState('');

  const handleLogin = async () => {
    if (pin.length < 4) {
      Alert.alert('Error', 'Please enter a valid PIN');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.adminLogin(pin);
      await login(response.token, null, true);
      navigation.navigate('AdminDashboard');
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.detail || 'Invalid PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Login</Text>
        <Text style={styles.subtitle}>Enter your admin PIN</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Admin PIN</Text>
        <TextInput
          style={[styles.input, styles.pinInput]}
          placeholder="****"
          keyboardType="number-pad"
          value={pin}
          onChangeText={setPin}
          maxLength={8}
          secureTextEntry
          placeholderTextColor="#666"
        />

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.backButtonText}>← Back to Home</Text>
        </TouchableOpacity>

        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Demo PIN: admin123</Text>
        </View>
      </View>
    </View>
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
  pinInput: {
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
  backButton: {
    alignItems: 'center',
    marginTop: 32,
  },
  backButtonText: {
    color: '#666666',
    fontSize: 14,
  },
  hintContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#16213e',
    borderRadius: 8,
    alignItems: 'center',
  },
  hintText: {
    color: '#a0a0a0',
    fontSize: 12,
  },
});

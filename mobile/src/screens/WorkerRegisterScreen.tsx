import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { workerAPI } from '../api';

type RootStackParamList = {
  WorkerRegister: undefined;
  WorkerLogin: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'WorkerRegister'>;

export default function WorkerRegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    upi_id: '',
    platform: 'ZOMATO',
    zone_id: '', // Will be selected in full implementation
    avg_weekly_income: '',
    declared_weekly_hours: '',
  });

  const handleRegister = async () => {
    // Validation
    if (!formData.full_name || !formData.phone || !formData.upi_id) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (formData.phone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);

    try {
      await workerAPI.register({
        full_name: formData.full_name,
        phone: formData.phone,
        upi_id: formData.upi_id,
        platform: formData.platform as any,
        avg_weekly_income: parseFloat(formData.avg_weekly_income) || 3500,
        declared_weekly_hours: parseInt(formData.declared_weekly_hours) || 48,
      });

      Alert.alert('Success', 'Registration successful! Please login.', [
        { text: 'OK', onPress: () => navigation.navigate('WorkerLogin') },
      ]);
    } catch (error: any) {
      Alert.alert(
        'Registration Failed',
        error.response?.data?.detail || 'Please try again'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join Hermetical income protection</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ravi Kumar"
          value={formData.full_name}
          onChangeText={(text) => setFormData({ ...formData, full_name: text })}
        />

        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="9876543210"
          keyboardType="phone-pad"
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          maxLength={10}
        />

        <Text style={styles.label}>UPI ID *</Text>
        <TextInput
          style={styles.input}
          placeholder="ravi@upi"
          value={formData.upi_id}
          onChangeText={(text) => setFormData({ ...formData, upi_id: text })}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Platform</Text>
        <View style={styles.platformSelector}>
          {['ZOMATO', 'SWIGGY', 'BLINKIT'].map((platform) => (
            <TouchableOpacity
              key={platform}
              style={[
                styles.platformButton,
                formData.platform === platform && styles.platformButtonActive,
              ]}
              onPress={() => setFormData({ ...formData, platform })}
            >
              <Text
                style={[
                  styles.platformButtonText,
                  formData.platform === platform && styles.platformButtonTextActive,
                ]}
              >
                {platform}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Avg Weekly Income (₹)</Text>
        <TextInput
          style={styles.input}
          placeholder="3500"
          keyboardType="numeric"
          value={formData.avg_weekly_income}
          onChangeText={(text) => setFormData({ ...formData, avg_weekly_income: text })}
        />

        <Text style={styles.label}>Weekly Working Hours</Text>
        <TextInput
          style={styles.input}
          placeholder="48"
          keyboardType="numeric"
          value={formData.declared_weekly_hours}
          onChangeText={(text) => setFormData({ ...formData, declared_weekly_hours: text })}
        />

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Register</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.navigate('WorkerLogin')}
        >
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.loginLinkBold}>Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  },
  label: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
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
  platformSelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  platformButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#16213e',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  platformButtonActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  platformButtonText: {
    color: '#a0a0a0',
    fontSize: 12,
    fontWeight: '600',
  },
  platformButtonTextActive: {
    color: '#ffffff',
  },
  submitButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  loginLinkText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  loginLinkBold: {
    color: '#e94560',
    fontWeight: '600',
  },
});

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Platform, workerAPI, ZoneOption } from '../api';

type RootStackParamList = {
  WorkerRegister: undefined;
  WorkerLogin: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'WorkerRegister'>;

export default function WorkerRegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(false);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(
    null
  );
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    upi_id: '',
    platform: 'ZOMATO' as Platform,
    zone_id: '',
    avg_weekly_income: '',
    declared_weekly_hours: '',
  });

  useEffect(() => {
    const loadZones = async () => {
      try {
        const zoneOptions = await workerAPI.getZones();
        setZones(zoneOptions);
        if (zoneOptions.length > 0) {
          setFormData((current) => ({
            ...current,
            zone_id: current.zone_id || zoneOptions[0].id,
          }));
        }
        setFeedback(null);
      } catch (error: any) {
        setFeedback({
          type: 'error',
          message:
            error.response?.data?.detail ||
            'Could not load Bengaluru zones. Make sure the backend is running, then try again.',
        });
      } finally {
        setZonesLoading(false);
      }
    };

    loadZones();
  }, []);

  const handleRegister = async () => {
    setFeedback(null);

    if (!formData.full_name || !formData.phone || !formData.upi_id || !formData.zone_id) {
      setFeedback({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }

    if (formData.phone.length !== 10) {
      setFeedback({ type: 'error', message: 'Please enter a valid 10-digit phone number.' });
      return;
    }

    setLoading(true);

    try {
      await workerAPI.register({
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        upi_id: formData.upi_id.trim(),
        platform: formData.platform,
        zone_id: formData.zone_id,
        avg_weekly_income: parseFloat(formData.avg_weekly_income) || 3500,
        declared_weekly_hours: parseInt(formData.declared_weekly_hours, 10) || 48,
      });

      setFeedback({
        type: 'success',
        message: 'Registration successful. You can log in now.',
      });
      navigation.navigate('WorkerLogin');
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message:
          error.response?.data?.detail ||
          'Registration failed. Make sure the backend is running and try again.',
      });
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
        {feedback ? (
          <View
            style={[
              styles.feedbackBanner,
              feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess,
            ]}
          >
            <Text style={styles.feedbackText}>{feedback.message}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ravi Kumar"
          placeholderTextColor="#666"
          value={formData.full_name}
          onChangeText={(text) => setFormData({ ...formData, full_name: text })}
        />

        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="9876543210"
          placeholderTextColor="#666"
          keyboardType="phone-pad"
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          maxLength={10}
        />

        <Text style={styles.label}>UPI ID *</Text>
        <TextInput
          style={styles.input}
          placeholder="ravi@upi"
          placeholderTextColor="#666"
          value={formData.upi_id}
          onChangeText={(text) => setFormData({ ...formData, upi_id: text })}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Platform</Text>
        <View style={styles.platformSelector}>
          {(['ZOMATO', 'SWIGGY', 'BLINKIT'] as Platform[]).map((platform) => (
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

        <Text style={styles.label}>Primary Zone *</Text>
        {zonesLoading ? (
          <ActivityIndicator color="#e94560" style={styles.zoneLoader} />
        ) : zones.length > 0 ? (
          <View style={styles.zoneSelector}>
            {zones.map((zone) => (
              <TouchableOpacity
                key={zone.id}
                style={[
                  styles.zoneButton,
                  formData.zone_id === zone.id && styles.zoneButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, zone_id: zone.id })}
              >
                <Text style={styles.zoneButtonText}>{zone.name}</Text>
                <Text style={styles.zoneCityText}>{zone.city}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No zones available yet.</Text>
            <TouchableOpacity
              style={styles.retryZonesButton}
              onPress={() => {
                setZonesLoading(true);
                setFeedback(null);
                workerAPI
                  .getZones()
                  .then((zoneOptions) => {
                    setZones(zoneOptions);
                    if (zoneOptions.length > 0) {
                      setFormData((current) => ({
                        ...current,
                        zone_id: current.zone_id || zoneOptions[0].id,
                      }));
                    }
                  })
                  .catch((error: any) => {
                    setFeedback({
                      type: 'error',
                      message:
                        error.response?.data?.detail ||
                        'Still unable to load zones. Check the backend and try again.',
                    });
                  })
                  .finally(() => setZonesLoading(false));
              }}
            >
              <Text style={styles.retryZonesText}>Retry loading zones</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>Avg Weekly Income (INR)</Text>
        <TextInput
          style={styles.input}
          placeholder="3500"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={formData.avg_weekly_income}
          onChangeText={(text) => setFormData({ ...formData, avg_weekly_income: text })}
        />

        <Text style={styles.label}>Weekly Working Hours</Text>
        <TextInput
          style={styles.input}
          placeholder="48"
          placeholderTextColor="#666"
          keyboardType="numeric"
          value={formData.declared_weekly_hours}
          onChangeText={(text) => setFormData({ ...formData, declared_weekly_hours: text })}
        />

        <TouchableOpacity
          style={[styles.submitButton, (loading || zonesLoading) && styles.submitButtonDisabled]}
          onPress={handleRegister}
          disabled={loading || zonesLoading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Register</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('WorkerLogin')}>
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
  feedbackBanner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  feedbackError: {
    backgroundColor: '#3b1218',
    borderColor: '#e94560',
  },
  feedbackSuccess: {
    backgroundColor: '#123126',
    borderColor: '#4ade80',
  },
  feedbackText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
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
  zoneLoader: {
    marginTop: 16,
  },
  zoneSelector: {
    gap: 8,
    marginTop: 8,
  },
  zoneButton: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0f3460',
    padding: 14,
  },
  zoneButtonActive: {
    borderColor: '#e94560',
    backgroundColor: '#1b2748',
  },
  zoneButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  zoneCityText: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  emptyStateText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  retryZonesButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  retryZonesText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '600',
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

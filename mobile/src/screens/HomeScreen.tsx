import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  Home: undefined;
  WorkerRegister: undefined;
  WorkerLogin: undefined;
  AdminLogin: undefined;
  WorkerDashboard: { workerId: string };
  AdminDashboard: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Hermetical</Text>
        <Text style={styles.subtitle}>Income Insurance for Delivery Partners</Text>
      </View>

      <View style={styles.logoContainer}>
        {/* Placeholder for logo - replace with actual image */}
        <View style={styles.logoPlaceholder}>
          <Text style={styles.logoText}>🛡️</Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => navigation.navigate('WorkerRegister')}
        >
          <Text style={styles.primaryButtonText}>New User? Register</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate('WorkerLogin')}
        >
          <Text style={styles.secondaryButtonText}>Existing User? Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.adminButton]}
          onPress={() => navigation.navigate('AdminLogin')}
        >
          <Text style={styles.adminButtonText}>Admin Login</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Built for Zomato, Swiggy & Blinkit riders</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 8,
    textAlign: 'center',
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0f3460',
  },
  logoText: {
    fontSize: 60,
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 40,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#e94560',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#16213e',
    borderWidth: 2,
    borderColor: '#0f3460',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  adminButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#a0a0a0',
  },
  adminButtonText: {
    color: '#a0a0a0',
    fontSize: 16,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: '#666666',
    fontSize: 12,
  },
});

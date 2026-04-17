import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from './src/store';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import WorkerRegisterScreen from './src/screens/WorkerRegisterScreen';
import WorkerLoginScreen from './src/screens/WorkerLoginScreen';
import AdminLoginScreen from './src/screens/AdminLoginScreen';
import WorkerDashboardScreen from './src/screens/WorkerDashboardScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';

export type RootStackParamList = {
  Home: undefined;
  WorkerRegister: undefined;
  WorkerLogin: undefined;
  AdminLogin: undefined;
  WorkerDashboard: { workerId: string };
  AdminDashboard: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const { isAuthenticated, isAdmin, workerId, hydrate, isHydrated } = useAuthStore();

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {isAuthenticated ? (
          isAdmin ? (
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
          ) : workerId ? (
            <Stack.Screen name="WorkerDashboard" component={WorkerDashboardScreen} />
          ) : (
            <Stack.Screen name="Home" component={HomeScreen} />
          )
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="WorkerRegister" component={WorkerRegisterScreen} />
            <Stack.Screen name="WorkerLogin" component={WorkerLoginScreen} />
            <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
});

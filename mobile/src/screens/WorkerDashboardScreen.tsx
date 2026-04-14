import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuthStore } from '../store';
import { workerAPI, policyAPI, claimAPI } from '../api';

interface DashboardData {
  worker: any;
  policy: any;
  claims: any[];
  disruptions: any[];
}

export default function WorkerDashboardScreen({ navigation }: any) {
  const { workerId, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  const fetchDashboard = async () => {
    if (!workerId) return;
    try {
      const [dashboardData, claimsData] = await Promise.all([
        workerAPI.getDashboard(workerId),
        claimAPI.getWorkerClaims(workerId),
      ]);
      setDashboard({
        worker: dashboardData.worker,
        policy: dashboardData.policy,
        claims: claimsData,
        disruptions: dashboardData.disruptions || [],
      });
    } catch (error: any) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.replace('Home');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Namaste, {dashboard?.worker?.full_name || 'Rider'}</Text>
          <Text style={styles.subGreeting}>Stay protected with Hermetical</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Policy Card */}
      {dashboard?.policy ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Your Policy</Text>
          <View style={styles.policyDetails}>
            <View style={styles.policyRow}>
              <Text style={styles.policyLabel}>Status</Text>
              <View style={[styles.statusBadge, styles.statusActive]}>
                <Text style={styles.statusText}>{dashboard.policy.status}</Text>
              </View>
            </View>
            <View style={styles.policyRow}>
              <Text style={styles.policyLabel}>Weekly Premium</Text>
              <Text style={styles.policyValue}>₹{dashboard.policy.weekly_premium}</Text>
            </View>
            <View style={styles.policyRow}>
              <Text style={styles.policyLabel}>Coverage Amount</Text>
              <Text style={styles.policyValueHighlight}>₹{dashboard.policy.coverage_amount}</Text>
            </View>
            <View style={styles.policyRow}>
              <Text style={styles.policyLabel}>Total Payouts Received</Text>
              <Text style={styles.policyValue}>₹{dashboard.policy.total_payouts_received || 0}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 No Active Policy</Text>
          <Text style={styles.noPolicyText}>Get covered against income loss</Text>
          <TouchableOpacity style={styles.activateButton}>
            <Text style={styles.activateButtonText}>Activate Coverage</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{dashboard?.claims?.length || 0}</Text>
          <Text style={styles.statLabel}>Total Claims</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            ₹{dashboard?.claims?.reduce((sum, c) => sum + (c.payout_amount || 0), 0) || 0}
          </Text>
          <Text style={styles.statLabel}>Total Protected</Text>
        </View>
      </View>

      {/* Recent Claims */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📝 Recent Claims</Text>
        {dashboard?.claims && dashboard.claims.length > 0 ? (
          dashboard.claims.slice(0, 5).map((claim: any, index: number) => (
            <View key={claim.id} style={[styles.claimRow, index > 0 && styles.claimRowBorder]}>
              <View style={styles.claimInfo}>
                <Text style={styles.claimStatus}>{claim.status}</Text>
                <Text style={styles.claimDate}>
                  {new Date(claim.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.claimAmount}>₹{claim.payout_amount || 0}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noClaimsText}>No claims yet</Text>
        )}
      </View>

      {/* Active Disruptions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚠️ Active Disruptions in Your Zone</Text>
        {dashboard?.disruptions && dashboard.disruptions.length > 0 ? (
          dashboard.disruptions.map((d: any) => (
            <View key={d.id} style={styles.disruptionBadge}>
              <Text style={styles.disruptionText}>
                {d.event_type.replace('_', ' ')} - Severity: {d.severity_score}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noDisruptionsText}>No active disruptions - Keep riding! 🛵</Text>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Protected by Hermetical 🛡️</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    color: '#a0a0a0',
    marginTop: 16,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subGreeting: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 4,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#16213e',
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#16213e',
    margin: 16,
    marginTop: 8,
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  policyDetails: {
    gap: 12,
  },
  policyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  policyLabel: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  policyValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  policyValueHighlight: {
    color: '#4ade80',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#065f46',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  noPolicyText: {
    color: '#a0a0a0',
    fontSize: 14,
    marginBottom: 16,
  },
  activateButton: {
    backgroundColor: '#e94560',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  activateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e94560',
  },
  statLabel: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 4,
  },
  claimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  claimRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
  },
  claimInfo: {
    gap: 4,
  },
  claimStatus: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  claimDate: {
    color: '#a0a0a0',
    fontSize: 12,
  },
  claimAmount: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noClaimsText: {
    color: '#a0a0a0',
    textAlign: 'center',
    paddingVertical: 20,
  },
  disruptionBadge: {
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  disruptionText: {
    color: '#ffffff',
    fontSize: 14,
  },
  noDisruptionsText: {
    color: '#4ade80',
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 16,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    color: '#666666',
    fontSize: 12,
  },
});

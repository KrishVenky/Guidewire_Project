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
import { adminAPI } from '../api';

export default function AdminDashboardScreen({ navigation }: any) {
  const { logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);

  const fetchDashboard = async () => {
    try {
      const [dashboardData, claimsData] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getPendingClaims(),
      ]);
      setDashboard(dashboardData);
      setPendingClaims(claimsData);
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

  const handleReviewClaim = (claimId: string, approved: boolean) => {
    Alert.alert(
      'Review Claim',
      `Are you sure you want to ${approved ? 'approve' : 'reject'} this claim?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approved ? 'Approve' : 'Reject',
          style: approved ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await adminAPI.reviewClaim(claimId, approved);
              Alert.alert('Success', `Claim ${approved ? 'approved' : 'rejected'}`);
              fetchDashboard();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to review claim');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.loadingText}>Loading admin dashboard...</Text>
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
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Hermetical Insurance Platform</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Key Metrics */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{dashboard?.total_active_policies || 0}</Text>
          <Text style={styles.metricLabel}>Active Policies</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{dashboard?.total_workers || 0}</Text>
          <Text style={styles.metricLabel}>Total Workers</Text>
        </View>
      </View>

      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, styles.metricCardHighlight]}>
          <Text style={[styles.metricValue, styles.metricValueHighlight]}>
            {dashboard?.pending_review_count || 0}
          </Text>
          <Text style={styles.metricLabel}>Pending Review</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{(dashboard?.loss_ratio || 0) * 100}%</Text>
          <Text style={styles.metricLabel}>Loss Ratio</Text>
        </View>
      </View>

      {/* Financial Summary Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💰 This Week</Text>
        <View style={styles.financialRow}>
          <Text style={styles.financialLabel}>Total Payouts</Text>
          <Text style={styles.financialValue}>₹{dashboard?.total_payouts_this_week || 0}</Text>
        </View>
        <View style={styles.financialRow}>
          <Text style={styles.financialLabel}>Total Claims</Text>
          <Text style={styles.financialValue}>{dashboard?.total_claims_this_week || 0}</Text>
        </View>
        <View style={styles.financialRow}>
          <Text style={styles.financialLabel}>Disruptions</Text>
          <Text style={styles.financialValue}>{dashboard?.disruptions_this_week || 0}</Text>
        </View>
      </View>

      {/* Pending Claims */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⏳ Pending Claims Review</Text>
        {pendingClaims.length > 0 ? (
          pendingClaims.map((claim: any, index: number) => (
            <View
              key={claim.id}
              style={[styles.claimCard, index > 0 && styles.claimCardBorder]}
            >
              <View style={styles.claimHeader}>
                <Text style={styles.claimId}>Claim #{claim.id.slice(0, 8)}</Text>
                <View style={styles.fraudScoreBadge}>
                  <Text style={styles.fraudScoreText}>
                    Fraud Score: {claim.fraud_score}
                  </Text>
                </View>
              </View>
              {claim.fraud_flags && claim.fraud_flags.length > 0 && (
                <View style={styles.flagsContainer}>
                  {claim.fraud_flags.map((flag: string) => (
                    <View key={flag} style={styles.flagBadge}>
                      <Text style={styles.flagText}>{flag}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.claimDetails}>
                <Text style={styles.claimAmount}>₹{claim.payout_amount}</Text>
                <Text style={styles.claimDate}>
                  {new Date(claim.created_at).toLocaleString()}
                </Text>
              </View>
              <View style={styles.claimActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleReviewClaim(claim.id, false)}
                >
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => handleReviewClaim(claim.id, true)}
                >
                  <Text style={styles.approveButtonText}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noPendingText}>🎉 No pending claims - All clear!</Text>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionTile}>
            <Text style={styles.actionTileIcon}>📊</Text>
            <Text style={styles.actionTileText}>Financial Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionTile}>
            <Text style={styles.actionTileIcon}>👥</Text>
            <Text style={styles.actionTileText}>Workers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionTile}>
            <Text style={styles.actionTileIcon}>⚡</Text>
            <Text style={styles.actionTileText}>Simulate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionTile}>
            <Text style={styles.actionTileIcon}>🗺️</Text>
            <Text style={styles.actionTileText}>Zones</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Hermetical Admin v1.0</Text>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
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
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  metricCardHighlight: {
    backgroundColor: '#e94560',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  metricValueHighlight: {
    color: '#ffffff',
  },
  metricLabel: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 4,
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
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  financialLabel: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  financialValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  claimCard: {
    paddingVertical: 12,
  },
  claimCardBorder: {
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
    marginTop: 12,
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  claimId: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  fraudScoreBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  fraudScoreText: {
    color: '#ffffff',
    fontSize: 12,
  },
  flagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  flagBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flagText: {
    color: '#ffffff',
    fontSize: 11,
  },
  claimDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  claimAmount: {
    color: '#4ade80',
    fontSize: 18,
    fontWeight: 'bold',
  },
  claimDate: {
    color: '#a0a0a0',
    fontSize: 12,
  },
  claimActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#dc2626',
  },
  rejectButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  approveButton: {
    backgroundColor: '#059669',
  },
  approveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  noPendingText: {
    color: '#4ade80',
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 16,
  },
  quickActions: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionTile: {
    width: '48%',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionTileIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTileText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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

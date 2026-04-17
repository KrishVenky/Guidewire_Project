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
  Modal,
} from 'react-native';
import { useAuthStore } from '../store';
import { Claim, Disruption, Policy, Worker, workerAPI, policyAPI } from '../api';

interface DashboardData {
  worker: Worker;
  policy: Policy | null;
  claims: Claim[];
  disruptions: Disruption[];
  earningsProtected: number;
}

export default function WorkerDashboardScreen({ navigation }: any) {
  const { workerId, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Payment modal
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'details' | 'processing' | 'success'>('details');
  const [premiumData, setPremiumData] = useState<any>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const fetchDashboard = async () => {
    if (!workerId) {
      setLoading(false);
      setRefreshing(false);
      setErrorMessage('No worker session was found. Please sign in again.');
      return;
    }

    try {
      const dashboardData = await workerAPI.getDashboard(workerId);
      setDashboard({
        worker: dashboardData.worker,
        policy: dashboardData.active_policy,
        claims: dashboardData.recent_claims || [],
        disruptions: dashboardData.active_disruptions || [],
        earningsProtected: dashboardData.earnings_protected || 0,
      });
      setErrorMessage(null);
    } catch (error: any) {
      console.error('Failed to fetch dashboard:', error);
      setErrorMessage(error.response?.data?.detail || 'Unable to load your dashboard right now.');
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

  const handleActivateCoverage = async () => {
    if (!workerId) return;
    try {
      const premium = await policyAPI.calculatePremium(workerId);
      setPremiumData(premium);
      setTermsAccepted(false);
      setPrivacyAccepted(false);
      setPaymentStep('details');
      setPaymentModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not load premium details');
    }
  };

  const handlePayNow = async () => {
    if (!workerId) return;
    setPaymentStep('processing');
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await policyAPI.create(workerId, true, true);
      setPaymentStep('success');
      await new Promise((r) => setTimeout(r, 1800));
      setPaymentModal(false);
      await fetchDashboard();
    } catch (error: any) {
      setPaymentModal(false);
      Alert.alert('Activation Failed', error.response?.data?.detail || 'Please try again');
    }
  };

  if (loading && !dashboard) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Dashboard unavailable</Text>
        <Text style={styles.errorText}>{errorMessage || 'Please try again in a moment.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchDashboard}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Namaste, {dashboard.worker.full_name || 'Rider'}</Text>
            <Text style={styles.subGreeting}>
              📍 {(dashboard.worker as any).zone_name || 'Bengaluru'} · {dashboard.worker.platform}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {dashboard.policy ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Policy</Text>
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
            <Text style={styles.cardTitle}>No Active Policy</Text>
            <Text style={styles.noPolicyText}>Get covered against income loss from disruptions</Text>
            <TouchableOpacity style={styles.activateButton} onPress={handleActivateCoverage}>
              <Text style={styles.activateButtonText}>Activate Coverage</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{dashboard.claims.length}</Text>
            <Text style={styles.statLabel}>Recent Claims</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₹{dashboard.earningsProtected || 0}</Text>
            <Text style={styles.statLabel}>Total Protected</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Claims</Text>
          {dashboard.claims.length > 0 ? (
            dashboard.claims.map((claim, index) => (
              <View key={claim.id} style={[styles.claimRow, index > 0 && styles.claimRowBorder]}>
                <View style={styles.claimInfo}>
                  <Text style={styles.claimStatus}>{claim.status}</Text>
                  <Text style={styles.claimDate}>{new Date(claim.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.claimAmount}>₹{claim.payout_amount || 0}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noClaimsText}>No claims yet</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active Disruptions in Your Zone</Text>
          {dashboard.disruptions.length > 0 ? (
            dashboard.disruptions.map((disruption) => (
              <View key={disruption.id} style={styles.disruptionBadge}>
                <Text style={styles.disruptionText}>
                  {disruption.event_type.replace(/_/g, ' ')} · Severity {disruption.severity_score}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noDisruptionsText}>No active disruptions. Keep riding.</Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Protected by Hermetical</Text>
        </View>
      </ScrollView>

      {/* Razorpay Payment Modal */}
      <Modal visible={paymentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {paymentStep === 'details' && (
              <>
                <View style={styles.razorpayHeader}>
                  <Text style={styles.razorpayLogo}>Razorpay</Text>
                  <Text style={styles.razorpayTagline}>Trusted Payments Infrastructure</Text>
                </View>
                <View style={styles.paymentDivider} />
                <Text style={styles.paymentTitle}>Activate Income Protection</Text>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Weekly Premium</Text>
                  <Text style={styles.paymentAmount}>₹{premiumData?.weekly_premium?.toFixed(2) || '—'}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Coverage Amount</Text>
                  <Text style={styles.paymentCoverage}>₹{premiumData?.coverage_amount?.toFixed(0) || '—'}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Pay via</Text>
                  <Text style={styles.paymentUpi}>UPI · {dashboard.worker.upi_id}</Text>
                </View>

                <TouchableOpacity style={styles.consentRow} onPress={() => setTermsAccepted(!termsAccepted)}>
                  <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                    {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.consentText}>I accept the <Text style={styles.consentLink}>Terms & Conditions</Text></Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.consentRow} onPress={() => setPrivacyAccepted(!privacyAccepted)}>
                  <View style={[styles.checkbox, privacyAccepted && styles.checkboxChecked]}>
                    {privacyAccepted && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.consentText}>I consent to <Text style={styles.consentLink}>Data Processing (DPDP Act 2023)</Text></Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.payButton, (!termsAccepted || !privacyAccepted) && styles.payButtonDisabled]}
                  onPress={handlePayNow}
                  disabled={!termsAccepted || !privacyAccepted}
                >
                  <Text style={styles.payButtonText}>Pay ₹{premiumData?.weekly_premium?.toFixed(2)} via UPI</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => { setPaymentModal(false); setTermsAccepted(false); setPrivacyAccepted(false); }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {paymentStep === 'processing' && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#3395FF" />
                <Text style={styles.processingTitle}>Processing Payment</Text>
                <Text style={styles.processingSubtitle}>Connecting to your UPI app...</Text>
                <Text style={styles.razorpayLogo}>Razorpay</Text>
              </View>
            )}

            {paymentStep === 'success' && (
              <View style={styles.processingContainer}>
                <Text style={styles.successIcon}>✅</Text>
                <Text style={styles.processingTitle}>Payment Successful!</Text>
                <Text style={styles.processingSubtitle}>Coverage is now active. You're protected.</Text>
                <Text style={styles.successAmount}>₹{premiumData?.weekly_premium?.toFixed(2)} paid via UPI</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 24 },
  loadingText: { color: '#a0a0a0', marginTop: 16, textAlign: 'center' },
  errorTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  errorText: { color: '#a0a0a0', fontSize: 14, marginTop: 12, textAlign: 'center', maxWidth: 320 },
  retryButton: { marginTop: 20, backgroundColor: '#e94560', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  retryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  header: { padding: 20, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' },
  subGreeting: { fontSize: 13, color: '#a0a0a0', marginTop: 4 },
  logoutButton: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#16213e', borderRadius: 8 },
  logoutButtonText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: '#16213e', margin: 16, marginTop: 8, borderRadius: 16, padding: 20 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 16 },
  policyDetails: { gap: 12 },
  policyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  policyLabel: { color: '#a0a0a0', fontSize: 14 },
  policyValue: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  policyValueHighlight: { color: '#4ade80', fontSize: 18, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusActive: { backgroundColor: '#065f46' },
  statusText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  noPolicyText: { color: '#a0a0a0', fontSize: 14, marginBottom: 16 },
  activateButton: { backgroundColor: '#e94560', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  activateButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  statsContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#16213e', borderRadius: 12, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#e94560', textAlign: 'center' },
  statLabel: { color: '#a0a0a0', fontSize: 12, marginTop: 4 },
  claimRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  claimRowBorder: { borderTopWidth: 1, borderTopColor: '#0f3460' },
  claimInfo: { gap: 4 },
  claimStatus: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  claimDate: { color: '#a0a0a0', fontSize: 12 },
  claimAmount: { color: '#4ade80', fontSize: 16, fontWeight: 'bold' },
  noClaimsText: { color: '#a0a0a0', textAlign: 'center', paddingVertical: 20 },
  disruptionBadge: { backgroundColor: '#dc2626', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 8 },
  disruptionText: { color: '#ffffff', fontSize: 14 },
  noDisruptionsText: { color: '#4ade80', textAlign: 'center', paddingVertical: 20, fontSize: 16 },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { color: '#666666', fontSize: 12 },
  // Payment modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  razorpayHeader: { alignItems: 'center', marginBottom: 4 },
  razorpayLogo: { fontSize: 22, fontWeight: 'bold', color: '#3395FF', letterSpacing: -0.5 },
  razorpayTagline: { fontSize: 11, color: '#888', marginTop: 2 },
  paymentDivider: { height: 1, backgroundColor: '#eee', marginVertical: 16 },
  paymentTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 16 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  paymentLabel: { color: '#555', fontSize: 14 },
  paymentAmount: { color: '#111', fontSize: 18, fontWeight: '700' },
  paymentCoverage: { color: '#059669', fontSize: 16, fontWeight: '700' },
  paymentUpi: { color: '#3395FF', fontSize: 14, fontWeight: '600' },
  consentRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#3395FF', borderColor: '#3395FF' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  consentText: { flex: 1, fontSize: 12, color: '#555' },
  consentLink: { color: '#3395FF', fontWeight: '600' },
  payButton: { backgroundColor: '#3395FF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  payButtonDisabled: { backgroundColor: '#aac8ef' },
  payButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelButton: { alignItems: 'center', marginTop: 12 },
  cancelButtonText: { color: '#888', fontSize: 14 },
  processingContainer: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  processingTitle: { fontSize: 20, fontWeight: '700', color: '#111' },
  processingSubtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  successIcon: { fontSize: 56 },
  successAmount: { fontSize: 14, color: '#059669', fontWeight: '600' },
});

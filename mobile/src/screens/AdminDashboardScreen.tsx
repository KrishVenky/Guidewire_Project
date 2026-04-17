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
  Switch,
} from 'react-native';
import { useAuthStore } from '../store';
import { adminAPI } from '../api';
import api from '../api/config';

export default function AdminDashboardScreen({ navigation }: any) {
  const { logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal states
  const [activeModal, setActiveModal] = useState<'financial' | 'workers' | 'simulate' | 'zones' | null>(null);
  const [financialData, setFinancialData] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Simulate form
  const [simZoneId, setSimZoneId] = useState('');
  const [simEventType, setSimEventType] = useState('HEAVY_RAIN');
  const [simRawValue, setSimRawValue] = useState(75.0);
  const [simForceT2, setSimForceT2] = useState(true);
  const [simResult, setSimResult] = useState<any>(null);

  const EVENT_TYPES = ['HEAVY_RAIN', 'EXTREME_HEAT', 'HIGH_AQI', 'NDMA_ALERT', 'BANDH'];

  const fetchDashboard = async () => {
    try {
      const [dashboardData, claimsData] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getPendingClaims(),
      ]);
      setDashboard(dashboardData);
      setPendingClaims(claimsData);
      setErrorMessage(null);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.detail || 'Unable to load the admin dashboard right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchDashboard(); };

  const openModal = async (modal: typeof activeModal) => {
    setActiveModal(modal);
    setModalLoading(true);
    setSimResult(null);
    try {
      if (modal === 'financial') {
        const data = await adminAPI.getFinancialSummary();
        setFinancialData(data);
      } else if (modal === 'workers') {
        const data = await adminAPI.getWorkers();
        setWorkers(data);
      } else if (modal === 'simulate' || modal === 'zones') {
        const res = await api.get('/api/admin/zones');
        setZones(res.data);
        if (modal === 'simulate' && res.data.length > 0) setSimZoneId(res.data[0].id);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to load data');
    } finally {
      setModalLoading(false);
    }
  };

  const handleSimulate = async () => {
    setModalLoading(true);
    setSimResult(null);
    try {
      const res = await api.post('/api/disruptions/simulate', {
        zone_id: simZoneId,
        event_type: simEventType,
        raw_value: simRawValue,
        force_t2: simForceT2,
        idempotency_key: `mobile-${Date.now()}`,
      });
      setSimResult(res.data);
    } catch (e: any) {
      Alert.alert('Simulation Failed', e.response?.data?.detail || 'Error running simulation');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleBandh = async (zoneId: string, currentlyActive: boolean) => {
    try {
      await api.post('/api/disruptions/bandh/toggle', { zone_id: zoneId, active: !currentlyActive });
      const res = await api.get('/api/admin/zones');
      setZones(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to toggle bandh');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => { await logout(); navigation.replace('Home'); },
      },
    ]);
  };

  const handleReviewClaim = (claimId: string, approved: boolean) => {
    Alert.alert('Review Claim', `${approved ? 'Approve' : 'Reject'} this claim?`, [
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
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.loadingText}>Loading admin dashboard...</Text>
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Admin dashboard unavailable</Text>
        <Text style={styles.errorText}>{errorMessage || 'Please try again in a moment.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchDashboard}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const lossRatioPct = ((dashboard.loss_ratio || 0) * 100).toFixed(1);

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>Hermetical Insurance Platform</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{dashboard.total_active_policies || 0}</Text>
            <Text style={styles.metricLabel}>Active Policies</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{dashboard.total_workers || 0}</Text>
            <Text style={styles.metricLabel}>Total Workers</Text>
          </View>
        </View>

        <View style={styles.metricsContainer}>
          <View style={[styles.metricCard, pendingClaims.length > 0 && styles.metricCardHighlight]}>
            <Text style={styles.metricValue}>{dashboard.pending_review_count || 0}</Text>
            <Text style={styles.metricLabel}>Pending Review</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{lossRatioPct}%</Text>
            <Text style={styles.metricLabel}>Loss Ratio</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>This Week</Text>
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Total Payouts</Text>
            <Text style={styles.financialValue}>₹{dashboard.total_payouts_this_week || 0}</Text>
          </View>
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Total Claims</Text>
            <Text style={styles.financialValue}>{dashboard.total_claims_this_week || 0}</Text>
          </View>
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Disruptions</Text>
            <Text style={styles.financialValue}>{dashboard.disruptions_this_week || 0}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pending Claims Review</Text>
          {pendingClaims.length > 0 ? (
            pendingClaims.map((claim: any, index: number) => (
              <View key={claim.id} style={[styles.claimCard, index > 0 && styles.claimCardBorder]}>
                <View style={styles.claimHeader}>
                  <Text style={styles.claimId}>Claim #{claim.id.slice(0, 8)}</Text>
                  <View style={styles.fraudScoreBadge}>
                    <Text style={styles.fraudScoreText}>Fraud: {claim.fraud_score}</Text>
                  </View>
                </View>
                {claim.fraud_flags?.length > 0 && (
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
                  <Text style={styles.claimDate}>{new Date(claim.created_at).toLocaleString()}</Text>
                </View>
                <View style={styles.claimActions}>
                  <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => handleReviewClaim(claim.id, false)}>
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => handleReviewClaim(claim.id, true)}>
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noPendingText}>No pending claims. All clear.</Text>
          )}
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionTile} onPress={() => openModal('financial')}>
              <Text style={styles.actionTileIcon}>📊</Text>
              <Text style={styles.actionTileText}>Financial Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionTile} onPress={() => openModal('workers')}>
              <Text style={styles.actionTileIcon}>👷</Text>
              <Text style={styles.actionTileText}>Workers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionTile} onPress={() => openModal('simulate')}>
              <Text style={styles.actionTileIcon}>⚡</Text>
              <Text style={styles.actionTileText}>Simulate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionTile} onPress={() => openModal('zones')}>
              <Text style={styles.actionTileIcon}>🗺️</Text>
              <Text style={styles.actionTileText}>Zones</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Hermetical Admin v1.0</Text>
        </View>
      </ScrollView>

      {/* ── FINANCIAL REPORT MODAL ── */}
      <Modal visible={activeModal === 'financial'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📊 Financial Report</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {modalLoading ? (
              <ActivityIndicator color="#e94560" style={{ marginTop: 32 }} />
            ) : financialData ? (
              <ScrollView>
                {[
                  ['Total Premiums Collected', `₹${financialData.total_premiums_collected ?? 0}`],
                  ['Total Payouts Disbursed', `₹${financialData.total_payouts_disbursed ?? 0}`],
                  ['Loss Ratio', `${((financialData.loss_ratio ?? 0) * 100).toFixed(1)}%`],
                  ['Active Policies', financialData.active_policies ?? 0],
                  ['Payouts This Week', `₹${financialData.payouts_this_week ?? 0}`],
                  ['Premiums This Week', `₹${financialData.premiums_this_week ?? 0}`],
                ].map(([label, value]) => (
                  <View key={String(label)} style={styles.financialRow}>
                    <Text style={styles.financialLabel}>{label}</Text>
                    <Text style={styles.financialValue}>{value}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ── WORKERS MODAL ── */}
      <Modal visible={activeModal === 'workers'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>👷 Workers ({workers.length})</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {modalLoading ? (
              <ActivityIndicator color="#e94560" style={{ marginTop: 32 }} />
            ) : (
              <ScrollView>
                {workers.map((w: any) => (
                  <View key={w.id} style={styles.workerRow}>
                    <View>
                      <Text style={styles.workerName}>{w.full_name}</Text>
                      <Text style={styles.workerMeta}>{w.platform} · {w.phone}</Text>
                    </View>
                    <View style={[styles.tierBadge, { backgroundColor: w.trust_tier === 'TRUSTED_PARTNER' ? '#059669' : w.trust_tier === 'RISING_PARTNER' ? '#d97706' : '#6b7280' }]}>
                      <Text style={styles.tierText}>{w.trust_tier?.replace('_PARTNER', '') ?? '-'}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── SIMULATE MODAL ── */}
      <Modal visible={activeModal === 'simulate'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚡ Simulate Disruption</Text>
              <TouchableOpacity onPress={() => { setActiveModal(null); setSimResult(null); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {simResult ? (
                <View>
                  <Text style={[styles.simResultTitle, { color: simResult.dual_trigger_fired ? '#4ade80' : '#f59e0b' }]}>
                    {simResult.dual_trigger_fired ? '✅ Dual Trigger Fired!' : '⚠️ Trigger Incomplete'}
                  </Text>
                  <Text style={styles.simResultLine}>T1 (External): {simResult.t1_confirmed ? '✅' : '❌'}</Text>
                  <Text style={styles.simResultLine}>T2 (Order Drop): {simResult.t2_confirmed ? '✅' : '❌'}</Text>
                  <Text style={styles.simResultLine}>Claims Created: {simResult.claims_created ?? 0}</Text>
                  <Text style={styles.simResultLine}>Severity: {simResult.severity_score?.toFixed(1)}</Text>
                  <TouchableOpacity style={[styles.submitButton, { marginTop: 16 }]} onPress={() => setSimResult(null)}>
                    <Text style={styles.submitButtonText}>Run Another</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.simLabel}>Zone</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {zones.map((z: any) => (
                      <TouchableOpacity
                        key={z.id}
                        style={[styles.chipButton, simZoneId === z.id && styles.chipButtonActive]}
                        onPress={() => setSimZoneId(z.id)}
                      >
                        <Text style={[styles.chipText, simZoneId === z.id && styles.chipTextActive]}>{z.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.simLabel}>Event Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {EVENT_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.chipButton, simEventType === t && styles.chipButtonActive]}
                        onPress={() => setSimEventType(t)}
                      >
                        <Text style={[styles.chipText, simEventType === t && styles.chipTextActive]}>{t.replace('_', ' ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.simLabel}>Raw Value: {simRawValue}</Text>
                  <View style={styles.sliderRow}>
                    {[25, 50, 72.5, 85, 100].map((v) => (
                      <TouchableOpacity key={v} style={[styles.chipButton, simRawValue === v && styles.chipButtonActive]} onPress={() => setSimRawValue(v)}>
                        <Text style={[styles.chipText, simRawValue === v && styles.chipTextActive]}>{v}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.switchRow}>
                    <Text style={styles.simLabel}>Force T2 (Order Drop)</Text>
                    <Switch value={simForceT2} onValueChange={setSimForceT2} trackColor={{ true: '#e94560' }} />
                  </View>

                  <TouchableOpacity
                    style={[styles.submitButton, modalLoading && { opacity: 0.6 }]}
                    onPress={handleSimulate}
                    disabled={modalLoading || !simZoneId}
                  >
                    {modalLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>⚡ Fire Disruption</Text>}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── ZONES MODAL ── */}
      <Modal visible={activeModal === 'zones'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🗺️ Zone Controls</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {modalLoading ? (
              <ActivityIndicator color="#e94560" style={{ marginTop: 32 }} />
            ) : (
              <ScrollView>
                {zones.map((z: any) => (
                  <View key={z.id} style={styles.zoneRow}>
                    <View>
                      <Text style={styles.zoneName}>{z.name}</Text>
                      <Text style={styles.zoneCity}>{z.city} · {z.active_policies ?? 0} policies</Text>
                    </View>
                    <View style={styles.bandhControl}>
                      <Text style={[styles.bandhLabel, { color: z.bandh_active ? '#e94560' : '#6b7280' }]}>
                        {z.bandh_active ? 'BANDH ON' : 'Bandh Off'}
                      </Text>
                      <Switch
                        value={!!z.bandh_active}
                        onValueChange={() => handleToggleBandh(z.id, !!z.bandh_active)}
                        trackColor={{ true: '#e94560', false: '#374151' }}
                      />
                    </View>
                  </View>
                ))}
              </ScrollView>
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
  title: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' },
  subtitle: { fontSize: 14, color: '#a0a0a0', marginTop: 4 },
  logoutButton: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#16213e', borderRadius: 8 },
  logoutButtonText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
  metricsContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  metricCard: { flex: 1, backgroundColor: '#16213e', borderRadius: 12, padding: 16, alignItems: 'center' },
  metricCardHighlight: { backgroundColor: '#e94560' },
  metricValue: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' },
  metricLabel: { color: '#a0a0a0', fontSize: 12, marginTop: 4 },
  card: { backgroundColor: '#16213e', margin: 16, marginTop: 8, borderRadius: 16, padding: 20 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 16 },
  financialRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  financialLabel: { color: '#a0a0a0', fontSize: 14 },
  financialValue: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  claimCard: { paddingVertical: 12 },
  claimCardBorder: { borderTopWidth: 1, borderTopColor: '#0f3460', marginTop: 12 },
  claimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  claimId: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  fraudScoreBadge: { backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  fraudScoreText: { color: '#ffffff', fontSize: 12 },
  flagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  flagBadge: { backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  flagText: { color: '#ffffff', fontSize: 11 },
  claimDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  claimAmount: { color: '#4ade80', fontSize: 18, fontWeight: 'bold' },
  claimDate: { color: '#a0a0a0', fontSize: 12 },
  claimActions: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  rejectButton: { backgroundColor: '#dc2626' },
  rejectButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  approveButton: { backgroundColor: '#059669' },
  approveButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  noPendingText: { color: '#4ade80', textAlign: 'center', paddingVertical: 20, fontSize: 16 },
  quickActions: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionTile: { width: '47%', backgroundColor: '#16213e', borderRadius: 12, padding: 20, alignItems: 'center' },
  actionTileIcon: { fontSize: 28, marginBottom: 8 },
  actionTileText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { color: '#666666', fontSize: 12 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#16213e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  modalClose: { color: '#a0a0a0', fontSize: 22, fontWeight: '700' },
  workerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  workerName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  workerMeta: { color: '#a0a0a0', fontSize: 12, marginTop: 2 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tierText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  zoneRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  zoneName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  zoneCity: { color: '#a0a0a0', fontSize: 12, marginTop: 2 },
  bandhControl: { alignItems: 'flex-end', gap: 4 },
  bandhLabel: { fontSize: 11, fontWeight: '700' },
  simLabel: { color: '#a0a0a0', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chipButton: { borderWidth: 1, borderColor: '#0f3460', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: '#1a1a2e' },
  chipButtonActive: { backgroundColor: '#e94560', borderColor: '#e94560' },
  chipText: { color: '#a0a0a0', fontSize: 13 },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },
  sliderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  submitButton: { backgroundColor: '#e94560', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  simResultTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  simResultLine: { color: '#ffffff', fontSize: 15, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
});

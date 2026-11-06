import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { ComplaintReport, isSummonReport } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import Card from '../../src/components/Card';
import { printMonthlyReport, MonthlyReportData } from '../../src/utils/printReport';
import { stickyHeader } from '../../src/utils/ui';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};


function parseMonthYear(date: string): { mon: string; year: string } | null {
  const m = date.match(/^([A-Za-z]+)\s+\d+,\s*(\d{4})/);
  if (!m) return null;
  return { mon: m[1], year: m[2] };
}

export default function AnalyticsScreen() {
  const { reports, announcements, accounts } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [nameSearch, setNameSearch] = useState('');

  const personRecords = useMemo(() => {
    const query = nameSearch.trim().toLocaleLowerCase();
    if (!query) return [];

    return reports.flatMap((report) => {
      const isComplainant = report.reportedBy.toLocaleLowerCase().includes(query);
      const summonedPeople = report.summonedPersons?.length
        ? report.summonedPersons.map((person) => person.name)
        : report.summonedPersonName
          ? [report.summonedPersonName]
          : [];
      const matchingSummonedPeople = summonedPeople.filter((name) => name.toLocaleLowerCase().includes(query));
      if (!isComplainant && matchingSummonedPeople.length === 0) return [];

      return [{
        report,
        isComplainant,
        matchingSummonedPeople,
      }];
    });
  }, [reports, nameSearch]);

  // ── Build list of available "Mon Year" periods from report dates ──
  const periods = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      const py = parseMonthYear(r.date);
      if (py) set.add(`${py.mon} ${py.year}`);
    });
    // Sort by year then month order
    return Array.from(set).sort((a, b) => {
      const [ma, ya] = a.split(' ');
      const [mb, yb] = b.split(' ');
      if (ya !== yb) return Number(yb) - Number(ya);
      return MONTH_NAMES.indexOf(mb) - MONTH_NAMES.indexOf(ma);
    });
  }, [reports]);

  // Selected period: 'all' or a "Mon Year" string
  const [period, setPeriod] = useState<string>('all');

  // ── Filter reports by selected period ──
  const scopedReports = useMemo(() => {
    if (period === 'all') return reports;
    return reports.filter((r) => {
      const py = parseMonthYear(r.date);
      return py && `${py.mon} ${py.year}` === period;
    });
  }, [reports, period]);

  const complaintReports = useMemo(
    () => scopedReports.filter((report) => !isSummonReport(report)),
    [scopedReports],
  );
  const summonReports = useMemo(
    () => scopedReports.filter(isSummonReport),
    [scopedReports],
  );

  // ── Stats (scoped) ──
  const pending = scopedReports.filter((r) => r.status === 'Pending').length;
  const investigating = scopedReports.filter((r) => r.status === 'Investigating').length;
  const resolved = scopedReports.filter((r) => r.status === 'Resolved').length;
  const rejected = scopedReports.filter((r) => r.status === 'Rejected').length;
  const total = scopedReports.length;
  const summons = scopedReports.filter((r) => r.priority === 'Summon' || !!r.summonedPersonName).length;
  const pendingAccounts = accounts.filter((a) => a.status === 'Pending').length;

  const categoryCounts: Record<string, number> = {};
  scopedReports.forEach((r) => { categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1; });
  const categoryEntries = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const topCategory = categoryEntries[0]?.[0] || '—';
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Monthly complaint trend uses database reports, independent of the period filter.
  const monthlyCounts: Record<string, number> = {};
  reports.forEach((r) => {
    const reportedAt = new Date(r.date.split(' • ')[0]);
    if (Number.isNaN(reportedAt.getTime())) return;
    const key = `${reportedAt.getFullYear()}-${reportedAt.getMonth()}`;
    monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
  });
  const currentMonth = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    return {
      key,
      month: date.toLocaleString('en-US', { month: 'short' }),
      value: monthlyCounts[key] || 0,
    };
  });
  const maxMonthVal = Math.max(...monthlyData.map((d) => d.value), 1);

  const periodLabel = period === 'all' ? 'All Time' : `${MONTH_FULL[period.split(' ')[0]]} ${period.split(' ')[1]}`;

  // ── Print handler ──
  const handlePrint = () => {
    const data: MonthlyReportData = {
      month: periodLabel,
      generatedAt: new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      }),
      total,
      pending,
      investigating,
      resolved,
      rejected,
      summons,
      resolutionRate,
      categories: categoryEntries.map(([name, count]) => ({ name, count })),
      registeredResidents: accounts.length,
      pendingApprovals: pendingAccounts,
      publishedBulletins: announcements.length,
      rows: scopedReports.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        status: r.status,
        priority: r.priority,
        reportedBy: r.reportedBy,
        assignee: r.assignee,
        date: r.date,
      })),
    };
    printMonthlyReport(data);
  };

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      <View
        className="bg-white dark:bg-surface-dark px-4 pb-3 border-b border-border dark:border-border-dark gap-2.5"
        style={[stickyHeader, { paddingTop: insets.top + 12 }]}
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-xl font-black text-ink dark:text-ink-dark">Analytics</Text>
            <Text className="text-xs text-muted dark:text-muted-dark mt-0.5">Live statistics from Barangay Bangbang civic data</Text>
          </View>
          {Platform.OS === 'web' && (
            <TouchableOpacity
              className="flex-row items-center gap-1.5 bg-primary rounded-lg px-3 py-2"
              onPress={handlePrint}
              activeOpacity={0.85}
            >
              <Ionicons name="print-outline" size={16} color={Colors.white} />
              <Text className="text-xs font-bold text-white">Print Report</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Period selector */}
        <View>
          <Text className="text-[11px] font-bold text-muted dark:text-muted-dark uppercase tracking-wide mb-1.5">Reporting Period</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity
              className={`px-3 py-1.5 rounded-2xl border ${period === 'all' ? 'bg-primary border-primary' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'}`}
              onPress={() => setPeriod('all')}
            >
              <Text className={`text-xs font-semibold ${period === 'all' ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>All Time</Text>
            </TouchableOpacity>
            {periods.map((p) => {
              const active = period === p;
              return (
                <TouchableOpacity
                  key={p}
                  className={`px-3 py-1.5 rounded-2xl border ${active ? 'bg-primary border-primary' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'}`}
                  onPress={() => setPeriod(p)}
                >
                  <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        {/* Period banner */}
        <View className="flex-row items-center gap-2 bg-blue-light rounded-[10px] border border-[#bfdbfe] px-3 py-2.5 mb-4">
          <Ionicons name="calendar-outline" size={15} color={Colors.blue} />
          <Text className="text-[13px] text-blue font-semibold">Showing: {periodLabel}</Text>
        </View>


        {/* KPI Cards */}
        <View className="flex-row flex-wrap gap-2.5 mb-4">
          <KpiCard label="Total Reports" value={total} icon="document-text-outline" color={Colors.blue} bg={Colors.blueLight} />
          <KpiCard label="Pending" value={pending} icon="time-outline" color={Colors.amber} bg={Colors.amberLight} />
          <KpiCard label="Under Investigation" value={investigating} icon="search-outline" color={Colors.purple} bg={Colors.purpleLight} />
          <KpiCard label="Resolved" value={resolved} icon="checkmark-circle-outline" color={Colors.green} bg={Colors.greenLight} />
          <KpiCard label="Rejected" value={rejected} icon="close-circle-outline" color={Colors.red} bg={Colors.redLight} />
          <KpiCard label="Summon Cases" value={summons} icon="hammer-outline" color={Colors.purple} bg={Colors.purpleLight} />
        </View>

        {/* Resolution Rate */}
        <Card style={{ marginBottom: 16 }}>
          <Text className="text-sm font-extrabold text-ink dark:text-ink-dark mb-3.5">Resolution Rate</Text>
          <View className="flex-row items-center gap-3 mb-1.5">
            <Text className="text-[32px] font-black text-primary w-[70px]">{resolutionRate}%</Text>
            <View className="flex-1 h-3 bg-gray-light dark:bg-surface-dark-2 rounded-md overflow-hidden">
              <View className="h-full bg-primary rounded-md" style={{ width: `${resolutionRate}%` }} />
            </View>
          </View>
          <Text className="text-xs text-muted dark:text-muted-dark">{resolved} resolved out of {total} total complaints</Text>
        </Card>

        {/* Monthly Trend */}
        <Card style={{ marginBottom: 16 }}>
          <Text className="text-sm font-extrabold text-ink dark:text-ink-dark mb-3.5">Monthly Complaint Trend (Last 6 Months)</Text>
          {monthlyData.length === 0 ? (
            <Text className="text-[13px] text-muted dark:text-muted-dark">No data yet.</Text>
          ) : (
            <View className="flex-row items-end h-[100px] gap-1.5">
              {monthlyData.map((d) => (
                <View key={d.key} className="flex-1 items-center gap-1">
                  <Text className="text-[9px] font-bold text-muted dark:text-muted-dark">{d.value}</Text>
                  <View className="w-[80%] h-[70px] justify-end bg-gray-light dark:bg-surface-dark-2 rounded overflow-hidden">
                    <View className="w-full bg-primary rounded" style={{ height: `${(d.value / maxMonthVal) * 100}%` }} />
                  </View>
                  <Text className="text-[9px] text-muted dark:text-muted-dark font-semibold">{d.month}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Category Breakdown */}
        <Card style={{ marginBottom: 16 }}>
          <Text className="text-sm font-extrabold text-ink dark:text-ink-dark mb-3.5">Complaints by Category</Text>
          {categoryEntries.length === 0 ? (
            <Text className="text-[13px] text-muted dark:text-muted-dark">No complaints in this period.</Text>
          ) : (
            categoryEntries.map(([cat, count]) => (
              <View key={cat} className="flex-row items-center gap-2.5 mb-2.5">
                <Text className="text-xs text-ink dark:text-ink-dark font-semibold w-[130px]" numberOfLines={1}>{cat}</Text>
                <View className="flex-1 h-2 bg-gray-light dark:bg-surface-dark-2 rounded overflow-hidden">
                  <View className="h-full bg-blue rounded" style={{ width: `${(count / total) * 100}%` }} />
                </View>
                <Text className="text-xs font-extrabold text-ink dark:text-ink-dark w-6 text-right">{count}</Text>
              </View>
            ))
          )}
        </Card>

        {/* Summary Stats */}
        <Card style={{ marginBottom: 16 }}>
          <Text className="text-sm font-extrabold text-ink dark:text-ink-dark mb-3.5">Quick Stats</Text>
          <SummaryRow icon="star-outline" label="Top Incident Type" value={topCategory} />
          <SummaryRow icon="megaphone-outline" label="Published Bulletins" value={`${announcements.length}`} />
          <SummaryRow icon="people-outline" label="Registered Residents" value={`${accounts.length}`} />
          <SummaryRow icon="hourglass-outline" label="Pending Approvals" value={`${pendingAccounts}`} />
          <SummaryRow icon="trending-up-outline" label="Resolution Rate" value={`${resolutionRate}%`} />
        </Card>

        {/* Print button (also at bottom for convenience on web) */}
        {Platform.OS === 'web' && (
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 bg-primary rounded-xl py-3.5 mb-2"
            onPress={handlePrint}
            activeOpacity={0.85}
          >
            <Ionicons name="print-outline" size={18} color={Colors.white} />
            <Text className="text-[15px] font-bold text-white">Print / Save {periodLabel} Report</Text>
          </TouchableOpacity>
        )}

        <Card style={{ marginBottom: 16 }}>
          <Text className="text-sm font-extrabold text-ink dark:text-ink-dark mb-1">Search Person Records</Text>
          <Text className="text-xs text-muted dark:text-muted-dark mb-3">
            Find complaints filed by a person and summon cases where they are named.
          </Text>
          <View className="flex-row items-center gap-2 bg-gray-light dark:bg-surface-dark-2 rounded-[10px] border border-border dark:border-border-dark px-3 h-[42px]">
            <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
            <TextInput
              className="flex-1 text-sm text-ink dark:text-ink-dark"
              placeholder="Search by person name…"
              placeholderTextColor={Colors.textMuted}
              value={nameSearch}
              onChangeText={setNameSearch}
              autoCapitalize="words"
              accessibilityLabel="Search complaints and summons by person name"
            />
            {nameSearch ? (
              <TouchableOpacity onPress={() => setNameSearch('')} accessibilityLabel="Clear person search">
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          {nameSearch.trim() ? (
            <View className="mt-3">
              <Text className="text-xs font-semibold text-muted dark:text-muted-dark mb-2">
                {personRecords.length} matching {personRecords.length === 1 ? 'record' : 'records'}
              </Text>
              {personRecords.length === 0 ? (
                <Text className="text-[13px] text-muted dark:text-muted-dark py-2">
                  No complaint or summons records found for “{nameSearch.trim()}”.
                </Text>
              ) : (
                personRecords.map(({ report, isComplainant, matchingSummonedPeople }) => (
                  <PersonRecordCard
                    key={report.id}
                    report={report}
                    isComplainant={isComplainant}
                    matchingSummonedPeople={matchingSummonedPeople}
                    onPress={() => router.push({ pathname: '/(admin)/complaint-review', params: { reportId: report.id } })}
                  />
                ))
              )}
            </View>
          ) : null}
        </Card>

        <CategoryReportTable
          title="Complaint Records"
          reports={complaintReports}
          emptyMessage="No complaints found for this category and period."
          onSelectReport={(reportId) => router.push({ pathname: '/(admin)/complaint-review', params: { reportId } })}
        />
        <CategoryReportTable
          title="Summon Records"
          reports={summonReports}
          emptyMessage="No summons found for this category and period."
          onSelectReport={(reportId) => router.push({ pathname: '/(admin)/complaint-review', params: { reportId } })}
        />
      </ScrollView>
    </View>
  );
}

function CategoryReportTable({
  title,
  reports,
  emptyMessage,
  onSelectReport,
}: {
  title: string;
  reports: ComplaintReport[];
  emptyMessage: string;
  onSelectReport: (reportId: string) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState('All categories');
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const categories = useMemo(
    () => Array.from(new Set(reports.map((report) => report.category))).sort((a, b) => a.localeCompare(b)),
    [reports],
  );
  const filteredReports = selectedCategory === 'All categories'
    ? reports
    : reports.filter((report) => report.category === selectedCategory);
  const categoryOptions = [
    'All categories',
    ...categories,
    ...(selectedCategory !== 'All categories' && !categories.some((category) => category === selectedCategory) ? [selectedCategory] : []),
  ];
  const isSummonTable = title === 'Summon Records';

  return (
    <Card style={{ marginBottom: 16 }}>
      <View className="flex-row items-center justify-between gap-2 mb-3">
        <View className="flex-1">
          <Text className="text-sm font-extrabold text-ink dark:text-ink-dark">{title}</Text>
          <Text className="text-xs text-muted dark:text-muted-dark mt-0.5">
            {filteredReports.length} {filteredReports.length === 1 ? 'record' : 'records'}
          </Text>
        </View>
        <TouchableOpacity
          className="min-w-[155px] flex-row items-center justify-between gap-2 rounded-lg border border-border dark:border-border-dark bg-gray-light dark:bg-surface-dark-2 px-3 py-2"
          onPress={() => setCategoryPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`${title} category filter: ${selectedCategory}`}
        >
          <View className="flex-1">
            <Text className="text-[9px] font-bold uppercase text-muted dark:text-muted-dark">Category</Text>
            <Text className="text-xs font-semibold text-ink dark:text-ink-dark" numberOfLines={1}>{selectedCategory}</Text>
          </View>
          <Ionicons name="chevron-down" size={15} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {filteredReports.length === 0 ? (
        <Text className="py-4 text-center text-[13px] text-muted dark:text-muted-dark">{emptyMessage}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View className="flex-row bg-gray-light dark:bg-surface-dark-2 rounded-t-lg">
              <TableHeaderCell label="Case" width={95} />
              <TableHeaderCell label="Title" width={190} />
              <TableHeaderCell label="Category" width={155} />
              <TableHeaderCell label="Complainant" width={145} />
              {isSummonTable ? <TableHeaderCell label="Summoned Person" width={150} /> : null}
              <TableHeaderCell label="Status" width={115} />
              <TableHeaderCell label={isSummonTable ? 'Summon Stage' : 'Date'} width={145} />
              {isSummonTable ? <TableHeaderCell label="Date" width={145} /> : null}
            </View>
            {filteredReports.map((report) => {
              const summonedNames = report.summonedPersons?.length
                ? report.summonedPersons.map((person) => person.name).join(', ')
                : report.summonedPersonName || '—';
              return (
                <TouchableOpacity
                  key={report.id}
                  className="flex-row border-b border-border dark:border-border-dark"
                  onPress={() => onSelectReport(report.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${report.title}, ${report.id}`}
                >
                  <TableBodyCell text={report.id} width={95} bold />
                  <TableBodyCell text={report.title} width={190} />
                  <TableBodyCell text={report.category} width={155} />
                  <TableBodyCell text={report.reportedBy} width={145} />
                  {isSummonTable ? <TableBodyCell text={summonedNames} width={150} /> : null}
                  <TableBodyCell text={report.status} width={115} />
                  <TableBodyCell text={isSummonTable ? report.summonNoticeStage || '—' : report.date} width={145} />
                  {isSummonTable ? <TableBodyCell text={report.date} width={145} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={categoryPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="max-h-[70%] rounded-t-[20px] bg-white dark:bg-surface-dark p-5 pb-8">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-extrabold text-ink dark:text-ink-dark">Filter by Category</Text>
              <TouchableOpacity onPress={() => setCategoryPickerVisible(false)} accessibilityLabel="Close category filter">
                <Ionicons name="close" size={23} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {categoryOptions.map((category) => {
                const active = selectedCategory === category;
                return (
                  <TouchableOpacity
                    key={category}
                    className={`flex-row items-center justify-between border-b border-border dark:border-border-dark py-3 ${active ? 'bg-blue-light' : ''}`}
                    onPress={() => {
                      setSelectedCategory(category);
                      setCategoryPickerVisible(false);
                    }}
                  >
                    <Text className={`text-sm ${active ? 'font-bold text-blue' : 'text-ink dark:text-ink-dark'}`}>
                      {category}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={18} color={Colors.blue} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

function TableHeaderCell({ label, width }: { label: string; width: number }) {
  return (
    <View className="justify-center px-2.5 py-2.5" style={{ width }}>
      <Text className="text-[10px] font-extrabold uppercase text-muted dark:text-muted-dark" numberOfLines={1}>{label}</Text>
    </View>
  );
}

function TableBodyCell({ text, width, bold = false }: { text: string; width: number; bold?: boolean }) {
  return (
    <View className="justify-center px-2.5 py-2.5" style={{ width }}>
      <Text className={`text-xs ${bold ? 'font-bold text-primary' : 'text-ink dark:text-ink-dark'}`} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

function PersonRecordCard({
  report,
  isComplainant,
  matchingSummonedPeople,
  onPress,
}: {
  report: ComplaintReport;
  isComplainant: boolean;
  matchingSummonedPeople: string[];
  onPress: () => void;
}) {
  const summonRecord = isSummonReport(report) || matchingSummonedPeople.length > 0;
  const respondentNames = report.summonedPersons?.length
    ? report.summonedPersons.map((person) => person.name).join(', ')
    : report.summonedPersonName || '—';
  const roles = [
    isComplainant ? 'Complaint filed' : null,
    matchingSummonedPeople.length > 0 ? 'Summoned' : null,
  ].filter(Boolean);

  return (
    <TouchableOpacity
      className="rounded-lg border border-border dark:border-border-dark p-3 mb-2"
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Open ${report.title}, ${roles.join(' and ')}`}
    >
      <View className="flex-row items-start justify-between gap-2 mb-1.5">
        <View className="flex-1">
          <Text className="text-[11px] font-bold text-muted dark:text-muted-dark">{report.id}</Text>
          <Text className="text-[13px] font-extrabold text-ink dark:text-ink-dark mt-0.5">{report.title}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
      <View className="flex-row flex-wrap gap-1.5 mb-2">
        {roles.map((role) => (
          <View key={role} className={`rounded-full px-2 py-1 ${role === 'Summoned' ? 'bg-purple-light' : 'bg-blue-light'}`}>
            <Text className={`text-[10px] font-bold ${role === 'Summoned' ? 'text-purple' : 'text-blue'}`}>{role}</Text>
          </View>
        ))}
        <View className="rounded-full bg-gray-light dark:bg-surface-dark-2 px-2 py-1">
          <Text className="text-[10px] font-bold text-gray dark:text-ink-dark">{report.status}</Text>
        </View>
      </View>
      <Text className="text-xs text-muted dark:text-muted-dark">
        Filed by: <Text className="font-semibold text-ink dark:text-ink-dark">{report.reportedBy}</Text>
      </Text>
      {summonRecord ? (
        <View className="mt-1">
          <Text className="text-xs text-muted dark:text-muted-dark">
            Summoned: <Text className="font-semibold text-ink dark:text-ink-dark">{respondentNames}</Text>
          </Text>
          {report.summonNoticeStage ? (
            <Text className="text-xs text-purple font-semibold mt-1">
              Stage: {report.summonNoticeStage}{report.hearingDate ? ` · Hearing: ${report.hearingDate}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Text className="text-[11px] text-muted dark:text-muted-dark mt-1">{report.category} · {report.date}</Text>
    </TouchableOpacity>
  );
}

function KpiCard({ label, value, icon, color, bg }: { label: string; value: number; icon: any; color: string; bg: string }) {
  return (
    <View className="w-[47%] rounded-xl p-3.5 gap-1.5" style={{ backgroundColor: bg }}>
      <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: color + '22' }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text className="text-[26px] font-black" style={{ color }}>{value}</Text>
      <Text className="text-xs font-semibold" style={{ color }}>{label}</Text>
    </View>
  );
}

function SummaryRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-2.5 py-2.5 border-b border-border dark:border-border-dark">
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text className="flex-1 text-[13px] text-ink dark:text-ink-dark">{label}</Text>
      <Text className="text-[13px] font-extrabold text-primary">{value}</Text>
    </View>
  );
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Users,
  UserCheck,
  UserX,
  CreditCard,
  Printer,
  MapPin,
  Tag,
  BookOpen,
  Receipt,
  Bookmark,
  FileSpreadsheet,
  ArrowRight,
  Award,
  RefreshCw,
  TrendingUp,
  Layers
} from 'lucide-react';
import {
  fetchReportSummary,
  fetchMembersReport,
  fetchUnapprovedMembersReport,
  fetchReceiptsReport,
  fetchLabelsReport,
  fetchMagazineReturnsReport
} from '../utils/reportApi';
import { loadMembershipTypes, loadLocations } from '../utils/serverData';

export default function ReportsDashboard() {
  const [summary, setSummary] = useState({
    totalApproved: 0,
    totalUnapproved: 0,
    totalReceiptsAmount: 0,
    totalReceiptsCount: 0,
    typeBreakdown: [],
    genderBreakdown: { male: 0, female: 0, other: 0 },
    geographyHighlights: [],
    labelsPending: 0,
    labelsGenerated: 0,
    magazineReturns: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);

    Promise.allSettled([
      fetchReportSummary(),
      fetchMembersReport({ approval_status: 'APPROVED' }),
      fetchUnapprovedMembersReport(),
      fetchReceiptsReport(),
      loadMembershipTypes(),
      fetchLabelsReport(),
      fetchMagazineReturnsReport(),
    ]).then(([sumRes, appRes, unappRes, recRes, typeRes, labelRes, magRes]) => {
      const approved = appRes.status === 'fulfilled' ? appRes.value : [];
      const unapproved = unappRes.status === 'fulfilled' ? unappRes.value : [];
      const receipts = recRes.status === 'fulfilled' ? recRes.value : [];
      const types = typeRes.status === 'fulfilled' ? typeRes.value : [];
      const labels = labelRes.status === 'fulfilled' ? labelRes.value : [];
      const returns = magRes.status === 'fulfilled' ? magRes.value : [];

      const totalAmt = receipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      // Gender Breakdown
      let male = 0;
      let female = 0;
      let other = 0;
      approved.forEach((m) => {
        const g = String(m.gender || '').toLowerCase();
        if (g === 'male') male++;
        else if (g === 'female') female++;
        else other++;
      });

      // Type Breakdown
      const typeCounts = new Map();
      approved.forEach((m) => {
        const tName = m.membership_type || m.category || 'General';
        typeCounts.set(tName, (typeCounts.get(tName) || 0) + 1);
      });
      const typeArr = Array.from(typeCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top District Concentrations
      const districtCounts = new Map();
      approved.forEach((m) => {
        const dName = m.district_name || m.district || 'Unspecified';
        districtCounts.set(dName, (districtCounts.get(dName) || 0) + 1);
      });
      const geoArr = Array.from(districtCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Labels Count
      const pendingL = labels.filter((l) => l.status === 'pending').length;
      const genL = labels.filter((l) => l.status === 'generated').length;

      // Check if backend summary had values
      const backendSum = sumRes.status === 'fulfilled' ? sumRes.value : null;

      setSummary({
        totalApproved: backendSum?.total_approved ?? approved.length,
        totalUnapproved: backendSum?.total_unapproved ?? unapproved.length,
        totalReceiptsAmount: backendSum?.total_receipts_amount ?? totalAmt,
        totalReceiptsCount: backendSum?.total_receipts_count ?? receipts.length,
        typeBreakdown: backendSum?.membership_types ?? typeArr,
        genderBreakdown: backendSum?.gender_counts ?? { male, female, other },
        geographyHighlights: backendSum?.geography ?? geoArr,
        labelsPending: backendSum?.labels_pending ?? pendingL,
        labelsGenerated: backendSum?.labels_generated ?? genL,
        magazineReturns: backendSum?.magazine_returns ?? returns.length,
      });

      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#180200] tracking-tight flex items-center gap-2">
            <span>Report Summary &amp; Analytics Hub</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#863221] mt-0.5">
            Consolidated operational overview derived from live backend registry, financial, and magazine data.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#E8DFD8] text-[#863221] hover:text-[#510601] text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />

        </button>
      </div>

      {/* Top Operational Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <Link
          to="/dashboard/reports/members"
          className="bg-white p-5 rounded-2xl border border-[#E8DFD8] shadow-xs hover:border-[#510601]/40 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#863221] uppercase tracking-wider">
              Approved Members
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-3xl font-bold text-[#180200] block">
              {loading ? '—' : summary.totalApproved}
            </strong>
            <span className="text-[11px] text-[#863221] mt-1 flex items-center gap-1 group-hover:text-[#510601]">
              <span>View Roster</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </Link>

        {/* Metric 2 */}
        <Link
          to="/dashboard/reports/unapproved"
          className="bg-white p-5 rounded-2xl border border-[#E8DFD8] shadow-xs hover:border-amber-500/40 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#863221] uppercase tracking-wider">
              Pending Approvals
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-3xl font-bold text-amber-700 block">
              {loading ? '—' : summary.totalUnapproved}
            </strong>
            <span className="text-[11px] text-[#863221] mt-1 flex items-center gap-1 group-hover:text-amber-800">
              <span>View Unapproved</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </Link>

        {/* Metric 3 */}
        <Link
          to="/dashboard/reports/receipts"
          className="bg-white p-5 rounded-2xl border border-[#E8DFD8] shadow-xs hover:border-[#3D705C]/40 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#863221] uppercase tracking-wider">
              Total Collections
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-2xl sm:text-3xl font-bold text-[#510601] font-mono block">
              ₹{loading ? '—' : summary.totalReceiptsAmount.toLocaleString('en-IN')}
            </strong>
            <span className="text-[11px] text-[#863221] mt-1 flex items-center gap-1 group-hover:text-[#510601]">
              <span>{summary.totalReceiptsCount} receipts</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </Link>

        {/* Metric 4 */}
        <Link
          to="/dashboard/reports/labels"
          className="bg-white p-5 rounded-2xl border border-[#E8DFD8] shadow-xs hover:border-[#510601]/40 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#863221] uppercase tracking-wider">
              Eligible Labels
            </span>
            <div className="p-2 rounded-xl bg-[#510601]/10 text-[#510601]">
              <Printer className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-3xl font-bold text-[#180200] block">
              {loading ? '—' : summary.labelsPending + summary.labelsGenerated}
            </strong>
            <span className="text-[11px] text-[#863221] mt-1 flex items-center gap-1 group-hover:text-[#510601]">
              <span>{summary.labelsPending} pending batch</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </Link>
      </div>

      {/* Grid of Key Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Breakdown 1: Membership Type Distribution */}
        <div className="bg-white rounded-2xl p-5 border border-[#E8DFD8] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DFD8]">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#510601]" />
                <h3 className="font-bold text-[#180200] text-sm">Membership Type Breakdown</h3>
              </div>
              <Link
                to="/dashboard/reports/membership-types"
                className="text-xs font-semibold text-[#510601] hover:underline"
              >
                View Details
              </Link>
            </div>
            <div className="mt-3 divide-y divide-[#E8DFD8]">
              {summary.typeBreakdown.map((t) => (
                <div key={t.name} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#180200]">{t.name}</span>
                  <span className="font-mono font-bold text-[#510601] bg-[#FAF7F2] px-2.5 py-0.5 rounded-full border border-[#E8DFD8]">
                    {t.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Breakdown 2: Gender Demographics */}
        <div className="bg-white rounded-2xl p-5 border border-[#E8DFD8] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DFD8]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#510601]" />
                <h3 className="font-bold text-[#180200] text-sm">Gender Demographics</h3>
              </div>
              <Link
                to="/dashboard/reports/gender"
                className="text-xs font-semibold text-[#510601] hover:underline"
              >
                View Details
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-[#180200]">Male</span>
                  <span className="font-mono text-sky-800 font-bold">{summary.genderBreakdown.male}</span>
                </div>
                <div className="w-full bg-[#FAF7F2] h-2 rounded-full overflow-hidden border border-[#E8DFD8]">
                  <div
                    className="bg-sky-700 h-full rounded-full"
                    style={{
                      width: `${summary.totalApproved > 0 ? (summary.genderBreakdown.male / summary.totalApproved) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-[#180200]">Female</span>
                  <span className="font-mono text-emerald-800 font-bold">{summary.genderBreakdown.female}</span>
                </div>
                <div className="w-full bg-[#FAF7F2] h-2 rounded-full overflow-hidden border border-[#E8DFD8]">
                  <div
                    className="bg-emerald-700 h-full rounded-full"
                    style={{
                      width: `${summary.totalApproved > 0 ? (summary.genderBreakdown.female / summary.totalApproved) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-[#180200]">Other / Unspecified</span>
                  <span className="font-mono text-[#863221] font-bold">{summary.genderBreakdown.other}</span>
                </div>
                <div className="w-full bg-[#FAF7F2] h-2 rounded-full overflow-hidden border border-[#E8DFD8]">
                  <div
                    className="bg-[#863221] h-full rounded-full"
                    style={{
                      width: `${summary.totalApproved > 0 ? (summary.genderBreakdown.other / summary.totalApproved) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown 3: Geography & Magazine Logistics */}
        <div className="bg-white rounded-2xl p-5 border border-[#E8DFD8] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DFD8]">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#510601]" />
                <h3 className="font-bold text-[#180200] text-sm">Top Regional Centers</h3>
              </div>
              <Link
                to="/dashboard/reports/geography"
                className="text-xs font-semibold text-[#510601] hover:underline"
              >
                View Map/List
              </Link>
            </div>
            <div className="mt-3 divide-y divide-[#E8DFD8]">
              {summary.geographyHighlights.map((g) => (
                <div key={g.name} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#180200]">{g.name}</span>
                  <span className="font-mono font-bold text-[#180200]">
                    {g.count} members
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#E8DFD8] flex items-center justify-between text-xs">
            <span className="text-[#863221]">Magazine Returns Log:</span>
            <Link
              to="/dashboard/reports/magazine-reports?tab=returns"
              className="font-bold text-red-700 hover:underline flex items-center gap-1"
            >
              <span>{summary.magazineReturns} undelivered</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Complete Report Directory Navigation Cards */}
      <div>
        <h2 className="text-base font-bold text-[#180200] mb-3">
          Detailed Report Catalog &amp; Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: 'Approved Members Report',
              desc: 'Official roster with bilingual Kannada/English language selector and customizable print columns.',
              path: '/dashboard/reports/members?tab=approved',
              icon: UserCheck,
            },
            {
              title: 'Unapproved Members Report',
              desc: 'Filterable queue of pending applications awaiting committee verification and source tracking.',
              path: '/dashboard/reports/members?tab=unapproved',
              icon: UserX,
            },
            {
              title: 'Members by Geography',
              desc: 'Multi-level drilldown by State, District, Taluk, and Village with member counts.',
              path: '/dashboard/reports/members?tab=geography',
              icon: MapPin,
            },
            {
              title: 'Members by Gender',
              desc: 'Gender demographic distribution including male, female, other, and unspecified.',
              path: '/dashboard/reports/members?tab=gender',
              icon: Users,
            },
            {
              title: 'Members by Membership Type',
              desc: 'Patron, Life, Associate, and Annual categorizations with price history linkages.',
              path: '/dashboard/reports/members?tab=types',
              icon: Award,
            },
            {
              title: 'Labels Report (Pending / Generated)',
              desc: 'Audit trail distinguishing pending eligible label counts and generated monthly batches.',
              path: '/dashboard/reports/label-print?tab=report',
              icon: Tag,
            },
            {
              title: 'Magazine Returns Report',
              desc: 'Postal return log tracking undelivered magazines, reasons, and KYC follow-up status.',
              path: '/dashboard/reports/magazine-reports?tab=returns',
              icon: BookOpen,
            },
            {
              title: 'Receipt Reports',
              desc: 'Comprehensive financial collections with date filtering, particulars, and payment modes.',
              path: '/dashboard/reports/receipts',
              icon: Receipt,
            },
            {
              title: 'Receipt Reports by Member',
              desc: 'Select any member to generate an individual transaction history and contribution statement.',
              path: '/dashboard/reports/receipts/by-member',
              icon: CreditCard,
            },
            {
              title: 'Label Print Module',
              desc: 'Standardized 3-column mailing address sheet printer with pure black on white design.',
              path: '/dashboard/reports/label-print',
              icon: Printer,
            },
            {
              title: 'Saved Reports',
              desc: 'Server-persisted report templates and filter configurations with full CRUD management.',
              path: '/dashboard/reports/saved',
              icon: Bookmark,
            },
            {
              title: 'Export Audit Logs',
              desc: 'Chronological event record of user data exports with formats, operators, and counts.',
              path: '/dashboard/reports/export-logs',
              icon: FileSpreadsheet,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="bg-white p-5 rounded-2xl border border-[#E8DFD8] shadow-xs hover:border-[#510601]/40 hover:shadow-md transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-[#510601]/10 text-[#510601] flex items-center justify-center font-bold mb-3">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-[#180200] text-sm group-hover:text-[#510601] transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#863221] mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E8DFD8] flex items-center justify-between text-xs font-semibold text-[#510601]">
                  <span>Open Report</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

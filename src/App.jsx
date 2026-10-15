import React from 'react';
import PermissionGate from './components/PermissionGate';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import MembershipTypeManagement from './pages/MembershipTypeManagement';
import ReceiptTypeManagement from './pages/ReceiptTypeManagement';
import LocationSetup from './pages/LocationSetup';
import RolesAndPrivileges from './pages/RolesAndPrivileges';
import UserManagement from './pages/UserManagement';
import ModulesManagement from './pages/ModulesManagement';
import ReceiptEntry from './pages/ReceiptEntry';
import ReceiptTracking from './pages/ReceiptTracking';
import LabelList from './pages/LabelList';
import LabelPrint from './pages/LabelPrint';
import ReportsDashboard from './pages/ReportsDashboard';
import MembershipReports from './pages/MembershipReports';
import MemberReports from './pages/reports/MemberReports';
import ApprovedMembersReport from './pages/reports/ApprovedMembersReport';
import UnapprovedMembersReport from './pages/reports/UnapprovedMembersReport';
import GeographyReport from './pages/reports/GeographyReport';
import GenderReport from './pages/reports/GenderReport';
import MembershipTypeReport from './pages/reports/MembershipTypeReport';
import LabelsReport from './pages/reports/LabelsReport';
import LabelPrintAndReports from './pages/reports/LabelPrintAndReports';
import MagazineReports from './pages/reports/MagazineReports';
import MagazineReturnsReport from './pages/reports/MagazineReturnsReport';
import ReceiptReports from './pages/reports/ReceiptReports';
import ReceiptByMemberReport from './pages/reports/ReceiptByMemberReport';
import SavedReports from './pages/reports/SavedReports';
import ExportLogs from './pages/reports/ExportLogs';
import MembershipList from './pages/MembershipList';
import UnapprovedMembership from './pages/UnapprovedMembership';
import OrganisationSettings from './pages/OrganisationSettings';
import BankDetailsManagement from './pages/BankDetailsManagement';
import Approvals from './pages/Approvals';
import RegisterNewMember from './pages/RegisterNewMember';
import FormModalHost from './components/FormModalHost';
import { BankMaster } from './pages/MasterLists';
// Personal Masters (gotra / qualification / native place) screen is switched off for now:
// import PersonalMasters, { BankMaster } from './pages/MasterLists';

// Anyone without a login is sent to the sign-in page before any panel screen renders
const RequireLogin = ({ children }) => {
  let signedIn = false;
  try {
    signedIn = Boolean(localStorage.getItem('access_token'));
  } catch (_) {
    signedIn = false;
  }
  return signedIn ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <FormModalHost />
      <Routes>
        <Route path="/" element={<Login />} />

        {/* Shortcuts without the /dashboard prefix */}
        <Route path="/membership/register" element={<Navigate to="/dashboard/membership/register" replace />} />
        <Route path="/membership/add" element={<Navigate to="/dashboard/membership/register" replace />} />
        <Route path="/membership/list" element={<Navigate to="/dashboard/membership/list" replace />} />
        <Route path="/membership/unapproved" element={<Navigate to="/dashboard/membership/unapproved" replace />} />
        <Route path="/membership" element={<Navigate to="/dashboard/membership/list" replace />} />
        <Route path="/reports/label-print" element={<Navigate to="/dashboard/reports/label-print" replace />} />
        <Route path="/reports/labels" element={<Navigate to="/dashboard/reports/label-print" replace />} />
        <Route path="/label-print" element={<Navigate to="/dashboard/reports/label-print" replace />} />
        <Route path="/reports" element={<Navigate to="/dashboard/reports/dashboard" replace />} />

        <Route path="/dashboard" element={<RequireLogin><MainLayout /></RequireLogin>}>
          <Route index element={<Dashboard />} />
          
          {/* Membership Module Routes */}
          <Route path="membership/list" element={<MembershipList />} />
          <Route path="membership/unapproved" element={<UnapprovedMembership />} />
          <Route path="membership/register" element={<RegisterNewMember />} />
          <Route path="membership/add" element={<RegisterNewMember />} />
          <Route path="membership/edit/:id" element={<RegisterNewMember />} />
          <Route path="membership/view/:id" element={<RegisterNewMember />} />
          <Route path="membership" element={<Navigate to="/dashboard/membership/list" replace />} />
          <Route path="members" element={<Navigate to="/dashboard/membership/list" replace />} />
          <Route path="members/list" element={<Navigate to="/dashboard/membership/list" replace />} />

          {/* Master Management Routes */}
          <Route path="master/location-setup" element={<LocationSetup />} />
          <Route path="masters/location-setup" element={<LocationSetup />} />
          <Route path="master/location" element={<LocationSetup />} />
          <Route path="masters/location" element={<LocationSetup />} />
          <Route path="master/membership-type" element={<MembershipTypeManagement />} />
          <Route path="masters/membership-types" element={<MembershipTypeManagement />} />
          <Route path="master/receipt-type" element={<ReceiptTypeManagement />} />
          <Route path="masters/receipt-types" element={<ReceiptTypeManagement />} />
          <Route path="master/receipt" element={<ReceiptTypeManagement />} />
          <Route path="master/particulars" element={<ReceiptTypeManagement />} />
          <Route path="masters/particulars" element={<ReceiptTypeManagement />} />
          <Route path="master/particulars-master" element={<ReceiptTypeManagement />} />
          <Route path="masters/particulars-master" element={<ReceiptTypeManagement />} />
          <Route path="master/organisation-settings" element={<OrganisationSettings />} />
          <Route path="master/organisation" element={<OrganisationSettings />} />
          <Route path="settings/organisation" element={<OrganisationSettings />} />
          <Route path="settings" element={<OrganisationSettings />} />
          <Route path="master/payment-modes" element={<BankDetailsManagement />} />
          <Route path="master/banks" element={<BankMaster />} />
          {/* <Route path="master/personal-masters" element={<PersonalMasters />} /> */}
          <Route path="approvals" element={<Approvals />} />
          <Route path="masters/payment-modes" element={<BankDetailsManagement />} />
          <Route path="master/payment-mode" element={<BankDetailsManagement />} />
          <Route path="masters/payment-mode" element={<BankDetailsManagement />} />
          <Route path="master/bank-details" element={<BankDetailsManagement />} />
          <Route path="masters/bank-details" element={<BankDetailsManagement />} />
          <Route path="master/bank" element={<BankDetailsManagement />} />
          <Route path="masters/bank" element={<BankDetailsManagement />} />
          <Route path="users/roles" element={<RolesAndPrivileges />} />
          <Route path="users/roles-privileges" element={<RolesAndPrivileges />} />
          <Route path="user/roles" element={<RolesAndPrivileges />} />
          <Route path="users/list" element={<UserManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="users/management" element={<UserManagement />} />
          <Route path="users/user-management" element={<UserManagement />} />
          <Route path="users/modules" element={<PermissionGate minRank={1} title="Super Admin only" message="Module management is reserved for the Super Admin."><ModulesManagement /></PermissionGate>} />
          <Route path="master/modules" element={<PermissionGate minRank={1} title="Super Admin only" message="Module management is reserved for the Super Admin."><ModulesManagement /></PermissionGate>} />
          <Route path="masters/modules" element={<PermissionGate minRank={1} title="Super Admin only" message="Module management is reserved for the Super Admin."><ModulesManagement /></PermissionGate>} />
          <Route path="settings/modules" element={<PermissionGate minRank={1} title="Super Admin only" message="Module management is reserved for the Super Admin."><ModulesManagement /></PermissionGate>} />

          {/* Receipts Module Routes */}
          <Route path="receipts" element={<Navigate to="/dashboard/receipts/entry" replace />} />
          <Route path="receipts/entry" element={<ReceiptEntry />} />
          <Route path="receipts/add" element={<ReceiptEntry />} />
          <Route path="receipts/tracking" element={<ReceiptTracking />} />
          <Route path="receipt/tracking" element={<ReceiptTracking />} />
          <Route path="receipts/labels" element={<PermissionGate required="members.list.read" title="Access Restricted"><LabelList /></PermissionGate>} />
          <Route path="receipts/label-list" element={<PermissionGate required="members.list.read" title="Access Restricted"><LabelList /></PermissionGate>} />
          <Route path="magazine/labels" element={<PermissionGate required="members.list.read" title="Access Restricted"><LabelList /></PermissionGate>} />

          {/* Reports Module Routes */}
          {/* Reports Module Routes - 5 Consolidated Sections + Deep Links */}
          <Route path="reports" element={<Navigate to="/dashboard/reports/members" replace />} />
          <Route path="reports/dashboard" element={<Navigate to="/dashboard/reports/members" replace />} />
          <Route path="reports/summary" element={<ReportsDashboard />} />
          <Route path="reports/members" element={<MemberReports />} />
          <Route path="reports/membership" element={<MemberReports />} />
          <Route path="reports/membership-reports" element={<MemberReports />} />
          <Route path="reports/approved-members" element={<ApprovedMembersReport />} />
          <Route path="reports/unapproved" element={<UnapprovedMembersReport />} />
          <Route path="reports/unapproved-members" element={<UnapprovedMembersReport />} />
          <Route path="reports/geography" element={<GeographyReport />} />
          <Route path="reports/gender" element={<GenderReport />} />
          <Route path="reports/membership-types" element={<MembershipTypeReport />} />
          <Route path="reports/receipts" element={<ReceiptReports />} />
          <Route path="reports/receipts/by-member" element={<ReceiptByMemberReport />} />
          <Route path="reports/magazine-reports" element={<MagazineReports />} />
          <Route path="reports/magazine-returns" element={<MagazineReturnsReport />} />
          <Route path="reports/labels" element={<PermissionGate required="members.list.read" title="Access Restricted"><LabelPrintAndReports /></PermissionGate>} />
          <Route path="reports/label-print" element={<PermissionGate required="members.list.read" title="Access Restricted"><LabelPrintAndReports /></PermissionGate>} />
          <Route path="reports/saved" element={<SavedReports />} />
          <Route path="reports/export-logs" element={<ExportLogs />} />
          <Route path="label-print" element={<PermissionGate required="members.list.read" title="Access Restricted"><LabelPrintAndReports /></PermissionGate>} />

        </Route>

        {/* Any unknown address: a full-screen page, no panel around it */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import LabelPrint from '../LabelPrint';
import LabelsReport from './LabelsReport';

export default function LabelPrintAndReports() {
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('tab');

  return currentTab === 'report' ? <LabelsReport /> : <LabelPrint />;
}

/**
 * Página do Dashboard SLA
 * Dashboard dedicado para métricas e configurações de SLA
 */

import React from 'react';
import SLADashboard from '@/components/sla-dashboard';

export default function SLADashboardPage() {
  return (
    <div className="container mx-auto py-6">
      <SLADashboard />
    </div>
  );
} 
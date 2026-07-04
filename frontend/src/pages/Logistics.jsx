import DeficitGrid from '../components/Logistics/DeficitGrid';
import LogisticsEngine from '../components/Logistics/LogisticsEngine';
import SeveritySlider from '../components/Logistics/SeveritySlider';
import WarehouseTable from '../components/Logistics/WarehouseTable';

export default function Logistics() {
  return (
    <div className="space-y-4">
      <SeveritySlider />
      <DeficitGrid />
      <LogisticsEngine />
      <WarehouseTable />
    </div>
  );
}

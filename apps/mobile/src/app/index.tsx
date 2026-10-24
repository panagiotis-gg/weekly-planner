import { weekKeyOf } from '@planner/shared';
import { Redirect } from 'expo-router';
import { todayIso } from '@/lib/format';
import { usePlanner, PlannerGate } from '@/state/planner';

/** Opens the current week of the active planner. */
function IndexContent() {
  const planner = usePlanner();
  return <Redirect href={{ pathname: '/week/[weekKey]', params: { weekKey: weekKeyOf(todayIso(), planner.weekStartDay) } }} />;
}

/** Waits for the local database before rendering (see PlannerGate). */
export default function Index() {
  return (
    <PlannerGate>
      <IndexContent />
    </PlannerGate>
  );
}

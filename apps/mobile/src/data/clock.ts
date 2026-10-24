import { createHlc, HlcState, newId, tick } from '@planner/shared';
import { kvGet, kvSet } from './db/client';

const NODE_ID_KEY = 'node_id';
const HLC_KEY = 'hlc_state';

let state: HlcState | null = null;

function load(): HlcState {
  if (state) return state;
  let nodeId = kvGet(NODE_ID_KEY);
  if (!nodeId) {
    nodeId = newId().replace(/-/g, ''); // stable per install; HLC node ids may not contain ':'
    kvSet(NODE_ID_KEY, nodeId);
  }
  const saved = kvGet(HLC_KEY);
  state = saved ? (JSON.parse(saved) as HlcState) : createHlc(nodeId);
  return state;
}

/** Next HLC stamp for a local field write; persisted so stamps stay monotonic across restarts. */
export function nextStamp(): string {
  const [next, stamp] = tick(load());
  state = next;
  kvSet(HLC_KEY, JSON.stringify(next));
  return stamp;
}

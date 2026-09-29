import { Navigate, useParams } from 'react-router';
import { flowById } from '../content/flows';
import { NotFoundScreen } from './NotFoundScreen';

/** An old /flows/<id> address, from before the flows were built: sends it on to the flow. */
export function FlowScreen() {
  const flow = flowById(useParams().flowId);
  if (!flow) return <NotFoundScreen />;
  return <Navigate to={flow.to} replace />;
}

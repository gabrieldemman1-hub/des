import { Route, Routes } from 'react-router';
import { SymptomNotFound, SymptomScreen } from './SymptomScreen';
import { TroubleshootScreen } from './TroubleshootScreen';

/**
 * Flow C, Troubleshoot by feel (CONCEPT.md §5), mounted at `troubleshoot/*`:
 * `/troubleshoot` is stage 1 (setup check) and stage 2 (pick a symptom);
 * `/troubleshoot/<symptomId>` is one symptom.
 */
export function TroubleshootFlow() {
  return (
    <Routes>
      <Route index element={<TroubleshootScreen />} />
      <Route path=":symptomId" element={<SymptomScreen />} />
      <Route path="*" element={<SymptomNotFound />} />
    </Routes>
  );
}

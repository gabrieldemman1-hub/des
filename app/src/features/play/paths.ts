/** Where each Play screen lives (routes in PlayFlow.tsx). */
export const playPath = {
  index: '/play',
  framework: (id: string) => `/play/frameworks/${id}`,
  principle: (id: string) => `/play/mindset/${id}`,
  loadoutPlan: (id: string) => `/play/loadouts/${id}`,
  map: (id: string) => `/play/maps/${id}`,
  session: '/play/session',
};

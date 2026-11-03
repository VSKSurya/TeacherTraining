import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';

type DashboardState = {
  audience: 'Teacher' | 'Student';
  selectedPhase: number | null;
  filters: Record<string, string>;
  sidebarCollapsed: boolean;
};
const AUDIENCE_STORAGE_KEY = 'teacher-training-audience';
function storedAudience(): DashboardState['audience'] {
  try { return window.localStorage.getItem(AUDIENCE_STORAGE_KEY) === 'Student' ? 'Student' : 'Teacher'; } catch { return 'Teacher'; }
}
const initialState: DashboardState = {
  audience: storedAudience(), selectedPhase: 3, sidebarCollapsed: false,
  filters: { project: '', state: '', district: '', school: '', plan: '', batch: '', 'date-range': '' },
};
const dashboardSlice = createSlice({
  name: 'dashboard', initialState,
  reducers: {
    setAudience(state, action: PayloadAction<DashboardState['audience']>) { state.audience = action.payload; },
    setPhase(state, action: PayloadAction<number | null>) { state.selectedPhase = action.payload; },
    setFilter(state, action: PayloadAction<{ key: string; value: string }>) { state.filters[action.payload.key] = action.payload.value; },
    clearFilters(state) { for (const key of Object.keys(state.filters)) state.filters[key] = ''; },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) { state.sidebarCollapsed = action.payload; },
  },
});
export const { setAudience, setPhase, setFilter, clearFilters, setSidebarCollapsed } = dashboardSlice.actions;
export const store = configureStore({ reducer: { dashboard: dashboardSlice.reducer } });
let persistedAudience = store.getState().dashboard.audience;
store.subscribe(() => {
  const audience = store.getState().dashboard.audience;
  if (audience === persistedAudience) return;
  persistedAudience = audience;
  try { window.localStorage.setItem(AUDIENCE_STORAGE_KEY, audience); } catch { /* Keep the current audience in memory if storage is unavailable. */ }
});
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === AUDIENCE_STORAGE_KEY && (event.newValue === 'Teacher' || event.newValue === 'Student')) store.dispatch(setAudience(event.newValue));
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

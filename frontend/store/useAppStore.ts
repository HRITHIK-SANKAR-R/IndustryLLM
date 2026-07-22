import { create } from 'zustand';

interface AppState {
  activeNodeId: string | null;
  hoveredNodeId: string | null;
  isMockModeActive: boolean;
  processingState: 'idle' | 'uploading' | 'processing' | 'complete';
  setActiveNodeId: (id: string | null) => void;
  setHoveredNodeId: (id: string | null) => void;
  toggleMockMode: () => void;
  setProcessingState: (state: 'idle' | 'uploading' | 'processing' | 'complete') => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeNodeId: null,
  hoveredNodeId: null,
  isMockModeActive: false,
  processingState: 'idle',
  setActiveNodeId: (id) => set({ activeNodeId: id }),
  setHoveredNodeId: (id) => set({ hoveredNodeId: id }),
  toggleMockMode: () => set((state) => ({ isMockModeActive: !state.isMockModeActive })),
  setProcessingState: (state) => set({ processingState: state }),
}));

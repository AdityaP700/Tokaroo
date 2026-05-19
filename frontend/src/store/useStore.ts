import { create } from 'zustand';

interface TokarooState {
  input: {
    text: string;
    model: string;
    chunk_size: number;
    overlap: number;
    top_k: number;
  };
  simulation: {
    runId: number;
    chunks: any[];
    edges: any[];
    attention: number[];
    loading: boolean;
    error: string | null;
    raw: any | null;
    request: any | null;
  };
  analysis: {
    diagnosis: string | null;
    issues: any[];
    health_score: number;
  };
  ui: {
    selectedNode: string | null;
    hoveredNode: string | null;
    view: 'graph' | 'tokens' | 'attention';
  };
  setInput: (data: Partial<TokarooState['input']>) => void;
  setSimulation: (data: Partial<TokarooState['simulation']>) => void;
  setAnalysis: (data: Partial<TokarooState['analysis']>) => void;
  setUI: (data: Partial<TokarooState['ui']>) => void;
}

export const useStore = create<TokarooState>((set) => ({
  input: {
    text: "",
    model: "gpt-4o",
    chunk_size: 100,
    overlap: 20,
    top_k: 5,
  },
  simulation: {
    runId: 0,
    chunks: [],
    edges: [],
    attention: [],
    loading: false,
    error: null,
    raw: null,
    request: null,
  },
  analysis: {
    diagnosis: null,
    issues: [],
    health_score: 0,
  },
  ui: {
    selectedNode: null,
    hoveredNode: null,
    view: 'graph',
  },
  
  setInput: (data) =>
    set((state) => ({ input: { ...state.input, ...data } })),

  setSimulation: (data) =>
    set((state) => ({ simulation: { ...state.simulation, ...data } })),

  setAnalysis: (data) =>
    set((state) => ({ analysis: { ...state.analysis, ...data } })),

  setUI: (data) =>
    set((state) => ({ ui: { ...state.ui, ...data } })),
}));

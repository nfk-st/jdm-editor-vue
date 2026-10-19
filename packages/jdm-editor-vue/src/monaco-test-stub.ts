// Runtime stub for monaco-editor in tests — the real package's entry cannot
// resolve under jsdom, and no test creates real editors (Monaco needs a real
// DOM; it's covered by the playground). Types still come from the package.
export const MarkerSeverity = {
  Hint: 1,
  Info: 2,
  Warning: 4,
  Error: 8,
} as const;

export const editor = {
  create: () => {
    throw new Error('monaco stub: editors are not available in tests');
  },
  createDiffEditor: () => {
    throw new Error('monaco stub: editors are not available in tests');
  },
  getModels: () => [],
  getEditors: () => [],
  setModelMarkers: () => undefined,
  setTheme: () => undefined,
  createModel: () => {
    throw new Error('monaco stub: models are not available in tests');
  },
};

export const languages = {
  typescript: {
    javascriptDefaults: {
      setCompilerOptions: () => undefined,
      setDiagnosticsOptions: () => undefined,
      setExtraLibs: () => undefined,
      addExtraLib: () => undefined,
    },
  },
};

export const Range = class Range {
  constructor(
    public startLineNumber: number,
    public startColumn: number,
    public endLineNumber: number,
    public endColumn: number,
  ) {}
};

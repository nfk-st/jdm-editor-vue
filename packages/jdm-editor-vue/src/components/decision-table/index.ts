// Ported from components/decision-table/index.ts.
// PORTING: upstream's `export * from './dt'` picks up the component's named
// export; ours re-exports the SFC's default as DecisionTable (expression/
// index.ts precedent).
export { default as DecisionTable } from './dt.vue';
export type { DecisionTableProps } from './dt.vue';
export type { TableScrollApi } from './table/table.vue';
export type {
  DecisionTableType,
  DecisionTableMode,
  JdmUiMode,
  ColumnFieldType,
  TableSchemaItem,
} from './context/dt-store.context';

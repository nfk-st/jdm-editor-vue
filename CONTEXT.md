# GoRules Editor (Vue port)

A Vue 3 port of GoRules' `@gorules/jdm-editor`, the open-source editor for JDM files. The domain language below is inherited from upstream; changing it would break diffability against the React original.

## Language

**JDM (JSON Decision Model)**:
The JSON document format a decision graph is serialized to and executed from.
_Avoid_: decision file, rules JSON

**Decision Graph**:
A directed graph of nodes and edges that models a decision, edited on the canvas.
_Avoid_: flow, diagram, workflow

**Node**:
A single step in a Decision Graph. Has a kind (Input, Output, Expression, Decision Table, Switch, Function) and a user-editable name.

**Node Kind** vs **Node Type**:
_Kind_ is the domain category of a node (Switch, Expression, …). _Type_ is an upstream code artifact used for schema-inferred nodes (Inferred Input / Inferred Output). Prefer _kind_ in prose.
_Avoid_: using "type" for kind

**Edge**:
A connection from one node's output handle to another node's input handle, defining evaluation order.

**Specification**:
The registry entry that describes a node kind: its icon, color, how it renders on canvas, and how it edits. Custom nodes register a Specification.
_Avoid_: node definition, node descriptor

**Decision Table**:
A node kind (and standalone component) editing rules as a grid of inputs and outputs with a hit policy.

**Hit Policy**:
The rule deciding what happens when multiple table rows match (first match, all matches, no match).

**Zen**:
GoRules' expression language, evaluated by their engine. Written inside Expression nodes and Decision Table cells.

**Function**:
A node kind containing a full JavaScript function, editable in a code editor with a debugger.

**Dictionary**:
A named set of `{label, value}` options supplied by the embedding application, offered as dropdown choices when building expressions or table fields. Domain data — not UI translation.
_Avoid_: dictionary/i18n confusion, locale, messages

**Simulator**:
The panel that runs the current graph against test input using the Zen engine (WASM) and shows trace output.
_Avoid_: playground, test runner

**Custom Node**:
A node kind registered by the embedding application, not built into the editor.

**Trace**:
The ordered evaluation record the Simulator produces for one run.
_Avoid_: log, history

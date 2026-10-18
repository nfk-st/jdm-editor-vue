# @nfk.st/jdm-editor-vue

An unofficial **Vue 3** port of GoRules' [`@gorules/jdm-editor`](https://github.com/gorules/jdm-editor) —
open-source components for crafting and designing JDM (JSON Decision Model) files.

> **Not affiliated with or endorsed by GoRules.** Derived from the upstream React
> library (MIT); see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Status

Port in progress — see [PORTING.md](./docs/PORTING.md) for scope, parity checklist and progress.

## Installation

```sh
npm i @nfk.st/jdm-editor-vue
```

## Usage

```vue
<script setup>
import { ref } from 'vue';
import { JdmConfigProvider, DecisionGraph } from '@nfk.st/jdm-editor-vue';
import '@nfk.st/jdm-editor-vue/dist/style.css';

const graph = ref({ edges: [], nodes: [] });
</script>

<template>
  <JdmConfigProvider>
    <DecisionGraph v-model="graph" />
  </JdmConfigProvider>
</template>
```

## License

MIT © GoRules.io (original) and nfk.st contributors (Vue port).

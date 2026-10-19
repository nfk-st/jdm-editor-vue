// Ported from components/code-editor/business/focus-helper.ts.
import type { CodeEditorBaseRef } from '../ce-base.vue';

export type BuilderRef = { focus: () => void };

export const focusBuilderRoot = (el: HTMLElement | null) => {
  if (!el) return;
  // PORTING: upstream parameterises querySelector with its ce-base ref type
  // (the DOM element itself, augmented with codeMirror). The ported ce-base
  // exposes { el, codeMirror } on the Vue instance but still attaches
  // `.codeMirror` to its root DOM element, so the lookup keeps working with
  // an intersection cast instead of the type parameter.
  const ceEl = el.querySelector<HTMLElement & Partial<CodeEditorBaseRef>>('.grl-ce');
  if (ceEl?.codeMirror) {
    const view = ceEl.codeMirror;
    view.focus();
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    return;
  }
  const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
  if (input) {
    input.focus();
    if ('selectionStart' in input) {
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  }
};

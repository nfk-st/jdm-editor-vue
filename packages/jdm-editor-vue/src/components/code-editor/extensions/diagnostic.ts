// Ported from components/code-editor/extensions/diagnostic.tsx.
// PORTING: upstream file is .tsx but contains no JSX — both exports are pure
// helpers returning HTML strings, so it lands here as diagnostic.ts.
// Import sites keep the extension-less `./diagnostic` specifier.

type RenderDiagnosticMessageParams = {
  text: string;
  className?: string;
};

export const renderDiagnosticMessage = ({ text, className }: RenderDiagnosticMessageParams) => {
  return text.replace(/`([^`]+)`/g, (match, content) => {
    let color;
    if (/^["'].*["']$/.test(content)) {
      color = '#6aab73'; // Strings
    } else if (/^\d+$/.test(content)) {
      color = '#57a8f5'; // Numbers
    } else {
      color = '#CE8E6D'; // Everything else
    }
    return `<span class="${className}" style="color: ${color};">${escapeHtml(content)}</span>`;
  });
};

export const escapeHtml = (str: string) => {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

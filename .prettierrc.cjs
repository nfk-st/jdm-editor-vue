module.exports = {
  plugins: [require('@trivago/prettier-plugin-sort-imports')],
  printWidth: 120,
  singleQuote: true,
  quoteProps: 'consistent',
  semi: true,
  importOrder: ['^[!^./]', '^[./].*$'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};

import neostandard from 'neostandard'

export default neostandard({
  noStyle: true, // Disable style-related rules, we use Prettier
  ts: true,
  ignores: ['vendor/**', 'deps.ts'],
})

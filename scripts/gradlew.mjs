// 跨平台调用 android/ 下的 Gradle Wrapper：node scripts/gradlew.mjs <task...>
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const windows = process.platform === 'win32'
const cwd = fileURLToPath(new URL('../android', import.meta.url))
const { status } = spawnSync(
  path.join(cwd, windows ? 'gradlew.bat' : 'gradlew'),
  process.argv.slice(2),
  {
    cwd,
    stdio: 'inherit',
    shell: windows,
  }
)
process.exit(status ?? 1)

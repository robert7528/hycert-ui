import type { Config } from 'tailwindcss'
import { hyspPreset } from '@hysp/ui-kit/tailwind-preset'

const config: Config = {
  presets: [hyspPreset as Config],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@hysp/ui-kit/src/**/*.{ts,tsx}',
  ],
}

export default config

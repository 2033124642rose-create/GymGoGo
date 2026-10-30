// Offline compilation only. This script never deploys or uses local .env secrets.
import {execFileSync} from 'node:child_process'
import path from 'node:path'
const env={...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false',
  XDG_CONFIG_HOME:path.resolve('.npm-cache/wrangler-config'),WRANGLER_LOG_PATH:path.resolve('.npm-cache/wrangler-logs')}
const cli=path.resolve('node_modules/wrangler/bin/wrangler.js')
for(const args of [
  ['deploy','--dry-run','--config','cloudflare/wrangler.jsonc','--outdir','.npm-cache/worker-dry-run'],
  ['pages','functions','build','--outdir','.npm-cache/pages-functions'],
])execFileSync(process.execPath,[cli,...args],{env,stdio:'inherit'})

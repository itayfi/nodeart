# Mobile AI crash diagnostics

Run `pnpm dev` as usual. Vite automatically starts a loopback-only diagnostic collector and proxies `/nodeart/__ai-diagnostics/` to it. Keep forwarding the same Vite port over SSH; there is no additional port to forward or service to start.

Reload the phone or tablet page after restarting Vite, then reproduce the failure. Reports are saved continuously on the development machine in `logs/ai-diagnostics/<page-session>.jsonl`. Each line contains a server receipt timestamp, page-session ID, source (`page` or `worker`), sequence number, event, and diagnostic data. A reload creates a new file, preserving the previous session. The directory is ignored by Git.

Events include model/backend choice, adapter capabilities, GPU device creation and errors, cache/download progress, session preparation, inference progress, and page loading heartbeats. Chromium may expose JavaScript heap metrics; these do not measure total tab, native WASM, or GPU memory. Prompt text, shader source, and generated suggestions are not uploaded.

Check the collector through the forwarded Vite server at `/nodeart/__ai-diagnostics/health`. To watch incoming reports in PowerShell:

```powershell
Get-Content (Get-ChildItem logs/ai-diagnostics/*.jsonl | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName -Wait
```

Uploads are best effort, sampled at most once per second for frequent progress events, with a bounded queue. A hard process kill may prevent the final events from arriving. The last saved stage and progress are evidence of where the browser stopped reporting, not proof of an OOM or driver failure. Logging is enabled only by Vite development mode; production builds do not upload reports.

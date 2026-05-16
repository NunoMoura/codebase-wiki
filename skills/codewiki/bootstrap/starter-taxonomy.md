| Class | Paths | Rule |
| --- | --- | --- |
| Canonical knowledge | `.codewiki/kb/**`, `.codewiki/config.json` | Durable project truth. Edit through CodeWiki workflows or exact human review. |
| Roadmap truth | `.codewiki/roadmap/queue.json` | Machine-managed task ordering and lifecycle truth. Mutate through CodeWiki task APIs. |
| Generated state/views | `.codewiki/index_graph.json`, `.codewiki/roadmap/tasks/**` | Tool-owned read models. Never hand-edit or cite as canonical truth when source files are available. |
| Runtime/session state | `.codewiki/session/**`, `.codewiki/runtime/**` | Local coordination, handoffs, and pending UI state. Useful operational context, not durable product truth. |
| Build/validation artifacts | `.codewiki/builds/**`, `.codewiki/validation/**` | Compiler handoffs and gateway decisions. Use as evidence, then compile durable changes into knowledge, roadmap, tests, code, or publication proof. |
| Source/research support | `.codewiki/sources/**`, `.codewiki/research/**` | Provenance and compact findings that support knowledge changes. |
| Product/package source | Repository code, tests, scripts, package files, and skill assets outside `.codewiki/**` | Implements {{projectName}} itself. Do not confuse package source with repo-local CodeWiki state. |

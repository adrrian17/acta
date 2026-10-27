# Capability Map: acta

Source: [brief.md](./brief.md). Module ids are stable; each module gets its own `SPEC-<module-id>.md` next to this file.

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| `owner-access` | GitHub OAuth sign-in of the Owner, session, rejection of any other account | — |
| `notes` | Notes, Tags, pinning, Archived, Trashed, Timeline, tag panel | owner-access |
| `tasks` | Standalone Tasks (no projects, no relation to Notes) | owner-access |
| `search` | Full-text search and query operators over Notes | notes |
| `attachments` | Files and images on Notes, stored in R2 | notes |
| `note-history` | Note versions, diff and restore | notes |
| `links` | Wiki links and backlinks between Notes | notes |
| `agent-memory` | Persistent memory for AI agents, MCP endpoint | notes |

Build order: `owner-access` → `notes`, `tasks` → `search`, `attachments`, `note-history`, `links`, `agent-memory`.

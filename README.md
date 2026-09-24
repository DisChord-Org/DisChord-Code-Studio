# DisChord Code Studio

A desktop IDE built for developing, managing, and deploying Discord bots and applications.

## Features

- **Code editor** powered by CodeMirror 6, including a custom `chord` language mode with syntax highlighting and autocompletion.
- **Integrated terminal** (xterm.js) to run and manage your project without leaving the app.
- **Package manager** panel to browse, install, and track dependencies used by your project.
- **System monitor** showing live CPU/RAM usage.
- **Discord Rich Presence** integration, so your status reflects what you're working on.
- **Auto-updater** with a dedicated update window.

## Tech Stack

- **Frontend:** Tauri 2, React 19, TypeScript, Tailwind CSS 4, managed with **pnpm**.
- **Backend:** Rust (`src-tauri/`), using crates such as `sysinfo`, `discord-rich-presence`, `tauri-plugin-updater`, and `reqwest`.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/) (`pnpm@10.34.5`, as pinned in `package.json`)
- [Rust](https://www.rust-lang.org/tools/install) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform

### Install

```bash
pnpm install
```

### Development

```bash
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

## Skills Required to Contribute

To contribute effectively to this project, you should be comfortable with:

- **React + TypeScript** — most of the app lives in `src/`, organized by feature (custom hooks, components, types).
- **Tailwind CSS** — styling is done exclusively with utility classes; no CSS modules or CSS-in-JS.
- **Rust basics** — the native backend (`src-tauri/`) exposes commands consumed by the frontend via Tauri's IPC.
- **Tauri 2 fundamentals** — how commands, plugins, and multi-window setups (e.g. the updater window) work.
- Familiarity with **CodeMirror 6** is a plus if you're working on the editor or the `chord` language mode.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the project's coding conventions and structure guidelines.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

## License

Released under the [MIT License](LICENSE).

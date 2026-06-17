# Selfie Discord

> **Selfie Discord: Making you feel fear, because you're always one '!ping' away from a permanent ban.**

Selfie Discord is a modular selfbot framework designed with a clean architecture, inspired by the standards of the [mushi](https://github.com/ginkohub/mushi) project. Built using `discord.js-selfbot-v13`, it offers high flexibility with a dynamic plugin system and robust data management.

## Disclaimer

**Using a selfbot violates [Discord's Terms of Service](https://discord.com/terms).**
Using this script can result in your account being permanently banned by Discord. Use it only for educational purposes and at your own risk. The author is not responsible for any consequences that may arise. **Remember, you're always one step closer to a permanent ban.**

## Key Features

- **Modular Architecture:** Organized with separate modules for `client`, `handler`, `settings`, and `tools`.
- **Dynamic Plugin System:** Instantly add new features in the `src/plugins/` folder.
- **Hot Reload:** Changes to plugins are automatically detected and reloaded without restarting the bot.
- **Advanced User Management:** Hierarchy-based role system (GUEST, USER, ADMIN, SUPERADMIN) and user data tracking (XP, Level, Stats).
- **Internationalization (i18n):** Built-in `translate` helper for multi-language support (ID/EN).
- **Pro Logger:** Beautiful and informative terminal output using `pen.js`.
- **ESM Native:** Uses modern JavaScript standards (ES Modules).

## Project Structure

```text
src/
├── plugins/         # Dynamic command & listener modules
├── chat_manager.js  # Chat/guild data management
├── client.js        # Discord client initialization
├── const.js         # Constants & event definitions
├── handler.js       # Central dispatcher & context builder
├── index.js         # Main entry point
├── pen.js           # Ginko-style logger
├── plugin.js        # Plugin loader & watcher
├── roles.js         # Role hierarchy (badges & levels)
├── settings.js      # Configuration & Environment
├── store.js         # JSON data persistence
├── tools.js         # Utility functions (sleep, splitText, watchDir)
└── translate.js     # Multi-language helper
```

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v16.x or higher.
- Discord account token (Use with extreme caution).

### Installation
1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Environment:
   ```bash
   cp .env.example .env
   ```
   Fill in the `DISCORD_TOKEN` in the `.env` file with your token.

### Running
- **Production Mode:** `npm start`
- **Development Mode (Auto-watch):** `npm run dev`

## Creating a New Plugin

Just create a new file in `src/plugins/hello.js`. The system will load it automatically.

```javascript
import { Role } from "#selfie"

export default {
  cmd: ["hello", "hi"],
  cat: "user",
  desc: "Greet the user",
  roles: [Role.USER],
  exec: async (c) => {
    await c.reply(`Hello ${c.user().displayName || c.user().username}!`)
  },
}
```

## License

This project is licensed under the **Mozilla Public License Version 2.0 (MPL-2.0)**. See the [LICENSE](LICENSE) file for more details.

---
*Created with anxiety by [Ginko](https://github.com/ginkohub).*

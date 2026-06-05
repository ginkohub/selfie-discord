# Plugin Guide

## Structure

A plugin is a file in `src/plugins/` that exports a default object (or array of objects):

```js
export default {
  cmd: ["hello"],           // command triggers
  cat: "user",              // category for menu
  desc: "Say hello",        // short description
  roles: [Role.USER],       // minimum role level
  exec: async (c) => {      // execution function
    // c = PluginContext
  },
};
```

For multiple commands in one file, export an array:

```js
export default [
  { cmd: ["hi"],  exec: async (c) => { ... } },
  { cmd: ["bye"], exec: async (c) => { ... } },
];
```

## PluginContext (`c`)

| Property | Type | Description |
|----------|------|-------------|
| `c.client` | `Client` | Discord client instance |
| `c.event` | `Message` | The message that triggered the command |
| `c.prefix` | `string` | First configured prefix (for display) |
| `c.lang` | `string` | User's language (`"en"` or `"id"`) |
| `c.cmd` | `string` | The matched command name |
| `c.args` | `string` | Arguments after the command, joined by spaces |
| `c.senderJid` | `string` | The user's Discord ID |
| `c.handler()` | `Handler` | The handler instance (access managers) |
| `c.user()` | `User` | Current user data object |
| `c.chatData()` | `Object` | Current chat/guild data |
| `c.reply(text)` | `Promise` | Reply to the message |
| `c.react(emoji)` | `Promise` | React to the message |

### Managers via `c.handler()`

```js
c.handler().userManager     // UserManager — user data, roles
c.handler().chatManager     // ChatManager — per-channel settings
```

### User object

```js
c.user().id          // Discord ID
c.user().username    // Discord username
c.user().roles       // Array of role levels
c.user().lang        // "en" | "id"
c.user().banned      // boolean
c.user().stats       // message stats
c.user().isAtLeast(role)   // check role level
c.user().hasRole(role)     // check exact role
```

## Role Levels

```js
import { Role } from "../roles.js";

Role.GUEST       // 0 — new users
Role.USER        // 1 — registered users
Role.ADMIN       // 2
Role.SUPERADMIN  // 3 — bot owner
```

## i18n

```js
import { translate } from "../translate.js";

const t = translate({
  en: { hello: "Hello {name}" },
  id: { hello: "Halo {name}" },
});

await c.reply(t("hello", { name: "World" }, c));
```

## Translation (Google/LibreTranslate)

```js
import { translateText } from "../translate.js";

const result = await translateText("Hello", "id", { engine: "google" });
```

## Events (listeners without commands)

```js
export default {
  events: ["messageCreate"],
  exec: async (c) => {
    // runs on every message
  },
};
```

Available events: `ready`, `messageCreate`, `messageUpdate`, `messageDelete`, `guildMemberAdd`.

## Style Guide

- **No semicolons** unless required
- **Double quotes** for strings
- **2-space** indentation
- **No comments** in plugin code
- **No error handling** for impossible scenarios
- **Use `c.react("❌")`** for silent failures instead of error replies
- **One concern per plugin file** — don't mix unrelated commands
- **Match existing patterns** — look at other plugins before writing new ones

## Hot Reload

Plugins are automatically reloaded when the file changes. No restart needed.

## Creating a Plugin (quick start)

```js
import { Role } from "../roles.js";

export default {
  cmd: ["ping", "p"],
  cat: "system",
  desc: "Ping command",
  roles: [Role.USER],
  exec: async (c) => {
    await c.reply("Pong!");
  },
};
```

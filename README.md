# AwakeBar

A macOS menu bar app that keeps your Mac from going to sleep — built with Electron,
TypeScript and Electron Forge. It lives only in the menu bar: no Dock icon, no window.

Click the mug in the top-right menu bar to toggle it:

- **Solid mug** — your Mac stays awake
- **Mug with a slash through it** — off, your Mac can sleep normally

## Menu

| Item                   | What it does                                                              |
| ---------------------- | ------------------------------------------------------------------------- |
| Keep Mac Awake         | Starts/stops an Electron `powerSaveBlocker` with `prevent-app-suspension` |
| Display sleep: allowed | Reminder that the screen still turns off — only system sleep is blocked   |
| Keep Awake at Launch   | Remembers the toggle so AwakeBar starts awake next time                   |
| Launch at Login        | macOS login item, via `app.setLoginItemSettings()`                        |
| Quit AwakeBar          | Releases the blocker and exits                                            |

## Running it

```sh
npm start           # run in development
npm run make        # build a .app and zip it into out/make
npm run typecheck   # tsc --noEmit
npm run lint        # oxlint + oxfmt
```

`npm run make` produces `out/AwakeBar-darwin-<arch>/AwakeBar.app`. Copy that into
`/Applications`, open it once, and turn on **Launch at Login** from its menu.

## Releasing

Pushing a `v*` tag builds `arm64` and `x64` zips on GitHub Actions and publishes
them to a release. The workflow takes the app version from the tag, so there is no
need to bump `package.json` first:

```sh
git tag v1.1.0 && git push origin v1.1.0
```

`workflow_dispatch` runs the same build without publishing anything, if you just
want to check that CI is green.

The app is unsigned, so the first launch needs a right-click → **Open**, or an
approval in **System Settings → Privacy & Security**.

## The sleep assertion

`npm run make` compiles `native/sleep-assertion.c` into `bin/AwakeBar-sleep`, a
~50 KB binary the app spawns while keep-awake is on.

Electron's `powerSaveBlocker` would do the same job, but IOKit takes the assertion
name from whoever creates it and Electron hardcodes its own, so `pmset -g
assertions` reported AwakeBar's assertion as `named: "Electron"`. The name is not
settable through the Electron API. The helper calls `IOPMAssertionCreateWithName`
directly, so the assertion is now reported as:

```
pid 40666(AwakeBar-sleep): NoIdleSleepAssertion named: "AwakeBar"
```

It takes the same assertion type Electron used, so the behaviour is unchanged:
system sleep blocked, display sleep allowed. The app holds the helper's stdin
open and closes it to release; the kernel drops the assertion if either process
dies, so a stuck assertion is not possible. If the helper cannot run at all, the
app falls back to `powerSaveBlocker` rather than silently letting the Mac sleep.

Building needs the Xcode Command Line Tools for `clang` (`xcode-select
--install`). Forge compiles it for whichever architecture it is packaging.

## Icons

`assets/*Template.png` are generated, not hand-drawn. The shapes are signed distance
functions in `scripts/generate-tray-icons.mjs`, rendered at 1x/2x/3x with no image
dependencies. Both states share one mug silhouette so the icon never changes size in
the menu bar, and the mug is taller than it is wide — a short, wide cup reads as a
battery next to the other menu bar icons. The off state is struck through: fill
alone was too subtle to read at a glance, and it never said which state was which. Edit the shapes there and re-run:

```sh
npm run generate-icons
```

The `Template` suffix is a macOS convention: the images are black-with-alpha and the
system recolors them for light and dark menu bars.

## Contributing

Issues and pull requests are welcome at
[builtbyashish/awakebar](https://github.com/builtbyashish/awakebar). Run
`npm run typecheck` and `npm run lint` before opening one.

## License

[MIT](LICENSE) © Ashish Ranjan

## Known limits

- **Closing the lid still sleeps the Mac.** `powerSaveBlocker` prevents _idle_ sleep
  only; nothing in user space can override a clamshell close on modern macOS. Leave
  the lid open (the display may sleep) for long-running work.
- Blocking is released on quit, crash and logout, so a stuck blocker isn't possible.
- macOS only. The Windows/Linux makers were removed from the Forge config.

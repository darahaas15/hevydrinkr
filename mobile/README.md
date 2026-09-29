# hevydrinkr for iPhone

The native iOS app for hevydrinkr, built with Expo and React Native.
It runs on Apple's own UI (tab bar, navigation bar, sheets, alerts, haptics) and shares its logic with the web app in `../src`, so drinks, BAC, sessions and the feed behave the same in both.

## Run it on your Mac

You need macOS with Xcode 26 (for the iOS 26 tab bar), Node 22 (or 20.19 or newer), and CocoaPods (`brew install cocoapods`).

```bash
cd mobile
npm install
cp .env.example .env.local   # then fill in the Supabase URL and anon key the web app uses
npm run ios                  # builds the app and opens it in the iOS Simulator
```

The first build takes a few minutes; after that, `npm start` reloads JavaScript changes instantly.

To run it on your iPhone, connect it with a cable (or pair it over Wi-Fi in Xcode), then:

```bash
npm run ios:device
```

The first device build needs a signing team.
Either add `"appleTeamId": "<your team id>"` under `"ios"` in `app.json` (the ID is on developer.apple.com under Membership), or open `ios/Drinkr.xcworkspace` after the first build and pick your team under Signing & Capabilities.
The bundle ID is `com.drinkr.app`, which is what the push-notification backend already targets.

The app talks to whichever Supabase project `.env.local` points at, so with the production values you are using your real account and data.

### Taking it out with you

A development build loads its JavaScript from Metro on your Mac, so it only works while the phone can reach the Mac.
To try it for real on a night out, install a standalone release build instead, which carries its own JavaScript:

```bash
npm run ios:release
```

Rebuild it to pick up new changes.

## What's in this build

- Sign in and password reset (the reset link finishes on the web).
- Feed: Home and Discover, likes, sharing, people and post search, follow buttons.
- Sesh: start a session with venue suggestions, the live drink gauge and BAC, quick add, the drink picker (search, categories, starred drinks, prices, custom drinks), end with a mood and caption, the session summary, and the new-personal-record celebration.
- The live session in the tab bar's accessory, with one-tap re-logging of your last drink.
- Profile: Light and Dark themes, and signing out.

Not ported yet: sign-up, post details and comments, notifications and push, photos, profiles and settings beyond the theme, groups and party mode, the leaderboard, and logging and editing past sessions.

## Browser preview

`npm run web` serves the same screens in a browser for quick checks without a Mac.
It swaps in a web tab bar and plain header buttons, so it is not what the native chrome looks like.

## Working on it

Read `AGENTS.md` for how the code is shared with the web app, how the theme stays in sync, and the checks to run (`npm run ci`).

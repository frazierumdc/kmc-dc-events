# F4 — Install the app

> Requirements for helping people add the app to their phone's home screen.
> IDs (`IN-*`) are stable.
> Pictures: [design/README.md](../design/README.md#f4-install-the-app).
> Built in slice 1.7 of [PLAN.md](../PLAN.md).

## Why

The app is a web app with no app store (D1): people open a link and must add it to the home screen themselves.
On iPhone only Safari can add it, and where Safari keeps Share depends on the iOS version and the bar layout chosen in Settings.
From the home screen the app opens full screen from its own icon and keeps the schedule offline; in a Safari tab, iPhone may clear the saved schedule after a few weeks unused.

<p align="center">
<img src="../design/mockups/install/info-iphone-dark.png" width="180" alt="Info on iOS 27, dark">&nbsp;
<img src="../design/mockups/install/info-iphone-ios26.png" width="180" alt="Info on iOS 26">&nbsp;
<img src="../design/mockups/install/info-choose.png" width="180" alt="Which looks like yours?">&nbsp;
<img src="../design/mockups/install/info-android.png" width="180" alt="Info on Android">
</p>
<p align="center"><em>The steps as Info showed them before they moved to <code>/get-app</code> (the same steps and pictures): Safari on iOS 27 · iOS 26 · picking Safari's bar · Android. <a href="../design/README.md#f4-install-the-app">Gallery</a>.</em></p>

## Requirements

| ID | Requirement |
|---|---|
| IN-1 | **Never checks whether the app is installed.** Info looks the same in a browser and from the home screen; under **Add to Home Screen ›** it says "Opens full screen from its own icon and works with no connection. Already added? You're all set." Nothing about installing shows anywhere else: no install button in the top bar, no reminder. |
| IN-2 | **Steps for this browser.** `/get-app` (IN-10), which Info's **Add to Home Screen ›** ("home screen" on Android) opens, shows the steps for the browser it is opened in, found from the browser's own report: Safari on iOS 27 and later, Safari on iOS 26, Safari before iOS 26, another browser on iPhone, Chrome on Android, another browser on Android, or a computer. Safari's report hides the iOS version, so Safari's own version is used. An iPad asking for the desktop site counts as an iPhone. |
| IN-3 | **Safari's steps** start with a row "Steps for **Safari on iOS 27**" (or iOS 26, or "Share in Safari's bar") and **Not what you see?**. iOS 27: tap the Page Menu (≡) in the address bar; tap Share at the top of the menu; tap **View More**, "the fourth round button, under the apps" (already a long list: go on); tap Add to Home Screen in the list that opens; leave Open as Web App on, then tap Add at the top right. iOS 26: the same, starting with ⋯ at the bottom right. Share in the bar (Safari's Bottom or Top layout, or iOS 18 and earlier): tap Share in Safari's bar, then View More, Add to Home Screen and Add. |
| IN-4 | **Not what you see?** opens **Which looks like yours?** in place of the steps, with Back to the steps: pictures of Safari's bar on iOS 27 (≡ in the address bar, Tabs at the right) and on iOS 26 (⋯ at the right), and "A Share button in the bar", the one in use marked. Picking one shows its steps and is remembered on the phone. It never asks for a version number. |
| IN-5 | **Each step** is numbered, names the browser's own button in the browser's words with its icon in a small grey key, and shows a small picture of the part of Safari the reader sees then, the button to tap ringed in maroon: Safari's bar, the menu with Share at its top, the Share sheet with its round buttons and View More, the list with Add to Home Screen, and the Add to Home Screen screen with Add. The apps and the first three round buttons differ by phone, so the steps never name them. The pictures follow real iOS 27 screenshots, not Apple's guide, which lags; when a new iOS changes them, they are checked again on a real phone. |
| IN-6 | **Another browser** (Chrome, Firefox or Edge on iPhone, or a browser inside Instagram, Facebook, Gmail or another app) gets "Open this page in Safari first": only Safari can add the app to an iPhone's Home Screen, so copy the link, open Safari and paste it. **Copy link** copies the app's address and says "Link copied" for 2 seconds. On Android, a browser other than Chrome gets "Open this page in Chrome first", the same way. A computer gets "Open this page on your phone". |
| IN-7 | **Chrome on Android:** tap ⋮ on the right of the address bar, tap **Install and create shortcut**, tap **Install** (Google's Chrome Help). |
| IN-8 | **Feels native and accessible:** grouped cards on iPhone, Material rows on Android, as in Info; light and dark; text grows with the phone's text size. The steps are a numbered list; each button's icon has a name ("Page Menu", "More"); Safari's bars are radio buttons with clear names; Back, Not what you see? and Copy link are buttons. Targets are at least 44 pt on iPhone and 48 dp on Android. |
| IN-9 | **Privacy.** A **Privacy ›** row in Info, above Share the app, opens the privacy page inside the sheet, with Back to Info. The same words are a page of their own at `/privacy`, needing no script, with **Open the app ›**: for anyone with the link and for Google's sign-in review (NFR-5). Questions go to contact@example.org. The text lives in one place (`packages/ui/src/privacy.ts`), approved by the owner; any change to what the app keeps or contacts changes it too (C-10). |
| IN-10 | **The page for people new to the app,** at `/get-app` (also `/app`, sent there with a 301), for links, QR codes and posters. **Open the app** comes first and is the biggest thing on the page: the app's icon and name ("KMC DC Events", "Kadampa Meditation Center DC"), the headline **Classes and events at KMC DC** in large type, then "The app works best from your Home Screen." in a maroon highlight ("home screen" on Android), each always on one line, sized to fit the screen, then a full-width maroon **Open the app** that opens the app with its welcome (EV-42). Under it, the heading **Add it to your Home Screen** ("home screen" on Android) and "Tap ⚙ in the app to see these steps again.", with ⚙ drawn as the app's Settings button, then the app's own steps and pictures for this browser, found by the same rules (IN-2), with **Not what you see?** (IN-4), and "Then it opens full screen from its own icon."; another browser gets "Open this page in Safari first" (IN-6). In Safari on iOS 27 and iOS 26 the five steps fit the first screen and play by themselves: a list of the steps, each said short ("Tap Share."), over one scene where each of Safari's screens arrives as Safari draws it and a finger taps the ringed button, ending with the app on the Home Screen; the step playing is lit, with a line filling under it. It plays twice, then rests on step 1, where the button in the scene's corner says **↻ Replay** and plays it again from step 1 (also when stopped on the Home Screen); while it plays that button is **Pause** (44 pt), beside the pictures, never over the button to tap, and a tap on the scene shows the next step. With Reduce Motion nothing moves and there is no Pause: a tap shows the next step. The words and pictures are the ones Settings' steps use (one source for both); there the line about ⚙ comes after the steps. The playing steps are the owner's choice E4 of the install-step mock-ups (15 November 2026). The page gives no count of taps, no time to add it and no pointer at the browser's bar. On a computer a QR code for the site's `/get-app` leads. Added from this page, the Home Screen gets the app itself (its name, icon, start-up images and manifest), and opened from the Home Screen it goes straight to the schedule. A shared link previews with the app's icon, "Get KMC DC Events" and one line about the app. The page loads nothing from other companies (C-10), light and dark. Settings' **Add to Home Screen ›** opens `/get-app`, which then shows **‹ Back to the app** at the top (the Home Screen app has no browser Back), returning with no splash. Settings' **Share the app**, under Privacy, sends the link to `/get-app` with the phone's share menu, or copies it where there is none. The design is the owner's choice D of the Get page mock-ups (8 November 2026). |

## The steps

| Browser | Steps | Source |
|---|---|---|
| Safari, iOS 27 and later | ≡ (Page Menu) in the address bar › Share › View More › Add to Home Screen › Open as Web App on › Add | Maximiliano Firtman's iOS 27 screenshots (June 2026), Cult of Mac's and the owner's; the last screen from MacRumors' iOS 26 screenshots |
| Safari, iOS 26 | ⋯ (More) at the bottom right › Share › View More › Add to Home Screen › Open as Web App on › Add | Apple's iPhone User Guide for iOS 26; MacRumors' iOS 26 screenshots |
| Safari, Share in the bar | Share › View More › Add to Home Screen › Open as Web App on, if shown › Add | Apple's iPhone User Guide (Bottom and Top layouts; iOS 18) |
| Another browser on iPhone | Open the page in Safari (Copy link) | — |
| Chrome on Android | ⋮ › Install and create shortcut › Install | Google's Chrome Help, "Use web apps" |
| Another browser on Android | Open the page in Chrome (Copy link) | — |

Not yet seen on a real phone: iOS 27's Add to Home Screen screen, Safari's Bottom and Top layouts on iOS 26 and 27, and every Android screen.
The owner checks each row on a real phone (slice 1.7 step 4), and again when a new iOS or Chrome changes its menus.

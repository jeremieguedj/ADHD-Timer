# Chrome Web Store Listing Content

## Short Description (132 chars max)
Gentle, kid-friendly screen time reminders for Netflix. An animated bunny helps children with ADHD manage viewing time with care.

## Detailed Description

ADHD Netflix Timer helps parents set gentle, visual screen time limits for Netflix. Designed with ADHD-friendly principles, it uses a colorful pie-wedge countdown and an animated bunny character to help children transition away from screens without meltdowns.

HOW IT WORKS
- Set a time limit (30, 45, 60, or 90 minutes) or an episode limit (1, 2, or 3 episodes)
- A visual pie-wedge timer appears on screen, shrinking as time passes — inspired by the Time Timer visual countdown
- The timer gradually grows larger and changes colors to gently draw attention
- At key milestones (halfway, 10 minutes, 5 minutes, 90 seconds), a friendly bunny character walks across the screen with a spoken reminder
- When time is up, the child is taken to a cheerful "Great Job!" celebration page with a waving bunny and floating stars
- A discreet parent override button (hold 3 seconds) allows extending time if needed

KEY FEATURES
- Pie-wedge visual timer (like the Time Timer) — intuitive for kids who can't read clocks
- Animated bunny companion with customizable name
- Gentle graduated reminders — no sudden cutoffs
- Episode counting mode — auto-detects when episodes change
- Optional sound effects and voice reminders
- Blocks Netflix autoplay when on the last allowed episode
- Suggested next activity prompt ("snack time," "outside play," etc.)
- Reduced motion support for accessibility
- Dark, non-distracting overlay that blends with Netflix

WHO IT'S FOR
- Parents of children with ADHD who need help transitioning away from screens
- Families looking for a gentle, positive approach to screen time limits
- Caregivers who want to avoid arguments about "just one more episode"

PRIVACY
This extension collects no data whatsoever. All settings are stored locally on your device. No analytics, no tracking, no external servers. Your family's viewing habits stay private.

## Single Purpose Description
Displays visual screen time reminders and limits on Netflix for children with ADHD.

## Permission Justifications

### storage
Stores user preferences (timer duration, bunny name, sound settings) and active timer state locally so the timer persists across page refreshes and browser restarts. No data is sent externally.

### activeTab
Required to inject the timer overlay and bunny character onto the active Netflix tab when the user starts a timer from the popup.

### scripting
Used to programmatically inject the timer overlay when Netflix navigates between pages without a full reload (single-page app navigation). Without this, the timer would not appear until the user manually refreshes the page.

### tabs
Used to detect Netflix tab navigation (episode changes) and to communicate between the popup and the content script running on Netflix. Required for episode counting mode to track when a new episode begins.

### webNavigation
Detects when Netflix navigates to a new video (episode change) to increment the episode counter. This is essential for the episode-limit mode to work correctly.

### Host permission: https://www.netflix.com/*
The extension only operates on Netflix. This permission allows the content script to inject the visual timer overlay, bunny character animations, and reminder system directly onto Netflix video pages. The extension does not access, read, or modify any Netflix account data.

## Category
Productivity (or Well-being if available)

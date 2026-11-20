# Participant handoff — November 19

Recruitment: the owner confirmed they can arrange testers. No participant attempts have occurred yet.
Use 2–3 consenting non-technical people and aliases P1–P3. Allow five minutes per attempt without coaching.
These are lab-specific draft answers, not current check_install output or general WordPress instructions.

## Facilitator preparation (do not show participants)

1. Run Docker and open the local WordPress admin using the ignored local credentials.
2. Reset the assigned case with `node lab/wordpress/scenario.mjs wrong-slot`, `csp`, or `cached`.
3. Run check_install and preserve its raw output before each attempt.
4. Give the participant the browser on the WordPress dashboard, the broken page, and only the matching answer below. No terminal work is required from them.
5. Time their attempt. Record wrong turns and exact confusing words, including a failure to find Settings.
6. Verify success with check_install and configuration evidence. Record the attempt even if unsuccessful.
7. Rewrite only after observing a real difficulty; preserve this wording as v1-local. Reset and retest, recording prior exposure.

Do not expose local admin access over a public tunnel for participant testing. They can use this computer in person.
Keep names, credentials, and account screens out of public results. Screen recordings remain pending and need the participant's consent.

## Answer cards — v1-local, untested

### Wrong slot

The accessibility script is not loading on this page.

In WordPress, open **Settings → Install lab**, set **Code location** to **Site-wide header**, and click **Save installation**, then check the page again.

### Security policy

Your website's script security policy blocked the accessibility script.

In WordPress, open **Settings → Install lab**, click **Allow WebAbility script**, then check the page again.

### Old cached page

The page served to this check did not contain the accessibility script.

In WordPress, open **Settings → Install lab**, click **Clear page cache**, then check the page again.

## Record each attempt

| Alias | Case | Wording version | Prior exposure? | Independent repair? | Seconds | Wrong turns / confusing words | Verification run |
|---|---|---|---|---|---|---|---|

Do not prefill outcomes. Report successes out of attempts and the number of distinct participants.
An agent verifying these controls is functional testing, not a participant result.

## Assignment for the two confirmed friends

Send each person: “Could you help test instructions for fixing a deliberately broken test website? No coding knowledge is needed. It takes about 15–20 minutes on my laptop. You will get a short instruction and up to five minutes to try each repair. Please say what you are thinking and point out confusing words. We are testing the instructions, not you. You can stop whenever you like.”

Ask separately whether they consent to recording; do not record them without it. They do not need to create accounts, pay anything or share credentials. Do not send the facilitator reset steps or all answer cards in advance.

First round: P1 tries wrong slot then cache; P2 tries CSP then wrong slot. This yields four attempts across three cases. Give only that case's answer card each time. After real observations, revise confusing wording, reset cases and swap assignments where possible. Record any previous exposure. Leave results blank until attempts occur; a five-minute unsuccessful attempt is valid evidence.

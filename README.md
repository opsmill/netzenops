# NetZenOps

Affirmations for the network automation engineer, inspired by [srenity.online](https://www.srenity.online/) (a [krazam.tv](https://www.youtube.com/watch?v=ia8Q51ouA_s) production). Press the button, breathe in, and let a soothing voice remind you that your YAML is fine.

Published with GitHub Pages at <https://opsmill.github.io/netzenops/>.

## How it works

It's a static site with no build step: `index.html`, `style.css` and `app.js` served straight from `main`.

1. The page loads `quotes.md` and turns every Markdown list item into a quote.
2. Clicking **FIND NETZENOPS** starts the ambient sound and the affirmation loop. Browsers block audio until the visitor interacts, which is why the button exists.
3. Quotes play in shuffled order and none repeats until all of them have played. Each quote fades in and its voice-over plays from `audio/`. After a 2 second pause the next one starts, and the background topology re-converges in a new colour.
4. A quote with no audio file still shows, it stays on screen for roughly the time it takes to read (6 seconds at minimum).
5. If there is no `audio/ambient.mp3`, a quiet synth pad is generated in the browser so the room is never completely silent.

## Editing quotes

Edit [quotes.md](quotes.md) and push. One quote per list item. Anything else in the file is ignored.

```markdown
- Why is my proof of concept from 2019 still running in production?
- Why is my change window always so quiet? <!-- audio: quiet-change-window -->
```

The first line looks for `audio/why-is-my-proof-of-concept-from-2019-still-running-in-production.mp3`. The second uses the override and looks for `audio/quiet-change-window.mp3`. The comment doesn't show in rendered Markdown and is stripped from the on-screen text.

Note: the default filename comes from the quote text, so fixing a typo in a quote changes the file it expects. Add an `<!-- audio: ... -->` override first if you'd rather not re-export or rename the audio.

## Editing background words

The terms that float up through the background (`router bgp`, `pytest` and friends) come from [terms.md](terms.md), one per list item, same rules as `quotes.md`. Edit and push. Keep them short, they drift past in small faint monospace. An empty list turns the floating words off.

## Adding audio

The quickest route is the generator script, which calls the ElevenLabs API and writes each clip under the right filename. Quotes alternate between "Posh - A British Woman" and "Tarquin - Posh & English RP" in file order, using the `eleven_v3` model. Clips that already exist are skipped, so after adding a quote only the new one is generated.

```bash
printf 'ELEVENLABS_API_KEY=%s\n' 'your-key' > .env   # gitignored
uv run scripts/generate_audio.py --dry-run           # show the plan, no API calls
uv run scripts/generate_audio.py                     # generate missing clips
uv run scripts/generate_audio.py --force --only "conf t"   # re-roll one take
```

Note: v3 varies between takes. If one sounds rushed or odd, re-roll it with `--force --only "<part of the quote>"`.

To do it by hand instead, export each quote from ElevenLabs as MP3 and drop it in `audio/` using the filename below. The slug rule: lowercase, accents and apostrophes removed, every run of other characters replaced with a single hyphen.

| Quote | File |
| --- | --- |
| Why does it take me three days to automate a ten-minute task, and why am I right to do it? | `why-does-it-take-me-three-days-to-automate-a-ten-minute-task-and-why-am-i-right-to-do-it.mp3` |
| How did I turn one messy config into four hundred perfectly reproducible messy configs? | `how-did-i-turn-one-messy-config-into-four-hundred-perfectly-reproducible-messy-configs.mp3` |
| Why do I enjoy fixing legacy systems that nobody remembers buying? | `why-do-i-enjoy-fixing-legacy-systems-that-nobody-remembers-buying.mp3` |
| How did I simplify our infrastructure down to seven tools, three repos and a cron job? | `how-did-i-simplify-our-infrastructure-down-to-seven-tools-three-repos-and-a-cron-job.mp3` |
| Why does typing "conf t" now feel like a moral failing? | `why-does-typing-conf-t-now-feel-like-a-moral-failing.mp3` |
| Why do I keep discovering powerful new tools that promise exactly what the last one did? | `why-do-i-keep-discovering-powerful-new-tools-that-promise-exactly-what-the-last-one-did.mp3` |
| How did I become fluent in both "it's not the network" and "works on my machine"? | `how-did-i-become-fluent-in-both-its-not-the-network-and-works-on-my-machine.mp3` |
| Why do my teammates call me "the automation person" like it's a diagnosis? | `why-do-my-teammates-call-me-the-automation-person-like-its-a-diagnosis.mp3` |
| How do I stay so calm when the whole outage was two spaces of YAML indentation? | `how-do-i-stay-so-calm-when-the-whole-outage-was-two-spaces-of-yaml-indentation.mp3` |
| Why am I so great at spotting patterns in logs, especially the one where it's DNS? | `why-am-i-so-great-at-spotting-patterns-in-logs-especially-the-one-where-its-dns.mp3` |
| Why does my network get more resilient every time I stop people touching it? | `why-does-my-network-get-more-resilient-every-time-i-stop-people-touching-it.mp3` |
| Why is teaching automation so easy, and stopping people running it against production so hard? | `why-is-teaching-automation-so-easy-and-stopping-people-running-it-against-production-so-hard.mp3` |
| Why do I trust myself to learn any new tool, even the one we'll replace next quarter? | `why-do-i-trust-myself-to-learn-any-new-tool-even-the-one-well-replace-next-quarter.mp3` |
| Why do I keep finding new value in my network data, mostly that half of it is wrong? | `why-do-i-keep-finding-new-value-in-my-network-data-mostly-that-half-of-it-is-wrong.mp3` |
| Why do all my network tests pass, and why do they only check that the YAML parses? | `why-do-all-my-network-tests-pass-and-why-do-they-only-check-that-the-yaml-parses.mp3` |
| Why is my spreadsheet of IP addresses called a source of truth now? | `why-is-my-spreadsheet-of-ip-addresses-called-a-source-of-truth-now.mp3` |
| How did I learn to take down four hundred switches as reliably as one? | `how-did-i-learn-to-take-down-four-hundred-switches-as-reliably-as-one.mp3` |
| Why does everyone trust the pipeline, when it's just me with extra steps? | `why-does-everyone-trust-the-pipeline-when-its-just-me-with-extra-steps.mp3` |
| Why do my Jinja templates have more if statements than the config has lines? | `why-do-my-jinja-templates-have-more-if-statements-than-the-config-has-lines.mp3` |
| How did I become the person who says "idempotent" at dinner parties? | `how-did-i-become-the-person-who-says-idempotent-at-dinner-parties.mp3` |
| Why is my rollback plan, git revert and hope, so effective? | `why-is-my-rollback-plan-git-revert-and-hope-so-effective.mp3` |
| Why is my proof of concept from 2019 still running in production? | `why-is-my-proof-of-concept-from-2019-still-running-in-production.mp3` |
| Why does parsing show command output with regex bring me such peace? | `why-does-parsing-show-command-output-with-regex-bring-me-such-peace.mp3` |
| Why does my network have perfect drift detection, and absolutely no drift remediation? | `why-does-my-network-have-perfect-drift-detection-and-absolutely-no-drift-remediation.mp3` |
| Why do I branch my network data like code, and still merge on a Friday? | `why-do-i-branch-my-network-data-like-code-and-still-merge-on-a-friday.mp3` |
| Why do I feel so calm knowing the vendor API changes next release? | `why-do-i-feel-so-calm-knowing-the-vendor-api-changes-next-release.mp3` |
| Why does my change window feel so peaceful at 2am on a Sunday? | `why-does-my-change-window-feel-so-peaceful-at-2am-on-a-sunday.mp3` |

To replace the synth pad, add a loopable track as `audio/ambient.mp3`. It plays at half volume underneath the voice.

If a quote isn't playing its audio, open the browser console. The page logs every audio path it tried and couldn't find.

## Running locally

`fetch()` doesn't work over `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Credits

The concept, the Papyrus and the "find serenity" button all come from [srenity.online](https://www.srenity.online/) by Krazam. This repo reuses none of its video or audio assets. The background is a generated network topology instead.

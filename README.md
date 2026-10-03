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
- Why does my network get more resilient the more I automate?
- Why is my change window always so quiet? <!-- audio: quiet-change-window -->
```

The first line looks for `audio/why-does-my-network-get-more-resilient-the-more-i-automate.mp3`. The second uses the override and looks for `audio/quiet-change-window.mp3`. The comment doesn't show in rendered Markdown and is stripped from the on-screen text.

Note: the default filename comes from the quote text, so fixing a typo in a quote changes the file it expects. Add an `<!-- audio: ... -->` override first if you'd rather not re-export or rename the audio.

## Adding audio

Export each quote from ElevenLabs as MP3 and drop it in `audio/` using the filename below. The slug rule: lowercase, accents and apostrophes removed, every run of other characters replaced with a single hyphen.

| Quote | File |
| --- | --- |
| Why am I always finding smarter ways to automate network tasks? | `why-am-i-always-finding-smarter-ways-to-automate-network-tasks.mp3` |
| How did I become so good at turning messy configs into clean, reproducible code? | `how-did-i-become-so-good-at-turning-messy-configs-into-clean-reproducible-code.mp3` |
| Why do I enjoy solving problems that others avoid in legacy systems? | `why-do-i-enjoy-solving-problems-that-others-avoid-in-legacy-systems.mp3` |
| How did I become the kind of person who simplifies complex infrastructure? | `how-did-i-become-the-kind-of-person-who-simplifies-complex-infrastructure.mp3` |
| Why does network automation feel more natural to me every day? | `why-does-network-automation-feel-more-natural-to-me-every-day.mp3` |
| Why do I keep discovering powerful tools that make my job easier? | `why-do-i-keep-discovering-powerful-tools-that-make-my-job-easier.mp3` |
| How did I become so skilled at bridging traditional networking with modern DevOps practices? | `how-did-i-become-so-skilled-at-bridging-traditional-networking-with-modern-devops-practices.mp3` |
| Why do I attract teammates and mentors who help me grow? | `why-do-i-attract-teammates-and-mentors-who-help-me-grow.mp3` |
| How do I stay so calm when troubleshooting thousands of lines of YAML and Python? | `how-do-i-stay-so-calm-when-troubleshooting-thousands-of-lines-of-yaml-and-python.mp3` |
| Why am I so great at spotting patterns in logs, configs, and code? | `why-am-i-so-great-at-spotting-patterns-in-logs-configs-and-code.mp3` |
| Why does my network get more resilient the more I automate? | `why-does-my-network-get-more-resilient-the-more-i-automate.mp3` |
| Why do I find it so easy to teach others what I’ve learned in automation? | `why-do-i-find-it-so-easy-to-teach-others-what-ive-learned-in-automation.mp3` |
| Why do I trust myself to learn any new tool—be it Nornir, Ansible, or Terraform? | `why-do-i-trust-myself-to-learn-any-new-tool-be-it-nornir-ansible-or-terraform.mp3` |
| Why do I keep uncovering new layers of value in the data my network provides? | `why-do-i-keep-uncovering-new-layers-of-value-in-the-data-my-network-provides.mp3` |
| Why does writing tests for my network code feel like second nature now? | `why-does-writing-tests-for-my-network-code-feel-like-second-nature-now.mp3` |

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

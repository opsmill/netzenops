# NetZenOps quotes

One quote per list item. The site reads this file at load time, so editing it
and pushing to `main` is all it takes to change what plays.

Audio lives in `audio/` and is matched by filename. By default the filename is
the quote turned into a slug (lowercase, punctuation dropped, spaces become
hyphens) with `.mp3` on the end. To use a shorter name, add an HTML comment to
the end of the line, for example `<!-- audio: smarter-ways -->`, and the site
will look for `audio/smarter-ways.mp3` instead. Quotes with no audio file are
still shown, they just stay on screen for a timed interval.

Anything that is not a list item (like this paragraph) is ignored.

## Quotes

- Why does it take me three days to automate a ten-minute task, and why am I right to do it?
- How did I turn one messy config into four hundred perfectly reproducible messy configs?
- Why do I enjoy fixing legacy systems that nobody remembers buying?
- How did I simplify our infrastructure down to seven tools, three repos and a cron job?
- Why does typing "conf t" now feel like a moral failing?
- Why do I keep discovering powerful new tools that promise exactly what the last one did?
- How did I become fluent in both "it's not the network" and "works on my machine"?
- Why do my teammates call me "the automation person" like it's a diagnosis?
- How do I stay so calm when the whole outage was two spaces of YAML indentation?
- Why am I so great at spotting patterns in logs, especially the one where it's DNS?
- Why does my network get more resilient every time I stop people touching it?
- Why is teaching automation so easy, and stopping people running it against production so hard?
- Why do I trust myself to learn any new tool, even the one we'll replace next quarter?
- Why do I keep finding new value in my network data, mostly that half of it is wrong?
- Why do all my network tests pass, and why do they only check that the YAML parses?
- Why is my spreadsheet of IP addresses called a source of truth now?
- How did I learn to take down four hundred switches as reliably as one?
- Why does everyone trust the pipeline, when it's just me with extra steps?
- Why do my Jinja templates have more if statements than the config has lines?
- How did I become the person who says "idempotent" at dinner parties?
- Why is my rollback plan, git revert and hope, so effective?
- Why is my proof of concept from 2019 still running in production?
- Why does parsing show command output with regex bring me such peace?
- Why does my network have perfect drift detection, and absolutely no drift remediation?
- Why do I branch my network data like code, and still merge on a Friday?
- Why do I feel so calm knowing the vendor API changes next release?
- Why does my change window feel so peaceful at 2am on a Sunday?

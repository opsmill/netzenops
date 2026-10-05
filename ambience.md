# NetZenOps ambience

The background sound menu: every place a network engineer ends up doing their
best work, or at least their most urgent work. Options appear in the menu in
this order.

Each option is a top-level list item, `Name: tagline`. The name and the
tagline both show in the menu. Indented underneath it go settings:

- `prompt:` what `scripts/generate_ambience.py` asks the ElevenLabs Sound
  Effects API to generate, as a 30-second seamless loop.
- `audio:` (optional) a filename to use instead of the default, which is the
  name turned into a slug (`Data center` plays `audio/ambience/data-center.mp3`).
- `builtin:` (optional) `synth` for the drone generated in the browser, or
  `off` for silence. Built-in options need no prompt or file.

An option whose file does not exist yet is left out of the menu, so it is safe
to list ideas before generating them. The first option in the menu is the
default. Anything outside the "Ambiences" list below is ignored.

## Ambiences

- Data center: Hot aisle, cold aisle, no phone signal. Bring a hoodie.
  - prompt: Inside a large data center hall, constant loud roar of server fans and cooling units, steady broadband white noise, faint electrical hum, no voices
- Airplane cabin: Pushing configs at 35,000 feet over in-flight Wi-Fi.
  - prompt: Inside a commercial airplane cabin at cruising altitude, steady low jet engine drone and air vent hiss, muffled and constant, no announcements, no voices
- Conference center: Nodding along to the keynote while fixing prod.
  - prompt: Busy conference center hallway between sessions, indistinct crowd murmur, distant footsteps, occasional coffee cups clinking, no clear words
- Network operations center: The night shift. Every dashboard is green and nobody trusts it.
  - prompt: Quiet network operations center at night, soft hum of computers and air conditioning, sparse keyboard typing and mouse clicks, no voices
- Wiring closet: One switch fan, one flickering light, zero cable labels.
  - prompt: Small cramped wiring closet, single network switch fan whining, fluorescent light buzzing, muffled office noise through a closed door
- Change window at 2am: The change is approved. Sleep is not.
  - prompt: Quiet home office at 2am, laptop fan whirring softly, occasional keyboard typing, distant fridge hum, light rain on the window
- Airport gate: Boarding in ten minutes, merge request in five.
  - prompt: Airport departure gate, distant muffled crowd chatter, suitcase wheels rolling past, soft background hum, no clear words, no announcements
- Hotel room: On site tomorrow, troubleshooting tonight.
  - prompt: Hotel room at night, constant air conditioning unit hum, faint distant city traffic, quiet and steady
- Coffee shop: Remote access over somebody else's Wi-Fi.
  - prompt: Cozy coffee shop, quiet indistinct chatter, espresso machine hiss, cups and saucers clinking, no music, no clear words
- Synth pad: Pure, unearned serenity. No hardware was harmed.
  - builtin: synth
- Off: Just you and the voice in your head.
  - builtin: off

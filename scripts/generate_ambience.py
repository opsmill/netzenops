# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Generate seamless ambience loops for every option in ambience.md.

Each option's indented `prompt:` setting goes to the ElevenLabs Sound Effects
API with looping enabled, and the clip is saved under the filename the site
derives from the option name in app.js. Built-in options are skipped. Existing files are skipped unless
--force is given.

Cost: ElevenLabs charges 40 credits per second when the duration is set, so a
30-second loop costs 1,200 credits.

Usage:
    uv run scripts/generate_ambience.py --dry-run
    uv run scripts/generate_ambience.py --only "data center"
    uv run scripts/generate_ambience.py --force --only "coffee"
"""

import argparse
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from generate_audio import (
    REPO_ROOT,
    ElevenLabsClient,
    ElevenLabsError,
    load_api_key,
    slugify,
)

AMBIENCE_FILE = REPO_ROOT / "ambience.md"
AMBIENCE_DIR = REPO_ROOT / "audio" / "ambience"
DEFAULT_DURATION_SECONDS = 30.0
CREDITS_PER_SECOND = 40

logger = logging.getLogger("generate_ambience")


@dataclass(frozen=True)
class Ambience:
    """An ambience option from ambience.md that needs a generated file."""

    name: str
    prompt: str
    filename: str


def parse_ambiences(markdown: str) -> list[Ambience]:
    """Extract generatable options, matching parseAmbiences() in app.js.

    Options live under the "## Ambiences" heading as `- Name: tagline`, with
    indented `- prompt:`, `- audio:` and `- builtin:` settings. Built-in options
    have nothing to generate and are left out.

    Args:
        markdown: Contents of ambience.md.

    Returns:
        Options in file order. An option without a prompt gets an empty prompt.
    """
    options: list[tuple[str, dict[str, str]]] = []
    in_section = False
    for line in markdown.splitlines():
        if re.match(r"^#{1,6}\s", line):
            in_section = bool(re.match(r"^##\s+Ambiences\s*$", line, re.IGNORECASE))
            continue
        if not in_section:
            continue
        option = re.match(r"^[-*+]\s+([^:]+?)\s*(?::.*)?$", line)
        setting = re.match(r"^\s+[-*+]\s+(prompt|audio|builtin):\s*(.+?)\s*$", line, re.IGNORECASE)
        if option:
            options.append((option.group(1), {}))
        elif setting and options:
            options[-1][1][setting.group(1).lower()] = setting.group(2)

    ambiences = []
    for name, settings in options:
        if "builtin" in settings:
            continue
        stem = re.sub(r"\.mp3$", "", settings.get("audio", ""), flags=re.IGNORECASE)
        filename = f"{stem or slugify(name)}.mp3"
        ambiences.append(Ambience(name=name, prompt=settings.get("prompt", ""), filename=filename))
    return ambiences


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    parser.add_argument("--force", action="store_true", help="regenerate existing files")
    parser.add_argument("--dry-run", action="store_true", help="show the plan, call no APIs")
    parser.add_argument("--only", help="only options whose name contains this text")
    parser.add_argument(
        "--duration", type=float, default=DEFAULT_DURATION_SECONDS, help="seconds, 0.5 to 30"
    )
    return parser.parse_args()


def build_plan(args: argparse.Namespace) -> list[Ambience]:
    """Choose which ambiences to generate, logging the ones skipped."""
    plan = []
    for ambience in parse_ambiences(AMBIENCE_FILE.read_text()):
        if args.only and args.only.lower() not in ambience.name.lower():
            continue
        if (AMBIENCE_DIR / ambience.filename).exists() and not args.force:
            logger.info("skip  %s (exists)", ambience.filename)
            continue
        if not ambience.prompt:
            logger.warning("skip  %s (no prompt: setting)", ambience.name)
            continue
        plan.append(ambience)
    return plan


def main() -> None:
    """Plan and generate a loop for each ambience option."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    args = parse_args()
    if not 0.5 <= args.duration <= 30:
        raise ElevenLabsError("--duration must be between 0.5 and 30 seconds")

    plan = build_plan(args)
    credits = round(len(plan) * args.duration * CREDITS_PER_SECOND)
    logger.info("%d loops to generate, %.0fs each, about %d credits", len(plan), args.duration, credits)
    for ambience in plan:
        logger.info("  %s -> %s", ambience.name, ambience.filename)
    if args.dry_run or not plan:
        return

    client = ElevenLabsClient(load_api_key())
    AMBIENCE_DIR.mkdir(parents=True, exist_ok=True)
    for position, ambience in enumerate(plan, start=1):
        audio = client.sound_effect(ambience.prompt, args.duration, loop=True)
        target: Path = AMBIENCE_DIR / ambience.filename
        target.write_bytes(audio)
        logger.info("%2d/%d wrote %s (%d KB)", position, len(plan), target.name, len(audio) // 1024)


if __name__ == "__main__":
    try:
        main()
    except ElevenLabsError as error:
        logger.error("ElevenLabs error: %s", error)
        raise SystemExit(1) from error

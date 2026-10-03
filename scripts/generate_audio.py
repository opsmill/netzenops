# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Generate ElevenLabs voice-overs for every quote in quotes.md.

Quotes alternate between the configured voices in file order, and each clip is
saved under the same filename the site derives in app.js. Existing files are
skipped unless --force is given, so adding a quote only costs credits for the
new one.

The API key is read from ELEVENLABS_API_KEY in the environment or in a .env
file at the repo root. It is never logged.

Usage:
    uv run scripts/generate_audio.py --dry-run
    uv run scripts/generate_audio.py
    uv run scripts/generate_audio.py --force --only "conf t"
"""

import argparse
import json
import logging
import os
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
QUOTES_FILE = REPO_ROOT / "quotes.md"
AUDIO_DIR = REPO_ROOT / "audio"
ENV_FILE = REPO_ROOT / ".env"
API_BASE = "https://api.elevenlabs.io"
DEFAULT_VOICES = ["Posh - A British Woman", "Tarquin - Posh & English RP"]
DEFAULT_MODEL = "eleven_v3"
OUTPUT_FORMAT = "mp3_44100_128"

logger = logging.getLogger("generate_audio")


class ElevenLabsError(Exception):
    """Raised when the ElevenLabs API returns an error or an unexpected result."""


@dataclass(frozen=True)
class Quote:
    """A quote from quotes.md and the audio filename the site expects for it."""

    text: str
    filename: str


def slugify(text: str) -> str:
    """Turn quote text into a filename stem, matching slugify() in app.js.

    Args:
        text: The quote text.

    Returns:
        Lowercase, accent-free, apostrophe-free text with every other run of
        non-alphanumeric characters replaced by a single hyphen.
    """
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(char for char in decomposed if not unicodedata.combining(char))
    lowered = re.sub(r"['’]", "", stripped.lower())
    return re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")


def parse_quotes(markdown: str) -> list[Quote]:
    """Extract quotes from Markdown list items, matching parseQuotes() in app.js.

    Args:
        markdown: Contents of quotes.md.

    Returns:
        Quotes in file order, honouring any <!-- audio: name --> override.
    """
    quotes = []
    for line in markdown.splitlines():
        item = re.match(r"^\s*[-*+]\s+(.+?)\s*$", line)
        if not item:
            continue
        text = item.group(1)
        stem = None
        override = re.search(r"<!--\s*audio:\s*([^\s>]+?)\s*-->", text, re.IGNORECASE)
        if override:
            stem = re.sub(r"\.mp3$", "", override.group(1), flags=re.IGNORECASE)
            text = text.replace(override.group(0), "").strip()
        if text:
            quotes.append(Quote(text=text, filename=f"{stem or slugify(text)}.mp3"))
    return quotes


def load_api_key() -> str:
    """Read the ElevenLabs API key from the environment or the repo .env file.

    Returns:
        The API key.

    Raises:
        ElevenLabsError: If no key is configured.
    """
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key and ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            match = re.match(r"^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*(.*?)\s*$", line)
            if match:
                key = match.group(1).strip("'\"")
    if not key:
        raise ElevenLabsError(f"Set ELEVENLABS_API_KEY in the environment or in {ENV_FILE}")
    return key


class ElevenLabsClient:
    """Minimal ElevenLabs REST client covering voice lookup and text to speech."""

    def __init__(self, api_key: str) -> None:
        """Store the API key used for every request.

        Args:
            api_key: ElevenLabs API key.
        """
        self._api_key = api_key

    def _request(self, method: str, path: str, body: dict | None = None) -> bytes:
        """Send a request and return the raw response body.

        Args:
            method: HTTP method.
            path: Path and query string, relative to the API base URL.
            body: Optional JSON body.

        Returns:
            The response body.

        Raises:
            ElevenLabsError: On any HTTP or network failure.
        """
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(f"{API_BASE}{path}", data=data, method=method)
        request.add_header("xi-api-key", self._api_key)
        if data is not None:
            request.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")[:500]
            raise ElevenLabsError(f"{method} {path.split('?')[0]} -> {error.code}: {detail}")
        except urllib.error.URLError as error:
            raise ElevenLabsError(f"{method} {path.split('?')[0]} failed: {error.reason}")

    def _get_json(self, path: str) -> dict:
        """GET a path and decode the JSON response."""
        return json.loads(self._request("GET", path))

    def resolve_voice(self, name: str) -> str:
        """Find a voice ID by exact name, adding it from the Voice Library if needed.

        Args:
            name: Voice name as shown in ElevenLabs.

        Returns:
            A voice ID usable for text to speech.

        Raises:
            ElevenLabsError: If no voice with that exact name exists.
        """
        for voice in self._get_json("/v1/voices").get("voices", []):
            if voice["name"] == name:
                logger.info("Found voice in My Voices", extra={"voice": name})
                return voice["voice_id"]

        query = urllib.parse.urlencode({"search": name, "page_size": 50})
        for voice in self._get_json(f"/v1/shared-voices?{query}").get("voices", []):
            if voice["name"] == name:
                path = f"/v1/voices/add/{voice['public_owner_id']}/{voice['voice_id']}"
                added = json.loads(self._request("POST", path, {"new_name": name}))
                logger.info("Added voice from the Voice Library", extra={"voice": name})
                return added["voice_id"]
        raise ElevenLabsError(f"No voice named {name!r} in My Voices or the Voice Library")

    def synthesize(self, voice_id: str, text: str, model: str) -> bytes:
        """Render text to MP3 audio.

        Args:
            voice_id: Voice to speak with.
            text: Text to speak.
            model: ElevenLabs model ID.

        Returns:
            MP3 bytes.
        """
        path = f"/v1/text-to-speech/{voice_id}?output_format={OUTPUT_FORMAT}"
        return self._request("POST", path, {"text": text, "model_id": model})


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    parser.add_argument("--force", action="store_true", help="regenerate existing files")
    parser.add_argument("--dry-run", action="store_true", help="show the plan, call no APIs")
    parser.add_argument("--only", help="only quotes containing this text (case-insensitive)")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="ElevenLabs model ID")
    parser.add_argument(
        "--voice", action="append", dest="voices", help="voice name, repeat to alternate"
    )
    return parser.parse_args()


def main() -> None:
    """Plan and generate the voice-over for each quote."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    args = parse_args()
    voices = args.voices or DEFAULT_VOICES
    quotes = parse_quotes(QUOTES_FILE.read_text())

    plan = []
    for index, quote in enumerate(quotes):
        voice = voices[index % len(voices)]
        target = AUDIO_DIR / quote.filename
        if args.only and args.only.lower() not in quote.text.lower():
            continue
        if target.exists() and not args.force:
            logger.info("skip  %s (exists)", quote.filename)
            continue
        plan.append((quote, voice, target))

    characters = sum(len(quote.text) for quote, _, _ in plan)
    logger.info("%d clips to generate, %d characters, model %s", len(plan), characters, args.model)
    for quote, voice, _ in plan:
        logger.info("  [%s] %s", voice.split(" - ")[0], quote.text)
    if args.dry_run or not plan:
        return

    client = ElevenLabsClient(load_api_key())
    voice_ids = {voice: client.resolve_voice(voice) for voice in {v for _, v, _ in plan}}
    AUDIO_DIR.mkdir(exist_ok=True)
    for position, (quote, voice, target) in enumerate(plan, start=1):
        audio = client.synthesize(voice_ids[voice], quote.text, args.model)
        target.write_bytes(audio)
        logger.info("%2d/%d wrote %s (%d KB)", position, len(plan), target.name, len(audio) // 1024)


if __name__ == "__main__":
    try:
        main()
    except ElevenLabsError as error:
        logger.error("ElevenLabs error: %s", error)
        raise SystemExit(1) from error

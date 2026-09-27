"""Rate limiting shared by the app and individual routes (slowapi)."""
import os

from slowapi import Limiter
from slowapi.util import get_remote_address

RATE_LIMIT = os.environ.get("RATE_LIMIT", "120/minute")
VOICE_RATE_LIMIT = os.environ.get("VOICE_RATE_LIMIT", "10/minute")  # each miss costs ElevenLabs characters

limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT])

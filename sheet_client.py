"""HTTPS bridge to Apps Script. POST only once to prevent duplicate note edits."""
import os
from urllib.parse import urljoin, urlparse

import requests
from dotenv import load_dotenv

load_dotenv()


def required(name):
    result = os.getenv(name, '').strip()
    if not result or result.startswith('PASTE_'):
        raise SystemExit(f'[CONFIG] Please set {name} in your .env file')
    return result


WEBAPP_URL = required('WEBAPP_URL')
BOT_SECRET = required('BOT_SECRET')
if not WEBAPP_URL.startswith('https://script.google.com/macros/s/') or not WEBAPP_URL.endswith('/exec'):
    raise SystemExit('[CONFIG] WEBAPP_URL must be the deployed Apps Script /exec link')
if len(BOT_SECRET) < 24:
    raise SystemExit('[CONFIG] BOT_SECRET must be at least 24 characters')


def send_request(action: str, section: str, wallhop: str, username: str = '') -> dict:
    payload = dict(secret=BOT_SECRET, action=action, section=section, wallhop=wallhop, username=username)
    response = requests.post(WEBAPP_URL, json=payload, timeout=25, allow_redirects=False)
    for _ in range(5):
        if response.status_code not in (301, 302, 303, 307, 308):
            break
        location = response.headers.get('Location')
        if not location:
            raise RuntimeError('Google redirect was missing Location')
        new_url = urljoin(response.url, location)
        if (urlparse(new_url).hostname or '').lower() != 'script.googleusercontent.com':
            raise RuntimeError('Unexpected Google redirect; check web app deployment')
        # ContentService returns a redirect; retrieve output with GET, do not send POST again.
        response = requests.get(new_url, timeout=20, allow_redirects=False)
    if response.status_code != 200:
        raise RuntimeError(f'Google HTTP {response.status_code}. For add/remove, verify the sheet note before trying again.')
    try:
        data = response.json()
    except ValueError as exc:
        raise RuntimeError('Expected JSON from Google; check the web app deployment and account access') from exc
    if not isinstance(data, dict):
        raise RuntimeError('Unexpected Google response format')
    return data

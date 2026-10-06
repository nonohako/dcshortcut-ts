"""Publish an existing GitHub Release ZIP through Chrome Web Store API v2."""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile

REPOSITORY = 'nonohako/dcshortcut-ts'
API = 'https://chromewebstore.googleapis.com'
ACCEPTED_STATES = {'PENDING_REVIEW', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'}


def version_for(tag):
    if not re.fullmatch(r'v\d+\.\d+\.\d+(?:\.\d+)?', tag):
        raise ValueError('Expected a stable release tag such as v0.4.5.')
    version = tag[1:]
    if any(int(part) > 65535 or str(int(part)) != part for part in version.split('.')):
        raise ValueError('Invalid Chrome extension version.')
    return version


def zip_path(directory, tag):
    version_for(tag)
    return Path(directory) / f'dcshortcut-ts-{tag}-dist.zip'


def validate_zip(path, tag):
    version = version_for(tag)
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or 'manifest.json' not in names:
            raise ValueError('ZIP must contain one root manifest.json and no duplicate paths.')
        for name in names:
            normalized = name.replace('\\', '/')
            if normalized.startswith('/') or '..' in PurePosixPath(normalized).parts or ':' in normalized:
                raise ValueError('ZIP contains an unsafe path.')
            if normalized.startswith('dist/') or normalized.endswith('.map'):
                raise ValueError('Expected a production ZIP without dist prefix or source maps.')
        info = archive.getinfo('manifest.json')
        if info.file_size > 1024 * 1024:
            raise ValueError('Unexpected manifest size.')
        manifest = json.loads(archive.read(info))
        if manifest.get('version') != version or manifest.get('manifest_version') != 3:
            raise ValueError('Manifest version does not match the release tag.')
        if set(manifest.get('permissions', [])) != {'storage', 'commands', 'scripting', 'activeTab'}:
            raise ValueError('Unexpected extension permissions.')
        if manifest.get('host_permissions') or manifest.get('optional_host_permissions'):
            raise ValueError('Unexpected host permissions.')
        scripts = manifest.get('content_scripts', [])
        if not scripts or any(s.get('matches') != ['*://*.dcinside.com/*'] for s in scripts):
            raise ValueError('Unexpected content-script scope.')
        for required in ('background.js', 'content-script.js', 'content-script.css', 'dc-content.css', 'popup.html'):
            if required not in names:
                raise ValueError(f'Missing production asset: {required}')
    return version


def report(message):
    print(message)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as summary:
            summary.write(message + '\n\n')


def prepare(directory, tag):
    version_for(tag)
    path = zip_path(directory, tag)
    # gh release create can publish before its asset upload has completed.
    for attempt in range(13):
        release = json.loads(subprocess.check_output([
            'gh', 'release', 'view', tag, '--repo', REPOSITORY,
            '--json', 'tagName,isDraft,isPrerelease,assets',
        ], text=True, encoding='utf-8'))
        if release['tagName'] != tag or release['isDraft'] or release['isPrerelease']:
            raise ValueError('Only published stable releases can be submitted.')
        assets = [asset for asset in release['assets'] if asset['name'] == path.name]
        digest = assets[0].get('digest', '') if len(assets) == 1 else ''
        if len(assets) == 1 and assets[0].get('state') == 'uploaded' and re.fullmatch(r'sha256:[0-9a-f]{64}', digest):
            break
        if attempt == 12:
            raise ValueError('Completed release ZIP with SHA-256 digest not found. Attach it and rerun.')
        time.sleep(5)
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['gh', 'release', 'download', tag, '--repo', REPOSITORY,
                    '--pattern', path.name, '--dir', str(path.parent), '--clobber'], check=True)
    if 'sha256:' + hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise ValueError('Release ZIP digest mismatch.')
    validate_zip(path, tag)
    report(f'Validated {path.name} against release SHA-256 `{digest[7:]}`.')


def version_tuple(version):
    parts = tuple(int(part) for part in version.split('.'))
    return parts + (0,) * (4 - len(parts))


def preflight(status, version):
    if status.get('takenDown'):
        raise ValueError('Item is taken down. Check the Chrome Web Store dashboard.')
    for key in ('publishedItemRevisionStatus', 'submittedItemRevisionStatus'):
        revision = status.get(key) or {}
        state = revision.get('state')
        versions = [channel['crxVersion'] for channel in revision.get('distributionChannels', [])]
        if any(version_tuple(v) > version_tuple(version) for v in versions):
            raise ValueError('A newer version already exists in the store. Refusing an older release.')
        if version in versions and state in ACCEPTED_STATES:
            return state
        if key == 'submittedItemRevisionStatus' and state in {'PENDING_REVIEW', 'STAGED'}:
            raise ValueError('Another submission is pending or staged. Resolve it in the dashboard first.')
        if version in versions and state == 'REJECTED':
            raise ValueError('This version was rejected. Check review feedback before submitting again.')
    return None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class StoreAPI:
    def __init__(self, publisher, extension, token):
        if not re.fullmatch(r'[A-Za-z0-9_-]+', publisher) or not re.fullmatch(r'[a-p]{32}', extension):
            raise ValueError('Invalid publisher or extension ID.')
        if not token:
            raise ValueError('Missing Chrome Web Store access token.')
        self.name = f'publishers/{publisher}/items/{extension}'
        self.token = token

    def __call__(self, action, data=None):
        prefix = '/upload/v2/' if action == 'upload' else '/v2/'
        url = f'{API}{prefix}{self.name}:{action}'
        headers = {'Authorization': f'Bearer {self.token}'}
        if data is not None:
            headers['Content-Type'] = 'application/zip' if action == 'upload' else 'application/json'
        request = urllib.request.Request(url, data=data, headers=headers,
                                         method='GET' if action == 'fetchStatus' else 'POST')
        try:
            with urllib.request.build_opener(NoRedirect).open(request, timeout=120) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Do not print request headers, credentials or arbitrary response bodies.
            raise RuntimeError(f'Chrome Web Store {action}: HTTP {error.code}. Check API access and the developer dashboard.') from None
        except (urllib.error.URLError, TimeoutError):
            raise RuntimeError(f'Chrome Web Store {action} did not return a result. Check the dashboard before retrying.') from None


def submit(path, tag, api, sleep=time.sleep, poll_attempts=20):
    version = validate_zip(path, tag)
    existing = preflight(api('fetchStatus'), version)
    if existing:
        report(f'{version}: already {existing}; no upload or resubmission performed.')
        return existing
    uploaded = api('upload', path.read_bytes())
    if uploaded.get('crxVersion') and uploaded['crxVersion'] != version:
        raise ValueError('Upload response version does not match the ZIP.')
    state = uploaded.get('uploadState')
    for _ in range(poll_attempts):
        if state not in {'IN_PROGRESS', 'UPLOAD_IN_PROGRESS'}:
            break
        sleep(15)
        state = api('fetchStatus').get('lastAsyncUploadState')
    if state != 'SUCCEEDED':
        raise RuntimeError('Upload did not succeed within the polling window; nothing was submitted. Check the dashboard.')
    published = api('publish', json.dumps({'publishType': 'DEFAULT_PUBLISH', 'skipReview': False}).encode())
    state = published.get('state')
    if state not in ACCEPTED_STATES:
        raise RuntimeError('Publish returned an unexpected state. Check the dashboard before retrying.')
    report(f'{version}: {state}. Approval is controlled by Google; approved submissions publish automatically.')
    if published.get('warningInfo', {}).get('warnings'):
        report('The store returned validation warnings. Check the developer dashboard.')
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('prepare', 'validate', 'submit'))
    parser.add_argument('--tag', required=True)
    parser.add_argument('--directory', required=True)
    args = parser.parse_args()
    path = zip_path(args.directory, args.tag)
    if args.command == 'prepare':
        prepare(args.directory, args.tag)
    elif args.command == 'validate':
        report(f'ZIP validated: {validate_zip(path, args.tag)}')
    else:
        api = StoreAPI(os.environ.get('CWS_PUBLISHER_ID', ''),
                       os.environ.get('CWS_EXTENSION_ID', ''),
                       os.environ.get('CWS_ACCESS_TOKEN', ''))
        submit(path, args.tag, api)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, OSError, subprocess.CalledProcessError, zipfile.BadZipFile) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)

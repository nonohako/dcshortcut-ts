import json
from pathlib import Path
import tempfile
import unittest
import zipfile
from unittest.mock import patch

from webstore_publish import preflight, submit, validate_zip, version_for


class PublisherTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / 'release.zip'
        self.manifest = {
            'version': '0.4.5', 'manifest_version': 3,
            'permissions': ['storage', 'commands', 'scripting', 'activeTab'],
            'content_scripts': [{'matches': ['*://*.dcinside.com/*']}],
        }
        self.write_zip()

    def write_zip(self, extra=None):
        with zipfile.ZipFile(self.path, 'w') as archive:
            archive.writestr('manifest.json', json.dumps(self.manifest))
            for name in ('background.js', 'content-script.js', 'content-script.css', 'dc-content.css', 'popup.html'):
                archive.writestr(name, '')
            if extra:
                archive.writestr(extra, '')

    def fake_api(self, responses):
        calls = []
        def api(action, data=None):
            calls.append((action, data))
            response = responses.pop(0)
            if isinstance(response, Exception):
                raise response
            return response
        return api, calls

    @staticmethod
    def status(state, version='0.4.5', key='submittedItemRevisionStatus'):
        return {key: {'state': state, 'distributionChannels': [{'crxVersion': version}]}}

    def test_zip_version_and_scope(self):
        self.assertEqual(validate_zip(self.path, 'v0.4.5'), '0.4.5')
        with self.assertRaises(ValueError):
            validate_zip(self.path, 'v0.4.6')
        self.manifest['permissions'].append('tabs')
        self.write_zip()
        with self.assertRaises(ValueError):
            validate_zip(self.path, 'v0.4.5')

    def test_invalid_tag_and_zip_paths(self):
        for tag in ('main', 'v0.4.5-beta', 'v0.04.5', 'v0.4.65536', '../../bad'):
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                version_for(tag)
        for name in ('../secret', 'dist/file.js', 'content-script.js.map'):
            self.write_zip(name)
            with self.subTest(name=name), self.assertRaises(ValueError):
                validate_zip(self.path, 'v0.4.5')

    def test_pending_or_published_is_idempotent(self):
        for state in ('PENDING_REVIEW', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'):
            api, calls = self.fake_api([self.status(state)])
            with patch('webstore_publish.report'):
                self.assertEqual(submit(self.path, 'v0.4.5', api), state)
            self.assertEqual([c[0] for c in calls], ['fetchStatus'])

    def test_conflicting_submission_and_downgrade(self):
        for state, version in (('PENDING_REVIEW', '0.4.4'), ('STAGED', '0.4.5'), ('REJECTED', '0.4.5'), ('PUBLISHED', '0.4.6')):
            with self.subTest(state=state), self.assertRaises(ValueError):
                preflight(self.status(state, version), '0.4.5')
        with self.assertRaises(ValueError):
            preflight({'takenDown': True}, '0.4.5')

    def test_async_upload_then_review(self):
        api, calls = self.fake_api([
            {}, {'uploadState': 'IN_PROGRESS'}, {'lastAsyncUploadState': 'IN_PROGRESS'},
            {'lastAsyncUploadState': 'SUCCEEDED'}, {'state': 'PENDING_REVIEW'},
        ])
        with patch('webstore_publish.report'):
            self.assertEqual(submit(self.path, 'v0.4.5', api, sleep=lambda _: None), 'PENDING_REVIEW')
        self.assertEqual([c[0] for c in calls], ['fetchStatus', 'upload', 'fetchStatus', 'fetchStatus', 'publish'])
        self.assertEqual(calls[1][1], self.path.read_bytes())
        self.assertEqual(json.loads(calls[-1][1]), {'publishType': 'DEFAULT_PUBLISH', 'skipReview': False})

    def test_failed_or_timed_out_upload_never_publishes(self):
        for state in ('FAILED', 'NOT_FOUND', 'IN_PROGRESS', None):
            api, calls = self.fake_api([{}, {'uploadState': state}])
            with self.subTest(state=state), self.assertRaises(RuntimeError):
                submit(self.path, 'v0.4.5', api, poll_attempts=0)
            self.assertNotIn('publish', [c[0] for c in calls])

    def test_wrong_upload_version_never_publishes(self):
        api, calls = self.fake_api([{}, {'uploadState': 'SUCCEEDED', 'crxVersion': '0.4.6'}])
        with self.assertRaises(ValueError):
            submit(self.path, 'v0.4.5', api)
        self.assertEqual(len(calls), 2)

    def test_publish_failure_is_not_retried(self):
        api, calls = self.fake_api([{}, {'uploadState': 'SUCCEEDED'}, RuntimeError('HTTP 500')])
        with self.assertRaises(RuntimeError):
            submit(self.path, 'v0.4.5', api)
        self.assertEqual([c[0] for c in calls].count('publish'), 1)


if __name__ == '__main__':
    unittest.main()

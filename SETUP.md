# Release repository setup

Last updated: 2026-11-05.
Status: Prepared locally; GitHub deployment has not been verified.

This directory is maintained alongside the main project. It has no local Git
repository, remote synchronization, file watcher, or automatic upload process.
Upload changes directly to `Motive-Dev-Studio/Motive-Release` only when requested,
using the existing authorized GitHub account.

## Files to upload

- `README.md`, `LICENSE`, `motive.png`, `motive-showcase.png`, `motive_icon.png`.
- The complete `.github` directory, including its scripts.
- `SETUP.md` is maintainer documentation; `tests` is optional local validation.

Keep the paths unchanged and place the files on the release repository's default
branch. Enable Issues and GitHub Actions. The workflow requests `contents: read`
and `issues: write` through `GITHUB_TOKEN`; no personal token is needed. Organization
policies must allow these permissions and the official actions used by the workflow.
The repository-name guard prevents activation in the source repository.

## Form and automation

Fields 1–5 are required; fields 6–7 are optional. Category selection is singular.
New and reopened issues receive `Pending`. The selected category becomes a label.
Editing an issue updates its category and validation result without restoring a
manually removed `Pending` label. Unrelated maintainer labels are preserved.
Missing labels are created automatically.

GitHub does not expose maximum-character or maximum-file-count validators in its
current form schema. The form states the limits; Actions checks them after submission
and adds `Needs Information` with an editable reminder if necessary. This does not
prevent submission or remove attachments. Correcting the issue removes that label.

The version fields permit 50 characters each, the problem field 500, and the expected
result 200. Unicode code points, spaces, punctuation, and Markdown syntax count;
surrounding whitespace and inline image addresses do not. Image captions count.
Field 7 allows up to 10 distinct visible attachment URLs; archive contents are not
counted or downloaded. GitHub's own size, format, and overall body limits still apply.
The additional-information field has no extra project limit.

Similarity checks inspect at most the latest 200 repository issue/PR records, excluding
PRs and issues newer than the current issue. A sufficiently long identical title, or
at least 80% character-bigram overlap in a substantial description in the same category,
produces up to three references. These are heuristic suggestions and can miss matches
or suggest unrelated reports. All duplicates only receive reminders; nothing is closed.
The bot updates its existing review comment instead of posting repeated reminders.
No issue content is executed, and no attachment is fetched.

After uploading, manually verify the form and submit an authorized trial issue to check
labels, editing, attachments, and reminders. Local checks do not prove hosted execution.

## Local check

Run `node --test tests/issue-triage.test.cjs` with Node.js 24 or newer.

## Official references

- [GitHub form schema](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema)
- [Issue templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)
- [Checkout](https://github.com/actions/checkout)
- [GitHub Script](https://github.com/actions/github-script)

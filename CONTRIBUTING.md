# Contributing

Thanks for stopping by. Any help counts: a bug report, an idea, a typo fix or a whole feature.

## Not sure where to start?

- Browse [good first issues](https://github.com/eurusik/ratingo/contribute). Each one is small and has a note on what to change.
- Have an idea or a question? Start a thread in [Discussions](https://github.com/eurusik/ratingo/discussions).
- Want to take an issue? Leave a comment so we don't both work on it.

## Making a change

1. Fork the repo and create a branch from `development`.
2. Run it locally, see [Run it yourself](README.md#run-it-yourself).
3. Make your change and run the tests for the part you touched:
   ```bash
   npm run test:storefront
   npm run test:api
   ```
4. Commit with a [conventional commit](https://www.conventionalcommits.org) message, like `fix: show the right season in the calendar`.
5. Open a pull request against `development`.

The PR template has a long checklist. Tick what applies and skip the rest, I won't mind.

I read every PR and reply within a few days. If something needs changing, I'll explain why and help you get it over the line.

## Where things live

- `apps/storefront` is the site (Next.js). UI changes go here.
- `apps/api` is the backend (NestJS). Data, sync jobs and the catalog rules live here.

New to the code? Ask in the issue, I'm happy to point you to the right file.

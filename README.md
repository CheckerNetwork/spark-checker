# spark
SP Retrieval Checker Module

- [Roadmap](https://pl-strflt.notion.site/SPARK-Roadmap-ac729c11c49b409fbec54751d1bc6c8a)
- [API](https://github.com/filecoin-station/spark-api)

## Development

Install [Zinnia CLI](https://github.com/filecoin-station/zinnia).

```bash
$ # Install dev tooling
$ npm ci
$ # Lint
$ npm run lint
$ # Fix linting issues
$ npm run lint:fix
$ # Run module
$ zinnia run main.js
$ # Test module
$ zinnia run test.js
```

## Release

On a clean working tree, run the following command:

```bash
$ ./release.sh <semver>
$ # Example
$ ./release.sh 1.0.0
```

Use GitHub's changelog feature to fill out the release notes.

Publish the new release and let the CI/CD workflow upload the sources
to IPFS & IPNS.

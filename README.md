# conventional-changelog-conventionalcommits-helm

This is a modified version of the preset [conventional-changelog-conventionalcommits](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-conventionalcommits). Please, check the original module for documentation.

The goal of this module is to generate structured changelogs for helm charts, also working with umbrella charts.

The main difference is that the commits are now sorted by scope and then sorted again by type, creating a clear changelog structure even if you use multiple charts.

## Install

First, install the [conventional-changelog-cli](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-cli). (Refer to this repo for documentation on the cli)

```bash
npm i conventional-changelog-cli
```

Then, install this module.

```bash
npm i conventional-changelog-conventionalcommits-helm
```

## Usage (as preset)

Use the [Conventional Changelog CLI](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-cli) with the `-p conventionalcommits-helm` option.

You can follow the documentation of [conventional-changelog-conventionalcommits](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-conventionalcommits) to pass configuration options to the preset.

See [conventional-changelog-config-spec](https://github.com/conventional-changelog/conventional-changelog-config-spec) for available configuration options.

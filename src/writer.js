import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import compareFunc from 'compare-func'
import { DEFAULT_COMMIT_TYPES } from './constants.js'
import { addBangNotes } from './utils.js'

const dirname = fileURLToPath(new URL('.', import.meta.url))
const releaseAsRegex = /release-as:\s*\w*@?([0-9]+\.[0-9]+\.[0-9a-z]+(-[0-9a-z.]+)?)\s*/i
/**
 * Handlebar partials for various property substitutions based on commit context.
 */
const owner = '{{#if this.owner}}{{~this.owner}}{{else}}{{~@root.owner}}{{/if}}'
const host = '{{~@root.host}}'
const repository = '{{#if this.repository}}{{~this.repository}}{{else}}{{~@root.repository}}{{/if}}'



export async function createWriterOpts (config) {
  const finalConfig = {
    types: DEFAULT_COMMIT_TYPES,
    issueUrlFormat: '{{host}}/{{owner}}/{{repository}}/issues/{{id}}',
    commitUrlFormat: '{{host}}/{{owner}}/{{repository}}/commit/{{hash}}',
    compareUrlFormat: '{{host}}/{{owner}}/{{repository}}/compare/{{previousTag}}...{{currentTag}}',
    userUrlFormat: '{{host}}/{{user}}',
    issuePrefixes: ['#'],
    ...config
  }
  const commitUrlFormat = expandTemplate(finalConfig.commitUrlFormat, {
    host,
    owner,
    repository
  })
  const compareUrlFormat = expandTemplate(finalConfig.compareUrlFormat, {
    host,
    owner,
    repository
  })
  const issueUrlFormat = expandTemplate(finalConfig.issueUrlFormat, {
    host,
    owner,
    repository,
    id: '{{this.issue}}',
    prefix: '{{this.prefix}}'
  })

  const [
    template,
    header,
    commit,
    footer
  ] = await Promise.all([
    readFile(resolve(dirname, './templates/template.hbs'), 'utf-8'),
    readFile(resolve(dirname, './templates/header.hbs'), 'utf-8'),
    readFile(resolve(dirname, './templates/commit.hbs'), 'utf-8'),
    readFile(resolve(dirname, './templates/footer.hbs'), 'utf-8')
  ])
  const writerOpts = getWriterOpts(finalConfig)
  writerOpts.mainTemplate = template
  writerOpts.headerPartial = header
    .replace(/{{compareUrlFormat}}/g, compareUrlFormat)
  writerOpts.commitPartial = commit
    .replace(/{{commitUrlFormat}}/g, commitUrlFormat)
    .replace(/{{issueUrlFormat}}/g, issueUrlFormat)
  writerOpts.footerPartial = footer

  return writerOpts
}


function getWriterOpts (config) {
  const commitGroupOrder = config.types.flatMap(t => t.section).filter(t => t)

  return {
    transform: (commit, context) => {
      let discard = true
      const issues = []
      const entry = findTypeEntry(config.types, commit)

      // adds additional breaking change notes
      // for the special case, test(system)!: hello world, where there is
      // a '!' but no 'BREAKING CHANGE' in body:
      let notes = addBangNotes(commit)

      // Add an entry in the CHANGELOG if special Release-As footer
      // is used:
      if ((commit.footer && releaseAsRegex.test(commit.footer)) ||
          (commit.body && releaseAsRegex.test(commit.body))) {
        discard = false
      }

      notes = notes.map(note => {
        discard = false

        return {
          ...note,
          title: 'BREAKING CHANGES'
        }
      })
      
      // breaking changes attached to any type are still displayed.
      if (discard && (entry === undefined ||
          entry.hidden)) return

      const type = entry
        ? entry.section
        : commit.type
      const scope = commit.scope === '*'
        ? ''
        : commit.scope
      const shortHash = typeof commit.hash === 'string'
        ? commit.hash.substring(0, 7)
        : commit.shortHash
      let subject = commit.subject
      if (typeof subject === 'string') {
        // Issue URLs.
        const issueRegEx = '(' + config.issuePrefixes.join('|') + ')' + '([a-z0-9]+)'
        const re = new RegExp(issueRegEx, 'g')

        subject = subject.replace(re, (_, prefix, issue) => {
          issues.push(prefix + issue)
          const url = expandTemplate(config.issueUrlFormat, {
            host: context.host,
            owner: context.owner,
            repository: context.repository,
            id: issue,
            prefix
          })
          return `[${prefix}${issue}](${url})`
        })
        // User URLs.
        subject = subject.replace(/\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g, (_, user) => {
          // TODO: investigate why this code exists.
          if (user.includes('/')) {
            return `@${user}`
          }

          const usernameUrl = expandTemplate(config.userUrlFormat, {
            host: context.host,
            owner: context.owner,
            repository: context.repository,
            user
          })
          return `[@${user}](${usernameUrl})`
        })
      }

      // remove references that already appear in the subject
      const references = commit.references.filter(reference => !issues.includes(reference.prefix + reference.issue))

      return {
        notes,
        type,
        scope,
        shortHash,
        subject,
        references
      }
    },
    groupBy: 'scope',
    // the groupings of commit messages, e.g., Features vs., Bug Fixes, are
    // sorted based on their probable importance:

    commitGroupsSort: (a, b) => {
      a.title=(a.title).toUpperCase()
      b.title=(b.title).toUpperCase()
      const gRankA = commitGroupOrder.indexOf(a.title)
      const gRankB = commitGroupOrder.indexOf(b.title)
      return gRankA - gRankB
    },

    

    finalizeContext: (context) => {
      const repo = context.host+"/"+context.owner+"/"+context.repository
      context.commitGroups = context.commitGroups.map(group => {
        const bugFixes = [];
        const features = [];
        const bump = [];
        const perf = [];
        const revert = [];
        const docs = [];
        const style = [];
        const chore = [];
        const refactor = [];
        const test = [];
        const build = [];
        const ci = [];

        group.commits.forEach(commit => {
          switch (commit.type) {
            case 'Bug Fixes':
              commit.repo = repo
              bugFixes.push(commit);
              break;
            case 'Features':
              commit.repo = repo
              features.push(commit);
              break;
            case 'New version':
              commit.repo = repo
              bump.push(commit);
              break;
            case 'Performance Improvements':
              commit.repo = repo
              perf.push(commit);
              break;
            case 'Reverts':
              commit.repo = repo
              revert.push(commit);
              break;
            case 'Documentation':
              commit.repo = repo
              docs.push(commit);
              break;
            case 'Styles':
              commit.repo = repo
              style.push(commit);
              break;
            case 'Miscellaneous Chores':
              commit.repo = repo
              chore.push(commit);
              break;
            case 'Code Refactoring':
              commit.repo = repo
              refactor.push(commit);
              break;
            case 'Tests':
              commit.repo = repo
              test.push(commit);
              break;
            case 'Build System':
              commit.repo = repo
              build.push(commit);
              break;
            case 'Continuous Integration':
              commit.repo = repo
              ci.push(commit);
              break;
            default:
              console.log(`Type ${commit.type} not supported.`);
          }
        });

        return {
          ...group,
          bugFixes,
          features,
          bump,
          perf,
          revert,
          docs,
          style,
          chore,
          refactor,
          test,
          build,
          ci
        };
      });
      return context;
    },
    commitsSort: ['type', 'subject'],
    noteGroupsSort: 'title',
    notesSort: compareFunc
  }
}

function findTypeEntry (types, commit) {
  const typeKey = (commit.revert ? 'revert' : (commit.type || '')).toLowerCase()
  return types.find((entry) => {
    if (entry.type !== typeKey) {
      return false
    }
    if (entry.scope && entry.scope !== commit.scope) {
      return false
    }
    return true
  })
}

// expand on the simple mustache-style templates supported in
// configuration (we may eventually want to use handlebars for this).
function expandTemplate (template, context) {
  let expanded = template
  Object.keys(context).forEach(key => {
    expanded = expanded.replace(new RegExp(`{{${key}}}`, 'g'), context[key])
  })
  return expanded
}

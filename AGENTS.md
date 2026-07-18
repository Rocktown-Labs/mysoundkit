<!-- intent-skills:start -->

# Agent Workflow and Skill Routing Guidelines

This document defines the standard plan-to-ship workflow and skill discovery protocol for autonomous coding agents operating on this codebase.

## 1. Skill Discovery & Routing Protocol

### TanStack Intent Setup

Before substantial work:

- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

### Dynamic Skill Directory Mapping

Do not assume a hardcoded list of project skills. Upon starting a task, perform a directory scan of `.agents/skills/` to map the project's active guidelines.

1. Run a directory search or list the contents of `.agents/skills/` to discover available concern domains such as database routing, billing paywalls, UI components, auth, and API routing.
2. Read the `SKILL.md` in any relevant folder before implementation.
3. Route files to change based on the identified package and concern boundaries.

## 2. GitHub-Driven Development Workflow

Every code change must trace to a GitHub Issue and follow the **Plan -> Branch -> Implement -> Test -> PR -> Merge -> Ship** cycle.

### Core Principles

1. GitHub is the source of truth: Issues define work, Projects track progress, and Pull Requests ship code.
2. No direct pushes: never push directly to `main` or `master`. All changes flow through PRs.
3. Real-time status syncing: update Project board cards as development state changes when a board is configured.

### Project Status Mapping

| Development State       | Project Status |
| :---------------------- | :------------- |
| Issue created           | Backlog        |
| Branch created / Coding | In Progress    |
| Pull Request opened     | In Review      |
| Pull Request merged     | Done           |

## 3. Step-by-Step Lifecycle

### Step A: Plan Mode

Before modifying or creating code files, output a structured plan covering:

- Issue context: link to the GitHub Issue and list acceptance criteria.
- Proposed changes: list affected files and exact file paths.
- Testing strategy: specify what tests must be run or created.
- Branch name: confirm the branch name matching the repo convention.

### Step B: Branch Strategy

Create branches from the latest pulled default branch:

```bash
git checkout master
git pull origin master
git checkout -b <type>/<slug>-<issueNumber>
```

Allowed branch types are `feat/`, `fix/`, and `chore/`. Use lowercase kebab-case with a descriptive slug and issue number, such as `feat/admin-stripe-catalog-5`.

If the default branch is `main` in a future repo, use `main` in place of `master`.

### Step C: Quality Gates & PR Rules

Before opening a Pull Request, verify code cleanliness with the package manager and scripts this repo actually defines. This repo currently uses Bun:

```bash
bun run check
bun run check-types
bun run test
```

If linter issues are found in files touched by the change, run:

```bash
bun run fix
```

If a repo-wide quality gate fails because of unrelated existing drift, report it explicitly in the PR and final status, and include focused checks for touched files.

### Step D: Pull Request Creation

PR titles should match the GitHub Issue title exactly. Create the PR with the GitHub CLI:

```bash
gh pr create \
  --title "<issueTitle>" \
  --body "## Summary\n\n## Implementation Notes\n\n## Testing Notes\n\nCloses #<issueNumber>" \
  --base master \
  --head <branchName>
```

### Step E: Merging & Release Changelog

Only merge when CI and test gates pass. Merge using:

```bash
gh pr merge --merge --delete-branch
```

Always include the `CHANGELOG.md` updates directly in the feature commit and shipping Pull Request. Add entries under semantic version headings and categorize changes under `Added`, `Fixed`, or `Changed`.

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun x ultracite fix`
- **Check for issues**: `bun x ultracite check`
- **Diagnose setup**: `bun x ultracite doctor`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `bun x ultracite fix` before committing to ensure compliance.

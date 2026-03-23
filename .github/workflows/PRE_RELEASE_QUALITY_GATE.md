# Pre-Release Quality Gate

## Overview

The **Pre-Release Quality Gate** is a comprehensive validation workflow that acts as the "final boss" before releasing new versions of Buzzy Game. It ensures production-ready quality by running extensive checks across multiple dimensions.

## When Does It Run?

### Automatic Triggers
- **Git Tags**: Automatically runs when you push a version tag (e.g., `v1.2.0`)
  ```bash
  git tag v1.2.0
  git push origin v1.2.0
  ```

### Manual Triggers
- **GitHub UI**: Actions → Pre-Release Quality Gate → Run workflow
- **Optional inputs**:
  - `release_version`: Target release version (e.g., v1.2.0)
  - `skip_tests`: Skip test suite (**⚠️ EMERGENCY ONLY** - see section below)

## 🚨 Emergency Releases

### When to Skip Tests

The `skip_tests` option allows bypassing the test suite for emergency releases. **This should ONLY be used in critical situations:**

✅ **Acceptable use cases:**
- Critical production bug causing service outage
- Security vulnerability that needs immediate patching
- Data loss prevention hotfix

❌ **NOT acceptable:**
- Regular feature releases
- "I'm in a hurry" situations
- Testing the workflow itself (use a non-production branch)

### How to Use

1. Go to: **Actions** → **Pre-Release Quality Gate** → **Run workflow**
2. Set `skip_tests` to **true**
3. Enter the release version
4. **Document the reason** in your release notes
5. **Schedule a follow-up** to run full tests post-release

### Risks

Skipping tests means:
- ⚠️ Untested code paths may contain bugs
- ⚠️ E2E scenarios haven't been validated
- ⚠️ Integration issues may slip through
- ⚠️ User experience regressions won't be caught

**Best practice:** Run the full test suite on a staging environment immediately after emergency release.

### Alternative: Staged Release

Instead of skipping tests, consider:
1. Release to a canary/staging environment first
2. Monitor for issues with real traffic
3. If stable, promote to production
4. This validates changes without skipping quality gates

---

## Quality Gates

The workflow runs 5 comprehensive gates in parallel:

### 1. ⛓️ Word Database Coverage
**Purpose**: Validates that the word database has adequate coverage across all difficulty/grade-level combinations.

**Script**: `npm run audit:words`

**Checks**:
- All 9 combinations (easy/medium/hard × K-2/3-5/6-8)
- Flags missing combinations (0 words) as ❌
- Flags low coverage (<20 words) as ⚠️
- Passes when all combinations have ≥20 words

**Example Output**:
```
✅ easy + K-2: 50 words
⚠️ medium + K-2: 15 words
❌ MISSING hard + K-2: 0 words
```

**Action**: Warning status doesn't fail the build, but requires review before release.

---

### 2. 🧙 Code Quality
**Purpose**: Ensures code meets quality standards.

**Checks**:
- ESLint: `npm run lint`
- TypeScript type checking: `npm run typecheck`

**Fails if**: Any linting errors or type errors are found.

---

### 3. 🧪 Test Suite
**Purpose**: Validates functionality through automated tests.

**Checks**:
- Unit tests: `npm test`
- E2E tests: `npm run test:e2e` (Playwright)

**Duration**: E2E tests can take **5-10 minutes** depending on the test suite size.

**Skippable**: Use `skip_tests: true` input **only for emergency releases** (see section above).

**Artifacts**: Test results and Playwright reports uploaded for 30 days.

---

### 4. 📦 Build Verification
**Purpose**: Ensures the production build completes successfully.

**Checks**:
- Production build: `npm run build`
- Bundle size analysis
- Top 10 largest files report

**Artifacts**: Production build artifacts uploaded for 30 days.

**Fails if**: Build process encounters errors.

---

### 5. 🔒 Security Checks
**Purpose**: Identifies known vulnerabilities in dependencies.

**Checks**:
- npm audit (production dependencies only)

**Behavior**: **Uses `continue-on-error: true`** - vulnerabilities won't block the workflow, but **MUST be manually reviewed**.

**Why continue-on-error?**
- Some vulnerabilities may not have fixes available yet
- Allows releases for critical fixes even with low-severity vulnerabilities
- Provides visibility without strict blocking

**⚠️ IMPORTANT: Team Review Required**

Even though this gate passes with vulnerabilities, the team **MUST**:
1. Download and review the `security-audit` artifact
2. Assess severity levels (critical/high/moderate/low)
3. For each vulnerability:
   - Update the dependency if a fix is available
   - Document risk acceptance if no fix exists
   - Create a follow-up issue to address it
4. Never release with **critical** or **high** severity vulnerabilities without explicit approval

**Artifacts**: Security audit results uploaded for 30 days.

---

## Final Report

After all gates complete, a **Quality Report** job summarizes results:

| Gate | Status |
|------|--------|
| ⛓️ Word Database Coverage | success |
| 🧙 Code Quality | success |
| 🧪 Test Suite | success |
| 📦 Build Verification | success |
| 🔒 Security Checks | success |

**Overall Status**:
- ✅ **READY FOR RELEASE**: All critical gates passed
- ❌ **NOT READY FOR RELEASE**: One or more gates failed

**Note**: Security gate showing "success" doesn't mean no vulnerabilities were found - always check the artifact.

## Usage Examples

### Standard Release
```bash
# Test the quality gate manually first
# Go to: Actions → Pre-Release Quality Gate → Run workflow
# Enter release_version: v1.3.0
# Wait for results (~10-15 minutes)

# If all gates pass, create and push the tag
git tag v1.3.0
git push origin v1.3.0
```

### Emergency Release (Skip Tests)
```bash
# ONLY for critical hotfixes!
# Go to: Actions → Pre-Release Quality Gate → Run workflow
# Enter release_version: v1.3.1-hotfix
# Set skip_tests: true
# Click Run workflow

# Document the emergency in release notes:
# "Emergency release to fix production outage. Full test suite
#  will be run post-deployment on staging."
```

### Running Locally (Individual Gates)

```bash
# Word database audit
npm run audit:words

# Code quality
npm run lint
npm run typecheck

# Tests
npm test
npm run test:e2e

# Build
npm run build

# Security
npm audit --production
```

## Interpreting Results

### Word Coverage Warnings
If you see ⚠️ LOW or ❌ MISSING:
1. Review which combinations are affected
2. Add more words using the word management tools
3. Re-run the workflow to verify

### Test Failures
1. Click on the failing job
2. Review the test output in the step summary
3. Download test artifacts for detailed logs
4. Fix issues and re-run

### Build Failures
1. Check the build output in the step summary
2. Common issues:
   - TypeScript errors
   - Missing dependencies
   - Vite configuration problems
3. Fix and re-run

### Security Vulnerabilities

**⚠️ CRITICAL**: Even if the security gate shows "success", you must review the output.

1. **Download** the `security-audit` artifact from the workflow run
2. **Review** severity levels:
   - **Critical/High**: Must be addressed before release or explicitly approved
   - **Moderate**: Review and create follow-up issues
   - **Low**: Document and address in next sprint
3. **Actions** to take:
   - Run `npm update` to get latest patches
   - Check if `npm audit fix` can resolve issues
   - Review `npm audit fix --force` (may introduce breaking changes)
   - If no fix available, document risk acceptance
4. **Document** your decision in the release notes

**Example risk acceptance documentation:**
```
Vulnerability: lodash <4.17.21 (Prototype Pollution)
Severity: Moderate
Decision: Accepting risk for this release
Reason: No fix available; vulnerability requires specific
        attack vector not present in our usage
Follow-up: Issue #123 created to migrate away from lodash
```

## Artifacts

The workflow preserves these artifacts for 30 days:

- `word-coverage-audit`: Word database audit results
- `test-results`: Unit and E2E test outputs + Playwright reports
- `production-build`: Complete production build
- `security-audit`: **npm audit results - ALWAYS REVIEW THIS**

Access: Go to workflow run → Artifacts section at bottom

## Best Practices

1. **Run manually before tagging**: Catch issues early
2. **Review warnings**: Don't ignore ⚠️ even if the build passes
3. **Check artifacts**: Download and review detailed reports, especially security audit
4. **Fix before release**: Address all ❌ failures before proceeding
5. **Document exceptions**: If releasing with warnings, document why
6. **Emergency releases**: Only skip tests for critical hotfixes, document the reason
7. **Security review**: Always review security audit output, even if gate passes

## Troubleshooting

### Workflow won't trigger on tag push
- Ensure tag format matches `v*.*.*` (e.g., v1.2.3)
- Check you pushed the tag: `git push origin <tag>`

### Tests timing out
- E2E tests may need more resources (typical duration: 5-10 minutes)
- Check for flaky tests in Playwright report
- Re-run the workflow
- For emergency releases, consider using `skip_tests: true`

### False positives in word coverage
- Verify the audit script logic
- Check if word data format changed
- Review threshold settings (currently: 20 words minimum)

### Security gate always passes but shows vulnerabilities
- This is **expected behavior** due to `continue-on-error: true`
- The gate is designed to warn, not block
- **You must manually review** the security-audit artifact
- Never release with critical/high vulnerabilities without approval

## Configuration

To modify thresholds or behavior, edit:
- Word coverage logic: `scripts/audit-word-coverage.js`
- Workflow gates: `.github/workflows/pre-release-quality-gate.yml`
- NPM scripts: `package.json`
- Security policy: Consider removing `continue-on-error` if you want strict blocking

## Related Workflows

- `ci.yml`: Runs on every PR (subset of quality checks)
- `test-e2e-full.yml`: Full E2E test matrix
- `security-penetration-tests.yml`: Security-focused testing

The pre-release workflow is the **most comprehensive** and should always pass before production releases.

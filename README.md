# Jira Release Link Action

Assigns Jira issues to a release version by version name and ticket list.

## Usage

```yaml
- name: Link Jira Release
  uses: stage-tech/jira-release-link@main
  with:
    jira-email: ${{ secrets.JIRA_EMAIL }}
    jira-token: ${{ secrets.JIRA_TOKEN }}
    jira-project: SSYNC
    release-prefix: Connex Release
    major-version: ${{ steps.get-major.outputs.major }}
    tickets: ${{ steps.extract-tickets.outputs.tickets }}
```

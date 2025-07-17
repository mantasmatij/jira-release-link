# Jira Release Link Action

Assigns Jira issues to a release version by version name and ticket list.
Gets the last commit message and gathers Jira ticket keys to assign to a project.

## Usage

```yaml
- name: Link Jira Release
  uses: mantasmatij/jira-release-link@main
  with:
    jira-email: Jira user email
    jira-token: Jira API token
    jira-domain: Jira domain (e.g. company.atlassian.net) 
    jira-project: Jira project key
    jira-ticket-key-prefix: Jira ticket key prefix (e.g. TICKET)
    release-name: Release name (e.g. Release 1.0.0)
```

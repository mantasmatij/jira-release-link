import * as core from "@actions/core";
import axios from "axios";
import { execSync } from "child_process";
import { exit } from "process";

class Jira {
    email;
    token;
    domain;
    project;
    ticketPrefix;
    releaseName;
    client;
    
    constructor(email, token, domain, project, ticketPrefix, releaseName) {
        this.email = email;
        this.token = token;
        this.domain = domain;
        this.project = project;
        this.ticketPrefix = ticketPrefix;
        this.releaseName = releaseName;
        
        // Create axios client with common configuration
        const authHeader = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
        this.client = axios.create({
            baseURL: `https://${domain}/rest/api/2`,
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });
    }

    async getJiraVersionId() {
        try {
            const response = await this.client.get(`/project/${this.project}/versions`);
            const versions = response.data;
            const version = versions.find(v => v.name === this.releaseName);
            
            if (!version) {
                throw new Error(`Release '${this.releaseName}' not found in Jira project ${this.project}`);
            }
            
            return version.id;
        } catch (error) {
            if (error.response) {
                throw new Error(`Failed to fetch Jira versions: ${error.response.status} ${error.response.statusText}`);
            }
            throw error;
        }
    }

    async linkTicketToRelease(ticketId, versionId) {
        try {
            await this.client.put(`/issue/${ticketId}`, {
                update: {
                    fixVersions: [
                        { add: { id: versionId } }
                    ]
                }
            });

            return { success: true, message: "Ticket successfully linked to release" };
        } catch (error) {
            if (error.response) {
                throw new Error(`Failed to link ticket to release: ${error.response.status} ${error.response.statusText}`);
            }
            throw error;
        }
    }
}

async function run() {
    try {
        const jiraEmail = process.env.INPUT_JIRA_EMAIL || core.getInput('jira-email');
        const jiraToken = process.env.INPUT_JIRA_TOKEN || core.getInput('jira-token');
        const jiraDomain = process.env.INPUT_JIRA_DOMAIN || core.getInput('jira-domain');
        const jiraProject = process.env.INPUT_JIRA_PROJECT || core.getInput('jira-project');
        const jiraTicketKeyPrefix = process.env.INPUT_JIRA_TICKET_KEY_PREFIX || core.getInput('jira-ticket-key-prefix');
        const releaseName = process.env.INPUT_RELEASE_NAME || core.getInput('release-name');


        const jira = new Jira(
            jiraEmail, 
            jiraToken,
            jiraDomain,
            jiraProject,
            jiraTicketKeyPrefix,
            releaseName
        );

        const tickets = getTickets(jiraTicketKeyPrefix);

        const versionId = await jira.getJiraVersionId();

        if (tickets === null) {
            core.info("No tickets found in commit message.")
            exit(0);
        }
        for (const ticket of tickets) {
            await jira.linkTicketToRelease(ticket, versionId);
        }
    } catch (error) {
        core.setFailed(`Error: ${error.message}`);
    }
}

function getTickets(jiraTicketKeyPrefix) {
    const regex = new RegExp(String.raw`${jiraTicketKeyPrefix}-[0-9]+`,'g');
    const gitLog = execSync('git log -1 --pretty=%B').toString().trim();
    const tickets = gitLog.match(regex);
    return tickets ? tickets.sort() : null;
} 

run();

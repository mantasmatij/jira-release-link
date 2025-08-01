import * as core from "@actions/core";
import fetch from "node-fetch";
import { execSync } from "child_process";
import { exit } from "process";

class Jira {
    email;
    token;
    domain;
    project;
    ticketPrefix;
    releaseName;
    constructor(email, token, domain, project, ticketPrefix, releaseName) {
        this.email = email;
        this.token = token;
        this.domain = domain;
        this.project = project;
        this.ticketPrefix = ticketPrefix;
        this.releaseName = releaseName;
    }

    async getJiraVersionId() {
        const url=`https://${this.domain}/rest/api/2/project/${this.project}/versions`;
        const authHeader = 'Basic ' + Buffer.from(`${this.email}:${this.token}`).toString('base64');

        const response = await fetch(url, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });

        const responseData = await response.json();

        if (!responseData || responseData.errorMessages) {
            throw new Error(`Failed to fetch Jira versions: ${responseData.errorMessages}`);
        }
        const version = Array.isArray(responseData)
            ? responseData.find((version) => version.name === this.releaseName)
            : undefined;
        
        return version.id;
    }

    async getTicket(ticketId) {
        const url=`https://${this.domain}/rest/api/2/issue/${ticketId}`;
        const authHeader = 'Basic ' + Buffer.from(`${this.email}:${this.token}`).toString('base64');

        const response = await fetch(url, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        });

        const ticketData = await response.json();

        if (!ticketData || ticketData.errorMessages || !ticketData.fields) {
            throw new Error(`Failed to fetch Jira ticket ${ticketId}: ${ticketData && ticketData.errorMessages ? ticketData.errorMessages.join(', ') : 'No ticket data found.'}`);
        }

        return ticketData;
    }

    async linkTicketToRelease(ticketId, versionId) {
        const url=`https://${this.domain}/rest/api/2/issue/${ticketId}`;
        const authHeader = 'Basic ' + Buffer.from(`${this.email}:${this.token}`).toString('base64');
        const body = JSON.stringify({
            update: {
                fixVersions: [
                    { add: { id: versionId } }
                ]
            }
        });

        const response = await fetch(url, {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            method: "PUT",
            body: body,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to link ticket to release: ${response.status} ${response.statusText} - ${errorText}`);
        }

        if (response.status === 204) {
            return { success: true, message: "Ticket successfully linked to release" };
        }

        const responseText = await response.text();
        if (responseText.trim() === '') {
            return { success: true, message: "Ticket successfully linked to release" };
        }

        try {
            return JSON.parse(responseText);
        } catch (error) {
            return { success: true, message: "Ticket linked but response could not be parsed", rawResponse: responseText };
        }
    }
}

async function run() {
    try {
        const jiraEmail = core.getInput('jira-email');
        const jiraToken = core.getInput('jira-token');
        const jiraDomain = core.getInput('jira-domain');
        const jiraProject = core.getInput('jira-project');
        const jiraTicketKeyPrefix = core.getInput('jira-ticket-key-prefix');
        const releaseName = core.getInput('release-name');
        const releaseNameRegex = core.getInput('release-name-regex');

        // Debug: Log the inputs (without sensitive data)
        console.log('Debug - Inputs received:');
        console.log('jiraEmail:', jiraEmail ? 'SET' : 'NOT SET');
        console.log('jiraToken:', jiraToken ? 'SET' : 'NOT SET');
        console.log('jiraDomain:', jiraDomain);
        console.log('jiraProject:', jiraProject);
        console.log('jiraTicketKeyPrefix:', jiraTicketKeyPrefix);
        console.log('releaseName:', releaseName);
        console.log('releaseNameRegex:', releaseNameRegex);

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
            const ticketResponse = await jira.getTicket(ticket);
            let skipUpdate = false;
            
            if (releaseNameRegex !== null) {
                const fixVersions = (ticketResponse && typeof ticketResponse === 'object' && ticketResponse.fields && Array.isArray(ticketResponse.fields.fixVersions)) ? ticketResponse.fields.fixVersions : [];
                const versionRegex = new RegExp(String.raw`${releaseNameRegex}`, 'g');
                
                for (const fixVersion of fixVersions) {
                    if (versionRegex.test(fixVersion.name)) {
                        if (compareReleaseNames(releaseName, fixVersion.name, versionRegex) >= 0) {
                            core.info(`Ticket ${ticket} is already linked to '${fixVersion.name}'. Skipping version link.`);
                            skipUpdate = true;
                        }
                    }
                }
            }
            
            if (!skipUpdate) {
                await jira.linkTicketToRelease(ticket, versionId);
            }
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

function compareReleaseNames(releaseA, releaseB, regex) {
    const aMatch = releaseA.match(regex);
    const bMatch = releaseB.match(regex);
    const r = /\d+/g;
    const aNum = aMatch[0].match(r);
    const bNum = bMatch[0].match(r);
    return parseInt(aNum[0]) - parseInt(bNum[0]);
}

run();

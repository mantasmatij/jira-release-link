import { execSync } from "node:child_process";
import { exit } from "node:process";
import * as core from "@actions/core";
import axios, {
    AxiosError,
    type AxiosInstance,
    type AxiosResponse,
} from "axios";

interface JiraVersion {
    id: string;
    name: string;
}

interface LinkTicketResult {
    success: boolean;
    message: string;
}

class Jira {
    private project: string;
    private releaseName: string;
    private client: AxiosInstance;

    constructor({
        email,
        token,
        domain,
        project,
        releaseName,
    }: {
        email: string;
        token: string;
        domain: string;
        project: string;
        releaseName: string;
    }) {
        this.project = project;
        this.releaseName = releaseName;

        this.client = axios.create({
            baseURL: `https://${domain}/rest/api/2`,
            auth: {
                username: email,
                password: token,
            },
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    async getJiraVersionId(): Promise<string> {
        try {
            const response: AxiosResponse<JiraVersion[]> =
                await this.client.get(`/project/${this.project}/versions`);
            const versions = response.data;
            const version = versions.find((v) => v.name === this.releaseName);

            if (!version) {
                throw new Error(
                    `Release '${this.releaseName}' not found in Jira project ${this.project}`,
                );
            }

            return version.id;
        } catch (error: unknown) {
            if (error instanceof AxiosError) {
                throw new Error(
                    `Failed to fetch Jira versions: ${error.message} ${error.response?.status} ${error.response?.statusText}`,
                );
            }
            throw error;
        }
    }

    async linkTicketToRelease(
        ticketId: string,
        versionId: string,
    ): Promise<LinkTicketResult> {
        try {
            await this.client.put(`/issue/${ticketId}`, {
                update: {
                    fixVersions: [{ add: { id: versionId } }],
                },
            });

            return {
                success: true,
                message: "Ticket successfully linked to release",
            };
        } catch (error: unknown) {
            if (error instanceof AxiosError) {
                throw new Error(
                    `Failed to link ticket to release: ${error.message} ${error.response?.status} ${error.response?.statusText}`,
                );
            }
            throw error;
        }
    }
}

async function run(): Promise<void> {
    try {
        const email =
            process.env.INPUT_JIRA_EMAIL || core.getInput("jira-email");
        const token =
            process.env.INPUT_JIRA_TOKEN || core.getInput("jira-token");
        const domain =
            process.env.INPUT_JIRA_DOMAIN || core.getInput("jira-domain");
        const project =
            process.env.INPUT_JIRA_PROJECT || core.getInput("jira-project");
        const ticketKeyPrefix =
            process.env.INPUT_JIRA_TICKET_KEY_PREFIX ||
            core.getInput("jira-ticket-key-prefix");
        const releaseName =
            process.env.INPUT_RELEASE_NAME || core.getInput("release-name");

        const jira = new Jira({
            email: email,
            token: token,
            domain: domain,
            project: project,
            releaseName: releaseName,
        });

        const tickets = getTickets(ticketKeyPrefix);

        if (tickets === null) {
            core.info("No tickets found in commit message.");
            exit(0);
        }
        core.info(
            `Found the following tickets in commit message: ${tickets.join(", ")}`,
        );

        const versionId = await jira.getJiraVersionId();

        await Promise.all(
            tickets.map((ticket) =>
                jira.linkTicketToRelease(ticket, versionId),
            ),
        );
    } catch (error: unknown) {
        core.setFailed(`Error: ${(error as Error).message}`);
    }
}

function getTickets(jiraTicketKeyPrefix: string): string[] | null {
    const regex = new RegExp(`${jiraTicketKeyPrefix}-[0-9]+`, "g");
    const gitLog = execSync("git log -1 --pretty=%B").toString().trim();
    const tickets = gitLog.match(regex);
    return tickets ? tickets.sort() : null;
}

run();

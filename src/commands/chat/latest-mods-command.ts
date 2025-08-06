import * as cheerio from 'cheerio';
import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class LatestModsCommand implements Command {
    public names = [Lang.getRef('chatCommands.latest', Language.Default)];
    public cooldown = new RateLimiter(1, 5000);
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];

    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        const html = await this.getMods();
        const links = html ? await this.parseHTML(html) : [];
        if (links.length) {
            links.forEach(link => InteractionUtils.send(intr, link));
        } else {
            InteractionUtils.send(intr, Lang.getEmbed('displayEmbeds.latest', data.lang));
        }
    }

    private getMods(): Promise<string> {
        return fetch('https://www.moddb.com/mods/stalker-anomaly/addons?sort=date-desc')
            .then(res => res.text() || '')
            .catch(() => '');
    }

    private parseHTML(html: string): Promise<string[]> {
        const $ = cheerio.load(html);
        const mods: IMod[] = [];
        let id = new Date().getTime();

        $('.rowcontent').each((_, element): void => {
            const linkElement = $(element).find('a');
            const title = linkElement.attr('title').trim();
            const link = 'https://www.moddb.com' + linkElement.attr('href');
            mods.push({id, title, link});
            id++; // Keep ID as uniq number
        });

        return mods.length ? this.addModsToDB(mods) : Promise.resolve([]);
    }

    private async addModsToDB(mods: IMod[]): Promise<string[]> {
        try {
            const maximumStorageCount = 100;
            // Initialize LowDB access
            const adapter = new JSONFile<{mods: IMod[]}>('db.json');
            const db = new Low<{mods: IMod[]}>(adapter, null); // Not sure that defaultData as {mods: []} is useful
            await db.read();

            // Check for storage existence and create one when missing
            if (!db.data.mods) {
                db.data = {mods: []};
                await db.write();
            }
            /**
             * Check for storage size and remove extra elements when overloaded.
             * Allows to keep storage size NOT larger than {@link maximumStorageCount}
             * and removes old entries to keep storage more dynamic and up to date.
            */
            else if (db.data.mods.length > maximumStorageCount) {
                const extraCount= db.data.mods.length - maximumStorageCount;
                db.data.mods.splice(0, extraCount);
                await db.write();
                const date = new Date().toISOString();
                console.log(`${extraCount} old elements removed from LowDB at ${date}`);
            }

            // Check new mods for existence in LowDB
            const existingLinks = db.data.mods.length ? db.data.mods.map(i => i.link) : [];
            const newMods = mods.filter(i => !existingLinks.includes(i.link));

            // Add new mods to LowDB
            if (newMods.length) {
                const date = new Date().toISOString();
                newMods.forEach(i => {
                    db.data.mods.push(i);
                    console.log(`${i.title} added to LowDB at ${date}`);
                });
                await db.write();
                return newMods.map(i => i.link);
            }
        } catch (e) {
            console.error(e);
        }

        return [];
    }
}

interface IMod {
    id: number;
    title: string;
    link: string;
}

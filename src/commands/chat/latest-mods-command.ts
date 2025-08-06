import * as cheerio from 'cheerio';
import { ChatInputCommandInteraction, PermissionsString } from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';

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
        this.getMods().then(html => {
            this.parseHTML(html)
            InteractionUtils.send(intr, Lang.getEmbed('displayEmbeds.latest', data.lang));
        })
    }

    private getMods(): Promise<string> {
        return fetch('https://www.moddb.com/mods/stalker-anomaly/addons?sort=date-desc').then(res => res.text());
    }

    private parseHTML(html: string): void {
        const $ = cheerio.load(html);

        // Find all elements with class 'rowcontent'
        const addons: string[] = [];

        $('.rowcontent').each((_, element) => {
            const title = $(element).find('a').text().trim();
            const link = 'https://www.moddb.com' + $(element).find('a').attr('href');
            addons.push(`${title} - ${link}`);
        });

        console.log(addons);
    }
}

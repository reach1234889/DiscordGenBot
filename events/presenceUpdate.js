require("dotenv").config();
const fs = require("fs");
const path = require("path");

module.exports = {
    name: "presenceUpdate",

    async execute(oldPresence, newPresence) {
        const rewardRoleId = process.env.ROLE_REWARD_ID;
        const logChannelId = process.env.LOG_CHANNEL_ID;

        const filePath = path.join(__dirname, "../commands/cstatus.json");

        if (!fs.existsSync(filePath)) return;
        const data = JSON.parse(fs.readFileSync(filePath));

        const member = newPresence.member;
        if (!member) return;

        const required = data.required?.toLowerCase();
        if (!required) return;

        const custom = newPresence.activities.find(a => a.type === 4);
        const userStatus = custom?.state?.toLowerCase() || "";

        if (member.roles.cache.has(rewardRoleId)) {
            if (!userStatus.includes(required)) {
                await member.roles.remove(rewardRoleId);

                const logChannel = newPresence.guild.channels.cache.get(logChannelId);
                if (logChannel) logChannel.send(`⚠️ Removed role from **${member.user.tag}** — status no longer matches.`);
            }
        }
    }
};

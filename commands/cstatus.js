const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");
require("dotenv").config();

module.exports = {
    cooldown: new Set(),

    data: new SlashCommandBuilder()
        .setName("cstatus")
        .setDescription("Custom Status Verification System")
        .addSubcommand(sub =>
            sub.setName("set")
                .setDescription("Set the required custom status (Admins only)")
                .addStringOption(opt =>
                    opt.setName("status")
                        .setDescription("Required custom status text")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("check")
                .setDescription("Check if your custom status matches")
        ),

    async execute(interaction, client) {
        const adminRoleId = process.env.ADMIN_ROLE_ID;
        const rewardRoleId = process.env.ROLE_REWARD_ID;
        const logChannelId = process.env.LOG_CHANNEL_ID;
        const dmEnabled = process.env.DM_ENABLED === "true";
        const cooldownTime = 10; // seconds

        const filePath = path.join(__dirname, "cstatus.json");

        // Create save file if not exist
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({ required: "" }, null, 2));
        }

        const data = JSON.parse(fs.readFileSync(filePath));
        const sub = interaction.options.getSubcommand();

        // --- COOLDOWN SYSTEM ---
        if (sub === "check") {
            if (this.cooldown.has(interaction.user.id)) {
                return interaction.reply({
                    content: `⏳ Slow down! You can use this again in **${cooldownTime}s**`,
                    ephemeral: true
                });
            }
            this.cooldown.add(interaction.user.id);
            setTimeout(() => this.cooldown.delete(interaction.user.id), cooldownTime * 1000);
        }

        // ───────────────────────────────
        // 🔧 /cstatus set (Admin)
        // ───────────────────────────────
        if (sub === "set") {
            if (!interaction.member.roles.cache.has(adminRoleId)) {
                return interaction.reply({
                    content: "❌ You need the **admin role** to do that.",
                    ephemeral: true
                });
            }

            const newStatus = interaction.options.getString("status");
            data.required = newStatus;

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

            const embed = new EmbedBuilder()
                .setTitle("✅ Required Status Updated")
                .setDescription(`New required custom status:\n\n**${newStatus}**`)
                .setColor("Green");

            interaction.reply({ embeds: [embed] });

            // Log it
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) logChannel.send(`🔧 **${interaction.user.tag}** updated required status to: **${newStatus}**`);

            return;
        }

        // ───────────────────────────────
        // 🔎 /cstatus check (User)
        // ───────────────────────────────
        if (sub === "check") {
            const member = await interaction.guild.members.fetch(interaction.user.id);

            if (!data.required) {
                return interaction.reply({
                    content: "⚠ The required custom status is not set yet.",
                    ephemeral: true
                });
            }

            const presence = member.presence;
            const custom = presence?.activities?.find(a => a.type === 4);

            if (!custom || !custom.state) {
                return interaction.reply({
                    content: "❌ You do not have any custom status set.",
                    ephemeral: true
                });
            }

            const userStatus = custom.state.toLowerCase();
            const required = data.required.toLowerCase();

            if (!userStatus.includes(required)) {
                return interaction.reply({
                    content: `❌ Your status does not match the required: **${data.required}**`,
                    ephemeral: true
                });
            }

            // Already has role?
            if (member.roles.cache.has(rewardRoleId)) {
                return interaction.reply({
                    content: "✅ You are already verified!",
                    ephemeral: true
                });
            }

            await member.roles.add(rewardRoleId);

            const embed = new EmbedBuilder()
                .setTitle("🎉 Verification Successful")
                .setDescription(`You have received <@&${rewardRoleId}>`)
                .setColor("Blue");

            interaction.reply({ embeds: [embed] });

            // DM Notify
            if (dmEnabled) {
                member.send(`🎉 You have been verified and received <@&${rewardRoleId}>`).catch(() => {});
            }

            // Log
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) logChannel.send(`🎉 **${member.user.tag}** has been verified and received role.`);
        }
    }
};

const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { REST } = require("@discordjs/rest");
const fs = require("fs");
require('dotenv').config();

// === SECRETS REPLIT ===
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_TEMP = process.env.ROLE_TEMP;
const LOG_CHANNEL = process.env.LOG_CHANNEL;
const SCRIPT_CHANNEL = process.env.SCRIPT_CHANNEL;
const DENY_CHANNEL = process.env.DENY_CHANNEL;

// === CLIENT ===
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// === DATA ===
const DATA_FILE = "./data.json";
let data = { scripts: [] };
try {
  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  }
} catch (err) {
  console.error("Erreur chargement data.json:", err.message);
  data = { scripts: [] };
}
const saveData = () => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// === AUTO CREATE 15 SCRIPTS ===
if (!data.scripts || data.scripts.length === 0) {
  data.scripts = Array.from({ length: 15 }, (_, i) => ({
    id: `script${i+1}`,
    name: `Script ${i+1}`,
    status: "🟢",
    whitelist: [],
    result: `CONTENU DU SCRIPT ${i+1}`,
    publicMessage: "{user} bienvenue, voici ton script."
  }));
  saveData();
  console.log("✅ 15 scripts générés");
}

// === COMMANDES SLASH ===
const commands = [
  new SlashCommandBuilder().setName("activate").setDescription("Afficher le menu des scripts"),
  new SlashCommandBuilder().setName("edit").setDescription("Modifier un script"),
  new SlashCommandBuilder().setName("whitelist").setDescription("Voir / modifier la whitelist d'un script"),
  new SlashCommandBuilder().setName("editwhitelist").setDescription("Ajouter ou retirer des utilisateurs de la whitelist"),
  new SlashCommandBuilder().setName("whitelist_auto").setDescription("Rechercher une personne dans tous les scripts").addUserOption(opt => opt.setName("utilisateur").setDescription("L'utilisateur à rechercher").setRequired(true)),
  new SlashCommandBuilder().setName("info").setDescription("Afficher les infos du bot")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Commandes slash enregistrées !");
  } catch (err) {
    console.error("Erreur enregistrement commandes:", err);
  }
})();

// === MENU SCRIPT ===
function buildScriptMenu(single = true, context = "activation") {
  const embed = new EmbedBuilder()
    .setColor(context === "activation" ? 0x5865F2 : context === "edit" ? 0xF1C40F : 0x9B59B6)
    .setTitle(context === "activation" ? "✨ Catalogue des Scripts" : context === "edit" ? "⚙️ Modifier un Script" : "👥 Gestion Whitelist")
    .setDescription(context === "activation" 
      ? "Sélectionnez un script pour l'activer. Vous devez être dans la whitelist." 
      : "Choisissez le script que vous souhaitez configurer.");

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("select_script")
      .setPlaceholder("📂 Ouvrir le catalogue...")
      .setMinValues(1)
      .setMaxValues(single ? 1 : data.scripts.length)
      .addOptions(data.scripts.map(s => ({
        label: s.name,
        description: `État: ${s.status} | Whitelist: ${s.whitelist.length} membres`,
        value: s.id,
        emoji: "📜"
      })))
  );

  return { embeds: [embed], components: [row] };
}

// === LOG ===
function logAction(userId, scriptName, type) {
  const logChannel = client.channels.cache.get(LOG_CHANNEL);
  if (!logChannel) return;
  const embed = new EmbedBuilder()
    .setTitle(type)
    .addFields({ name: "User", value: `<@${userId}>` }, { name: "Script", value: scriptName })
    .setColor(type.includes("❌") ? 0xE74C3C : 0x3498DB)
    .setTimestamp();
  logChannel.send({ embeds: [embed] }).catch(() => {});
}

// === READY ===
client.once("ready", () => console.log(`${client.user.tag} prêt !`));

// === INTERACTIONS ===
client.on("interactionCreate", async interaction => {
  const guild = interaction.guild;
  if (!guild) return;
  const isOwner = interaction.user.id === guild.ownerId;

  // ---- OWNER ONLY ----
  const ownerOnly = ["edit", "editwhitelist", "whitelist_auto"];
  if (interaction.isChatInputCommand() && ownerOnly.includes(interaction.commandName) && !isOwner) {
    return interaction.reply({ content: "❌ Seul le propriétaire peut exécuter cette commande.", ephemeral: true });
  }

  // ---- /info ----
  if (interaction.isChatInputCommand() && interaction.commandName === "info") {
    const totalScripts = data.scripts.length;
    const activeScripts = data.scripts.filter(s => s.status === "🟢").length;
    const totalWhitelisted = data.scripts.reduce((sum, s) => sum + s.whitelist.length, 0);
    const embed = new EmbedBuilder()
      .setTitle("🤖 Infos du Bot")
      .setDescription(`**Scripts totaux :** ${totalScripts}\n**Scripts actifs :** ${activeScripts}\n**Utilisateurs whitelistés :** ${totalWhitelisted}\n**Serveur :** ${guild.name}`)
      .setColor(0x3498DB)
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ---- /activate ----
    const menu = buildScriptMenu(true);
    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle("📜 Menu Scripts").setDescription("Sélectionne un script ci-dessous.").setColor(0x5865F2)],
      components: menu.components,
      ephemeral: false
    });
  }

  // ---- MENU SCRIPT ----
  if (interaction.isStringSelectMenu() && interaction.customId === "select_script") {
    const script = data.scripts.find(s => s.id === interaction.values[0]);
    if (!script) return;

    // On vérifie le contexte via le message d'origine (embed title)
    const messageEmbed = interaction.message.embeds[0];
    const context = messageEmbed?.title || "";

    if (context.includes("Modifier un script")) {
      // Logique Edition (Modal)
      const modal = new ModalBuilder()
        .setCustomId(`modal_edit_${script.id}`)
        .setTitle(`Modifier ${script.name}`);

      const nameInput = new TextInputBuilder()
        .setCustomId("edit_name")
        .setLabel("Nom du script")
        .setStyle(TextInputStyle.Short)
        .setValue(script.name);

      const resultInput = new TextInputBuilder()
        .setCustomId("edit_result")
        .setLabel("Contenu du script")
        .setStyle(TextInputStyle.Paragraph)
        .setValue(script.result);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(resultInput)
      );
      return interaction.showModal(modal);
    }

    if (context.includes("Whitelist d'un script") || context.includes("Modifier la whitelist")) {
      // Logique Whitelist (Affichage ou Edition via Boutons)
      const isEditing = context.includes("Modifier la whitelist");
      const whitelistUsers = script.whitelist.map(id => `<@${id}>`).join(", ") || "Aucun utilisateur";
      
      const embed = new EmbedBuilder()
        .setTitle(`Whitelist : ${script.name}`)
        .setDescription(`Utilisateurs :\n${whitelistUsers}`)
        .setColor(0x3498DB);

      if (isEditing) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`wl_add_${script.id}`).setLabel("Ajouter").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`wl_rem_${script.id}`).setLabel("Retirer").setStyle(ButtonStyle.Danger)
        );
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Comportement par défaut : Activation
    const member = await guild.members.fetch(interaction.user.id);
    if (!script.whitelist.includes(interaction.user.id)) {
      logAction(interaction.user.id, script.name, "❌ Refus");
      guild.channels.cache.get(DENY_CHANNEL)?.send(`❌ <@${interaction.user.id}> Vous n'êtes pas dans la whitelist !`);
      return interaction.reply({ content: "❌ Vous n'êtes pas dans la whitelist.", ephemeral: true });
    }

    await member.roles.add(ROLE_TEMP).catch(() => {});
    setTimeout(() => member.roles.remove(ROLE_TEMP).catch(() => {}), 11000);

    const msg = script.publicMessage.replace("{user}", `<@${interaction.user.id}>`);
    const sent = await guild.channels.cache.get(SCRIPT_CHANNEL)?.send(msg);
    setTimeout(() => sent?.delete().catch(() => {}), 5000);

    const resultEmbed = new EmbedBuilder()
      .setTitle(`📦 ${script.name}`)
      .setDescription(`ID : 1457770140023132386\n\nvoici ton script tu peux l'enoyer ici avec le truc a copier en bas :\n\n\`\`\`${script.result}\`\`\``)
      .setColor(0x2ECC71)
      .setFooter({ text: "Ce message s'auto-détruira dans 5 secondes." });

    await interaction.reply({ embeds: [resultEmbed], ephemeral: true });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);

    logAction(interaction.user.id, script.name, "✅ Click");
  }

  // ---- MODALS & BUTTONS ----
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("modal_edit_")) {
      const scriptId = interaction.customId.replace("modal_edit_", "");
      const script = data.scripts.find(s => s.id === scriptId);
      if (!script) return;

      script.name = interaction.fields.getTextInputValue("edit_name");
      script.result = interaction.fields.getTextInputValue("edit_result");
      saveData();
      
      const newMenu = buildScriptMenu(true, "edit");
      await interaction.update({ ...newMenu, content: `✅ Script **${script.name}** mis à jour !` }).catch(() => {
        interaction.reply({ content: `✅ Script **${script.name}** mis à jour !`, ephemeral: true });
      });
      return;
    }
    
    if (interaction.customId.startsWith("modal_wl_add_")) {
      const scriptId = interaction.customId.replace("modal_wl_add_", "");
      const script = data.scripts.find(s => s.id === scriptId);
      const input = interaction.fields.getTextInputValue("user_id").trim();
      
      let targetUser;
      if (input.match(/^\d+$/) || input.match(/^<@!?(\d+)>$/)) {
        const id = input.replace(/[<@!>]/g, "");
        targetUser = await client.users.fetch(id).catch(() => null);
      } else {
        const members = await guild.members.fetch();
        targetUser = members.find(m => 
          m.user.username.toLowerCase() === input.toLowerCase() || 
          m.displayName.toLowerCase() === input.toLowerCase()
        )?.user;
      }

      if (!targetUser) return interaction.reply({ content: "❌ Utilisateur introuvable.", ephemeral: true });

      if (!script.whitelist.includes(targetUser.id)) {
        script.whitelist.push(targetUser.id);
        saveData();
      }
      return interaction.reply({ content: `✅ <@${targetUser.id}> ajouté à la whitelist de **${script.name}**.`, ephemeral: true });
    }

    if (interaction.customId.startsWith("modal_wl_rem_")) {
      const scriptId = interaction.customId.replace("modal_wl_rem_", "");
      const script = data.scripts.find(s => s.id === scriptId);
      const input = interaction.fields.getTextInputValue("user_id").trim();
      
      let targetUserId = input.replace(/[<@!>]/g, "");
      if (!targetUserId.match(/^\d+$/)) {
        const members = await guild.members.fetch();
        targetUserId = members.find(m => 
          m.user.username.toLowerCase() === input.toLowerCase() || 
          m.displayName.toLowerCase() === input.toLowerCase()
        )?.id;
      }

      if (!targetUserId) return interaction.reply({ content: "❌ Utilisateur introuvable.", ephemeral: true });
      
      script.whitelist = script.whitelist.filter(id => id !== targetUserId);
      saveData();
      return interaction.reply({ content: `❌ <@${targetUserId}> retiré de la whitelist de **${script.name}**.`, ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith("wl_add_") || interaction.customId.startsWith("wl_rem_")) {
      const isAdd = interaction.customId.startsWith("wl_add_");
      const scriptId = interaction.customId.split("_")[2];
      const modal = new ModalBuilder()
        .setCustomId(`modal_wl_${isAdd ? "add" : "rem"}_${scriptId}`)
        .setTitle(isAdd ? "Ajouter à la whitelist" : "Retirer de la whitelist");
      
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("user_id")
          .setLabel("ID ou Mention de l'utilisateur")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ));
      return interaction.showModal(modal);
    }
    
    if (interaction.customId.startsWith("auto_wl_rem_")) {
      const [,, scriptId, userId] = interaction.customId.split("_");
      const script = data.scripts.find(s => s.id === scriptId);
      if (script) {
        script.whitelist = script.whitelist.filter(id => id !== userId);
        saveData();
        return interaction.update({ content: `✅ Retiré de **${script.name}**`, components: [], embeds: [] });
      }
    }
  }

  // ---- /edit ----
  if (interaction.isChatInputCommand() && interaction.commandName === "edit") {
    const menu = buildScriptMenu(true, "edit");
    const embed = new EmbedBuilder().setTitle("Modifier un script").setDescription("Sélectionne un script à éditer").setColor(0xF1C40F);
    return interaction.reply({ embeds: [embed], components: menu.components, ephemeral: true });
  }

  // ---- /whitelist ----
  if (interaction.isChatInputCommand() && interaction.commandName === "whitelist") {
    const menu = buildScriptMenu(true, "whitelist");
    const embed = new EmbedBuilder().setTitle("Whitelist d'un script").setDescription("Sélectionne un script pour voir la whitelist").setColor(0x3498DB);
    return interaction.reply({ embeds: [embed], components: menu.components, ephemeral: true });
  }

  // ---- /editwhitelist ----
  if (interaction.isChatInputCommand() && interaction.commandName === "editwhitelist") {
    const menu = buildScriptMenu(true, "editwhitelist");
    const embed = new EmbedBuilder().setTitle("Modifier la whitelist").setDescription("Sélectionne un script pour ajouter ou retirer des utilisateurs").setColor(0x9B59B6);
    return interaction.reply({ embeds: [embed], components: menu.components, ephemeral: true });
  }

  // ---- /whitelist_auto ----
  if (interaction.isChatInputCommand() && interaction.commandName === "whitelist_auto") {
    const user = interaction.options.getUser("utilisateur");
    if (!user) {
      // On demande l'utilisateur si non fourni (via commande sans option pour l'instant)
      return interaction.reply({ content: "Veuillez mentionner un utilisateur.", ephemeral: true });
    }

    const foundIn = data.scripts.filter(s => s.whitelist.includes(user.id));
    if (foundIn.length === 0) {
      return interaction.reply({ content: `L'utilisateur <@${user.id}> n'est dans aucune whitelist.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Recherche pour ${user.username}`)
      .setDescription(`<@${user.id}> est présent dans :`)
      .setColor(0xE67E22);

    const rows = foundIn.map(s => new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`auto_wl_rem_${s.id}_${user.id}`)
        .setLabel(`Retirer de ${s.name}`)
        .setStyle(ButtonStyle.Danger)
    ));

    return interaction.reply({ embeds: [embed], components: rows.slice(0, 5), ephemeral: true });
  }
});

client.login(TOKEN);
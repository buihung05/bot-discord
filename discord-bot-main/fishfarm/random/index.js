const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const { QuickDB } = require('quick.db');

const db = new QuickDB({ filePath: path.resolve(__dirname, '../data/database.sqlite') });
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const GAME_BET_BUTTON = 'game:bet';
const GAME_ALL_IN_BUTTON = 'game:all-in';
const GAME_CANCEL_BUTTON = 'game:cancel';
const GAME_BET_MODAL = 'game:bet-modal';
const GAME_ALL_IN_PICK = 'game:all-in-pick';
const COIN_EMOJI_NAME = 'coin';

function makeEmbed(content) {
    return new EmbedBuilder()
        .setColor(0x2b90ff)
        .setDescription(content)
        .setFooter({ text: 'Fishfarm random' });
}

function makeCmdEmbed() {
    return new EmbedBuilder()
        .setColor(0x2b90ff)
        .setTitle('Lệnh hiện có')
        .setDescription('Dùng lệnh dưới đây để bắt đầu chơi.')
        .addFields(
            { name: 'Lệnh', value: '/choi-ca', inline: true },
            { name: 'Button', value: 'Cá bé, cá lớn, all in', inline: true },
            { name: 'Cách chơi', value: 'Bấm button rồi nhập số tiền cược', inline: true }
        )
        .setFooter({ text: 'good luck!' });
}

function makeGamePanelEmbed() {
    return new EmbedBuilder()
        .setColor(0x2b90ff)
        .setTitle('Cá bé - Cá lớn')
        .setDescription('Mu hehehe.')
        .setFooter({ text: 'good luck!' });
}

function makeMainButtons(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${GAME_BET_BUTTON}:ca-be:${userId}`)
            .setLabel('Ca bé')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`${GAME_BET_BUTTON}:ca-lon:${userId}`)
            .setLabel('Ca lớn')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`${GAME_ALL_IN_BUTTON}:${userId}`)
            .setLabel('All in')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`${GAME_CANCEL_BUTTON}:${userId}`)
            .setLabel('Hủy')
            .setStyle(ButtonStyle.Secondary)
    );
}

function makeAllInPickButtons(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${GAME_ALL_IN_PICK}:ca-be:${userId}`)
            .setLabel('Ca bé all in')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`${GAME_ALL_IN_PICK}:ca-lon:${userId}`)
            .setLabel('Ca lớn all in')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`${GAME_CANCEL_BUTTON}:${userId}`)
            .setLabel('Hủy')
            .setStyle(ButtonStyle.Secondary)
    );
}

function makeBetModal(choice, userId) {
    const input = new TextInputBuilder()
        .setCustomId('so_tien')
        .setLabel('Nhập số tiền cược')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ví dụ: 10000')
        .setRequired(true);

    return new ModalBuilder()
        .setCustomId(`${GAME_BET_MODAL}:${choice}:${userId}`)
        .setTitle(choiceLabel(choice))
        .addComponents(new ActionRowBuilder().addComponents(input));
}

function choiceLabel(choice) {
    return choice === 'ca-be' ? 'Ca bé' : 'Ca lớn';
}

function getDiceEmoji(guild, value) {
    const emoji = guild?.emojis?.cache?.find(item => item.name === `${value}_`);
    return emoji ? emoji.toString() : `:${value}:`;
}

function getCoinEmoji(guild) {
    const emoji = guild?.emojis?.cache?.find(item => item.name === COIN_EMOJI_NAME);
    return emoji ? emoji.toString() : ':coin:';
}

function formatAmount(guild, amount) {
    return `${amount} ${getCoinEmoji(guild)}`;
}

function parsePositiveInt(value) {
    const numberValue = Number.parseInt(String(value), 10);
    if (!Number.isInteger(numberValue) || numberValue <= 0) return null;
    return numberValue;
}

function readCustomIdParts(customId, prefix) {
    const expectedPrefix = `${prefix}:`;
    if (!customId.startsWith(expectedPrefix)) return null;
    return customId.slice(expectedPrefix.length).split(':');
}

async function getBalance(userId) {
    return (await db.get(`balance_${userId}`)) || 0;
}

async function playGame(interaction, luaChon, soCa) {
    if (soCa <= 0) {
        return interaction.reply({ embeds: [makeEmbed('Số tiền cược phải lớn hơn 0!')], ephemeral: false });
    }

    const userId = interaction.user.id;
    const balance = await getBalance(userId);
    if (balance < soCa) {
        return interaction.reply({ embeds: [makeEmbed('Bạn không đủ số dư để cược!')], ephemeral: false });
    }

    const xucXac1 = Math.floor(Math.random() * 6) + 1;
    const xucXac2 = Math.floor(Math.random() * 6) + 1;
    const xucXac3 = Math.floor(Math.random() * 6) + 1;
    const tong = xucXac1 + xucXac2 + xucXac3;
    const ketQua = tong <= 10 ? 'ca-be' : 'ca-lon';

    await interaction.reply({ embeds: [makeEmbed('Bat dau tung xuc xac...')], ephemeral: false });
    await wait(900);

    const resultText = [
        `Xuc xac 1: ${getDiceEmoji(interaction.guild, xucXac1)}`,
        `Xuc xac 2: ${getDiceEmoji(interaction.guild, xucXac2)}`,
        `Xuc xac 3: ${getDiceEmoji(interaction.guild, xucXac3)}`,
        `Kết quả: **${tong}** (${choiceLabel(ketQua)})`
    ].join('\n\n');

    if (luaChon === ketQua) {
        await db.add(`balance_${userId}`, soCa);
        await interaction.editReply({
            embeds: [makeEmbed(`${resultText}\n\nHuppp! Bạn nhận thêm **${formatAmount(interaction.guild, soCa)}**.`)]
        });
        return;
    }

    await db.sub(`balance_${userId}`, soCa);
    await interaction.editReply({
        embeds: [makeEmbed(`${resultText}\n\nCook. Bạn mất **${formatAmount(interaction.guild, soCa)}**.`)]
    });
}

const cmdCommand = new SlashCommandBuilder()
    .setName('cmd')
    .setDescription('Hiển thị lệnh để bấm');

const gameCommand = new SlashCommandBuilder()
    .setName('choi-ca')
    .setDescription('Mở bảng chơi cá bé cá lớn');

const commands = [cmdCommand, gameCommand].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`Bot đã đăng nhập: ${client.user.tag}`);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), {
            body: commands
        });
        console.log('Đã đăng ký lệnh /cmd và /choi-ca thành công!');
    } catch (error) {
        console.error('Lỗi đăng ký lệnh:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'cmd') {
            return interaction.reply({
                embeds: [makeCmdEmbed()],
                ephemeral: false
            });
        }

        if (interaction.commandName === 'choi-ca') {
            return interaction.reply({
                embeds: [makeGamePanelEmbed()],
                components: [makeMainButtons(interaction.user.id)],
                ephemeral: false
            });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId.startsWith(`${GAME_CANCEL_BUTTON}:`)) {
            const parts = readCustomIdParts(interaction.customId, GAME_CANCEL_BUTTON);
            const ownerId = parts && parts[0];

            if (ownerId !== interaction.user.id) {
                return interaction.reply({ embeds: [makeEmbed('Nút này không dùng cho bạn.')], ephemeral: false });
            }

            return interaction.reply({ embeds: [makeEmbed('Đã hủy thao tác.')], ephemeral: false });
        }

        if (interaction.customId.startsWith(`${GAME_ALL_IN_BUTTON}:`)) {
            const parts = readCustomIdParts(interaction.customId, GAME_ALL_IN_BUTTON);
            const ownerId = parts && parts[0];

            if (ownerId !== interaction.user.id) {
                return interaction.reply({ embeds: [makeEmbed('Nút này không dùng cho bạn.')], ephemeral: false });
            }

            return interaction.reply({
                embeds: [makeEmbed('Chọn cửa để all in.')],
                components: [makeAllInPickButtons(interaction.user.id)],
                ephemeral: false
            });
        }

        if (interaction.customId.startsWith(`${GAME_BET_BUTTON}:`)) {
            const parts = readCustomIdParts(interaction.customId, GAME_BET_BUTTON);
            const choice = parts && parts[0];
            const ownerId = parts && parts[1];

            if (ownerId !== interaction.user.id) {
                return interaction.reply({ embeds: [makeEmbed('Nút này không dùng cho bạn.')], ephemeral: false });
            }

            return interaction.showModal(makeBetModal(choice, interaction.user.id));
        }

        if (interaction.customId.startsWith(`${GAME_ALL_IN_PICK}:`)) {
            const parts = readCustomIdParts(interaction.customId, GAME_ALL_IN_PICK);
            const choice = parts && parts[0];
            const ownerId = parts && parts[1];

            if (ownerId !== interaction.user.id) {
                return interaction.reply({ embeds: [makeEmbed('Nút này không dùng cho bạn.')], ephemeral: false });
            }

            const balance = await getBalance(interaction.user.id);
            if (balance <= 0) {
                return interaction.reply({ embeds: [makeEmbed('Bạn không có số dư để all in!')], ephemeral: false });
            }

            return playGame(interaction, choice, balance);
        }
    }

    if (interaction.isModalSubmit()) {
        if (!interaction.customId.startsWith(`${GAME_BET_MODAL}:`)) return;

        const parts = readCustomIdParts(interaction.customId, GAME_BET_MODAL);
        const choice = parts && parts[0];
        const ownerId = parts && parts[1];

        if (ownerId !== interaction.user.id) {
            return interaction.reply({ embeds: [makeEmbed('Modal này không dùng cho bạn.')], ephemeral: false });
        }

        const soTien = parsePositiveInt(interaction.fields.getTextInputValue('so_tien'));
        if (!soTien) {
            return interaction.reply({ embeds: [makeEmbed('Số tiền cược không hợp lệ!')], ephemeral: false });
        }

        return playGame(interaction, choice, soTien);
    }
});

client.login(process.env.DISCORD_TOKEN).catch(() => {
    console.error('Lỗi đăng nhập: token không hợp lệ. Hãy kiểm tra lại file .env!');
});
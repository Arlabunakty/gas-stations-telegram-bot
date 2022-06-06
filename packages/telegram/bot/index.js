// require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (TELEGRAM_BOT_TOKEN === undefined) {
    throw new Error('TELEGRAM_BOT_TOKEN must be provided!');
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.use(Telegraf.log())
bot.start((ctx) => ctx.reply('Welcome'));
bot.help((ctx) => ctx.reply('Send me a sticker'));
bot.on('sticker', (ctx) => ctx.reply('👍'));
bot.hears('hi', (ctx) => ctx.reply('Hey there'));

bot.hears('Паливо', (ctx) => {
    ctx.telegram.deleteMessage(ctx.message.chat.id, ctx.message.message_id);

    return ctx.reply(
        'Отримати інформацію по паливу...',
        Markup.keyboard([Markup.button.locationRequest("Поділитися гео-локацією")]).resize().oneTime()
    )
});

const geolocationMiddleware = Telegraf.optional(f => f.message.location !== undefined, ctx => {
    ctx.reply('Your location ' + ctx.message.location);
});
bot.use(geolocationMiddleware);

bot.telegram.setWebhook(process.env.TELEGRAM_BOT_HOOK_PATH);

async function main(args) {
    try {
        await bot.handleUpdate(args)
        return {
            statusCode: 200,
            body: {
                message: "success",
            }
        };
    } catch (error) {
        console.log(error);
        return {
            statusCode: 400,
            body: {
                message: `error`,
            }
        };
    }
}

exports.main = main;
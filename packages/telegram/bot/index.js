// require('dotenv').config();
const { Telegraf } = require('telegraf');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// if (TELEGRAM_BOT_TOKEN === undefined) {
// throw new Error('TELEGRAM_BOT_TOKEN must be provided!');
// }

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => ctx.reply('Welcome'));
bot.help((ctx) => ctx.reply('Send me a sticker'));
bot.on('sticker', (ctx) => ctx.reply('👍'));
bot.hears('hi', (ctx) => ctx.reply('Hey there'));

bot.telegram.setWebhook(process.env.TELEGRAM_BOT_HOOK_PATH);

async function main(args) {
    try {
        console.log(args);
        console.table(args);
        // await bot.handleUpdate(req.body)
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
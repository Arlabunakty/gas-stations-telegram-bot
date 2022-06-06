// require('dotenv').config();
const connect = require('./mongodb-client');
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

const geolocationMiddleware = Telegraf.optional(f => f.update_id === undefined &&
    f.message !== undefined &&
    f.message.location !== undefined, async ctx => {
        // ctx.telegram.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
        ctx.reply('Your location: longitude=' + ctx.message.location.longitude + " latitude=" + ctx.message.location.latitude,
            Markup.removeKeyboard(true));

        const client = await connect();
        const db = await client.db(process.env.DATABASE);
        const stationsCollection = await db.collection("stations");
        const aggregation = [{
            '$geoNear': {
                'near': {
                    'type': 'Point',
                    'coordinates': [ctx.message.location.longitude, ctx.message.location.latitude]
                },
                'distanceField': 'distance',
                'maxDistance': 15000,
                'spherical': true
            }
        }, {
            '$sort': {
                'distance': 1
            }
        }];
        const stations = await stationsCollection.aggregate(aggregation).toArray();

        stations.forEach(station => {
            const description = station.fuelLimits.map(el => el.description).join('\n');
            ctx.reply(((station.distance / 1000).toFixed(2) * 1) +
                ' km ' + station._id + '\n Link https://www.google.com/maps/search/?api=1&query=' +
                station.geoPoint.lat + '%2C' + station.geoPoint.lon + ' \n Description:\n' + description);
        });
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
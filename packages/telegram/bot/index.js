// require('dotenv').config();
const connect = require('./mongodb-client');
const { Telegraf, Markup } = require('telegraf');
const { session } = require('telegraf-session-mongodb');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (TELEGRAM_BOT_TOKEN === undefined) {
    throw new Error('TELEGRAM_BOT_TOKEN must be provided!');
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.use(Telegraf.log());

connect().then(client => {
    const db = client.db();
    bot.use(session(db, { collectionName: 'sessions' }));
});

bot.start((ctx) => ctx.reply('Привіт\n Бот допоможе знайти паливо якщо воно є поряд!\n' +
    '/Паливо_95\n' +
    '/Паливо_92\n' +
    '/Паливо_ДП\n' +
    '/Паливо_ГАЗ\n'));
bot.help((ctx) => ctx.reply('Send me a sticker'));
bot.on('sticker', (ctx) => ctx.reply('👍'));
bot.hears('hi', (ctx) => ctx.reply('Hey there'));

bot.command(['/Паливо', '/Паливо_95', '/Паливо_92', '/Паливо_ДП', '/Паливо_ГАЗ'], (ctx) => {
    ctx.telegram.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
    ctx.session.lastFuelCommand = ctx.message.text;
    return ctx.reply(
        'Отримати інформацію по паливу за гео-локацією...',
        Markup.keyboard([Markup.button.locationRequest("Поділитися гео-локацією")]).resize().oneTime()
    )
});

const geolocationMiddleware = Telegraf.optional(f => f.update_id === undefined &&
    f.message !== undefined &&
    f.message.location !== undefined, async ctx => {
        // ctx.telegram.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
        ctx.reply('Your location: longitude=' + ctx.message.location.longitude + " latitude=" + ctx.message.location.latitude,
            Markup.removeKeyboard(true));

        const configuration = {
            '/Паливо': [],
            '/Паливо_95': ['PULLS 95', 'М100', '98', 'М95', '95'],
            '/Паливо_92': ['92'],
            '/Паливо_ДП': ['МДП+', 'PULLS Diesel', 'МДП', 'ДП'],
            '/Паливо_ГАЗ': ['ГАЗ']
        }

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
                'query': {
                    'fuelLimits': {
                        '$elemMatch': {
                            'limitType': {
                                '$in': ['MOBILE_APP', 'BANK_CARD', 'CASH']
                            },
                            'fuel.normalizedStandard': {
                                '$in': configuration[ctx.session.lastFuelCommand]
                            }
                        }
                    }
                },
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
                ' km ' + station._id + '\n [Map](https://www.google.com/maps/search/?api=1&query=' +
                station.geoPoint.lat + '%2C' + station.geoPoint.lon + ') \n Description:\n' + description);
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
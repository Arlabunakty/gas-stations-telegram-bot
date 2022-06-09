// require('dotenv').config();
const connect = require('./mongodb-client');
const { Telegraf, Markup } = require('telegraf');
const { session } = require('telegraf-session-mongodb');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (TELEGRAM_BOT_TOKEN === undefined) {
    throw new Error('TELEGRAM_BOT_TOKEN must be provided!');
}

const geolocationMiddleware = Telegraf.optional(f => f.update_id === undefined &&
    f.message !== undefined &&
    f.message.location !== undefined, async ctx => {
        // ctx.telegram.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
        // ctx.reply('Your location: longitude=' + ctx.message.location.longitude + " latitude=" + ctx.message.location.latitude,
        // Markup.removeKeyboard(true));

        const configuration = {
            '95 та преміум': ['PULLS 95', 'М100', '98', 'М95', '95'],
            '92': ['92'],
            'ДП та преміум': ['МДП+', 'PULLS Diesel', 'МДП', 'ДП'],
            'ГАЗ': ['ГАЗ']
        }
        const fuels = configuration[ctx['session']['lastFuelCommand']];
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
                    'maxDistance': 50000,
                    'query': {
                        'fuelLimits': {
                            '$elemMatch': {
                                'limitType': {
                                    '$in': ['MOBILE_APP', 'BANK_CARD', 'CASH']
                                },
                                'fuel.normalizedStandard': {
                                    '$in': fuels
                                }
                            }
                        }
                    },
                    'spherical': true
                }
            },
            {
                '$sort': {
                    'distance': 1
                }
            },
            {
                '$limit': 5
            }
        ];
        const stations = await stationsCollection.aggregate(aggregation).toArray();

        if (stations.length === 0) {
            return ctx.reply('В радіусі 50 км не має АЗК з обраним пальним', Markup.removeKeyboard(true));
        }

        await stations.map(async station => {
            const descriptions = station.fuelLimits
                .filter((el, i) => ['MOBILE_APP', 'BANK_CARD', 'CASH'].includes(el.limitType))
                .filter((el, i) => fuels.includes(el.fuel.normalizedStandard))
                .map(el => el.description)
            const description = [...new Set(descriptions)].join('\n');
            const message = '<b>' + ((station.distance / 1000).toFixed(2) * 1) + ' км</b>\n' +
                station.description + '\n' +
                '<a href="https://www.google.com/maps/search/?api=1&query=' +
                station.geoPoint.lat + ',' + station.geoPoint.lon + '">Google Map</a>\n' +
                description;
            return await ctx.replyWithHTML(message, Markup.removeKeyboard(true));
        });
    });

const bot = async function() {
    const botInstance = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    botInstance.use(Telegraf.log());
    const client = await connect();
    const db = await client.db('telegram-bot');
    botInstance.use(session(db, { collectionName: 'sessions' }));

    botInstance.start((ctx) => ctx.reply('Привіт\nБот допоможе знайти паливо якщо воно є поряд!',
        Markup.keyboard([
            ['95 та преміум'],
            ['ДП та преміум'],
            ['ГАЗ', '92']
        ]).oneTime().resize()));

    botInstance.help((ctx) => ctx.reply('Send me a sticker'));
    botInstance.on('sticker', (ctx) => ctx.reply('👍'));
    botInstance.hears('hi', (ctx) => ctx.reply('Hey there'));
    botInstance.hears(/^((95 та преміум)|(ДП та преміум)|(ГАЗ)|(92))$/, (ctx) => {
        //ctx.telegram.deleteMessage(ctx.message.chat.id, ctx.message.message_id);
        ctx['session']['lastFuelCommand'] = ctx.message.text;
        return ctx.reply(
            'Отримати інформацію по паливу за гео-локацією...',
            Markup.keyboard([Markup.button.locationRequest("Поділитися гео-локацією")]).resize().oneTime()
        )
    });
    botInstance.use(geolocationMiddleware);

    botInstance.telegram.setWebhook(process.env.TELEGRAM_BOT_HOOK_PATH);

    return botInstance;
}

async function main(args) {
    try {
        const botInstance = await bot();
        await botInstance.handleUpdate(args)
        return {
            statusCode: 200,
            body: {
                message: "success",
            }
        };
    } catch (error) {
        console.log(error);
        return {
            statusCode: 200,
            body: {
                message: `error`,
            }
        };
    }
}

exports.main = main;
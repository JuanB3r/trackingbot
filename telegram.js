"use strict";
const https = require("https");
const aftership = require("./aftership");

const telegramEndpoint = "api.telegram.org";

const sendMessageOptions = {
    hostname: telegramEndpoint,
    path: "/bot" + process.env.TOKEN + "/sendMessage",
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Accept-Charset": "utf-8"
    }
};

const errorTrackingNumber = "Hay un error en el formato del número, verifícalo e intenta nuevamente.";
const httpError = "Lo siento, hay inconvenientes en los sistemas de comunicación. Por favor, intenta más tarde.";

/**
 * Asigna el webhook para las actualizaciones que envía Telegram
 */
function setWebhook() {
    let postData = {
        url: `https://${process.env.WEBHOOK}/${process.env.TOKEN}`,
        max_connections: 40,
        allowed_updates: ["message", "callback_query"]
    };
    const req = https.request({
        hostname: telegramEndpoint,
        path: "/bot" + process.env.TOKEN + "/setWebhook",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept-Charset": "utf-8"
        }
    }, (res) => {
        console.log(`STATUS POST TELEGRAM WEBHOOK: ${res.statusCode}`);
        res.setEncoding("utf-8");
    });
    req.on("error", error => {
        console.error("ERROR WHEN ATTEMPTING TO SEND THE MESSAGE: " + error);
    });
    req.write(JSON.stringify(postData), (error) => {
        if (error) console.error(error);
    });
    req.end();
}

// Vector que contiene las actualizaciones
let updates = [];

/**
 * Obtiene las actualizaciones de telegram
 */
function getUpdates() {
    let rawData = "";
    let req = https.request({
        method: "GET",
        hostname: "api.telegram.org",
        path: "/bot" + process.env.TOKEN + "/getUpdates"
    }, (res) => {
        res.setEncoding("utf-8");
        res.on("data", (chunck) => {
            rawData += chunck;
        });
        res.on("end", () => {
            try {
                const parsedJSON = JSON.parse(rawData);
                console.log(parsedJSON);
                //Compara si son actualizaciones viejas o nuevas 
                if (updates.length === parsedJSON.result.length || updates.length === 0) {
                    updates = parsedJSON.result;
                } else {
                    let newUpdates = parsedJSON.result.splice(updates.length);
                    updates.push(newUpdates);
                    executeCommands(newUpdates);
                }
            } catch (e) {
                console.error(e.message);
            }
        });
    });
    req.end();
}

/**
 * Ejecuta el comando correspondiente a cada actualización
 * @param {Array} result vector con las actualizaciones de Telegram
 */
function executeCommands(update) {
    if (update.message) {
        let text = update.message.text.split(" ");
        switch (text[0]) {
            case "/start":
                start(update.message.chat.id);
                break;
            case "/track":
                track(update.message);
                break;
            case "/add":
                addTrack(update.message);
                break;
            case "/edit":
                editTrack(update.message);
                break;
            case "/remove":
                removeTrack(update.message);
                break;
            case "/list":
                listTracks(update.message);
                break;
            case "/help":
                help(update.message.chat.id);
                break;
        }
    } else if (update.callbackQuery) {

    }
}

/**
 * Realiza una petición HTTPS
 * @param {String} postData JSON con los datos a enviar
 */
function sendMessage(postData) {
    const req = https.request(sendMessageOptions, (res) => {
        console.log(`STATUS POST TELEGRAM MESSAGE: ${res.statusCode}`);
        res.setEncoding("utf-8");
    });
    req.on("error", error => {
        console.error("ERROR WHEN ATTEMPTING TO SEND THE MESSAGE: " + error);
    });
    req.write(postData, (error) => {
        if (error) console.error(error);
    });
    req.end();
}

/**
 * Envía el mensaje de inicio del bot
 * @param {number} id identificador del chat/usuario
 */
function start(id) {
    console.log("CHAT_ID=" + id);
    const postData = JSON.stringify({
        chat_id: id,
        text: "Hola, usa un comando para ayudarte. Si es primera vez que me hablas, usa el comando /help para obtener consejos",
        parse_mode: ""
    });
    sendMessage(postData);
}

/**
 * Analiza un callbackQuery y obtiene el número de guía y la transportista, y 
 * lo convierte en un objeto
 * @param {string} string texto del callbackQuery}
 */
function parseCallback(string) {
    //TODO: convertir callback
    let object = {};
    return object;
}

/**
 * Ejecuta la lógica para el comando rastrear un envío
 * @param {Object} message Objeto del mensaje con el número a rastrear
 */
function track(message) {
    let array = message.text.split(" ");
    let trackingNumber = array[1];
    aftership.detectCouriers(trackingNumber).then((couriers) => {
        console.log(couriers);
        let postData;
        if (typeof couriers === "undefined" || couriers.length === 0) {
            postData = JSON.stringify({
                chat_id: message.chat.id,
                text: "No se pudo encontrar ninguna transportista para el número que ingresaste. ¿Estás seguro de haberlo escrito bien? Revísalo e intenta nuevamente."
            });
        } else if (couriers.length === 1) { // Si solo fue detectado un courier
            aftership.track(trackingNumber, couriers[0].slug).then(tracking => {
                sendTrackingInfo(tracking, message.chat.id);
            }).catch(error => {                
                if (error.meta.code === 4004) { // Si el número de rastreo no existe
                    aftership.addTrack(trackingNumber, couriers[0].slug, null).then(tracking => { // Agrega el número de rastreo sin alias
                        sendTrackingInfo(tracking, message.chat.id);
                    }).catch(err => {
                        if (err.meta.code === 4005) { // Si el formato del número es inválido
                            sendInvalidNumberError(message.chat.id);
                        } else {
                            sendHttpError(message.chat.id); // Error con la petición
                        }
                    });
                } else if (error.meta.code === 4005) { // Si el formato del número es inválido
                    sendInvalidNumberError(message.chat.id);
                } else {
                    sendHttpError(message.chat.id); // Error con la petición
                }
            });
        } else { // Múltiples couriers detectados, se crean los botones en matriz 2xn
            let row = [], buttons = [];
            couriers.forEach((courier, i) => {
                row.push({
                    text: courier.name,
                    callback_data: "track|" + trackingNumber + "|" + courier.slug
                });
                if (i % 2 === 0) {
                    buttons.push(row);
                    row = [];
                }
            });
            // Mensaje a enviar
            postData = JSON.stringify({
                chat_id: message.chat.id,
                text: "¿A cuál transportista pertenece?",
                reply_markup: {
                    inline_keyboard: buttons
                }
            });
            sendMessage(postData);
        }
    }).catch(error => {
        if (error.meta.code === 4005) {
            sendInvalidNumberError(message.chat.id); // Si el formato del número es inválido
        } else {
            sendHttpError(message.chat.id); // Error con la petición
        }
    });
}

/**
 * Envía el mensaje con toda la información de rastreo del envío
 * @param {Object} tracking JSON con la información del envío
 * @param {number} id identificador del chat
 */
function sendTrackingInfo(tracking, id) {
    let checkpoints = "", postData;
    tracking.checkpoints.forEach(checkpoint => {
        let date = new Date(checkpoint.checkpoint_time).toUTCString();
        checkpoints += `\n<b>Fecha</b>: ${date}\n<b>Mensaje</b>: ${checkpoint.message}`;
        if (checkpoint.location) {
            checkpoints += "\n<b>Lugar</b>:" + checkpoint.location;
        }
    });

    postData = JSON.stringify({
        chat_id: id,
        text: `<b>Número</b>: ${tracking.tracking_number}\n<b>Estado</b>: en tránsito\n\n<b>Checkpoints</b>\n` + checkpoints,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "Ver en Aftership",
                        url: "trackingbot.aftership.com/" + tracking.tracking_number
                    },
                    {
                        text: "Ver en 17track",
                        url: "http://www.17track.net/es/track?nums=" + tracking.tracking_number
                    }
                ]
            ]
        }
    });
    sendMessage(postData);
}

/**
 * Guarda un envío en la base de datos
 * @param {Object} message Objeto del mensaje con el número a rastrear
 */
function addTrack(message) { }

/**
 * Verifica si se obtiene error con el número de guía y envía el mensaje de error
 * @param {number} id identificador del chat
 */
function sendInvalidNumberError(id) {
    sendMessage(JSON.stringify({
        chat_id: id,
        text: errorTrackingNumber
    }));
}

/**
 * Verifica si se obtiene error con las peticiones HTTP y envía el mensaje de error
 * @param {number} id identificador del chat
 */
function sendHttpError(id) {
    sendMessage(JSON.stringify({
        chat_id: id,
        text: httpError
    }));
}

/**
 * Edita el alias de un envío almacenado
 * @param {Object} message Objeto del mensaje con el número de guía
 */
function editTrack(message) { }

/**
 * Elimina un envío almacenado
 * @param {Object} message Objeto del mensaje con el número de guía
 */
function removeTrack(message) { }

/**
 * Envía todos los envíos almacenados
 * @param {number} id identificador del chat/usuario
 */
function listTracks(id) { }

/**
 * Envía los consejos de uso del bot
 * @param {number} id identificador del chat/usuario
 */
function help(id) {
    // Mensaje a enviar
    const postData = JSON.stringify({
        chat_id: id,
        text: "Comands\n"
            + "- /track rastrea un número (e.g. `/track 88981234631`)\n"
            + "- /add  agrega un número de guía (e.g. `/add 88981234631 \"audifonos bose\"`)\n"
            + "- /edit edita el alias de un número de guía , puedes usar el número o el alias para editarlo (e.g. `/edit 88981234631 | /edit \"audifonos bose\"`)\n"
            + "- /remove elimina un número de guía, puedes usar el número o el alias para eliminarlo (e.g. `/remove 88981234631 | /remove \"audifonos bose\"`)\n"
            + "- /list lista todos los números de guía almacenados",
        parse_mode: "Markdown"
    });
    sendMessage(postData);
}

module.exports.getUpdates = getUpdates;
module.exports.setWebhook = setWebhook;
module.exports.executeCommands = executeCommands;
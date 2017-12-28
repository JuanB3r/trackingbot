"use strict";
require("dotenv").config();
const http = require("http");
const telegram = require("./telegram");

telegram.setWebhook();

// Obtener las actualizaciones cada segundo
//setInterval(telegram.getUpdates, 1000);
//Webhook para las actualizaciones enviadas por Telegram
http.createServer((request, response) => {
    if (request.url === ("/" + process.env.TOKEN) && request.method === "POST") {
        console.log("HTTP request listened at 8443");

        let rawBodyData = "";

        request.on("error", err => {
            console.error(err);
        }).on("data", chunk => {
            rawBodyData += chunk;
        }).on("end", () => {
            try {
                const update = JSON.parse(rawBodyData);
                console.log(update);
                //Compara si son actualizaciones viejas o nuevas 
                telegram.executeCommands(update);
            } catch (e) {
                console.error(e.message);
            }
            response.on("error", error => {
                console.error(error);
            });
            response.statusCode = 200;
            //response.setHeader("Content-Type", "application/json");
            response.setHeader("Content-Type", "text/html");
            response.write("true");
            response.end();
        });
    } else {
        response.statusCode = 404;
        response.end();
    }
}).listen(8443);
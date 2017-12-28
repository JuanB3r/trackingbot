"use strict";
const https = require("https");
const aftershipEndpoint = "api.aftership.com";
const aftershipHeaders = {
    "aftership-api-key": process.env.API_KEY,
    "Content-Type": "application/json"
};

/**
 * Rastrea un número de guía
 * @param {Número de guía} trackingNumber
 * @param {Slug del courier} slug
 * @returns {Promise} Promise con respuesta de la petición HTTP
 */
function track(trackingNumber, slug) {
    console.log(trackingNumber + slug);
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: aftershipEndpoint,
            path: `/v4/trackings/${slug}/${trackingNumber}?lang=en&fields=tracking_ship_date,tracking_destination_country,title,checkpoints`,
            headers: aftershipHeaders
        }, (res) => {
            const { statusCode } = res;
            const contentType = res.headers["content-type"];
            let error;
            
            res.setEncoding("utf-8");
            let rawData = "";
            res.on("data", (chunck) => { rawData += chunck; });
            res.on("end", () => {
                try {
                    console.log(rawData);
                    const parsedData = JSON.parse(rawData);
                    if (statusCode !== 404 && parsedData.meta.code === 4004) {
                        error = new Error(`Request Failed.\nStatus Code: ${statusCode} - ${parsedData.meta.message}`);
                    } else if (!/^application\/json/.test(contentType)) {
                        error = new Error(`Invalid content-type.\nExpected application/json but received: ${contentType}`);
                    }
                    if (error) {
                        res.resume();
                        reject(parsedData);
                    }
                    resolve(parsedData.data.tracking);
                } catch (e) {
                    console.error("Got error at track response: " + e.message);
                }
            });
        });
        req.on("error", (error) => {
            console.error("Got error at track request: " + error.message);
            reject(error);
        });
        req.end();
    });
}

/**
 * Agrega un número de guía para poder ser rastreado
 * @param {Número de guía} trackingNumber 
 * @param {Slug del courier} slug 
 * @returns {Promise} Promise con respuesta de la petición HTTP
 */
function addTrack(trackingNumber, slug, alias) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: aftershipEndpoint,
            path: "v4/trackings",
            method: "POST",
            headers: aftershipHeaders
        }, (res) => {
            const { statusCode } = res;
            const contentType = res.headers["content-type"];
            let error;

            res.setEncoding("utf-8");
            let rawData = "";
            res.on("data", (chunck) => { rawData += chunck; });
            res.on("end", () => {
                try {
                    const parsedData = JSON.parse(rawData);
                    if (statusCode !== 404 && parsedData.meta.code === 4004) {
                        error = new Error(`Request Failed.\nStatus Code: ${statusCode} - ${parsedData.meta.message}`);
                    } else if (!/^application\/json/.test(contentType)) {
                        error = new Error("Invalid content-type.\n" + `Expected application/json but received: ${contentType}`);
                    }
                    if (error) {
                        res.resume();
                        reject(parsedData);
                    }
                    resolve(parsedData.data.tracking);
                } catch (e) {
                    console.error("Got error at post track: " + e.message);
                }
            });
        });
        req.on("error", (error) => {
            console.error("Got error at post track: " + error.message);
            reject(error);
        });        
        req.write(JSON.stringify({
            tracking: {
                slug: slug,
                tracking_number: trackingNumber,
                title: alias
            }
        }));
        req.end();
    });
}

/**
 * Obtiene los couriers detectados
 * @param {Número de rastreo} trackingNumber 
 * @returns {Promise} Promise con vector de los couriers
 */
function detectCouriers(trackingNumber) {
    return new Promise((resolve, reject) => {
        let couriers = {};
        
        const req = https.request({
            hostname: aftershipEndpoint,
            path: "/v4/couriers/detect",
            method: "POST",
            headers: aftershipHeaders
        }, (res) => {
            const { statusCode } = res;
            const contentType = res.headers["content-type"];
            let error;

            res.setEncoding("utf-8");
            let rawData = "";
            res.on("data", (chunck) => { rawData += chunck; });
            res.on("end", () => {
                try {
                    const parsedData = JSON.parse(rawData);
                    couriers = parsedData.data.couriers;
                    if (statusCode !== 404 && parsedData.meta.code === 4004) {
                        error = new Error(`Request Failed.\nStatus Code: ${statusCode} - ${parsedData.meta.message}`);
                    } else if (!/^application\/json/.test(contentType)) {
                        error = new Error("Invalid content-type.\n" + `Expected application/json but received: ${contentType}`);
                    }
                    if (error) {
                        res.resume();
                        reject(parsedData);
                    }
                    resolve(couriers);
                } catch (e) {
                    console.error(e.message);
                    reject(e);
                }
            });
        });
        req.on("error", (error) => {
            console.error(`Got error at detect couriers: ${error.message}`);
            reject(error);
        });
        req.write(JSON.stringify({
            tracking: {
                tracking_number: trackingNumber
            }
        }));
        req.end();
    });
}

module.exports.detectCouriers = detectCouriers;
module.exports.track = track;
module.exports.addTrack = addTrack;
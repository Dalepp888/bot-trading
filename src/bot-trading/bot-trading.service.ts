import { Injectable, OnModuleInit } from "@nestjs/common";
import { Telegraf } from "telegraf";
import { GoogleGenAI } from "@google/genai";
import { ExchangeService } from "src/exchange/exchange.service";
import { PaperFuturesService } from "src/paper-trading/paper-trading.service";

@Injectable()
export class BotTradingService implements OnModuleInit {

    private bot: Telegraf;

    constructor(
        private readonly exchangeService: ExchangeService,
        private readonly paperFuturesService: PaperFuturesService
    ) {
        this.bot = new Telegraf(process.env.BOT_TOKEN!);

    }

    async onModuleInit() {

        let jaja = "BTC/USDT"
        let operation = {}

        this.bot.start((ctx) => ctx.reply("Welcome to Bot Trading!."));
        this.bot.command("balance", async (ctx) => {
            const balance = await this.exchangeService.getBalance();
            console.log(balance);
            ctx.reply(`Tu balance total es: ${JSON.stringify(balance.total)},
             tu balance para retirar o usar es: ${JSON.stringify(balance.free)}, y tu balance
             bloqueado o en ordenes abiertas es: ${JSON.stringify(balance.used)} `);
        })
        this.bot.command("positions", async (ctx) => {
            const positions = await this.exchangeService.getOpenPositionsFutures();
            const futu = await this.exchangeService.getFuturesData("BTC/USDT")
            ctx.reply(`${JSON.stringify(futu.price)}`)
        })
        this.bot.command("IaGemini", async (ctx) => {
            const data = await this.exchangeService.getOhlcv("BTC/USDT", "15m", Date.now() - 60 * 60 * 1000, 60);
            const datain = await this.exchangeService.getTicker("BTC/USDT");
            //const my = await this.exchangeService.getBalance();
            //const data = await this.paperFuturesService.getOhlcv("BTC/USDT", "1m", Date.now() - 60 * 60 * 1000, 60);
            //const datain = await this.paperFuturesService.getTicker("BTC/USDT");
            const my = await this.paperFuturesService.getBalance();
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `
    Analiza cuidadosamente esta información:

Balance actual: ${JSON.stringify(my)}

Histórico reciente del mercado: ${JSON.stringify(data)}

Precio actual: ${JSON.stringify(datain)}

Tu tarea es abrir una operación de trading de futuros haciendo scalping suave, priorizando 
movimientos pequeños, entradas conservadoras y gestión estricta del riesgo.

Devuélveme únicamente un objeto JSON válido, sin texto adicional, sin explicaciones, sin markdown 
y sin caracteres fuera del JSON como tres comillas. Debes usar exactamente esta estructura:

{
"symbol": "BTC/USDT",
"side": "buy" or "sell",
"amount": number,
"leverage": number,
"price": number,
"type": "market" or "limit",
"stopLoss": number,
"takeProfit": number
}

Reglas obligatorias:

Si la orden es market, el campo "price" debe ser siempre el precio actual.

"amount" debe ser positivo y calcularse de forma segura:

Nunca mayor que balance disponible / precio actual.

Ajústalo para scalping suave (normalmente un valor pequeño).

"leverage" debe estar entre 1 y 5, priorizando valores conservadores.

"stopLoss" y "takeProfit" deben reflejar scalping suave:

Distancias cortas pero realistas.

Take Profit mayor que Stop Loss en relación riesgo/beneficio positiva.

Devuelve solo números en los campos numéricos, sin null, sin strings innecesarios.

Solo responde con el JSON. Nada más, evita poner palabras o comillas.
  `,
            });
            console.log(response.text);
            const text = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!text) {
                ctx.reply("⚠️ No se recibió texto válido de Gemini.");
                return;
            }
            try {
                const orderData: {
                    symbol: string;
                    side: 'buy' | 'sell';
                    amount: number;
                    leverage: number;
                    price: number | null;
                    type: 'market' | 'limit';
                    stopLoss: number;
                    takeProfit: number;
                } = JSON.parse(text);

                if (orderData.symbol === 'BTC/USDT') {
                    orderData.symbol = 'BTCUSDT';
                }

                operation = orderData

                {/*const order = await this.exchangeService.placeFuturesOrder(
                    orderData.symbol,
                    orderData.side,
                    orderData.amount,
                    orderData.leverage,
                    orderData.price ? orderData.price : undefined,
                    orderData.type
                );*/}

                const order = await this.paperFuturesService.placeFuturesOrder(
                    orderData.symbol,
                    orderData.side,
                    orderData.amount,
                    orderData.leverage,
                    orderData.price ? orderData.price : undefined,
                    orderData.type,
                    orderData.stopLoss,
                    orderData.takeProfit
                );

                ctx.reply(`✅ Orden ejecutada: ${JSON.stringify(order, null, 2)}.
                Respuesta de Gemini: ${JSON.stringify(response.text)}`);

            } catch (err) {
                console.error("Error al procesar respuesta de Gemini:", err);
                ctx.reply("⚠️ Hubo un error al procesar la respuesta de Gemini.");
            }
        })
        this.bot.command("ia", async (ctx) => {
            const data = await this.paperFuturesService.getOhlcv("BTC/USDT", "1m", Date.now() - 5 * 60 * 1000, 5);
            const datain = await this.paperFuturesService.getTicker("BTC/USDT");
            const my = await this.paperFuturesService.getBalance();
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `
    Analiza estos datos del mercado y balance:
    - Balance: ${JSON.stringify(my)}
    - Histórico: ${JSON.stringify(data)}
    - Precio actual: ${JSON.stringify(datain)}

    segun los datos anteriores dime si, estos datos ${JSON.stringify(operation)} que son de una operacion 
    que abriste hace poco siguen siendo una buena idea o es mejor cerrarla y damelo en un texto
    pequeño.

    IMPORTANTE:
No declares que una operación es mala solo porque el precio actual está ligeramente en contra.
Tolera retrocesos pequeños dentro de un rango normal de scalping (0.05% a 0.20%).
Solo considera que una operación abierta ya no es buena si:
- El precio se acerca peligrosamente al stopLoss,
- Se rompe un nivel clave de soporte o resistencia,
- El volumen o la tendencia cambian de forma fuerte y clara,
- La estructura del mercado invalida el movimiento inicial.

Pequeños retrocesos o laterales NO invalidan la operación.
    `})

            ctx.reply(`Respuesta de Gemini: ${JSON.stringify(response.text)}`);
        })
        this.bot.on("text", async (ctx) => {
            const ticker = await this.exchangeService.getTicker(ctx.message.text);
            ctx.reply(`La moneda que buscamos, ${ticker.symbol},
            tiene un precio de ${ticker.last} USDT, con
            el mejor precio de venta de ${ticker.ask} USDT
            y el mejor precio de compra de ${ticker.bid} USDT.
            Un maximo de ${ticker.high} USDT y un minimo de ${ticker.low} USDT, un precio
            de apertura de ${ticker.open} USDT y una variacion absoluta o
            porcentual de ${ticker.change} USDT (${ticker.percentage}%). El volumen
            de la moneda base es de ${ticker.baseVolume} y el volumen
            de la moneda cotizada es de ${ticker.quoteVolume}.
        `)
        })
        this.bot.launch();
    }
}
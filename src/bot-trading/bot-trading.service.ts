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

    A partir de estos datos vamos a abrir una operacion en trading de futuros y debes abrir
    las operaciones con la intencion de perder la menor cantidad de dinero posible. prefiero 
    ganar poco que perder mucho quiero que hagas scalping suave, que harias. Dame la respuesta 
    lo mas orta posible, solo que harias y porque`})

     ctx.reply(`Respuesta de Gemini: ${JSON.stringify(response.text)}`);
        })
        this.bot.command("IaGemini", async (ctx) => {
            //const data = await this.exchangeService.getOhlcv("BTC/USDT", "1m", Date.now() - 60 * 60 * 1000, 60);
            //const datain = await this.exchangeService.getTicker("BTC/USDT");
            //const my = await this.exchangeService.getBalance();
            const data = await this.paperFuturesService.getOhlcv("BTC/USDT", "1m", Date.now() - 60 * 60 * 1000, 60);
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

    A partir de estos datos vamos a abrir una operacion en trading de futuros y debes abrir
    las operaciones con la intencion de perder la menor cantidad de dinero posible. prefiero 
    ganar poco que perder mucho quiero que hagas scalping suave.

    Devuélveme **únicamente** un objeto JSON válido que es para la operacion de trading de 
    futuros de la que te hable arriba, sin texto adicional, sin explicación 
    y sin formato Markdown.Usa exactamente esta estructura, no me des otras comillas que no 
    esten dentro del json. Solo quiero las llaves y lo que hay dentro, nada más. El objeto 
    JSON debe tener esta estructura:

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
      Instrucciones adicionales:
1. Nunca uses "null" en "price". Si la orden es de mercado, usa siempre el precio actual.
2. El "amount" debe ser positivo y no mayor que el balance disponible (USD / precio actual).
3. El "leverage" debe ser al menos 1 y no más que el máximo permitido (por ejemplo, 5).
4. Devuelve solo números, comillas dobles solo donde corresponda (string), y **JSON válido que pueda ser parseado directamente**.
5. No agregues texto, explicaciones ni Markdown.
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

    } catch(err) {
        console.error("Error al procesar respuesta de Gemini:", err);
        ctx.reply("⚠️ Hubo un error al procesar la respuesta de Gemini.");
    }
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
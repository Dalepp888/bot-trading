import { Injectable, OnModuleInit } from "@nestjs/common";
import { Telegraf } from "telegraf";
import { GoogleGenAI } from "@google/genai";
import { ExchangeService } from "src/exchange/exchange.service";
import { PaperFuturesService } from "src/paper-trading/paper-trading.service";
import { Cron } from "@nestjs/schedule";

@Injectable()
export class BotTradingService implements OnModuleInit {

    private bot: Telegraf;
    private operation: object = {}

    constructor(
        private readonly exchangeService: ExchangeService,
        private readonly paperFuturesService: PaperFuturesService
    ) {
        this.bot = new Telegraf(process.env.BOT_TOKEN!);

    }

    //esta funcion es para automatizar
    async futuresOperation() {
        if (Object.keys(this.operation).length === 0) {
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
    Analiza cuidadosamente la siguiente información:

Balance actual: ${JSON.stringify(my)}
Histórico reciente del mercado: ${JSON.stringify(data)}
Precio actual: ${JSON.stringify(datain)}

Tu tarea es abrir una operación de trading de futuros usando un estilo de 
“micro-swing intradía”, con duración esperada entre 10 y 40 minutos. 
Busco entradas moderadas, movimientos más amplios que el scalping, 
y una gestión de riesgo equilibrada.

Devuélveme UNICAMENTE un objeto JSON VÁLIDO.
No incluyas texto adicional.
No incluyas explicaciones.
No incluyas comentarios.
No incluyas Markdown.
NO agregues comillas fuera del JSON.
NO agregues caracteres antes o después del JSON.
El mensaje debe contener SOLO el objeto JSON EXACTAMENTE con este formato:

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

1. Si "type" es "market", "price" debe ser SIEMPRE el precio actual.
2. "amount" debe ser positivo y NUNCA mayor que (balance disponible / precio actual).
3. Usa un amount pequeño y seguro adecuado para micro-swing intradía.
4. "leverage" entre 1 y 5, preferiblemente valores moderados (2–4).
5. La pérdida máxima si se ejecuta el stopLoss NO DEBE superar el 0.3% del balance total.
6. NO uses null, strings innecesarios o valores no numéricos.
7. Devuelve solo el JSON. Nada más fuera de él.     
  `,
            });
            console.log(response.text);
            const text = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!text) {
                console.log("⚠️ No se recibió texto válido de Gemini.");
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

                this.operation = orderData

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

                console.log(`✅ Orden ejecutada: ${JSON.stringify(order, null, 2)}.
                Respuesta de Gemini: ${JSON.stringify(response.text)}`);

            } catch (err) {
                console.error("Error al procesar respuesta de Gemini:", err);
            }
        }
    }

    /*@Cron('* * * * *')
    async handleCron() {

        const chat_id = process.env.CHAT_ID!
        let jaja = "BTC/USDT"

        await this.futuresOperation()

    }*/

    async onModuleInit() {
        this.bot.start((ctx) => ctx.reply("Welcome to Bot Trading!."));
        this.bot.command('id', async (ctx) => {
            console.log((ctx.chat.id))
        })

        //esto me dice el dinero que tengo en la cuenta
        this.bot.command("balance", async (ctx) => {
            const balance = await this.exchangeService.getBalance();
            console.log(balance);
            ctx.reply(`Tu balance total es: ${JSON.stringify(balance.total)},
             tu balance para retirar o usar es: ${JSON.stringify(balance.free)}, y tu balance
             bloqueado o en ordenes abiertas es: ${JSON.stringify(balance.used)} `);
        })

        //esta es para revisar las operaciones que tengo abiertas
        this.bot.command("positions", async (ctx) => {
            const positions = await this.exchangeService.getOpenPositionsFutures();
            const futu = await this.exchangeService.getFuturesData("BTC/USDT")
            ctx.reply(`${JSON.stringify(positions)}`)
        })

        //saber si sigue siendo buena la operacion, tambien para automatizar
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

    segun los datos anteriores dime si, estos datos ${JSON.stringify(this.operation)} que son de una operacion 
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

        //abrir cuenta en futuros
        this.bot.command("IaGemini", async (ctx) => {
            const data = await this.exchangeService.getOhlcv("BTC/USDT", "3m", Date.now() - 60 * 60 * 1000, 20);
            const datain = await this.exchangeService.getTicker("BTC/USDT");
            const my = await this.exchangeService.getBalance();
            //const data = await this.paperFuturesService.getOhlcv("BTC/USDT", "1m", Date.now() - 60 * 60 * 1000, 60);
            //const datain = await this.paperFuturesService.getTicker("BTC/USDT");
            //const my = await this.paperFuturesService.getBalance();
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `
         Analiza cuidadosamente la siguiente información:

Balance actual: ${JSON.stringify(my)}
Histórico reciente del mercado: ${JSON.stringify(data)}
Precio actual: ${JSON.stringify(datain)}

Tu tarea es abrir una operación de trading de futuros usando un estilo de
“micro-scalping intradía”, con duración esperada entre 5 y 15 minutos.

Busco operaciones de corta duración, con movimientos pequeños y controlados,
NO swings amplios.
La prioridad es preservar capital, ganar poco pero de forma consistente,
y cerrar la operación rápidamente.

Los niveles de stopLoss y takeProfit deben ser CERCANOS al precio de entrada,
adecuados para movimientos cortos de 5–15 minutos.

Devuélveme UNICAMENTE un objeto JSON VÁLIDO.
No incluyas texto adicional.
No incluyas explicaciones.
No incluyas comentarios.
No incluyas Markdown.
NO agregues comillas fuera del JSON.
NO agregues caracteres antes o después del JSON.
El mensaje debe contener SOLO el objeto JSON EXACTAMENTE con este formato:

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

1. Si "type" es "market", "price" debe ser SIEMPRE el precio actual.
2. "amount" debe ser positivo y NUNCA mayor que (balance disponible / precio actual).
3. Usa un amount pequeño y seguro adecuado para micro-swing intradía.
4. "leverage" entre 1 y 5, preferiblemente valores moderados (2–4).
5. "stopLoss" y "takeProfit" deben reflejar micro-swing intradía:
   - Distancias mayores que scalping pero sin excesos.
   - Relación riesgo/beneficio positiva.
6. NO uses null, strings innecesarios o valores no numéricos.
7. Devuelve solo el JSON. Nada más fuera de él.
8. La pérdida máxima si se ejecuta el stopLoss NO DEBE superar el 0.3% del balance total.
9. El stopLoss debe estar entre 0.1% y 0.25% del precio de entrada.
10. El takeProfit debe estar entre 0.15% y 0.4% del precio de entrada.
11. La duración estimada de la operación NO debe superar 15 minutos.
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

                this.operation = orderData

                const order = await this.exchangeService.placeFuturesOrder(
                    orderData.symbol,
                    orderData.side,
                    orderData.amount,
                    orderData.leverage,
                    orderData.stopLoss,
                    orderData.takeProfit
                );

                {/*const order = await this.paperFuturesService.placeFuturesOrder(
                    orderData.symbol,
                    orderData.side,
                    orderData.amount,
                    orderData.leverage,
                    orderData.price ? orderData.price : undefined,
                    orderData.type,
                    orderData.stopLoss,
                    orderData.takeProfit
                );*/}

                ctx.reply(`✅ Orden ejecutada: ${JSON.stringify(orderData)}.
                Respuesta de Gemini: ${JSON.stringify(response.text)}`);

            } catch (err) {
                console.error("Error al procesar respuesta de Gemini:", err);
                ctx.reply("⚠️ Hubo un error al procesar la respuesta de Gemini.");
            }
        })

        //revisar presio de moneda en especifico
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
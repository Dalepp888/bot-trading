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
        const chat_id = process.env.CHAT_ID!
        const data = {
            higherTF: await this.exchangeService.getOhlcv(
                "BTC/USDT",
                "15m",
                Date.now() - 6 * 60 * 60 * 1000, // 6 horas
                48
            ),
            entryTF: await this.exchangeService.getOhlcv(
                "BTC/USDT",
                "3m",
                Date.now() - 90 * 60 * 1000, // 1.5 horas
                30
            )
        }
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

Tu tarea es decidir si existe una OPORTUNIDAD REAL DE TRADING EN FUTUROS LINEALES.

Debes basar tu decisión ÚNICAMENTE en estas estrategias profesionales:

1) Extensiones de Fibonacci

   -Identifica impulsos claros y correcciones válidas.

   -Usa extensiones (61.8%, 100%, 161.8%) como objetivos de continuación.

   -NO operar si el precio está cerca de una extensión relevante sin confirmación.

2)Estrategia de ruptura (Breakout)

   -Opera SOLO rupturas limpias de soporte o resistencia.

   -Debe existir consolidación previa y ruptura con intención clara.

   -Evita rupturas falsas, mechas largas o falta de continuidad.

3)Detección de cambios de tendencia

   -Analiza estructura de mercado (máximos y mínimos).

   -Detecta agotamiento de tendencia, fallos en continuación o reversión confirmada.

   -NO operar si el mercado está en transición confusa o sin dirección clara.

⚠️ Es OBLIGATORIO NO OPERAR si ocurre cualquiera de estos casos:

    -Precio cerca de techos o pisos recientes relevantes

    -Mercado en rango lateral sin ruptura válida

    -Movimiento fuerte previo con señales claras de agotamiento

    -Falta de confirmación estructural o técnica

    -Riesgo elevado o escenario ambiguo

La preservación de capital es PRIORIDAD ABSOLUTA.
NO fuerces operaciones.
Si no hay ventaja clara, NO OPERES.

Devuélveme ÚNICAMENTE un objeto JSON VÁLIDO.
No incluyas texto adicional.
No incluyas explicaciones.
No incluyas comentarios.
No incluyas Markdown.
No agregues caracteres fuera del JSON.

El formato debe ser EXACTAMENTE este:

{
  "symbol": "BTC/USDT",
  "side": "buy" or "sell" or "none",
  "amount": number,
  "leverage": number,
  "price": number,
  "type": "market",
  "stopLoss": number,
  "takeProfit": number
}

REGLAS OBLIGATORIAS

1)Si decides NO operar:

  -"side" debe ser "none"

  -"amount" = 0

  -"leverage" = 0

  -"price", "stopLoss" y "takeProfit" deben ser el precio actual

  -Incluye una explicación del porqué SOLO si decides no operar, dentro del JSON como texto adicional permitido por el sistema

2)Si "type" es "market", "price" debe ser SIEMPRE el precio actual.

3)"amount" debe ser pequeño, conservador y NUNCA mayor que
(balance disponible / precio actual).

4)"leverage" permitido entre 1 y 4.
Prioriza 2–3.

5)StopLoss y TakeProfit quedan a tu criterio técnico, pero deben ser coherentes con:

  -La estructura del mercado

  -Fibonacci

  -Ruptura o cambio de tendencia

6)La pérdida máxima si se ejecuta el StopLoss NO debe superar el 0.3% del balance total.

7)Si el escenario es dudoso, peligroso o poco claro:

  -DEBES devolver "side": "none".

8)Devuelve SOLO el JSON. Nada más.
  `,
        });
        console.log(response.text);
        const text = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!text) {
            await this.bot.telegram.sendMessage(chat_id, "⚠️ No se recibió texto válido de Gemini.");
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

            if (orderData.amount === 0) {
                await this.bot.telegram.sendMessage(chat_id, `No veo oportunidad clara: ${JSON.stringify(orderData)}`);
                return;
            }

            if (orderData.symbol === 'BTC/USDT') {
                orderData.symbol = 'BTCUSDT';
            }

            this.operation = orderData

            {/*const order = await this.exchangeService.placeFuturesOrder(
                    orderData.symbol,
                    orderData.side,
                    orderData.amount,
                    orderData.leverage,
                    orderData.stopLoss,
                    orderData.takeProfit
                );*/}

            const order = await this.paperFuturesService.placeFuturesOrder(
                orderData.symbol,
                orderData.side,
                orderData.amount,
                orderData.leverage,
                orderData.stopLoss,
                orderData.takeProfit
            );

            await this.bot.telegram.sendMessage(chat_id, `✅ Orden ejecutada: ${JSON.stringify(orderData)}.
                Respuesta de Gemini: ${JSON.stringify(response.text)}`);

        } catch (err: any) {
            if (err.status === 429) {
                console.warn("Limite de cuota excedido", err)
                await this.bot.telegram.sendMessage(
                    chat_id,
                    "⚠️ Límite de peticiones de Gemini alcanzado. Espera antes de hacer otra consulta."
                );
            }
            console.error("Error al procesar respuesta de Gemini:", err);
            await this.bot.telegram.sendMessage(chat_id, "⚠️ Hubo un error al procesar la respuesta de Gemini.");
        }
    }

    @Cron('*/10 * * * *')
    async handleCron() {
        const chat_id = process.env.CHAT_ID!
        let jaja = "BTC/USDT"

        await this.futuresOperation()

    }

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
            const chat_id = process.env.CHAT_ID!
            const data = {
                higherTF: await this.exchangeService.getOhlcv(
                    "BTC/USDT",
                    "15m",
                    Date.now() - 6 * 60 * 60 * 1000, // 6 horas
                    48
                ),
                entryTF: await this.exchangeService.getOhlcv(
                    "BTC/USDT",
                    "3m",
                    Date.now() - 90 * 60 * 1000, // 1.5 horas
                    30
                )
            }
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

Tu tarea es decidir si existe una OPORTUNIDAD REAL DE TRADING EN FUTUROS LINEALES.

Debes basar tu decisión ÚNICAMENTE en estas estrategias profesionales:

1) Extensiones de Fibonacci

   -Identifica impulsos claros y correcciones válidas.

   -Usa extensiones (61.8%, 100%, 161.8%) como objetivos de continuación.

   -NO operar si el precio está cerca de una extensión relevante sin confirmación.

2)Estrategia de ruptura (Breakout)

   -Opera SOLO rupturas limpias de soporte o resistencia.

   -Debe existir consolidación previa y ruptura con intención clara.

   -Evita rupturas falsas, mechas largas o falta de continuidad.

3)Detección de cambios de tendencia

   -Analiza estructura de mercado (máximos y mínimos).

   -Detecta agotamiento de tendencia, fallos en continuación o reversión confirmada.

   -NO operar si el mercado está en transición confusa o sin dirección clara.

⚠️ Es OBLIGATORIO NO OPERAR si ocurre cualquiera de estos casos:

    -Precio cerca de techos o pisos recientes relevantes

    -Mercado en rango lateral sin ruptura válida

    -Movimiento fuerte previo con señales claras de agotamiento

    -Falta de confirmación estructural o técnica

    -Riesgo elevado o escenario ambiguo

La preservación de capital es PRIORIDAD ABSOLUTA.
NO fuerces operaciones.
Si no hay ventaja clara, NO OPERES.

Devuélveme ÚNICAMENTE un objeto JSON VÁLIDO.
No incluyas texto adicional.
No incluyas explicaciones.
No incluyas comentarios.
No incluyas Markdown.
No agregues caracteres fuera del JSON.

El formato debe ser EXACTAMENTE este:

{
  "symbol": "BTC/USDT",
  "side": "buy" or "sell" or "none",
  "amount": number,
  "leverage": number,
  "price": number,
  "type": "market",
  "stopLoss": number,
  "takeProfit": number
}

REGLAS OBLIGATORIAS

1)Si decides NO operar:

  -"side" debe ser "none"

  -"amount" = 0

  -"leverage" = 0

  -"price", "stopLoss" y "takeProfit" deben ser el precio actual

  -Incluye una explicación del porqué SOLO si decides no operar, dentro del JSON como texto adicional permitido por el sistema

2)Si "type" es "market", "price" debe ser SIEMPRE el precio actual.

3)"amount" debe ser pequeño, conservador y NUNCA mayor que
(balance disponible / precio actual).

4)"leverage" permitido entre 1 y 4.
Prioriza 2–3.

5)StopLoss y TakeProfit quedan a tu criterio técnico, pero deben ser coherentes con:

  -La estructura del mercado

  -Fibonacci

  -Ruptura o cambio de tendencia

6)La pérdida máxima si se ejecuta el StopLoss NO debe superar el 0.3% del balance total.

7)Si el escenario es dudoso, peligroso o poco claro:

  -DEBES devolver "side": "none".

8)Devuelve SOLO el JSON. Nada más.
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

                if (orderData.amount === 0) {
                    ctx.reply(`No veo oportunidad clara: ${JSON.stringify(orderData)}`);
                    return;
                }

                if (orderData.symbol === 'BTC/USDT') {
                    orderData.symbol = 'BTCUSDT';
                }

                this.operation = orderData

                {/*const order = await this.exchangeService.placeFuturesOrder(
                    orderData.symbol,
                    orderData.side,
                    orderData.amount,
                    orderData.leverage,
                    orderData.stopLoss,
                    orderData.takeProfit
                );*/}

                const order = await this.paperFuturesService.placeFuturesOrder(
                    orderData.symbol,
                    orderData.side,
                    orderData.amount,
                    orderData.leverage,
                    orderData.stopLoss,
                    orderData.takeProfit
                );

                ctx.reply(`✅ Orden ejecutada: ${JSON.stringify(orderData)}.
                Respuesta de Gemini: ${JSON.stringify(response.text)}`);

            } catch (err: any) {

                if (
                    (err?.status === 429) ||
                    (err?.error?.code === 429) ||
                    (err?.error?.status === "RESOURCE_EXHAUSTED")
                ) {
                    console.warn("⚠️ Límite de cuota Gemini alcanzado");

                    await this.bot.telegram.sendMessage(
                        chat_id,
                        "⚠️ Límite de peticiones de Gemini alcanzado. Espera unos segundos antes de volver a intentarlo."
                    );

                    return
                }
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
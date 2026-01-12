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
        Actúa como un trader profesional de futuros especializado en scalping intradía. 
        Lee exactamente los datos que te doy y decide si existe una OPORTUNIDAD REAL para 
        abrir una operación de futuros lineales que pueda cerrarse en 15 minutos o menos. 
        Si no hay oportunidad real, devuelve la señal de NO OPERAR (side = "none") junto 
        con una explicación solo en ese caso.

Entradas (sustituye estas variables en la llamada API tal como las recibes):

Balance actual: ${JSON.stringify(my)}

Histórico reciente del mercado: ${JSON.stringify(data)}

Precio actual: ${JSON.stringify(datain)}

La operativa es EXCLUSIVAMENTE de tipo SCALPING INTRADÍA con duración máxima 15 minutos.
CONDICIÓN OBLIGATORIA DE TIEMPO:

Cada operación debe ser alcanzable dentro de 15 minutos.

Si estimas que el TakeProfit no puede alcanzarse en ese horizonte, NO OPERAR.

Entradas, SL y TP deben ser coherentes con movimientos de muy corto plazo (1m–5m principalmente).

Debes basar tu decisión ÚNICAMENTE en estas estrategias profesionales (no añadas ni sustituyas 
estrategias):

Extensiones de Fibonacci

-Identifica impulsos claros y correcciones válidas.
-Usa extensiones (61.8%, 100%, 161.8%) como objetivos de continuación.
-Evita operar si el precio está cerca de una extensión relevante a menos
que haya confirmación técnica (retest claro, volumen o momentum que valide la continuación).

Estrategia de ruptura (Breakout)

Opera preferiblemente rupturas limpias de soporte o resistencia.

Debe existir consolidación previa y ruptura con intención clara.

También puedes aceptar rupturas “menores” (breakouts de marcos temporales
inferiores o rompimientos débiles) solo si hay confirmación adicional — por ejemplo:
aumento de volumen, cierre por encima/por debajo del nivel en la vela de confirmación,
o retest exitoso del nivel roto.

Evita rupturas falsas, mechas largas o falta de continuidad si no hay confirmación.

Detección de cambios de tendencia

Analiza estructura de mercado (máximos y mínimos).

Detecta agotamiento de tendencia, fallos en continuación o reversión confirmada.

Puedes anticipar una entrada con confirmación de momentum o indicadores
si la estructura sugiere que la reversión está en curso.

NO operar si el mercado está en transición confusa o sin dirección clara,
salvo confirmación fuerte (estructura + momentum o volumen).

Trading de rango lateral (rebotes en soporte y resistencia)

Identifica rangos laterales claros con soporte y resistencia bien definidos.

Opera rebotes técnicos:

BUY cerca del soporte

SELL cerca de la resistencia

La entrada SOLO es válida si existe confirmación:
vela de rechazo clara, agotamiento del movimiento o señal de reversión.

NO operar en la zona media del rango.

El StopLoss debe colocarse fuera del rango, más allá del soporte o resistencia.

El TakeProfit debe apuntar hacia el extremo opuesto del rango
o a una zona intermedia con relación riesgo/beneficio positiva.

Falsas rupturas (Fake Breakout / Failure)

Identifica intentos de ruptura que fallan:

mechas largas

falta de cierre sólido fuera del nivel

ruptura sin volumen o sin continuidad

Opera en sentido contrario SOLO cuando el precio regresa al rango
y confirma rechazo del nivel roto.

El StopLoss debe ir más allá del extremo de la falsa ruptura.

El TakeProfit debe apuntar al interior del rango o al nivel opuesto.

⚠️ Es OBLIGATORIO NO OPERAR si ocurre cualquiera de estos casos (salvo confirmación técnica clara):

Precio extremadamente cercano a techos o pisos relevantes sin señal de rechazo.

Mercado sin estructura clara de rango (lateral sin niveles definidos).

Movimiento fuerte previo con señales de agotamiento sin confirmación.

Falta de confirmación técnica (volumen, cierre, retest, estructura).

Riesgo elevado o escenario ambiguo.

Salida esperada (obligatoria y única): DEVUÉLVEME SÓLO un objeto JSON VÁLIDO 
exactamente con este formato:

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

Reglas obligatorias y validaciones (el modelo debe aplicar antes de devolver el JSON):

Si decides NO operar:

"side" = "none"

"amount" = 0

"leverage" = 0

"price", "stopLoss" y "takeProfit" deben ser el precio actual (numérico).

Incluye una explicación del porqué SOLO si decides no operar: añade dentro del JSON una clave extra 
"explicacion": "texto" (solo en este caso). Fuera de ese caso no incluyas ninguna clave extra.

Si "type" es "market", "price" debe ser SIEMPRE el precio actual (numérico) que te pasé.

"amount" debe ser positivo, conservador y NUNCA mayor que (balance disponible / precio actual). 
Devuelve número, no strings.

"leverage" permitido: 1 (obligatorio).

StopLoss y TakeProfit deben definirse de forma técnica y adaptada a scalping intradía (≤15 min):

Basados en la estructura en marcos cortos (1m–5m): SL fuera del último máximo/mínimo relevante que 
invalide la idea.

Usa Fibonacci en marcos cortos como referencia; TP puede ubicar la siguiente extensión o nivel 
técnico alcanzable dentro de 15 min.

En rupturas: SL detrás del nivel roto; TP basado en rango y proyección breve.

En rangos: SL fuera del rango; TP hacia el extremo opuesto o zona intermedia con R/R positiva.

SL debe permitir la volatilidad normal del marco (no poner SL dentro del ruido).

TP debe garantizar relación riesgo/beneficio mínima 1:1.5, preferible 1:2, siempre que sea alcanzable en ≤15 min.

Límite de pérdida por operación: la pérdida máxima si se ejecuta el StopLoss NO debe superar 0.75% del balance 
total. Esta regla tiene prioridad:

Calcula el riesgo en USD = (precio entrada − stopLoss) * amount * (si aplica, convertir según par).

Si no puedes cumplir 0.75% por la distancia técnica del SL, reducir amount hasta que cumpla, 
o devolver "side":"none" si no es posible sin un tamaño insignificante.

No amplíes el StopLoss para “dar espacio” si eso rompe el límite de riesgo.

Estimación temporal: antes de proponer la orden, estima si el TP es alcanzable en ≤15 minutos con base en la velocidad del movimiento reciente (ej.: ATR/volatilidad en corto plazo). 
Si no, NO OPERAR.

Devuelve solo números en los campos numéricos, sin null, sin strings innecesarios. 
El JSON debe poder parsearse directamente.

Si decides operar, incluye únicamente el JSON señalado (sin texto adicional). Si decides no operar, incluye el JSON y la clave "explicacion" con el motivo técnico 
(por ejemplo: "mercado lateral sin retest/volumen; techo en X; sin impulso").

Comportamiento de seguridad: prioriza preservar capital; si la señal técnica choca con la regla de riesgo (0.75%), cancela la entrada. 
No propongas órdenes basadas en noticias u otros factores fuera del histórico y precio que te di.
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
            const msg = err.message || '';

            if (msg.includes('not available during funding fee settlement')) {
                console.warn('⚠️ CoinEx settlement activo. Saltando esta ejecución.');
                await this.bot.telegram.sendMessage(chat_id, "⚠️ CoinEx settlement activo. Saltando esta ejecución.");
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
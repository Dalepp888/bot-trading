import { Injectable } from "@nestjs/common";
import { ExchangeService } from "src/exchange/exchange.service";

@Injectable()
export class PaperFuturesService {

    constructor(private readonly exchangeService: ExchangeService) {}

    private balance = { USD: 1000, BTC: 0 };

    async getBalance() {
        return this.balance;
    }

    async getOhlcv(symbol: string, timeframe: string, since: number, limit: number) {
        return await this.exchangeService.getOhlcv(symbol, timeframe, since, limit);
    }

    async getTicker(symbol: string) {
        return await this.exchangeService.getTicker(symbol);
    }

    async placeFuturesOrder(
        symbol: string,
        side: 'buy' | 'sell',
        amount: number,
        leverage: number,
        price?: number,
        type?: 'market' | 'limit', 
        stopLoss?: number, 
        takeProfit?: number
    ) {
        console.log(`Simulación: ${side} ${amount} ${symbol} con apalancamiento ${leverage}`);

        // Simular la ejecución usando el precio actual
        const ticker = await this.getTicker(symbol);
        const executionPrice = price ?? ticker.last ?? 0;

        if (side === 'buy') {
            this.balance.BTC += amount;
            this.balance.USD -= amount * executionPrice / leverage; // ajusta según apalancamiento
        } else {
            this.balance.BTC -= amount;
            this.balance.USD += amount * executionPrice / leverage;
        }

        return {
            status: 'simulated',
            symbol,
            side,
            amount,
            leverage,
            price: executionPrice,
            type: type || 'market', 
            stopLoss, 
            takeProfit
        };
    }
}

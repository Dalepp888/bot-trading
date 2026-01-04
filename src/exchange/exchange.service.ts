import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ccxt from 'ccxt';

@Injectable()
export class ExchangeService {
  private exchange: ccxt.coinex;

  constructor(private configService: ConfigService) {
    this.exchange = new ccxt.coinex({
      apiKey: this.configService.get('COINEX_API_KEY'),
      secret: this.configService.get('COINEX_API_SECRET'),
      options: { defaultType: 'swap' },
    });
  }

  async getTicker(symbol: string) {
    return await this.exchange.fetchTicker(symbol);
  }

  async getFuturesData(symbol: string) {
    const trades = await this.exchange.fetchTrades(symbol, undefined, 1)
    return trades[trades.length - 1]
  }

  async getOhlcv(symbol: string, timeframe: string = '1m', since?: number, limit?: number) {
    return await this.exchange.fetchOHLCV(symbol, timeframe, since, limit);
  }

  async getBalance() {
    return await this.exchange.fetchBalance();
  }

  async placeOrder(symbol: string, type: string, side: string, amount: number, price?: number) {
    return await this.exchange.createOrder(symbol, type, side, amount, price);
  }

  // Abrir posición
  async openPosition(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    leverage: number
  ) {

    await this.exchange.setLeverage(leverage, symbol);

    return await this.exchange.createOrder(
      symbol,
      'market',
      side,
      amount
    );
  }

  async setStopLoss(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    stopLoss: number
  ) {
    const opposite = side === 'buy' ? 'sell' : 'buy';

    return await this.exchange.createOrder(
      symbol,
      'market',
      opposite,
      amount,
      undefined,
      {
        stopLossPrice: stopLoss,
        reduceOnly: true,
      }
    );
  }

  async setTakeProfit(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    takeProfit: number
  ) {
    const opposite = side === 'buy' ? 'sell' : 'buy';

    return await this.exchange.createOrder(
      symbol,
      'market',
      opposite,
      amount,
      undefined,
      {
        takeProfitPrice: takeProfit,
        reduceOnly: true,
      }
    );
  }

  async placeFuturesOrder(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    leverage: number,
    stopLoss?: number,
    takeProfit?: number
  ) {
    // 1️⃣ Abrir posición
    const position = await this.openPosition(symbol, side, amount, leverage);

    // 2️⃣ Esperar a que CoinEx registre la posición
    await new Promise(r => setTimeout(r, 800));

    // 3️⃣ Stop Loss
    if (stopLoss) {
      await this.setStopLoss(symbol, side, amount, stopLoss);
    }

    // 4️⃣ Take Profit
    if (takeProfit) {
      await this.setTakeProfit(symbol, side, amount, takeProfit);
    }

    return position;
  }

  async getOpenPositionsFutures() {
    try {
      const positions = await this.exchange.fetchPositions();
      console.log('Open futures positions:', positions);
      return positions;
    } catch (err) {
      console.error('fetchPositions not supported or error:', err);
      throw err;
    }
  }
}

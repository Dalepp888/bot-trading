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

  async placeFuturesOrder(symbol: string, side: 'buy' | 'sell', amount: number, leverage: number, price?: number, type: 'market' | 'limit' = 'market', stopLoss?: number, takeProfit?: number) {
    await this.exchange.setLeverage(leverage, symbol);
    const order = await this.exchange.createOrder(symbol, type, side, amount, price, {
      'positionSide': side === 'buy' ? 'long' : 'short',
    });

    if (stopLoss) {
      await this.exchange.createOrder(
        symbol,
        'STOP_MARKET',
        side === 'buy' ? 'sell' : 'buy',
        amount,
        stopLoss,
        { positionSide: side === 'buy' ? 'long' : 'short' },
      );
    }

    if (takeProfit) {
      await this.exchange.createOrder(
        symbol,
        'TAKE_PROFIT_MARKET',
        side === 'buy' ? 'sell' : 'buy',
        amount,
        takeProfit,
        { positionSide: side === 'buy' ? 'long' : 'short' },
      );
    }

    return order;
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

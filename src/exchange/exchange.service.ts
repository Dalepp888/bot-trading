// exchange.service.ts
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

  async getOhlcv(symbol: string, timeframe: string = '1m', since?: number, limit?: number) {
    return await this.exchange.fetchOHLCV(symbol, timeframe, since, limit);
  }

  async getBalance() {
    return await this.exchange.fetchBalance();
  }

  async placeOrder(symbol: string, type: string, side: string, amount: number, price?: number) {
    return await this.exchange.createOrder(symbol, type, side, amount, price);
  }

  async placeFuturesOrder(symbol: string, side: 'buy' | 'sell', amount: number, leverage: number, price?: number, type: 'market' | 'limit' = 'market') {
    await this.exchange.setLeverage(leverage, symbol);
    const order = await this.exchange.createOrder(symbol, type, side, amount, price, {
      'positionSide': side === 'buy' ? 'long' : 'short',
    });
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

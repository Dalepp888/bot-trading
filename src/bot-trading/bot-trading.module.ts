import { Module } from '@nestjs/common';
import { BotTradingService } from './bot-trading.service';
import { ExchangeService } from 'src/exchange/exchange.service';
import { PaperFuturesService } from 'src/paper-trading/paper-trading.service';

@Module({
    providers: [
        BotTradingService,
        ExchangeService,
        PaperFuturesService
    ],
})
export class BotTradingModule { }
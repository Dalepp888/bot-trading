import { Module } from '@nestjs/common';
import { BotTradingService } from './bot-trading.service';
import { ExchangeService } from './exchange.service';

@Module({
    providers: [
        BotTradingService,
        ExchangeService
    ],
})
export class BotTradingModule {}
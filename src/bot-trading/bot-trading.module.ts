import { Module } from '@nestjs/common';
import { BotTradingController } from './bot-trading.controller';
import { BotTradingService } from './bot-trading.service';

@Module({
    imports: [BotTradingService],
    controllers: [BotTradingController],
    providers: [],
})
export class BotTradingModule {}
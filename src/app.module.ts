import { Module } from '@nestjs/common';
import { BotTradingModule } from './bot-trading/bot-trading.module';

@Module({
  imports: [],
  controllers: [],
  providers: [BotTradingModule],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { BotTradingModule } from './bot-trading/bot-trading.module';
import { ConfigModule } from '@nestjs/config'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    BotTradingModule
  ]
})
export class AppModule {}

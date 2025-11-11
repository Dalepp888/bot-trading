import { Module } from '@nestjs/common';
import { BotTradingModule } from './bot-trading/bot-trading.module';
import { ConfigModule } from '@nestjs/config'
import { ExchangeModule } from './exchange/exchange.module';
import { PapeterModule } from './paper-trading/paper-trading.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true
    }),
    BotTradingModule,
    ExchangeModule,
    PapeterModule
  ]
})
export class AppModule {}

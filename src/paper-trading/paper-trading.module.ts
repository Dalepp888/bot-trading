import { Module } from "@nestjs/common";
import { PaperFuturesService } from "./paper-trading.service";
import { ExchangeService } from "src/exchange/exchange.service";

@Module({
    providers: [
        PaperFuturesService,
        ExchangeService
    ],
    exports: [PaperFuturesService]
})
export class PapeterModule { }
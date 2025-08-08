import { Test, TestingModule } from '@nestjs/testing';
import { BibleGatewayService } from './bible-gateway.service';

describe('BibleGatewayService', () => {
  let service: BibleGatewayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BibleGatewayService],
    }).compile();

    service = module.get<BibleGatewayService>(BibleGatewayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

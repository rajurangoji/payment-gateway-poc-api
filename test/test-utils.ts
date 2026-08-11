import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';

export async function createTestModule(
  metadata: Parameters<typeof Test.createTestingModule>[0],
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [LoggerModule.forRoot({}), ...(metadata.imports ?? [])],
    controllers: metadata.controllers ?? [],
    providers: metadata.providers ?? [],
  }).compile();
}

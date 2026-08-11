import { TestingModule } from '@nestjs/testing';

import { createTestModule } from '../test/test-utils';

import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await createTestModule({
      controllers: [AppController],
      providers: [AppService],
    });
    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toStrictEqual({
        message: 'Hello World!',
      });
    });
  });
});

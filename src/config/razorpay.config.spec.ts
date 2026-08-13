import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Test, TestingModule } from '@nestjs/testing';
import { TypeConfigModule } from '@snow-tzu/type-config-nestjs';

import { RazorpayConfig } from './razorpay.config';

describe('RazorpayConfig', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'razorpay-config-test-'));
    fs.writeFileSync(
      path.join(tmpDir, 'application.yml'),
      [
        'razorpay:',
        '  keyId: test_key_id',
        '  keySecret: test_key_secret',
      ].join('\n'),
    );
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function buildModule(): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: [
        TypeConfigModule.forRoot({
          profile: 'test',
          configDir: tmpDir,
          isGlobal: true,
        }),
        TypeConfigModule.forFeature([RazorpayConfig]),
      ],
    }).compile();
  }

  it('binds keyId and keySecret from config', async () => {
    const moduleRef = await buildModule();
    const config = moduleRef.get(RazorpayConfig);

    expect(config.keyId).toBe('test_key_id');
    expect(config.keySecret).toBe('test_key_secret');
  });

  it('leaves webhookSecret undefined when not configured', async () => {
    const moduleRef = await buildModule();
    const config = moduleRef.get(RazorpayConfig);

    expect(config.webhookSecret).toBeUndefined();
  });
});

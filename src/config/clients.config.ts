import { registerAs } from '@nestjs/config';

export default registerAs('clients', () => ({
  sample: {
    baseUrl:
      'https://01k6ymddesw4aqq39m5fcyehm300-ae84886dace71b7e4e76.requestinspector.com',
    timeout: 5000,
  },
}));

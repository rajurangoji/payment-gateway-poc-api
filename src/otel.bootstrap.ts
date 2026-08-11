import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';

/* eslint-disable  */
const otelSDK = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
});

otelSDK.start();

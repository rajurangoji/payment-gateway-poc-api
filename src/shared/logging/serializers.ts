import { stdSerializers } from 'pino';

import {
  TENANT_HEADER_BUSINESS_UNIT,
  TENANT_HEADER_COUNTRY_CODE,
  TENANT_PROPERTY_BUSINESS_UNIT,
  TENANT_PROPERTY_COUNTRY_CODE,
} from '@shared';

/* eslint-disable */
export function reqSerializer(req: any) {
  const tenantContext = {
    [TENANT_PROPERTY_BUSINESS_UNIT]: req.headers[TENANT_HEADER_BUSINESS_UNIT],
    [TENANT_PROPERTY_COUNTRY_CODE]: req.headers[TENANT_HEADER_COUNTRY_CODE],
  };
  return {
    id: req.id,
    ...tenantContext,
  };
}

export function resSerializer(res: any) {
  return {
    statusCode: res.statusCode,
    headers: res.getHeaders
      ? res.getHeaders()
      : {
          'content-type': res._headers
            ? res._headers['content-type']
            : undefined,
          'content-length': res._headers
            ? res._headers['content-length']
            : undefined,
        },
  };
}

export function errSerializer(err: any) {
  return stdSerializers.err(err);
}

import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { FastifyReply } from 'fastify';

import {
  TenantContext,
  TenantContextStorage,
  TenantRequest,
  TENANT_HEADER_BUSINESS_UNIT,
  TENANT_HEADER_BUSINESS_UNIT_ALT,
  TENANT_HEADER_COUNTRY_CODE,
  TENANT_HEADER_COUNTRY_CODE_ALT,
} from '@shared';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  use(req: TenantRequest, res: FastifyReply, next: () => void): void {
    const businessUnit =
      req.headers[TENANT_HEADER_BUSINESS_UNIT] ??
      req.headers[TENANT_HEADER_BUSINESS_UNIT_ALT];
    const countryCode =
      req.headers[TENANT_HEADER_COUNTRY_CODE] ??
      req.headers[TENANT_HEADER_COUNTRY_CODE_ALT];

    this.logger.debug('Setting tenant context', {
      businessUnit,
      countryCode,
      allHeaders: Object.keys(req.headers),
      url: req.url,
    });

    if (businessUnit && countryCode) {
      const tenantContext = {
        businessUnit,
        countryCode,
      } as TenantContext;
      req.tenantContext = tenantContext;

      this.logger.debug('Tenant context set successfully');
      // Run the rest of the middleware chain within tenant context
      // AsyncLocalStorage maintains context for all async operations initiated here
      TenantContextStorage.run(tenantContext, next);
    } else {
      this.logger.warn('Missing required tenant headers', {
        businessUnit,
        countryCode,
        availableHeaders: Object.keys(req.headers),
      });
      next();
    }
  }
}

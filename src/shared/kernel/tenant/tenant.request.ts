import { FastifyRequest } from 'fastify';

import { TenantContext } from './tenant-context';

export interface TenantRequest extends FastifyRequest {
  tenantContext?: TenantContext;
}

import {
  MessageAttributes,
  MessageEnricher,
  PublishContext,
} from '@snow-tzu/aws-message-publisher';

import { TenantContextStorage } from '../kernel/tenant/tenant-context.storage';
import {
  TENANT_HEADER_BUSINESS_UNIT,
  TENANT_HEADER_COUNTRY_CODE,
} from '../kernel/tenant/tenant.constants';

export class TenantEnricher implements MessageEnricher {
  async enrich(
    _message: never,
    _context: PublishContext,
  ): Promise<MessageAttributes> {
    const tenantContextStorage = TenantContextStorage.get();
    if (!tenantContextStorage) {
      return {};
    }
    const { businessUnit, countryCode } = tenantContextStorage;
    return {
      [TENANT_HEADER_BUSINESS_UNIT]: {
        dataType: 'String',
        value: businessUnit,
      },
      [TENANT_HEADER_COUNTRY_CODE]: {
        dataType: 'String',
        value: countryCode,
      },
    };
  }

  getPriority(): number {
    return 0;
  }
}

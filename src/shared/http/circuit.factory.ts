import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { AxiosResponse } from '@nestjs/terminus/dist/health-indicator/http/axios.interfaces';
import * as CircuitBreaker from 'opossum';
import { firstValueFrom } from 'rxjs';

import { ICircuitHttpClient } from './circuit.http';

function formatCircuitStats(status: CircuitBreaker.Status): string {
  const { failures, rejects, fires } = status.stats;
  const failureRate =
    fires > 0 ? ((failures / fires) * 100).toFixed(2) : '0.00';
  return `Total: ${fires}, Fails: ${failures}, Rejects: ${rejects}, Rate: ${failureRate}%`;
}

function registerCircuitListeners(
  circuit: CircuitBreaker<unknown[], unknown>,
  logger: Logger,
  breakerOptions: CircuitBreaker.Options,
): void {
  circuit.on('open', () => {
    logger.error(
      `CIRCUIT OPENED! Failure threshold reached. Blocking requests for ${breakerOptions.resetTimeout}ms.`,
    );
  });

  circuit.on('halfOpen', () => {
    logger.warn(
      `CIRCUIT HALF-OPEN. Circuit state: ${formatCircuitStats(circuit.status)}.`,
    );
  });

  circuit.on('close', () => {
    logger.log(
      'CIRCUIT CLOSED. Downstream service recovered. Resuming normal operations.',
    );
  });

  circuit.on('fallback', (error: unknown) => {
    logger.log(
      `REQUEST REJECTED (Fallback). Circuit state: ${formatCircuitStats(circuit.status)}. Error: ${error instanceof Error ? error.stack : error}`,
    );
  });

  circuit.on('failure', (error: unknown, latency: number) => {
    logger.warn(
      `Request FAILURE. Latency: ${latency}ms. State: ${formatCircuitStats(circuit.status)}. Error: ${error instanceof Error ? error.stack : error}`,
    );
  });
}

export const createCircuitBreakerClient = (
  httpService: HttpService,
  breakerOptions: CircuitBreaker.Options,
  logger: Logger,
): ICircuitHttpClient => {
  const protectedRequest = async <T = unknown>(
    method: 'get' | 'post',
    url: string,
    data?: unknown,
  ): Promise<AxiosResponse<T>> => {
    logger.debug(
      `Circuit breaker: Making ${method.toUpperCase()} request to ${url}`,
    );
    if (method === 'get') {
      return firstValueFrom(httpService.get<T>(url));
    } else if (method === 'post') {
      return firstValueFrom(httpService.post<T>(url, data));
    }
    throw new Error(`Unsupported HTTP method: ${method}`);
  };

  const circuit = new CircuitBreaker(protectedRequest, breakerOptions);
  registerCircuitListeners(circuit, logger, breakerOptions);

  return {
    async get<T>(url: string, config?: unknown): Promise<T> {
      try {
        const response = (await circuit.fire(
          'get',
          url,
          undefined,
          config,
        )) as AxiosResponse<T>;
        return response.data;
      } catch (error) {
        logger.error(
          `Http GET request to ${url} failed: ${error instanceof Error ? error.stack : error}`,
        );
        throw error;
      }
    },

    async post<T, R>(url: string, data?: R): Promise<T> {
      try {
        const response = (await circuit.fire(
          'post',
          url,
          data,
        )) as AxiosResponse<T>;
        return response.data;
      } catch (error) {
        logger.error(
          `Http POST request to ${url} failed: ${error instanceof Error ? error.stack : error}`,
        );
        throw error;
      }
    },

    // Future: add put/delete methods here
  };
};

/**
 * Copyright 2024 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CallOptions, ClientReadableStream, ClientUnaryCall, Metadata } from '@grpc/grpc-js';
import { UnaryCallback } from '@grpc/grpc-js/build/src/client';

export function wrapGrpcCall<TRequest, TResponse>(
  fn: (
    request: TRequest,
    metadata: Metadata,
    options: CallOptions,
    callback: UnaryCallback<TResponse>
  ) => ClientUnaryCall
) {
  return (
    request: TRequest,
    metadata: Metadata,
    { signal, ...options }: CallOptions & { signal?: AbortSignal } = {}
  ): Promise<TResponse> => {
    return new Promise<TResponse>((resolve, reject) => {
      const call = fn(request, metadata, options, (err, response) => {
        signal?.removeEventListener('abort', abortHandler);
        if (err) {
          reject(err);
        } else {
          if (response === undefined) {
            reject(new Error('Invalid response from GRPC server'));
          } else {
            resolve(response);
          }
        }
      });
      const abortHandler = () => {
        call.cancel();
      };
      signal?.addEventListener('abort', abortHandler, { once: true });
    });
  };
}

export function wrapGrpcStream<TRequest, TResponse>(
  fn: (
    request: TRequest,
    metadata: Metadata,
    options: CallOptions
  ) => ClientReadableStream<TResponse>
) {
  return async (
    request: TRequest,
    metadata: Metadata,
    { signal, ...options }: CallOptions & { signal?: AbortSignal } = {}
  ): Promise<ClientReadableStream<TResponse>> => {
    const stream = fn(request, metadata, options);
    const abortHandler = () => {
      stream.cancel();
    };
    signal?.addEventListener('abort', abortHandler, { once: true });
    stream.addListener('close', () => signal?.removeEventListener('abort', abortHandler));
    return stream;
  };
}

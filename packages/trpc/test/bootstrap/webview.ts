import { createTRPCProxyClient } from '@trpc/client';
import { type AppRouter } from './router';
import { ipcLink } from '../../client';

declare global {
  interface Window {
    __TRPC_TEST_CONFIG__: {
      path: string;
      input?: any;
    };
  }
}

const client = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
});

async function main() {
  const config = window.__TRPC_TEST_CONFIG__;
  const { path, input } = config;

  switch (path) {
    case 'hello':
      client.hello.query();
      break;
    case 'input1': {
      client.input1.query(input);
      break;
    }
    case 'r1.r2': {
      client.r1.r2.query();
      break;
    }
    case 'cmp1': {
      const result = await client.cmp1.query();
      client.getResult.query({ path: path, value: result });
      break;
    }
    case 'cmp2.cmp1': {
      const result = await client.cmp2.cmp1.query();
      client.getResult.query({ path: path, value: result });
      break;
    }
    case 'cmp3': {
      const result = await client.cmp3.query();
      client.getResult.query({ path: path, value: result });
      break;
    }
    case 'cmp4.cmp3': {
      const result = await client.cmp4.cmp3.query();
      client.getResult.query({ path: path, value: result });
      break;
    }
    case 'clientCmp': {
      await client.clientCmp.query(input, {
        context: { compress: true },
      });
      break;
    }
    case 'clientCmpUint8': {
      await client.clientCmpUint8.query(new Uint8Array([1, 2, 3, 4]), {
        context: { compress: true },
      });
      break;
    }
    default:
      break;
  }
}

main();

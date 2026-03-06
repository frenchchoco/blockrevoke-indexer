import { networks, type Network } from '@btc-vision/bitcoin';
import type { NetworkId } from '../shared/types.js';
import { env } from './env.js';

export interface NetworkConfig {
    readonly id: NetworkId;
    readonly name: string;
    readonly rpcUrl: string;
    readonly network: Network;
    readonly startBlock: number;
}

export const NETWORK_CONFIGS: Record<NetworkId, NetworkConfig> = {
    testnet: {
        id: 'testnet',
        name: 'Testnet',
        rpcUrl: env.testnetRpcUrl,
        network: networks.opnetTestnet,
        startBlock: 0,
    },
    mainnet: {
        id: 'mainnet',
        name: 'Mainnet',
        rpcUrl: env.mainnetRpcUrl,
        network: networks.bitcoin,
        startBlock: 0, // Will be set on March 17 launch
    },
};

import os from 'node:os';

const VIRTUAL_ADAPTER = /(loopback|virtual|vethernet|hyper-v|vmware|virtualbox|vbox|wsl|docker|tailscale|zerotier|bluetooth|npcap|tun|tap)/i;
const PHYSICAL_ADAPTER = /(wi-?fi|wlan|wireless|ethernet|eth|en\d)/i;

function isPrivateIPv4(address) {
  const [a, b] = address.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function getLanAddresses() {
  const candidates = [];

  for (const [name, interfaces] of Object.entries(os.networkInterfaces())) {
    for (const network of interfaces || []) {
      if (network.family !== 'IPv4' || network.internal) continue;
      if (!isPrivateIPv4(network.address)) continue;

      candidates.push({
        address: network.address,
        interface: name,
        score:
          (PHYSICAL_ADAPTER.test(name) ? 2 : 0) -
          (VIRTUAL_ADAPTER.test(name) ? 10 : 0),
      });
    }
  }

  return candidates
    .sort((left, right) => right.score - left.score || left.address.localeCompare(right.address))
    .map(({ address, interface: interfaceName }) => ({ address, interface: interfaceName }));
}

export function isLoopbackAddress(address = '') {
  return address === '::1' || address === '::ffff:127.0.0.1' || address.startsWith('127.');
}

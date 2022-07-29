// @ts-ignore
module.exports = {
  environments: {
    'development-nodewallet': {
      nodeUrl: 'http://127.0.0.1:22973',
      signerProvider: {
        walletName: 'alephium-web3-test-only-wallet',
        password: 'alph'
      }
    },
    'development-walletconnect': {
      nodeUrl: 'http://127.0.0.1:22973',
      signerProvider: {
        projectId: '6e2562e43678dd68a9070a62b6d52207',
        relayUrl: 'wss://relay.walletconnect.com',
        metadata: {
          name: 'ANS',
          description: 'Alephium Name Service',
          url: 'https://walletconnect.com/',
          icons: ['https://walletconnect.com/walletconnect-logo.png']
        },
        networkId: 4,
        chainGroup: -1
      }
    }
  }
}
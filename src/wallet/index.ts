import * as bitcoinMessage from 'bitcoinjs-message'
import * as bitcoin from 'bitcoinjs-lib'
import * as bip39 from 'bip39'
import * as ecc from 'tiny-secp256k1'
import BIP32Factory, { BIP32Interface } from 'bip32'
import ECPairFactory, { ECPairInterface } from 'ecpair'
import { ethers } from 'ethers'
import 'dotenv/config'

const MNEMONIC = process.env.MNEMONIC!

bitcoin.initEccLib(ecc)
const bip32 = BIP32Factory(ecc)
const ECPair = ECPairFactory(ecc)

export const SIGNET_NETWORK = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: { public: 0x045f1cf6, private: 0x045f18bc },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef
}

export interface ITaprootWallet {
  address: string
  path: string
  childNode: BIP32Interface
  payment: bitcoin.Payment
  internalPubkey: Buffer
  tweakedChildNode: bitcoin.Signer
}

export interface ISegWitWallet {
  address: string
  keyPair: ECPairInterface
}

/**
 * 钱包管理类
 *
 * 目前实现了 Evm 和 Taproot Signet 的签名和交易
 */
export class WalletManager {
  pathIndex: number

  evmWallet: ethers.Wallet
  taprootWallet: ITaprootWallet

  constructor(pathIndex: number) {
    this.pathIndex = pathIndex

    this.evmWallet = this.getEvmWallet()
    this.taprootWallet = this.getTaprootWallet()
  }

  private getEvmWallet(): ethers.Wallet {
    const seed = bip39.mnemonicToSeedSync(MNEMONIC)
    const path = `m/44'/60'/0'/0/${this.pathIndex}`

    const hdNode = ethers.HDNodeWallet.fromSeed(seed)
    const wallet = hdNode.derivePath(path)

    return new ethers.Wallet(wallet.privateKey)
  }

  private getTaprootWallet(): ITaprootWallet {
    const seed = bip39.mnemonicToSeedSync(MNEMONIC)
    const rootKey = bip32.fromSeed(seed, SIGNET_NETWORK)

    const path = `m/86'/1'/0'/0/${this.pathIndex}`
    const childNode = rootKey.derivePath(path)
    const internalPubkey = childNode.publicKey.subarray(1, 33)

    const payment = bitcoin.payments.p2tr({
      internalPubkey,
      network: SIGNET_NETWORK
    })

    const tweakedChildNode = childNode.tweak(bitcoin.crypto.taggedHash('TapTweak', internalPubkey))

    return {
      address: payment.address!,
      path,
      payment,
      childNode,
      internalPubkey,
      tweakedChildNode
    }
  }

  async signEvmMessage(message: string | Uint8Array): Promise<string> {
    const ethersWallet = new ethers.Wallet(this.evmWallet.privateKey)

    return await ethersWallet.signMessage(message)
  }

  async signTaprootMessage(message: string): Promise<string> {
    const keyPair = ECPair.fromWIF(this.taprootWallet.childNode.toWIF(), SIGNET_NETWORK)

    const signature = bitcoinMessage.sign(message, keyPair.privateKey as Buffer, keyPair.compressed)

    return Buffer.from(signature).toString('base64')
  }
}

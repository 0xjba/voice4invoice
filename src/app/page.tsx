'use client';

import React, { useState, useEffect } from 'react';
import { SignProtocolClient, SpMode, EvmChains, AttestationResult } from "@ethsign/sp-sdk";
import AttestationVerification from '../components/AttestationVerification';
import { ethers } from 'ethers';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import Link from 'next/link';

(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

const useTelegramWebApp = () => {
  const [webApp, setWebApp] = useState<any>(null);

  useEffect(() => {
    const tw = (window as any).Telegram?.WebApp;
    if (tw) {
      tw.ready();
      setWebApp(tw);
    }
  }, []);

  return webApp;
};

type CreateAttestationSuccess = {
  attestation: AttestationResult & {
    fullAttestationId: string;
    businessName: string;
    transactionHash: string;
    invoiceDate: bigint;
    customer: string;
    productName: string;
    category: string;
    quantity: bigint;
    amount: bigint;
    network: string;
  };
};

type CreateAttestationError = {
  error: string;
};

type CreateAttestationResult = CreateAttestationSuccess | CreateAttestationError;

type FormData = {
  businessName: string;
  transactionHash: string;
  invoiceDate: string;
  productName: string;
  category: string;
  quantity: string;
  network: string;
};

function isAttestationSuccess(result: CreateAttestationResult): result is CreateAttestationSuccess {
  return 'attestation' in result;
}

const networks = {
  sepolia: {
    chainId: '0xaa36a7',
    chainName: 'Sepolia',
    rpcUrls: ['https://rpc.sepolia.org'],
  },
};

export default function Home() {
  const webApp = useTelegramWebApp();
  const [result, setResult] = useState<CreateAttestationResult | null>(null);
  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    transactionHash: '',
    invoiceDate: '',
    productName: '',
    category: '',
    quantity: '',
    network: '',
  });
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState<{amount: string; customer: string} | null>(null);
  const [hasEthereum, setHasEthereum] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (webApp) {
      webApp.setHeaderColor(webApp.themeParams.bg_color);
      webApp.MainButton.setText('Generate Invoice');
      webApp.MainButton.onClick(createAttestation);
      webApp.MainButton.show();
    }

    return () => {
      if (webApp) {
        webApp.MainButton.offClick(createAttestation);
      }
    };
  }, [webApp, formData, isCorrectNetwork, transactionDetails]);

  useEffect(() => {
    setHasEthereum(typeof window.ethereum !== 'undefined');
    if (typeof window.ethereum !== 'undefined') {
      checkNetwork();
    }
  }, [formData.network]);

  const checkNetwork = async () => {
    if (window.ethereum && formData.network) {
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        setIsCorrectNetwork(chainId === networks[formData.network as keyof typeof networks].chainId);
      } catch (error) {
        console.error('Failed to get chain ID:', error);
      }
    }
  };

  const switchNetwork = async () => {
    if (window.ethereum && formData.network) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: networks[formData.network as keyof typeof networks].chainId }],
        });
      } catch (error: any) {
        if (error.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [networks[formData.network as keyof typeof networks]],
            });
          } catch (addError) {
            console.error('Failed to add Ethereum chain:', addError);
          }
        } else {
          console.error('Failed to switch network:', error);
        }
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const fetchTransactionDetails = async () => {
    if (formData.transactionHash && formData.network) {
      setIsLoading(true);
      const provider = new ethers.providers.JsonRpcProvider(networks[formData.network as keyof typeof networks].rpcUrls[0]);
      try {
        const tx = await provider.getTransaction(formData.transactionHash);
        if (tx) {
          setTransactionDetails({
            amount: ethers.utils.formatEther(tx.value),
            customer: tx.from,
          });
        }
      } catch (error) {
        console.error('Error fetching transaction details:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const createAttestation = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setIsLoading(true);
  
    if (!isCorrectNetwork) {
      alert('Please switch to the correct network before creating attestation');
      setIsLoading(false);
      return;
    }
  
    if (!transactionDetails) {
      alert('Please fetch transaction details before creating attestation');
      setIsLoading(false);
      return;
    }
  
    try {
      const client = new SignProtocolClient(SpMode.OnChain, {
        chain: EvmChains.sepolia,
      });
  
      const schemaId = "0x268";
  
      const paddedHash = ethers.utils.hexZeroPad(formData.transactionHash, 32);
  
      const attestationData = {
        businessName: String(formData.businessName),
        transactionHash: paddedHash,
        invoiceDate: BigInt(Math.floor(new Date(formData.invoiceDate).getTime() / 1000)),
        customer: transactionDetails.customer,
        productName: String(formData.productName),
        category: String(formData.category),
        quantity: BigInt(formData.quantity),
        amount: BigInt(ethers.utils.parseEther(transactionDetails.amount).toString()),
        network: String(formData.network)
      };
      
      const attestation = await client.createAttestation({
        schemaId: schemaId,
        indexingValue: "0x" + Date.now().toString(16),
        data: attestationData
      });
      
      const fullAttestationId = `onchain_evm_11155111_${attestation.attestationId}`;
      
      setResult({ 
        attestation: { 
          ...attestation, 
          fullAttestationId,
          ...attestationData
        } 
      });
    } catch (error) {
      console.error('Error creating attestation:', error);
      setResult({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const generatePdfInvoice = async () => {
    if (result && isAttestationSuccess(result)) {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
      const { width, height } = page.getSize();
      const fontSize = 10;
      const lineHeight = 20;
      let currentY = height - 50;
  
      const drawText = (text: string, x: number, y: number, options?: { font?: typeof font, size?: number, color?: [number, number, number] }) => {
        page.drawText(text, {
          x,
          y,
          size: options?.size || fontSize,
          font: options?.font || font,
          color: options?.color ? rgb(options.color[0], options.color[1], options.color[2]) : undefined
        });
      };
  
      // Title
      drawText('Sales Invoice', 50, currentY, { font: boldFont, size: 24 });
      currentY -= lineHeight * 2;
  
      const { attestation } = result;
  
      // Invoice details
      const details = [
        { label: 'Business Name', value: attestation.businessName },
        { label: 'Invoice Date', value: new Date(Number(attestation.invoiceDate) * 1000).toLocaleDateString() },
        { label: 'Customer Address', value: attestation.customer },
        { label: 'Product Name', value: attestation.productName },
        { label: 'Category', value: attestation.category },
        { label: 'Quantity', value: attestation.quantity.toString() },
        { label: 'Amount', value: `${ethers.utils.formatEther(attestation.amount)} ETH` },
        { label: 'Transaction Hash', value: attestation.transactionHash },
        { label: 'Network', value: attestation.network },
        { label: 'Attestation ID', value: attestation.attestationId },
        { label: 'Full Attestation ID', value: attestation.fullAttestationId },
      ];

      details.forEach(({ label, value }) => {
        drawText(`${label}:`, 50, currentY, { font: boldFont });
        drawText(value, 200, currentY, { size: label === 'Transaction Hash' || label === 'Full Attestation ID' ? 8 : 10 });
        currentY -= lineHeight;
      });
  
      const jsonData = JSON.stringify({
        ...attestation,
        timestamp: new Date().toISOString()
      }, (key, value) => typeof value === 'bigint' ? value.toString() : value);
      
      pdfDoc.setSubject(jsonData);
  
      pdfDoc.setTitle('Purchase Invoice');
      pdfDoc.setAuthor('Voice4Invoice');
      pdfDoc.setKeywords(['attestation', 'blockchain', 'transaction', 'invoice']);
      pdfDoc.setProducer('PDF/A-3 Generator');
      pdfDoc.setCreator('Voice4Invoice');
  
      return await pdfDoc.save();
    }
    return null;
  };

  const downloadPdfInvoice = async () => {
    const pdfBytes = await generatePdfInvoice();
    if (pdfBytes && result && isAttestationSuccess(result)) {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `invoice_${result.attestation.attestationId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center text-indigo-900 mb-8">Generate Attested Invoices</h1>
        <div className="bg-white shadow-2xl rounded-lg overflow-hidden">
          <form onSubmit={createAttestation} className="space-y-6 p-8">
            <div>
              <label htmlFor="network" className="block text-sm font-medium text-gray-700 mb-1">Network:</label>
              <select
                id="network"
                name="network"
                value={formData.network}
                onChange={handleInputChange}
                required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
              >
                <option value="">Select Network</option>
                <option value="sepolia">Sepolia</option>
              </select>
            </div>
            {formData.network && !isCorrectNetwork && (
              <button 
                type="button"
                onClick={switchNetwork}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded transition duration-300 ease-in-out transform hover:scale-105"
              >
                Switch to {formData.network}
              </button>
            )}
            {isCorrectNetwork && (
              <>
              <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">Business Name:</label>
                  <input
                    type="text"
                    id="businessName"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleInputChange}
                    required
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
                  />
                </div>
              <div>
                <label htmlFor="transactionHash" className="block text-sm font-medium text-gray-700 mb-1">Transaction Hash:</label>
                <input
                  type="text"
                  id="transactionHash"
                  name="transactionHash"
                  value={formData.transactionHash}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50"
                >
                  {isLoading ? 'Generating Invoice...' : 'Generate Invoice'}
                </button>
              </>
            )}
          </form>
        </div>
        {result && isAttestationSuccess(result) && (
          <div className="mt-8 bg-green-100 text-green-800 rounded-lg shadow-lg p-6 animate-fade-in">
            <h2 className="text-2xl font-bold mb-4">Attestation Created Successfully!</h2>
            <p className="text-lg mb-4">Full Attestation ID: <strong>{result.attestation.fullAttestationId}</strong></p>
            <button 
              onClick={downloadPdfInvoice}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded transition duration-300 ease-in-out transform hover:scale-105"
            >
              Download PDF/A-3 Invoice
            </button>
          </div>
        )}
        {result && !isAttestationSuccess(result) && (
          <div className="mt-8 bg-red-100 text-red-800 rounded-lg shadow-lg p-6 animate-fade-in">
            <h2 className="text-2xl font-bold mb-4">Error Creating Attestation</h2>
            <p>{result.error}</p>
          </div>
        )}
        <div className="mt-8 text-center">
          <Link href="./verify" className="text-indigo-600 hover:text-indigo-800 font-semibold text-lg transition duration-300">
            Verify Your Invoice
          </Link>
        </div>
      </div>
    </main>
  );
}
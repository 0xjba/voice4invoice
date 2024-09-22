'use client'

import React, { useState } from 'react';
import { IndexService } from '@ethsign/sp-sdk';
import { PDFDocument } from 'pdf-lib';

const indexService = new IndexService('testnet');

async function verifyAttestation(fullAttestationId: string) {
  console.log('Verifying attestation with ID:', fullAttestationId);
  try {
    const result = await indexService.queryAttestation(fullAttestationId);
    console.log('Attestation query result:', result);
    return result;
  } catch (error) {
    console.error('Error verifying attestation:', error);
    throw error;
  }
}

export default function AttestationVerification() {
  const [file, setFile] = useState<File | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const extractJsonFromPdf = async (file: File): Promise<any> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    const jsonData = pdfDoc.getSubject();
  
    if (!jsonData) {
      throw new Error('No JSON data found in the PDF metadata');
    }
  
    try {
      return JSON.parse(jsonData);
    } catch (error) {
      throw new Error('Failed to parse JSON data from PDF metadata');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setVerificationResult({ success: false, message: 'Please upload a PDF file' });
      return;
    }

    setLoading(true);
    setVerificationResult(null);

    try {
      const jsonData = await extractJsonFromPdf(file);
      
      if (!jsonData.fullAttestationId) {
        throw new Error('Invalid PDF file: missing fullAttestationId in embedded JSON');
      }

      await verifyAttestation(jsonData.fullAttestationId);
      setVerificationResult({ 
        success: true, 
        message: `Attestation with ID ${jsonData.fullAttestationId} verified successfully` 
      });
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'An unknown error occurred during verification.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-12 bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Verify Your Invoice</h2>
      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label htmlFor="pdfFile" className="block mb-2 text-sm font-medium text-gray-700">
            Upload Your Invoice:
          </label>
          <input
            type="file"
            id="pdfFile"
            accept=".pdf"
            onChange={handleFileChange}
            required
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button 
          type="submit"
          className={`w-full py-2 px-4 rounded-md font-semibold text-white transition-colors duration-300 ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          }`}
          disabled={loading}
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
      {verificationResult && (
        <div className={`mt-6 p-4 rounded-md ${
          verificationResult.success 
            ? 'bg-green-100 text-green-700 border border-green-400' 
            : 'bg-red-100 text-red-700 border border-red-400'
        }`}>
          <p className="font-semibold">{verificationResult.message}</p>
        </div>
      )}
    </div>
  );
}
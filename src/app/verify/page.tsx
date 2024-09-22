// pages/verify.js
import React from 'react';
import AttestationVerification from '../../components/AttestationVerification';
import Link from 'next/link';

export default function Verify() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-green-100 to-teal-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center text-teal-900 mb-8">Verify Your Invoice</h1>
        <div className="bg-white shadow-2xl rounded-lg overflow-hidden p-8">
          <AttestationVerification />
        </div>
        <div className="mt-8 text-center">
          <Link href="/" className="text-teal-600 hover:text-teal-800 font-semibold text-lg transition duration-300">
            Back to Attestation
          </Link>
        </div>
      </div>
    </main>
  );
}
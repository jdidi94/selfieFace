'use client';

import { ProductForm } from '@/components/product-form';
import { use } from 'react';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProductForm productId={id} />;
}

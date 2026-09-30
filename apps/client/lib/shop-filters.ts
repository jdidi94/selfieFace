export type ShopFilterValues = {
  q: string;
  category: string;
  problemCategory: string;
  brand: string;
  /** PRODUCT | PACK — empty = all */
  kind: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  recommended: boolean;
  incoming: boolean;
  promotion: boolean;
  sort: '' | 'price' | 'name';
  order: 'asc' | 'desc';
};

/** Build GET query params for shop listing; preserves filters when paginating. */
export function shopFilterQuery(values: ShopFilterValues, page?: number) {
  const params = new URLSearchParams();
  if (values.q) params.set('q', values.q);
  if (values.category) params.set('category', values.category);
  if (values.problemCategory) params.set('problemCategory', values.problemCategory);
  if (values.brand) params.set('brand', values.brand);
  if (values.kind === 'PRODUCT' || values.kind === 'PACK') params.set('kind', values.kind);
  if (values.minPrice) params.set('minPrice', values.minPrice);
  if (values.maxPrice) params.set('maxPrice', values.maxPrice);
  if (values.minRating) params.set('minRating', values.minRating);
  if (values.recommended) params.set('recommended', '1');
  if (values.incoming) params.set('incoming', '1');
  if (values.promotion) params.set('promotion', '1');
  if (values.sort) params.set('sort', values.sort);
  if (values.order && values.order !== 'asc') params.set('order', values.order);
  if (page && page > 1) params.set('page', String(page));
  return params;
}

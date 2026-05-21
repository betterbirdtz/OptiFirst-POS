import React, { useMemo } from "react";
import { Search } from "lucide-react";
import type { Product } from "../../types";

interface ProductSearchSelectProps {
  products: Product[];
  selectedProductId: string;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onProductChange: (productId: string) => void;
}

export const ProductSearchSelect: React.FC<ProductSearchSelectProps> = ({
  products,
  selectedProductId,
  searchTerm,
  onSearchTermChange,
  onProductChange
}) => {
  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => {
      const haystack = `${product.ProductName} ${product.Category} ${product.UOM}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [products, searchTerm]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold text-foreground/80">Product</label>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Search product by name"
          className="w-full rounded-xl border border-input bg-background py-3 pl-9 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-ring sm:py-2.5 sm:text-sm"
        />
      </div>
      <select
        value={selectedProductId}
        onChange={(event) => onProductChange(event.target.value)}
        className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-ring sm:py-2.5 sm:text-sm"
      >
        {filteredProducts.length === 0 ? (
          <option value="">No matching products</option>
        ) : (
          filteredProducts.map((product) => (
            <option key={product.ProductID} value={product.ProductID}>
              {product.ProductName} ({product.UOM})
            </option>
          ))
        )}
      </select>
    </div>
  );
};

export default ProductSearchSelect;

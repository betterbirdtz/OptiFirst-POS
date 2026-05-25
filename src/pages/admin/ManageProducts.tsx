import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Plus, Edit, Package, Layers, Tag, Percent, RefreshCw, AlertCircle, Store } from "lucide-react";
import { appsScriptClient } from "../../api/appsScriptClient";
import type { Product, Shop, UserSession } from "../../types";
import { formatCurrency } from "../../utils/calculations";
import Modal from "../../components/common/Modal";
import { getSessionUser } from "../../utils/session";

export const ManageProducts: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  // Modal Control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [uom, setUom] = useState("");
  const [defaultRate, setDefaultRate] = useState<number | "">("");
  const [active, setActive] = useState<"Yes" | "No">("Yes");

  const [user] = useState<UserSession | null>(() => getSessionUser());
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopPrices, setShopPrices] = useState<Array<{ shopId: string; productId: string; rate: number }>>([]);
  const [pricingProductId, setPricingProductId] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await appsScriptClient.getProducts();
      if (response.success && response.products) {
        setProducts(response.products);
      } else {
        setError("Failed to fetch product catalog.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error loading product catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "Admin") {
      navigate("/login");
      return;
    }
    loadProducts();
    loadShopsAndPrices();
  }, [user, navigate]);

  const loadShopsAndPrices = async () => {
    try {
      const res = await appsScriptClient.getShops();
      if (res.success && res.shops) setShops(res.shops.filter((s) => s.Status === "Active"));
      const raw = localStorage.getItem("opti_shop_prices");
      if (raw) setShopPrices(JSON.parse(raw));
    } catch { /* */ }
  };

  const getShopRate = (shopId: string, productId: string) => {
    return shopPrices.find((p) => p.shopId === shopId && p.productId === productId)?.rate;
  };

  const updateShopRate = (shopId: string, productId: string, rate: number) => {
    setShopPrices((current) => {
      const idx = current.findIndex((p) => p.shopId === shopId && p.productId === productId);
      const next = [...current];
      if (idx >= 0) next[idx] = { shopId, productId, rate };
      else next.push({ shopId, productId, rate });
      localStorage.setItem("opti_shop_prices", JSON.stringify(next));
      return next;
    });
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setProductName("");
    setCategory("General");
    setUom("KG");
    setDefaultRate("");
    setActive("Yes");
    setIsModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setProductName(prod.ProductName);
    setCategory(prod.Category);
    setUom(prod.UOM);
    setDefaultRate(prod.DefaultRate);
    setActive(prod.Active);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitLoading(true);

    if (!productName.trim() || !uom.trim() || defaultRate === "") {
      setError("Product Name, UOM, and Default Rate are required.");
      setSubmitLoading(false);
      return;
    }

    try {
      if (editingProduct) {
        // UPDATE
        const response = await appsScriptClient.updateProduct({
          productId: editingProduct.ProductID,
          productName: productName.trim(),
          category: category.trim(),
          uom: uom.trim(),
          defaultRate: Number(defaultRate),
          active
        });
        if (response.success) {
          setIsModalOpen(false);
          loadProducts();
        } else {
          setError(response.error || "Failed to update product details.");
        }
      } else {
        // CREATE
        const response = await appsScriptClient.createProduct({
          productName: productName.trim(),
          category: category.trim(),
          uom: uom.trim(),
          defaultRate: Number(defaultRate),
          active
        });
        if (response.success) {
          setIsModalOpen(false);
          loadProducts();
        } else {
          setError(response.error || "Failed to add new product.");
        }
      }
    } catch (err) {
      console.error(err);
      setError("Network connection error. Try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center space-x-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <span>Manage Products</span>
          </h1>
          <p className="text-xs text-muted-foreground">Manage active product listings, categories, and rates.</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadProducts}
            className="p-2 border border-border rounded-lg hover:bg-secondary text-muted-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          
          <button
            onClick={openAddModal}
            className="flex items-center space-x-1.5 py-2 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 text-xs transition-all shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {error && !isModalOpen && (
        <div className="flex items-center space-x-2 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive border border-destructive/20">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Product List Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-t-transparent border-primary rounded-full animate-spin"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mx-auto opacity-20 mb-3" />
          <p className="font-medium text-sm">No products added yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((prod) => (
            <div key={prod.ProductID} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-semibold">ID: {prod.ProductID}</span>
                  <h3 className="text-base font-bold text-foreground">{prod.ProductName}</h3>
                  <p className="text-xs text-muted-foreground flex items-center space-x-1">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Unit: {prod.UOM}</span>
                  </p>
                </div>
                <button
                  onClick={() => openEditModal(prod)}
                  className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5">
                    <Percent className="h-4 w-4 text-green-500" />
                    <span className="font-extrabold text-foreground">{formatCurrency(prod.DefaultRate)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-secondary/80 px-2 py-0.5 rounded text-[10px] text-muted-foreground">{prod.Category}</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                      prod.Active === "Yes" 
                        ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/20 dark:text-green-400" 
                        : "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-400"
                    }`}>
                      {prod.Active === "Yes" ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setPricingProductId(prod.ProductID)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/50 py-2 text-xs font-bold text-foreground hover:bg-secondary active:bg-secondary/80 transition-colors"
                >
                  <Store className="h-3.5 w-3.5" /> Set Shop Rates
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shop Pricing Modal */}
      <Modal
        isOpen={pricingProductId !== null}
        onClose={() => setPricingProductId(null)}
        title={`Shop Pricing: ${products.find((p) => p.ProductID === pricingProductId)?.ProductName || ""}`}
      >
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">Set different rates per shop. Leave blank to use default rate ({formatCurrency(products.find((p) => p.ProductID === pricingProductId)?.DefaultRate || 0)}).</p>
          {shops.map((shop) => {
            const rate = pricingProductId ? getShopRate(shop.ShopID, pricingProductId) : undefined;
            return (
              <div key={shop.ShopID} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-bold">{shop.ShopName}</p>
                  <p className="text-[10px] text-muted-foreground">{rate !== undefined && rate !== products.find((p) => p.ProductID === pricingProductId)?.DefaultRate ? `Custom: ${formatCurrency(rate)}` : "Using default"}</p>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rate ?? ""}
                  onChange={(e) => pricingProductId && updateShopRate(shop.ShopID, pricingProductId, Number(e.target.value || 0))}
                  placeholder={String(products.find((p) => p.ProductID === pricingProductId)?.DefaultRate || 0)}
                  className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm font-bold text-right outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            );
          })}
          <button type="button" onClick={() => setPricingProductId(null)} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground">Done</button>
        </div>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? "Edit Product Details" : "Add New Product"}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="flex items-center space-x-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20">
              <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">Product Name</label>
            <div className="relative">
              <Package className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Fresh Apples"
                className="w-full pl-9 pr-3 py-2 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">Category</label>
              <div className="relative">
                <Tag className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Fruits"
                  className="w-full pl-9 pr-3 py-2 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">Unit of Measure (UOM)</label>
              <input
                type="text"
                required
                value={uom}
                onChange={(e) => setUom(e.target.value)}
                placeholder="KG, Litre, Packet"
                className="w-full px-3 py-2 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">Default Rate (TSh)</label>
              <input
                type="number"
                required
                step="0.01"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="150"
                className="w-full px-3 py-2 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1">Status</label>
              <select
                value={active}
                onChange={(e) => setActive(e.target.value as "Yes" | "No")}
                className="w-full px-3 py-2 border border-input rounded-xl bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="Yes">Active</option>
                <option value="No">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className="flex items-center space-x-1 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 text-xs disabled:opacity-50"
            >
              {submitLoading ? (
                <div className="h-3.5 w-3.5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
              ) : (
                <span>Save</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default ManageProducts;

"use client";
import { Plus, Trash2 } from "lucide-react";
import type { MaterialItem } from "@/domain/types";
export function MaterialEditor({
  items,
  onChange,
}: {
  items: MaterialItem[];
  onChange: (items: MaterialItem[]) => void;
}) {
  const patch = (id: string, field: keyof MaterialItem, value: string) =>
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  return (
    <div className="material-editor full-span">
      <h3>Explicit material quantities</h3>
      <p className="muted">
        Use construction quantities reviewed by your estimator. Quote elevation
        area is not a board cutting list.
      </p>
      {items.map((item, i) => (
        <section className="quote-line" key={item.id}>
          <div className="quote-line-heading">
            <span className="line-number">{i + 1}</span>
            <input
              aria-label={`Material description ${i + 1}`}
              required
              value={item.description}
              onChange={(e) => patch(item.id, "description", e.target.value)}
              placeholder="Material, component or SKU specification"
            />
            <button
              type="button"
              className="icon-button danger-text"
              aria-label={`Remove material ${i + 1}`}
              onClick={() => onChange(items.filter((v) => v.id !== item.id))}
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div className="line-grid">
            {(["sku", "quantity", "unit", "unitCost"] as const).map((key) => (
              <label className="line-input" key={key}>
                <span>
                  {
                    {
                      sku: "SKU / model",
                      quantity: "Quantity",
                      unit: "Unit",
                      unitCost: "Unit cost (INR)",
                    }[key]
                  }
                </span>
                <input
                  aria-label={`Material ${key} ${i + 1}`}
                  required={key !== "sku"}
                  type={
                    ["quantity", "unitCost"].includes(key) ? "number" : "text"
                  }
                  min={key === "quantity" ? "0.00000001" : "0"}
                  step="any"
                  value={item[key]}
                  onChange={(e) => patch(item.id, key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </section>
      ))}
      <button
        type="button"
        className="button add-line"
        onClick={() =>
          onChange([
            ...items,
            {
              id: crypto.randomUUID(),
              description: "",
              sku: "",
              quantity: "1",
              unit: "piece",
              unitCost: "0",
              received: "0",
            },
          ])
        }
      >
        <Plus size={15} />
        Add material item
      </button>
    </div>
  );
}

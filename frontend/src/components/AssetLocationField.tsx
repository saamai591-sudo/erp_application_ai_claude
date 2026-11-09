import { useEffect, useState } from "react";
import { GoodsGroupNode, GoodsGroupPicker } from "./GoodsGroupPicker";
import { api } from "../lib/api";

// انتخابگر درختی «موقعیت دارایی» (دارایی ثابت › تنظیمات › درخت موقعیت دارایی): هر گره‌ی فعالی قابل انتخاب است. همان دیالوگ درختی گروه کالا را استفاده می‌کند.

export interface AssetLocationNode extends GoodsGroupNode {
  isActive: boolean;
}

export function AssetLocationField({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [nodes, setNodes] = useState<AssetLocationNode[]>([]);
  useEffect(() => {
    api.get("/asset-locations").then(setNodes).catch(() => setNodes([]));
  }, []);
  return (
    <GoodsGroupPicker
      groups={nodes}
      value={value}
      onSelect={(n) => onChange(String(n.id))}
      onClear={() => onChange("")}
      selectable={(n) => n.isActive}
      title="انتخاب موقعیت دارایی"
      placeholder="انتخاب شاخه‌ی موقعیت"
      disabled={disabled}
    />
  );
}

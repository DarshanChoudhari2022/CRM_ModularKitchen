import type { CRMRecord } from "./types";
export function kitchenCatalog(): CRMRecord[] {
  const groups: [string,string,string[]][] = [
    ["Cabinets","ft2",["Base cabinet carcass","Wall cabinet carcass","Tall pantry cabinet","Loft cabinet","Island cabinet","Sink base cabinet","Corner base cabinet"]],
    ["Shutters","ft2",["Laminate shutter","Acrylic shutter","PU painted shutter","Veneer shutter","Glass frame shutter","Aluminium profile shutter"]],
    ["Hardware","set",["Soft close hinges","Drawer channel set","Tandem drawer","Cutlery tray","Bottle pullout","Corner carousel","Tall pantry pullout","Dish rack","Wicker basket","Waste bin pullout"]],
    ["Surfaces","ft2",["Granite countertop","Quartz countertop","Backsplash","Breakfast counter"]],
    ["Accessories","piece",["Sink","Kitchen faucet","Cabinet handle","Hob","Chimney","Built in oven","Dishwasher"]],
    ["Finishing","ft",["Skirting","Gola profile","Edge banding","LED profile lighting"]],
    ["Services","package",["Site measurement","Kitchen design consultation","Delivery and handling","Kitchen installation","Old kitchen dismantling","Appliance installation","Maintenance visit"]],
  ];
  const at=new Date().toISOString();
  return groups.flatMap(([category,unit,names])=>names.map((name,i)=>({id:crypto.randomUUID(),kind:"catalog" as const,name,status:"Draft",sku:`HT-${category.toUpperCase()}-${String(i+1).padStart(3,"0")}`,category,unit,rate:"0",cost:"0",taxRate:"0",hsn:"",notes:unit==="ft2" ? "Record width and height in mm; depth and thickness by approved specification. Verify selling rate and tax classification before publishing." : "Confirm size, brand, finish, inclusions and selling rate before publishing.",createdAt:at,updatedAt:at})));
}
